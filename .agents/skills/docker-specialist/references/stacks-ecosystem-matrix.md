# Stacks & Ecosystem Matrix: Canonical Docker Configurations

This reference details battle-tested configurations for major application stacks and database engines.

---

## 1. Next.js: Complete Dual-Environment (Dev & Production)

Next.js applications can be containerized for two distinct goals:
1. **Development Environment (`Dockerfile.dev`):** Live code reloading, Turbopack, Fast Refresh, and full `devDependencies`.
2. **Production Environment (`Dockerfile`):** Ultra-small footprint using Next.js **standalone output**, multi-stage build, and non-root execution.

### Next.js Standalone Configuration

Ensure `output: 'standalone'` is configured:

**In `next.config.ts` (Next.js 15+ TypeScript standard):**
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

**In `next.config.js` / `next.config.mjs`:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
module.exports = nextConfig;
```

---

### A. Development Dockerfile (`Dockerfile.dev`)
Optimized for developer experience, Fast Refresh over WebSocket, and cache mounts:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install dependencies (including devDependencies) with BuildKit cache
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY . .

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=development

EXPOSE 3000
CMD ["npm", "run", "dev"]
```

---

### B. Production Dockerfile (`Dockerfile`)
Extracts Next.js standalone output to run a minimal ~120MB Node server without `node_modules`:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

---

### C. Compose Orchestration with Hierarchical `env_file`

In `compose.yaml`, use the native Next.js `.env` cascading hierarchy where `.env.local` overrides `.env`:

```yaml
services:
  app:
    container_name: nextjs-app
    image: nextjs-app:dev
    build:
      context: .
      dockerfile: Dockerfile.dev   # Switch to Dockerfile for testing standalone production builds
    ports:
      - "3000:3000"
    env_file:
      - path: .env
        required: false            # Base configuration
      - path: .env.local
        required: false            # Overrides base secrets locally (ignored in git)
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: sync
          path: ./public
          target: /app/public
        - action: rebuild
          path: ./package.json

  db:
    container_name: nextjs-db
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-appuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-apppass}
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped

volumes:
  pgdata:
```

---

### D. Essential Operational Commands

```bash
# 1. Start development with automatic file synchronization (Compose Watch)
docker compose watch app

# 2. Build and run all services in detached background mode
docker compose up --build -d

# 3. Build standalone production image directly
docker build --tag nextjs-app:latest .

# 4. Run production container directly with port binding
docker run -p 3000:3000 nextjs-app:latest

# 5. Run detached with custom container name
docker run -d -p 3000:3000 --name nextjs-app nextjs-app:latest
```

---

## 2. WordPress + PHP-FPM + Nginx

WordPress production architecture requires separating PHP execution (`wordpress:fpm-alpine`) from HTTP static delivery and TLS termination (`nginx:alpine`), backed by `mariadb`.

### Dockerfile (WordPress Custom FPM with Extensions)
```dockerfile
# syntax=docker/dockerfile:1
FROM wordpress:php8.3-fpm-alpine

# Install persistent runtime tools and compile-time build dependencies
RUN apk add --no-cache \
        libzip-dev \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        icu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        gd \
        zip \
        intl \
        opcache \
        exif \
        bcmath

# Production OPcache configuration
RUN { \
    echo 'opcache.memory_consumption=128'; \
    echo 'opcache.interned_strings_buffer=8'; \
    echo 'opcache.max_accelerated_files=10000'; \
    echo 'opcache.revalidate_freq=2'; \
    echo 'opcache.fast_shutdown=1'; \
    echo 'opcache.enable_cli=1'; \
} > /usr/local/etc/php/conf.d/opcache-recommended.ini
```

### Essential compose.yaml for WordPress
```yaml
services:
  database:
    image: mariadb:11.4
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpass}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-wordpress}
      MYSQL_USER: ${MYSQL_USER:-wpuser}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-wppass}
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  wordpress:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      WORDPRESS_DB_HOST: database:3306
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE:-wordpress}
      WORDPRESS_DB_USER: ${MYSQL_USER:-wpuser}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD:-wppass}
    volumes:
      - wp_data:/var/www/html
    depends_on:
      database:
        condition: service_healthy
    networks:
      - backend

  webserver:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - wp_data:/var/www/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - wordpress
    networks:
      - backend
      - frontend

volumes:
  db_data:
  wp_data:

networks:
  frontend:
  backend:
```

---

## 3. Node.js API (TypeScript / Express / Fastify / NestJS)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM deps AS builder
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER appuser
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

---

## 4. Python (FastAPI / Django / Flask)

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on

RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid 1001 --create-home appuser

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY --chown=appuser:appuser . .
USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 5. Go (Minimal Distroless / Scratch)

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS builder
WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata
COPY go.mod go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /bin/server .

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /bin/server /bin/server

EXPOSE 8080
ENTRYPOINT ["/bin/server"]
```

---

## 6. Databases Reference Table

| Engine | Canonical Image | Standard Port | Reliable Healthcheck Test | Default Data Directory |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `postgres:17-alpine` | `5432` | `["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]` | `/var/lib/postgresql/data` |
| **MySQL** | `mysql:8.4` | `3306` | `["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-u", "root", "-p$$MYSQL_ROOT_PASSWORD"]` | `/var/lib/mysql` |
| **MariaDB** | `mariadb:11.4` | `3306` | `["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]` | `/var/lib/mysql` |
| **MongoDB** | `mongo:7.0` | `27017` | `["CMD-SHELL", "mongosh --eval 'db.adminCommand(\"ping\")' || exit 1"]` | `/data/db` |
| **Redis** | `redis:7.4-alpine` | `6379` | `["CMD", "redis-cli", "ping"]` | `/data` |
