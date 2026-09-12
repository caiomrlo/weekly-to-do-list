# Test Suite Architecture

This directory houses the automated test suites for **Weekly To-Do List**.

## Directory Structure

```text
tests/
├── README.md                      # Test documentation and developer guidelines
└── unit/                          # Unit Tests: isolated, fast, zero I/O
    └── lib/                       # Unit tests mirroring src/lib/
        ├── date-utils.test.ts     # Date arithmetic, calendar boundaries, durations
        ├── r2.test.ts             # File sanitization & S3 storage path generation
        └── auth.test.ts           # Password hashing & JWT signing/verification
```

## Test Tiers

- **`tests/unit/`**: Fast, deterministic tests that test pure functions and domain logic in isolation. These tests do not require a database connection, network access, or external services. Run in milliseconds.
- **`tests/integration/`** *(Future)*: Tests that verify multi-component interactions, database queries (Drizzle ORM), and Next.js Server Actions.
- **`tests/e2e/`** *(Future)*: End-to-end browser flows and user journeys (e.g., Playwright).

## Available Commands

- **Run all unit tests**:
  ```bash
  npm test
  ```
- **Run tests in interactive watch mode**:
  ```bash
  npm run test:watch
  ```
- **Run a specific test file**:
  ```bash
  npx vitest run tests/unit/lib/date-utils.test.ts
  ```

## Standards & Best Practices

1. **Deterministic & Isolated**: Unit tests must never depend on external databases, live network APIs, or local file system side effects.
2. **Explicit Imports**: Always explicitly import test utilities from `vitest` (`import { describe, it, expect } from "vitest"`).
3. **Descriptive Test Cases**: Test descriptions should state the expected condition and outcome clearly (e.g. `it("should correctly offset to Monday when given a Sunday", () => { ... })`).
4. **Timezone Immunity**: Date arithmetic tests should account for boundary conditions (leap years, month rollovers, year transitions).
