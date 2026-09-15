# Test Suite Architecture

This directory houses the automated test suites for **Weekly To-Do List**.

## Directory Structure

```text
tests/
├── README.md                      # Test documentation and developer guidelines
├── unit/                          # Unit Tests: isolated, fast, zero I/O
│   └── lib/                       # Pure utility tests mirroring src/lib/ (dates, recurrence, auth, R2, statuses)
└── integration/                   # Integration Tests: PostgreSQL DB + Next.js Server Actions & API
    ├── setup/                     # Test database connection, Better Auth helpers, workspace mocks
    ├── actions/                   # Server Actions tests (tasks, recurrence, statuses, projects, workspaces, etc.)
    ├── api/                       # API Route Handler tests (attachments, redirects)
    └── db/                        # Database schema & constraint validation (cascades, unique indexes)
```

## Test Tiers

- **`tests/unit/`**: Fast, deterministic tests that test pure functions and domain logic in isolation. These tests do not require a database connection, network access, or external services. Run in milliseconds.
- **`tests/integration/`**: Tests that verify multi-component interactions, database queries (Drizzle ORM + PostgreSQL), Next.js Server Actions, and API Route Handlers. Each test operates with isolated test users and automatic cascade cleanup.
- **`tests/e2e/`** *(Future)*: End-to-end browser flows and user journeys (e.g., Playwright).

## Available Commands

- **Run all tests (unit + integration)**:
  ```bash
  npm test
  ```
- **Run unit tests only**:
  ```bash
  npm run test:unit
  ```
- **Run integration tests only**:
  ```bash
  npm run test:integration
  ```
- **Run tests in interactive watch mode**:
  ```bash
  npm run test:watch
  ```
- **Run a specific test file**:
  ```bash
  npx vitest run tests/integration/actions/tasks.test.ts
  ```

## Standards & Best Practices

1. **Deterministic & Isolated**: Each integration test creates dedicated test users with random UUIDs and cleans them up using `cleanupTestUser`, triggering atomic database foreign key cascades.
2. **Explicit Imports**: Always explicitly import test utilities from `vitest` (`import { describe, it, expect } from "vitest"`).
3. **Multi-Tenant & Workspace Isolation**: Every entity action must assert that cross-user and cross-workspace mutations or queries are denied.
4. **Zero Unhandled Side Effects**: External cloud storage (Cloudflare R2) and Next.js internal runtime contexts (`cookies()`, `revalidatePath()`) are reliably mocked in `tests/integration/setup/mocks.ts`.
