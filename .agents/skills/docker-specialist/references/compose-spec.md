# Compose Specification Reference (2026 Standards)

The modern standard for defining multi-container Docker applications is the **Compose Specification** (`compose-spec.io`).

---

## 1. File Naming & Version Element Deprecation

- **Canonical Filename:** Use `compose.yaml` (or `compose.override.yaml` for local overrides). `docker-compose.yml` is maintained solely for legacy backward compatibility.
- **Top-Level `version` is Obsolete:** Do **not** declare `version: "3.8"` or any version string at the top of the file. The modern Docker Compose engine ignores it or emits deprecation warnings.

---

## 2. Healthchecks & Startup Orchestration

Standard `depends_on` only verifies that a container process has started—not that the service (e.g., PostgreSQL or Redis) is accepting socket connections. Always combine `healthcheck` with `condition: service_healthy`.

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-appuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret}
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - backend

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-appuser}:${POSTGRES_PASSWORD:-secret}@db:5432/${POSTGRES_DB:-appdb}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend
      - frontend

volumes:
  pgdata:

networks:
  frontend:
  backend:
    internal: false
```

---

## 3. Real-Time Development: Compose Watch (`develop.watch`)

`docker compose watch` provides native file monitoring and synchronisation into containers without requiring third-party tools (like nodemon running on the host).

```yaml
services:
  web:
    build:
      context: .
      target: dev
    ports:
      - "3000:3000"
    develop:
      watch:
        # Sync changed frontend files directly into container filesystem
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - node_modules/
        # Rebuild container image if dependencies or package manifests change
        - action: rebuild
          path: ./package.json
        # Sync configuration and restart service process
        - action: sync+restart
          path: ./config.json
          target: /app/config.json
```
*Run watch command:*
`docker compose watch`

---

## 4. Storage Architecture: Volumes vs Bind Mounts

| Storage Type | Purpose | Best Practices |
| :--- | :--- | :--- |
| **Named Volumes** | Persistent application data (Databases, uploaded media, caches). | Let Docker manage the storage path (`volumes: pgdata:`). Immune to host file permission collisions. |
| **Bind Mounts** | Source code mapping during development. | Format: `./src:/app/src:cached`. Always add `:ro` (read-only) for configuration files or certificates. |
| **Anonymous Volumes** | Masking subdirectories inside bind mounts. | Use `- /app/node_modules` to prevent host directory from overwriting container-installed dependencies. |
| **tmpfs** | High-speed temporary memory storage. | Use for ephemeral caches or sensitive session tokens (`tmpfs: /tmp`). |

---

## 5. Security & Network Segmentation

Never expose database ports to the host (`0.0.0.0`) in multi-container setups unless explicitly required for external debugging. Use internal bridge networks:

```yaml
services:
  db:
    image: mariadb:11.4
    networks:
      - backend  # Only accessible to other services on 'backend'
    # Do NOT declare 'ports: 3306:3306' here for production/secure setups

  app:
    image: my-app:latest
    ports:
      - "8080:80"  # Expose only public gateway
    networks:
      - frontend
      - backend

networks:
  frontend:
  backend:
    internal: true # Disallows external outbound/inbound internet access
```

---

## 6. Secrets and Environment Variable Best Practices

1. **Hierarchical `env_file` (Cascading Overrides):**
   In modern Compose Specification, `env_file` accepts an ordered list of files. Later files override values defined in earlier files. Always use `required: false` so missing local override files do not break CI/CD:
   ```yaml
   services:
     app:
       env_file:
         - path: .env
           required: false       # Shared base configuration
         - path: .env.local
           required: false       # Overrides secrets locally (ignored in git)
   ```
2. **Variable Interpolation with Fallbacks:** `${VARIABLE_NAME:-default_value}`.
3. **Explicit Container & Image Names:**
   Declare `container_name:` and `image:` for ergonomic terminal workflows (`docker ps`, `docker logs`):
   ```yaml
   services:
     app:
       container_name: myapp-service
       image: myapp-service:dev
   ```
4. **Compose Secrets:**
   ```yaml
   services:
     web:
       image: my-app
       secrets:
         - db_password

   secrets:
     db_password:
       file: ./secrets/db_password.txt
   ```
   *Available inside container at `/run/secrets/db_password`.*

