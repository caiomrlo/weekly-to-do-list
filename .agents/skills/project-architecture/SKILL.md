---
name: project-architecture
description: Analyzes the current project workspace and generates, documents, or updates a comprehensive ARCHITECTURE.md file in the project root based on the project's real structure, stack, and components. Activate when the user asks to create, generate, rewrite, or update ARCHITECTURE.md or document the system architecture.
---

# Project Architecture Generator & Maintainer

This skill guides the agent to inspect, analyze, and document the complete architecture of the current project, creating or updating a living `ARCHITECTURE.md` file in the project root.

---

## Core Objectives

1. **Autonomous Project Discovery**: Deeply explore the codebase before writing (configs, directory tree, packages, databases, services, routing).
2. **High-Fidelity Documentation**: Never leave generic placeholders (e.g. `[Insert Name Here]`). Every section must describe real components, file paths, and technologies present in the workspace.
3. **Living Document Maintenance**: When updating an existing `ARCHITECTURE.md`, preserve valid architectural notes, remove outdated info, and accurately reflect new implementations.

---

## Workflow: Step-by-Step

### Step 1: Codebase Inspection & Stack Discovery
Examine key project files to understand the stack and architecture:
- **Project Manifests**: `package.json`, `composer.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, `pyproject.toml`, etc.
- **Environment & Configs**: `.env.example`, `docker-compose.yml`, `Dockerfile`, `tsconfig.json`, `vite.config.*`, `next.config.*`, etc.
- **Directory Structure**: List root and subdirectories (`src/`, `app/`, `backend/`, `frontend/`, `components/`, `api/`, `database/`, etc.).
- **Data & Models**: ORM schemas (Prisma, Drizzle, TypeORM, Mongoose), SQL migrations, model definitions.
- **Routing & APIs**: Main entry points, controllers, API routes, middleware, services.
- **Authentication & Security**: Auth middleware, JWT/session handling, permission checks.

### Step 2: Synthesizing Architectural Blueprint
Map the gathered insights into the standard architecture format, tailored to the project's complexity:
- If the project is a monorepo / multi-service app, document each service/package clearly.
- If it is a single monolithic app or SPA, focus on internal modular boundaries, layers, state management, and data flow.
- If it has internal admin panels and public frontend interfaces, create dedicated sub-sections for each.

### Step 3: Writing or Updating `ARCHITECTURE.md`
Write the file directly to `./ARCHITECTURE.md` (project root) using the template structure below.

---

## ARCHITECTURE.md Structure Template

When generating the `ARCHITECTURE.md`, adhere to this clear, modular structure:

```markdown
# Architecture Overview
[High-level summary of what the project does, its core purpose, and architectural style (e.g., Modular Monolith, Microservices, Event-Driven, JAMstack).]

## 1. Project Structure
\`\`\`text
[Annotated directory tree showing key folders and their architectural roles]
\`\`\`

## 2. High-Level System Diagram
\`\`\`mermaid
flowchart TD
    %% Diagram depicting Users, Clients/Frontends, Backend Services, Databases, and External APIs
\`\`\`

## 3. Core Components
### 3.1. Frontend / User Interfaces
- **Technologies**: [e.g. Next.js, React, Tailwind CSS, Vue]
- **Role & Scope**: [e.g. Admin dashboard, public customer portal, widgets]
- **Key Modules / State Management**: [e.g. Zustand, React Query, Context API]

### 3.2. Backend Services & API
- **Technologies & Runtime**: [e.g. Node.js, Fastify, Express, Python FastAPI, Go]
- **Architecture Pattern**: [e.g. Controller-Service-Repository, Clean Architecture, RPC/REST]
- **Key Routes / Endpoints**: [Summary of primary API namespaces]

## 4. Data Stores & Persistence
- **Primary Database**: [e.g. PostgreSQL, MySQL, MongoDB] via [ORM/Query Builder, e.g. Drizzle, Prisma, Raw SQL]
- **Key Schemas / Entities**: [List of core tables/collections and relationships]
- **Caching & Queues**: [e.g. Redis, RabbitMQ, BullMQ, or N/A]

## 5. External Integrations & APIs
- **Services**: [e.g. Stripe, SendGrid, OAuth Providers, S3/R2 Storage, Webhooks]
- **Integration Method**: [e.g. Official SDK, REST API, Webhook listener]

## 6. Deployment & Infrastructure
- **Containerization**: [e.g. Docker, Docker Compose services]
- **Environments & Hosting**: [e.g. Vercel, AWS ECS, VPS, Local Dev]
- **CI/CD**: [e.g. GitHub Actions workflows]

## 7. Security & Authentication
- **Authentication**: [e.g. JWT tokens, HTTP-only cookies, OAuth2, Session-based]
- **Authorization**: [e.g. Role-Based Access Control (RBAC), capability checks]
- **Data Protection**: [e.g. Input validation with Zod/Joi, CORS policy, rate limiting, SQL parameterization]

```

---

## Directives & Best Practices

> [!IMPORTANT]
> - **Be Contextual & Accurate**: Adapt sections to fit the specific project. Remove or merge sections that do not apply (e.g., if there are no external APIs or queues, omit them or briefly state N/A).
> - **No Generic Boilerplate**: Fill in concrete details, real package names, real model names, and real file paths.
> - **Mermaid Diagrams**: Use clear Mermaid diagrams (`flowchart TD` or `flowchart LR`) showing actual data flow and component connections.
> - **Incremental Updates**: When updating an existing `ARCHITECTURE.md`, perform a diff-aware review. Keep project-specific knowledge intact while updating outdated sections.
