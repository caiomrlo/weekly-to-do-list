---
name: production-docker-deploy
description: Prepares, audits, and optimizes web applications (Next.js, Node.js, full-stack) for production container deployment across any platform (Easypanel, Coolify, Docker Compose VPS, Railway, Render, Cloud Run). Covers automated database migrations on startup with connection retry loops, internal service networking (PostgreSQL, MySQL, Redis), environment variables, standalone multi-stage Docker builds, reverse proxy port routing, and OOM/swap tuning. Activate when preparing a project for deployment, troubleshooting build/runtime container errors, or configuring Dockerfile/migration scripts for production apps. Do not use for raw Kubernetes cluster administration.
---

# Production Container Deployment (PaaS & Docker)

This skill guides AI agents and developers through auditing, containerizing, and deploying web applications to production across **any Docker-compatible platform or PaaS** (Easypanel, Coolify, standard VPS with Docker Compose, Railway, Render, Cloud Run) with maximum reliability, zero-downtime database migrations, and portable container architecture.

---

## Core Principles & Directives

> [!IMPORTANT]
> **1. THE STANDALONE RUNNER MIGRATION GAP**
> When using multi-stage Dockerfiles (e.g., Next.js `output: "standalone"`), build tools (`drizzle-kit`, `prisma CLI`, `tsx`, devDependencies) and raw migration folders are **not** bundled into the runner image by default.
> Connecting the container to a fresh database in production will fail with HTTP 500 if tables are missing.
> **Rule:** Always ensure the production Dockerfile copies migration files and executes an automated, lightweight, idempotent migration step before launching the web server process.

> [!IMPORTANT]
> **2. GRACEFUL PROCESS EXECUTION (EXEC & SIGTERM)**
> Always use `exec` when chaining commands in container entrypoints or CMDs:
> `CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]`
> Without `exec`, the shell process remains PID 1, swallowing `SIGTERM` signals and preventing graceful container shutdowns across all orchestrators (Docker, Traefik, Kubernetes, Easypanel, Coolify).

> [!IMPORTANT]
> **3. DATABASE RETRY LOOP (AVOID CRASH LOOPS)**
> When application and database services start simultaneously or after a server reboot, the database (PostgreSQL/MySQL) can take 3–10 seconds to accept TCP connections.
> Startup migration scripts **must** implement a connection retry loop (e.g. 5 attempts with 3s intervals) to avoid crashing the application container during initial database boot.

> [!IMPORTANT]
> **4. PORT BINDING & HOSTNAME**
> Modern reverse proxies (Traefik, Nginx, Caddy) and cloud platforms route traffic to the container's private port.
> - The application **must** listen on `0.0.0.0` (NOT `localhost` / `127.0.0.1`).
> - The port exposed by the container (`PORT=3000`, `PORT=8080`, etc.) must match the target port configured in the platform's routing/networking section.

---

## Universal Pre-Deployment Checklist

Before deploying any repository to any platform, review these 6 items:

| # | Check | Requirement |
|---|-------|-------------|
| 1 | **Build Strategy** | Use a multi-stage `Dockerfile` with minimal production runner for complete control, or platform auto-detection (Railpack/Nixpacks) if no custom Dockerfile is needed. |
| 2 | **Database Migration** | Ensure an automated startup script or migration command is embedded so tables are auto-created on first boot. |
| 3 | **Port Configuration** | Ensure `HOSTNAME="0.0.0.0"` and container port (e.g. `3000`) matches the reverse proxy routing port. |
| 4 | **Internal Networking** | In multi-service setups, use internal network hostnames (e.g., `postgres:5432` or platform internal DNS), never `localhost`. |
| 5 | **Environment Secrets** | Set production secrets (`DATABASE_URL`, `AUTH_SECRET`, `NODE_ENV=production`) in platform environment variables, never hardcoded in the image. |
| 6 | **Context Sanitization** | Ensure `.dockerignore` exists and excludes `.env*`, `.git/`, and `node_modules/`. |

---

## Universal Architecture Patterns

### Pattern A: Next.js Standalone + Drizzle ORM Auto-Migration

For Next.js App Router with Drizzle ORM, follow this battle-tested pattern:

#### 1. Migration Runner (`scripts/migrate.mjs`)
Uses runtime dependencies (`drizzle-orm` and `pg`), avoiding bulky dev CLI tools (`drizzle-kit`):

```javascript
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL not set. Skipping migrations.");
    return;
  }

  console.log("🚀 Checking and applying database migrations...");
  let pool = null;
  let success = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
      const client = await pool.connect();
      client.release();

      const db = drizzle(pool);
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("✅ Migrations applied successfully!");
      success = true;
      break;
    } catch (error) {
      console.warn(`⏳ Attempt ${attempt}/${MAX_RETRIES} failed (${error.message}). Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      if (pool) {
        try { await pool.end(); } catch {}
      }
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  if (pool && success) {
    try { await pool.end(); } catch {}
  }

  if (!success) {
    console.error("❌ Could not connect to database or apply migrations.");
    process.exit(1);
  }
}

runMigrations();
```

#### 2. Production Dockerfile
```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci

# 2. Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# 3. Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy runtime assets and standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migrations and migration engine
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs

USER nextjs
EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
```

---

### Pattern B: Prisma ORM Auto-Migration

For projects using Prisma ORM:

In the Dockerfile runner stage, ensure the Prisma schema and generated engines are present:
```dockerfile
# In runner stage:
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# Execute prisma migrate deploy before starting:
CMD ["sh", "-c", "npx prisma migrate deploy && exec node server.js"]
```

---

## Platform-Specific Deployment Guides

### 1. Self-Hosted PaaS (Easypanel, Coolify, Dokku, CapRover)
1. **Database Service**: Add a PostgreSQL/MySQL service. Note its internal service name (e.g. `postgres`).
2. **App Service**:
   - Set source to Git/GitHub repo.
   - Builder: **Dockerfile**.
3. **Environment**:
   - `DATABASE_URL`: `postgresql://<user>:<password>@<internal-service-name>:5432/<dbname>`
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
4. **Domains / Routing**: Map your domain/subdomain and specify the container target port (`3000`).

### 2. Standalone VPS with Docker Compose
1. Use a production `compose.yaml`:
   ```yaml
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - DATABASE_URL=postgresql://user:pass@db:5432/appdb
         - NODE_ENV=production
       depends_on:
         db:
           condition: service_healthy

     db:
       image: postgres:17-alpine
       environment:
         - POSTGRES_USER=user
         - POSTGRES_PASSWORD=pass
         - POSTGRES_DB=appdb
       volumes:
         - pgdata:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U user -d appdb"]
         interval: 5s
         retries: 5
   volumes:
     pgdata:
   ```
2. Start with `docker compose up -d --build`.

### 3. Cloud PaaS (Railway, Render, Cloud Run)
1. Link GitHub repository.
2. Under Variables, provide `DATABASE_URL` (using the managed DB connection string) and `AUTH_SECRET`.
3. The platform automatically detects the `Dockerfile`, builds it with BuildKit, and runs the pre-start migration seamlessly.

---

## Troubleshooting Reference

### 1. Build Fails with Exit Code 137 (OOM / Out of Memory)
- **Cause:** Next.js compilation or asset bundling exceeded available RAM during Docker build.
- **Solution:** 
  - Enable/increase swap memory on the host server (`swapoff -a && swapon -a` or add a 2GB–4GB swap file).
  - Check memory/CPU limits assigned to the build runner.

### 2. HTTP 502 Bad Gateway
- **Cause:** Reverse proxy cannot reach the container on the configured port.
- **Checklist:**
  - Verify the container process binds to `0.0.0.0` (NOT `localhost` or `127.0.0.1`).
  - Verify the port configured in the platform's routing panel matches the container's exposed port.
  - Review container logs to verify the app didn't crash during startup.

### 3. Connection Refused to Database on Startup
- **Cause:** App container booted before database finished initializing, or `localhost` was used instead of the internal service name.
- **Checklist:**
  - Ensure the hostname in `DATABASE_URL` uses the internal service name, not `localhost`.
  - Ensure your migration script has a retry loop (Pattern A) to absorb database startup latency.

### 4. Code Changes Not Reflected After Deploy
- **Solution:** Force rebuild without build cache (e.g. "Force Rebuild" in Easypanel/Coolify or `--no-cache` in Docker).
