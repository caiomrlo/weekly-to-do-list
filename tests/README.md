# Test Suite Architecture

This directory houses the automated test suites for **Weekly To-Do List**.

## Directory Structure

```text
tests/
├── README.md                      # Test documentation and developer guidelines
├── unit/                          # Unit Tests: isolated, fast, zero I/O
│   └── lib/                       # Unit tests mirroring src/lib/
│       ├── date-utils.test.ts     # Date arithmetic, calendar boundaries, durations
│       ├── r2.test.ts             # File sanitization & S3 storage path generation
│       └── auth.test.ts           # Password hashing & JWT signing/verification
└── integration/                   # Integration Tests: PostgreSQL DB + Next.js Server Actions
    ├── setup/                     # Test database connection, auth helpers & mocks
    │   ├── test-db.ts             # Database connection & atomic cascade cleanup
    │   ├── auth-helper.ts         # User factory & JWT session simulation
    │   └── mocks.ts               # Next.js cookies/cache/navigation & Cloudflare R2 mocks
    ├── actions/                   # Server Actions integration tests
    │   ├── auth.test.ts           # Registration, login, logout & session cookies
    │   ├── user.test.ts           # User preferences JSONB updates & persistence
    │   ├── projects.test.ts       # Projects CRUD, color palettes & multi-tenant isolation
    │   ├── tags.test.ts           # Tags CRUD & multi-tenant isolation
    │   ├── tasks.test.ts          # Tasks CRUD, 1-level subtask hierarchy, DnD, cascade
    │   ├── docs.test.ts           # Docs CRUD, search/favorite filters & task linking
    │   └── attachments.test.ts    # File uploads, R2 client mocks & relational junctions
    ├── api/                       # API Route Handler integration tests
    │   └── attachments-route.test.ts # GET /api/attachments/[id] redirect/thumbnail URLs
    └── db/                        # Database schema & constraint validation
        └── schema-integrity.test.ts  # Cascade deletions, set-null relations & unique indexes
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
3. **Multi-Tenant Security**: Every entity action must assert that cross-user mutations or queries are denied.
4. **Zero Unhandled Side Effects**: External cloud storage (Cloudflare R2) and Next.js internal runtime contexts (`cookies()`, `revalidatePath()`) are reliably mocked in `tests/integration/setup/mocks.ts`.
