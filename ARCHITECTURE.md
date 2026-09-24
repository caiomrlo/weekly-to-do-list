# Architecture Overview

**Weekly To-Do List** is a weekly task management web application built as a **Modular Full-Stack Monolith** using **Next.js 16 (App Router)**, **React 19**, **Drizzle ORM**, and **PostgreSQL 17**.

---

## 1. Directory Conventions

High-signal architectural boundaries and folder responsibilities:

- **`src/app/actions/`**: Typed Next.js Server Actions acting as the primary RPC layer for queries, mutations, and business logic.
- **`src/app/api/`**: Next.js Route Handlers reserved for streaming, webhooks, authenticated binary transfers (e.g. presigned Cloudflare R2 attachment redirects), and Better Auth endpoints (`api/auth/[...all]`).
- **`src/app/(routes)/`**: Next.js App Router pages, dynamic routes, and layouts.
- **`src/components/`**: Reusable React 19 UI components modularized by domain.
- **`src/db/`**: Persistence configuration with PostgreSQL connection pooling (`index.ts`) and Drizzle ORM schemas and relations (`schema.ts`).
- **`src/lib/`**: Core utilities, task domain services (`src/lib/tasks/`), Better Auth configuration, timezone-immune date arithmetic, Cloudflare R2 client, and shared React hooks.
- **`src/middleware.ts`**: Edge runtime middleware enforcing session cookie validation via Better Auth and route protection.
- **`tests/`**: Automated test suites.
- **`drizzle/`**: Auto-generated Drizzle Kit migration SQL files and schema snapshots.

> **Note**: For individual component props, action signatures, or utility implementations, refer directly to source files via LSP or search tools (`ripgrep`) rather than maintaining an exhaustive static file list.

---

## 2. Core Components

### 2.1. Frontend (`src/components/`, `src/app/`)
- **Stack**: Next.js (App Router), React 19, Tailwind CSS v4 (custom glassmorphism design tokens), `lucide-react`.
- **Main Views & Components**:
  - **`WeeklyBoard` (`src/components/WeeklyBoard.tsx`)**: Interactive weekly planner with HTML5 Drag & Drop, subtask nesting/reordering, week navigation, day visibility toggles, and persistent unscheduled backlog panel.
  - **`KanbanBoard` (`src/components/kanban/KanbanBoard.tsx`)**: Columnar workflow board (`/kanban`) organizing workspace tasks into status columns (`To Do`, `Doing`, `Done`, and custom statuses) with HTML5 Drag & Drop, inline card creation, and status modal configurations.
  - **`WorkspaceSelector` (`src/components/workspace/WorkspaceSelector.tsx`)**: Header popover dropdown allowing instant workspace switching, creating new workspaces (+ New Workspace), inline renaming, and protected deletion (guarding against deleting default workspaces).
  - **`WorkspaceMemberAvatars` (`src/components/workspace/WorkspaceMemberAvatars.tsx`) & `WorkspaceInvitePopover` (`src/components/workspace/WorkspaceInvitePopover.tsx`)**: Dynamic workspace member stack with initial avatars and member count overflow, launching a lightweight anchored popover with shareable invite link management (toggle, copy, regenerate), integrated email invite structure, and real-time member directory.
  - **`TaskModal` (`src/components/TaskModal.tsx`)**: Task details modal featuring Tiptap WYSIWYG editor (`TaskDescriptionEditor`), subtask hierarchy, project selector, status picker popover, attachments, and linked docs.
  - **`DocsWorkspace` (`src/components/docs/DocsWorkspace.tsx`)**: Split-pane notes/documentation workspace with Tiptap editor (`DocRichEditor`), search/filters, linked tasks, and attachments.
  - **`LoginPage` (`src/app/login/page.tsx`)**: Authentication card (login and registration with password visibility toggles, preserved post-auth redirect navigation, and contextual invite notifications).
- **UX Principles**: Inline grouping over deep card nesting, zero redundant labels/clutter, progressive disclosure via popovers, and transient mutation feedback (`Saving...`).

### 2.2. Backend & API (`src/app/actions/`, `src/app/api/`)
- **Server Actions (`src/app/actions/`)**: Direct Drizzle ORM mutations and queries for `workspaces`, `workspace-invites`, `tasks`, `task-statuses`, `docs`, `attachments`, `projects`, `tags`, `auth` (Better Auth instance API integration), and `user` (preferences, avatar upload & deletion, profile updates).
- **Route Handlers (`src/app/api/`, `src/app/invite/`)**: `attachments/[id]` generates authenticated presigned Cloudflare R2 URLs for media access; `avatar/[id]` serves unauthenticated public WebP user avatars with immutable HTTP caching or redirects to `R2_PUBLIC_URL`; `auth/[...all]` serves Better Auth HTTP API endpoints via `toNextJsHandler`; `invite/[token]` validates invite tokens, auto-joins authenticated users, updates active workspace cookies, and handles unauthenticated auth redirects.
- **Middleware (`src/middleware.ts`)**: Edge runtime session cookie validation (`better-auth/cookies`) protecting root and authentication routes with redirect parameter preservation.
- *For detailed action signatures or component props, refer directly to the respective files in `src/app/actions/` and `src/components/`.*

---

## 3. Data Stores & Persistence

### 3.1. Primary Database & ORM
- **Engine**: PostgreSQL 17 (Alpine container).
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm/node-postgres`) with Drizzle Kit (`npm run db:generate`, `npm run db:migrate`).
- **Connection Pool**: Cached connection pooling in development.

### 3.2. Domain Models & Schema

The data model enforces strict workspace multi-tenancy across all core domain entities (tasks, documents, projects, tags, statuses, and recurring rules). Key patterns include single-level subtask hierarchies, member task assignments, on-demand recurrence projections, and polymorphic Cloudflare R2 attachments.

> **Single Source of Truth**: All table schemas, foreign key constraints, indexes, and Drizzle relational mappings are defined strictly in [`src/db/schema.ts`](./src/db/schema.ts). Always inspect that file directly before writing database queries or migrations.

---

## 4. External Integrations & APIs

- **Object Storage (Cloudflare R2)**:
  - S3-compatible cloud object storage without egress fees.
  - Interfaced via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
  - Task & Doc attachments enforce private bucket security model; objects accessed exclusively via authenticated signed URLs generated on-demand (`files/{attachmentId}/{fileName}`).
  - User profile avatars are processed with `sharp` into optimized 150x150 WebP thumbnails stored at `avatars/{avatarId}.webp` (raw originals discarded) and served unauthenticated via `/api/avatar/[id]` or direct `R2_PUBLIC_URL` CDN domain.
  - Automated physical file deletion on task, attachment, and avatar removal/replacement.
- **Static Assets & Fonts**: Google Fonts (`Geist` and `Geist_Mono`) via `next/font/google`.

---

## 5. Security & Authentication

- **Authentication Mechanism**: Session-based authentication managed by **Better Auth** (`better-auth` + `@better-auth/drizzle-adapter`). Session tokens stored in signed, HTTP-only, `SameSite=Lax`, secure cookies (`better-auth.session_token`).
- **Session & Account Storage**: Persisted in PostgreSQL database tables (`sessions`, `accounts`, `verifications`, and `users`), using UUID primary keys and standard Drizzle schema relations.
- **Password Security**: Managed internally by Better Auth via standard one-way password hashing (Scrypt/bcrypt).
- **Edge Middleware Protection**: Fast cookie presence check via `getSessionCookie(request)` from `better-auth/cookies` without cold-start database roundtrips on edge route transitions.
- **Multi-Tenant Data Protection & Isolation**: All task, document, project, tag, and recurring rule queries and mutations strictly verify workspace membership and user session ownership via `getActiveWorkspaceContext(session.userId)` and enforce cascade deletion upon workspace or user removal.
