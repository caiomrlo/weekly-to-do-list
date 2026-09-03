# Docker Troubleshooting & Diagnostic Decision Tree

This guide equips agents with triage procedures to diagnose and fix failing Docker environments.

---

## 1. Quick Diagnostic Triage Commands

When an environment fails to build or boot, execute these inspection commands:

```bash
# 1. Check status and health of all services
docker compose ps -a

# 2. Inspect failing service logs (last 100 lines + follow)
docker compose logs --tail=100 <service_name>

# 3. Inspect container exit codes and healthcheck details
docker inspect $(docker compose ps -q <service_name>) --format='{{json .State}}'

# 4. Open an interactive shell inside a running container
docker compose exec <service_name> sh
# Or if container fails to start, override entrypoint
docker compose run --rm --entrypoint sh <service_name>
```

---

## 2. Common Failure Modes & Solutions

### A. Permission Denied / `EACCES` on Mounted Volumes
- **Symptom:** Application fails to write to `/app/node_modules`, `/var/www/html/wp-content/uploads`, or `/data/db`.
- **Root Cause:** Host directory UID/GID does not match container non-root user UID/GID.
- **Solution:**
  1. If using named volumes, Docker manages ownership automatically. Prefer named volumes over host bind mounts for database data or generated caches.
  2. If using host bind mounts for development, align container user with host user:
     ```yaml
     services:
       app:
         user: "${CURRENT_UID:-1000}:${CURRENT_GID:-1000}"
     ```
  3. For WordPress / PHP-FPM: Ensure files in `/var/www/html` are owned by `www-data:www-data` (UID 33).

---

### B. `Connection Refused` or Database Race Conditions
- **Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:5432` or `Can't connect to MySQL server`.
- **Root Cause:** 
  1. The app is attempting to connect to `127.0.0.1` or `localhost`. Inside a container, `localhost` points to that specific container, not other services!
  2. The database container is booting and its process started, but the database engine is still initializing tables and rejecting connections.
- **Solution:**
  1. Change host from `localhost` to the Compose service name (e.g. `db`, `database`, `postgres`).
  2. Implement an explicit `healthcheck` on the database service and add `condition: service_healthy` to `depends_on`.

---

### C. Port Already Allocated (`bind: address already in use`)
- **Symptom:** `Error response from daemon: driver failed programming external connectivity on endpoint ...: Bind for 0.0.0.0:80 failed: port is already allocated`.
- **Root Cause:** Another service on the host machine is listening on the requested port (e.g., local Apache, IIS, another Docker container).
- **Solution:**
  1. Remap the host port in `compose.yaml` (e.g., change `"80:80"` to `"8080:80"` or `"3000:3000"` to `"3001:3000"`).
  2. Or identify and terminate the host process using that port.

---

### D. Container Exits Immediately with Code 0 or 1
- **Symptom:** Container starts and immediately stops.
- **Root Cause:** The foreground process terminated. Common in services using `service nginx start` (which forks to background) instead of `nginx -g 'daemon off;'`, or Node scripts that finish execution.
- **Solution:** Ensure the CMD runs a non-daemonizing foreground process. For Nginx: `CMD ["nginx", "-g", "daemon off;"]`. For development containers without a long-running server: `command: ["tail", "-f", "/dev/null"]` during interactive troubleshooting.

---

### E. `OOMKilled` (Exit Code 137)
- **Symptom:** Container abruptly terminates with exit code 137.
- **Root Cause:** The container exceeded its memory limit or consumed all available host RAM (e.g., during `npm run build` or database memory spikes).
- **Solution:**
  1. Allocate explicit memory limits in `compose.yaml`:
     ```yaml
     deploy:
       resources:
         limits:
           memory: 2G
     ```
  2. Use `--max-old-space-size=4096` in `NODE_OPTIONS` for memory-intensive Node build steps.

---

### F. Slow Builds & Cache Invalidation
- **Symptom:** Docker takes 5-10 minutes on every build, downloading packages repeatedly.
- **Root Cause:** `COPY . .` is placed before `npm install` or `pip install`, causing file modifications to bust the dependency layer cache.
- **Solution:**
  1. Copy only manifest files first (`package.json`, `package-lock.json`).
  2. Run dependency installation using `--mount=type=cache`.
  3. Only then copy the remaining source code (`COPY . .`).
  4. Ensure `.dockerignore` exists and excludes `.git`, `node_modules`, and local build artifacts.
