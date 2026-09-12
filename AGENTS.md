<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Architecture & Workflow Guidelines

## 1. Mandatory Architecture Review Before Any Task
- **Always read [ARCHITECTURE.md](./ARCHITECTURE.md) before starting any new task, feature, or refactoring.**
- Familiarize yourself with the project structure, components, data models, Server Actions, state flow, and security rules outlined in `ARCHITECTURE.md` before proposing or writing code.

## 2. Database Schema & Migration Workflow
Whenever a task requires changes to the database structure (adding tables, altering columns, new relations):
1. **Update Schema**: Edit `src/db/schema.ts` with the new Drizzle table definitions or schema modifications.
2. **Run Migrations at the Start**: Run the migration commands immediately after updating schemas before implementing business logic:
   - `npm run db:generate`: Generates the migration SQL files in the `drizzle/` directory.
   - `npm run db:migrate`: Executes and applies the generated migrations to the database.

## 3. Post-Task Verification Commands
Always validate your changes before considering a task completed:
- **`npm run test:unit`**:
  - **When to use**: After modifying utilities in `src/lib/` (date arithmetic, auth helpers, R2 client). Fast, zero-I/O validation.
- **`npm run test:integration`**:
  - **When to use**: After editing Server Actions, database queries, schemas, or API routes. Validates transactions against PostgreSQL and Next.js/R2 mocks.
- **`npm run lint`**:
  - **When to use**: After finishing code edits in TypeScript/TSX/JavaScript files.
  - **Purpose**: Checks for ESLint errors, code quality issues, unused variables, and Next.js lint rules.
- **`npm run build`**:
  - **When to use**: After completing feature implementations, refactoring, or schema changes.
  - **Purpose**: Validates full TypeScript type safety and tests the Next.js production build to ensure there are no compilation or route export errors.

## 4. Judicious Architecture Maintenance
- **Be Self-Critical When Updating [ARCHITECTURE.md](./ARCHITECTURE.md)**: When the user requests an update or after implementing changes, critically evaluate whether an update is truly warranted.
- **Do NOT update for trivial changes**: Minor bug fixes, cosmetic styling adjustments, small copy tweaks, or internal component logic tweaks that do not change system design should not trigger an architecture document rewrite.
- **DO update for significant architectural changes**:
  - New or modified database tables, schema relations, or migration strategies.
  - New core architectural layers, major feature modules, or routes.
  - Changes in authentication, session management, or authorization strategies.
  - Introduction of new infrastructure components, external integrations, services, or significant package additions.

## 5. Language & Localization Standard
- **English Everywhere**: All UI text, placeholder copy, button labels, notifications, toast messages, server action responses, error messages, and logs must be in English.

## 6. Strategic Code Commenting
- **Self-Documenting Code First**: Write clear, intention-revealing code (descriptive naming and modular structure) rather than adding explanatory comments.
- **Keep Only Essential Comments**:
  - **Allowed**: Non-obvious workarounds, browser quirks, external API edge cases, performance trade-offs, and critical security/regex constraints.
  - **Forbidden**: Comments that narrate *what* the code does, redundant descriptions, and dead/commented-out code. Always write retained comments in English.

## 7. Mandatory UI/UX Design Principles
Strictly adhere to cognitive load reduction and clean interface rules across all frontend views and components:
- **Inline Grouping Over Deep Card Nesting**: Prevent "card-inside-card" fatigue and heavy border stacking. Group related metadata, pills, and controls into compact, cohesive horizontal rows instead of wrapping them in nested containers.
- **Zero Redundant Labels / Clutter**: Eliminate obvious static meta-labels (e.g. "Description:", "Tags:") and explicit optionality markers like "(Optional)" whenever semantic icons, clean typography, formatted values, or contextual placeholders make the element self-explanatory.
- **Progressive Disclosure via Popovers**: Keep primary views high-signal and distraction-free. Secondary controls, advanced configurations, and tag/project pickers must be revealed on-demand through compact inline triggers and lightweight popovers rather than occupying permanent screen real estate.
- **Transient-Only Mutation Feedback**: Never leave static status indicators (e.g. permanent "Saved" text) polluting the layout. Feedback must be strictly transient and visible exclusively during active state transitions (e.g. animated `"Saving..."`), silently fading back to a clean state once resolved.


