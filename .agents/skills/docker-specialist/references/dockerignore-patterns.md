# .dockerignore Patterns & Context Optimization

The `.dockerignore` file prevents unnecessary files and sensitive data from being sent to the Docker daemon during the `docker build` context transfer phase.

---

## 1. Why `.dockerignore` is Critical

1. **Prevents Secret Leaks:** Stops `.env`, SSH keys, and local credentials from accidentally landing in image layers via `COPY . .`.
2. **Accelerates Build Speed:** Eliminates gigabytes of unnecessary local files (`node_modules/`, `.git/`, virtualenvs) transferred over the Docker socket.
3. **Protects Layer Caching:** Editing local temporary files or logs won't invalidate the `COPY . .` build cache.

---

## 2. Standard Production `.dockerignore`

Copy and adapt this template for any modern project:

```gitignore
# ==============================================================================
# 1. Version Control & CI/CD
# ==============================================================================
.git/
.gitignore
.gitattributes
.github/
.gitlab/
.circleci/

# ==============================================================================
# 2. Secrets & Environment Files (CRITICAL SECURITY)
# ==============================================================================
.env
.env.*
!.env.example
*.pem
*.key
*.crt
*.pfx
*.pub
id_rsa*
id_ed25519*
secrets/

# ==============================================================================
# 3. Local Dependencies & Package Managers
# ==============================================================================
node_modules/
vendor/
.venv/
env/
venv/
__pycache__/
*.pyc
*.pyo
*.pyd

# ==============================================================================
# 4. Build Outputs, Artifacts & Caches
# ==============================================================================
dist/
build/
out/
.next/
.nuxt/
.svelte-kit/
target/
bin/
obj/
coverage/
.nyc_output/
.turbo/
.cache/
.parcel-cache/
.pytest_cache/
.ruff_cache/
.mypy_cache/

# ==============================================================================
# 5. Local Logs, Temp & OS Files
# ==============================================================================
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
tmp/
temp/
.DS_Store
Thumbs.db
desktop.ini

# ==============================================================================
# 6. IDEs & Editors
# ==============================================================================
.vscode/
.idea/
*.sublime-project
*.sublime-workspace
.vim/
*.swp
*.swo

# ==============================================================================
# 7. Documentation & Miscellaneous
# ==============================================================================
README.md
CHANGELOG.md
LICENSE
docs/
*.md
!Dockerfile*
!compose*.yaml
!compose*.yml
```

---

## 3. The Strict Allowlist (Inverted) Pattern

For sensitive environments where you only want explicitly declared directories included in the Docker build context:

```gitignore
# Ignore everything by default
**

# Whitelist directories
!src/
!public/
!package.json
!package-lock.json
!tsconfig.json
!next.config.js
```

---

## 4. Syntax & Matching Rules

- **`#`**: Comments.
- **`*`**: Matches any string of non-slash characters.
- **`**`**: Matches zero or more directories.
- **`?`**: Matches any single non-slash character.
- **`!`**: Negates an exclusion (whitelists a pattern).
- Trailing slash (e.g. `dist/`): Matches directories only.
