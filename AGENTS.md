<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Architecture Guidelines

## 1. Mandatory Architecture Review Before Any Task
- **Always read [ARCHITECTURE.md](./ARCHITECTURE.md) before starting any new task, feature, or refactoring.**
- Familiarize yourself with the project structure, components, data models, Server Actions, state flow, and security rules outlined in `ARCHITECTURE.md` before proposing or writing code.

## 2. Judicious Architecture Maintenance
- **Be Self-Critical When Updating [ARCHITECTURE.md](./ARCHITECTURE.md)**: When the user requests an update or after implementing changes, critically evaluate whether an update is truly warranted.
- **Do NOT update for trivial changes**: Minor bug fixes, cosmetic styling adjustments, small copy tweaks, or internal component logic tweaks that do not change system design should not trigger an architecture document rewrite.
- **DO update for significant architectural changes**:
  - New or modified database tables, schema relations, or migration strategies.
  - New core architectural layers, major feature modules, or routes.
  - Changes in authentication, session management, or authorization strategies.
  - Introduction of new infrastructure components, external integrations, services, or significant package additions.
