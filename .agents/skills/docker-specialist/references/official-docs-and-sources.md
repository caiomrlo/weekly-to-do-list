# Official Documentation & Upstream Sources Reference

This document provides authoritative upstream documentation links and guidelines for active web research (`search_web`).

---

## 1. Core Authoritative Documentation

When consulting official specifications or confirming configuration keys, use these primary sources:

| Topic | Canonical Source URL | Key Sections to Consult |
| :--- | :--- | :--- |
| **Docker Compose Spec** | [compose-spec.io](https://compose-spec.io/) | Services, Healthcheck, Develop (Watch), Networks, Volumes |
| **Docker Official Docs** | [docs.docker.com](https://docs.docker.com/) | Dockerfile reference, BuildKit cache mounts, Multi-stage builds |
| **Docker Engine Security** | [docs.docker.com/engine/security](https://docs.docker.com/engine/security/) | Rootless mode, user namespaces, capability drops |
| **BuildKit Guide** | [docs.docker.com/build/buildkit](https://docs.docker.com/build/buildkit/) | Frontend syntax, cache backends, secrets |
| **Docker Hub Official Images** | [hub.docker.com/search?image_filter=official](https://hub.docker.com/search?image_filter=official) | Verified, maintained, hardened base images |

---

## 2. Official Image References by Stack

Always consult the official Docker Hub documentation for environment variable names, initialization hooks, and volume mount paths:

- **Node.js:** [hub.docker.com/_/node](https://hub.docker.com/_/node) & [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- **WordPress:** [hub.docker.com/_/wordpress](https://hub.docker.com/_/wordpress)
- **PHP:** [hub.docker.com/_/php](https://hub.docker.com/_/php) (Note: `docker-php-ext-install`, `docker-php-ext-enable`, `docker-php-ext-configure`)
- **PostgreSQL:** [hub.docker.com/_/postgres](https://hub.docker.com/_/postgres) (Note: `/docker-entrypoint-initdb.d/` scripts)
- **MySQL:** [hub.docker.com/_/mysql](https://hub.docker.com/_/mysql)
- **MariaDB:** [hub.docker.com/_/mariadb](https://hub.docker.com/_/mariadb) (Note: `healthcheck.sh` utility included)
- **MongoDB:** [hub.docker.com/_/mongo](https://hub.docker.com/_/mongo)
- **Redis:** [hub.docker.com/_/redis](https://hub.docker.com/_/redis)
- **Nginx:** [hub.docker.com/_/nginx](https://hub.docker.com/_/nginx)
- **Python:** [hub.docker.com/_/python](https://hub.docker.com/_/python)
- **Go / Golang:** [hub.docker.com/_/golang](https://hub.docker.com/_/golang)

---

## 3. Mandatory Active Research Protocols (`search_web`)

The agent **MUST** perform active web search in any of the following circumstances:

1. **Unknown or Unpinned Base Image:**
   When the user's project relies on a specific runtime version (e.g. Node 22, PHP 8.3, Python 3.12, Ruby 3.3), search to verify the latest stable official image tag:
   - Query pattern: `"docker hub <runtime> official image tags"` or `"<runtime> alpine slim docker tag"`
2. **Framework-Specific Containerization Quirks:**
   When a framework has dedicated Docker instructions (e.g. Next.js Standalone, Nuxt, Vite SSR, SvelteKit, Laravel Octane):
   - Query pattern: `"<framework> dockerfile official deployment docs"`
3. **Database Initialization or Healthcheck Flags:**
   When verifying healthcheck CLI commands for database images:
   - Query pattern: `"<database> docker compose healthcheck example"`
4. **Obscure Build Errors or Package Manager Deprecations:**
   When an `apk add`, `apt-get`, or `npm ci` fails during build:
   - Query pattern: `"docker build <exact error message snippet>"`
5. **New Docker Compose Features:**
   When checking the latest Compose Spec features:
   - Query pattern: `"docker compose spec <feature_name> documentation"`

---

## 4. Distinguishing Plausible Sources vs Outdated Tutorials

When reading articles or search results, filter by these criteria:

- ❌ **Reject / Avoid:**
  - Guides using `version: '3'` or `version: '2'` in compose files without explanation.
  - Tutorials instructing to run containers as `root` without security warnings.
  - Tutorials telling you to put database passwords or private API keys inside `ENV` or `ARG` in the Dockerfile.
  - Guides suggesting `wait-for-it.sh` or `dockerize` instead of native `condition: service_healthy`.
- ✅ **Favor / Trust:**
  - Official vendor documentation (`docs.docker.com`, `compose-spec.io`, official GitHub readmes).
  - Guides adhering to BuildKit cache mounts (`--mount=type=cache`).
  - Resources from 2024–2026 emphasizing non-root users, distroless/alpine runtimes, and healthcheck-driven orchestration.
