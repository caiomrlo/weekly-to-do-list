# Architecture Overview

**Weekly To-Do List** is a modern, responsive web application for weekly task management. Built with a **Modular Full-Stack Monolith** architecture utilizing **Next.js 16 (App Router)**, **React 19**, **Drizzle ORM**, and **PostgreSQL 17**, the application delivers a clean, glassmorphic light-themed user interface focused on cognitive simplicity, zero timezone drift, and seamless productivity.

---

## 1. Directory Conventions

High-signal architectural boundaries and folder responsibilities:

- **`src/app/actions/`**: Typed Next.js Server Actions acting as the primary RPC layer for queries, mutations, and business logic.
- **`src/app/api/`**: Next.js Route Handlers reserved for streaming, webhooks, authenticated binary transfers (e.g. presigned Cloudflare R2 attachment redirects), and Better Auth endpoints (`api/auth/[...all]`).
- **`src/app/(routes)/`**: Next.js App Router pages, dynamic routes, and layouts.
- **`src/components/`**: Reusable React 19 UI components modularized by domain.
- **`src/db/`**: Persistence configuration with PostgreSQL connection pooling (`index.ts`) and Drizzle ORM schemas and relations (`schema.ts`).
- **`src/lib/`**: Core utilities, Better Auth configuration, timezone-immune date arithmetic, Cloudflare R2 client, and shared React hooks.
- **`src/middleware.ts`**: Edge runtime middleware enforcing session cookie validation via Better Auth and route protection.
- **`tests/`**: Automated test suites.
- **`drizzle/`**: Auto-generated Drizzle Kit migration SQL files and schema snapshots.

> **Note**: For individual component props, action signatures, or utility implementations, refer directly to source files via LSP or search tools (`ripgrep`) rather than maintaining an exhaustive static file list.

---

## 2. High-Level System Diagram

```mermaid
flowchart TD
    User["👤 User (Web Browser)"]

    subgraph EdgeLayer["Edge / Middleware Layer"]
        Middleware["🛡️ Next.js Middleware (middleware.ts)\nSession Cookie Verification via Better Auth"]
    end

    subgraph AppLayer["Next.js 16 Application Layer"]
        subgraph UI["Frontend UI (React 19)"]
            LoginPage["/login (LoginPage)"]
            WeeklyBoard["/ (WeeklyBoard Component)"]
            KanbanBoard["/kanban (KanbanBoard Component)"]
            DocsWorkspace["/docs (DocsWorkspace Component)"]
            WorkspaceSelector["WorkspaceSelector (Switch, Create, Rename & Delete)"]
            TaskModal["TaskModal (Project & Status Selector, Attachments, Docs & Auto-Save)"]
        end

        subgraph ServerActions["Server Actions (app/actions/*)"]
            AuthActions["Auth Actions\n(login, register, logout)"]
            WorkspaceActions["Workspace Actions\n(getUserWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace, switchWorkspace)"]
            InviteActions["Workspace Invite Actions\n(getInviteLink, toggleInviteLink, regenerateInviteLink, getMembers)"]
            DocActions["Doc Actions\n(getDocs, getDocById, createDoc, updateDoc, deleteDoc, link/unlink)"]
            ProjectActions["Project Actions\n(getProjects, createProject, deleteProject)"]
            TagActions["Tag Actions (Backend)\n(getTags, createTag, deleteTag)"]
            TaskStatusActions["Status Actions\n(getStatuses, createStatus, updateStatus, deleteStatus, reorderStatuses)"]
            TaskActions["Task Actions\n(create, update, toggle, delete, move/reorder, moveKanban, query with projects/tags/statuses)"]
            UserActions["User Actions\n(getPreferences, updatePreferences)"]
        end

        subgraph Lib["Core Utilities (src/lib/*)"]
            AuthLib["Auth Lib (Better Auth + Drizzle Adapter)"]
            WorkspaceLib["Workspace Lib (Active Context Resolution & Auto-Provisioning)"]
            DateUtils["Date Utils (ISO YYYY-MM-DD)"]
            ProjectUtils["Project Utils (Palette Styles & Tokens)"]
            TagUtils["Tag Utils (Palette Styles & Tokens)"]
            StatusUtils["Status Utils (Palette Styles & Tokens)"]
        end
    end

    subgraph DataLayer["Persistence Layer"]
        Drizzle["Drizzle ORM (node-postgres pool)"]
        Postgres[("🐘 PostgreSQL 17 (weekly_todo_db)\n• users\n• workspaces\n• workspace_members\n• workspace_invites\n• task_statuses\n• projects\n• tags\n• tasks\n• recurring_rules\n• attachments\n• docs\n• task_docs")]
    end

    %% Flow connections
    User -->|"HTTP Request"| Middleware
    Middleware -->|"Authorized (Cookie Valid)"| WeeklyBoard
    Middleware -->|"Authorized (Cookie Valid)"| KanbanBoard
    Middleware -->|"Authorized (Cookie Valid)"| DocsWorkspace
    Middleware -->|"Unauthorized"| LoginPage
    LoginPage -->|"Submit Credentials"| AuthActions
    AuthActions --> AuthLib
    AuthActions --> WorkspaceLib
    AuthActions --> Drizzle
    WeeklyBoard -->|"Switch / Manage Workspaces"| WorkspaceActions
    WeeklyBoard -->|"Manage Tasks / Navigate Weeks"| TaskActions
    WeeklyBoard -->|"Toggle Visible Days"| UserActions
    WeeklyBoard --> TaskModal
    KanbanBoard -->|"Manage Column Statuses"| TaskStatusActions
    KanbanBoard -->|"Move / Reorder Tasks"| TaskActions
    KanbanBoard --> TaskModal
    DocsWorkspace -->|"Manage Documents & Notes"| DocActions
    DocsWorkspace -->|"Switch / Manage Workspaces"| WorkspaceActions
    TaskModal -->|"Manage Projects & Statuses"| ProjectActions
    TaskModal -->|"Debounced Auto-Save"| TaskActions
    TaskModal -->|"Link & Create Notes"| DocActions
    WorkspaceActions --> Drizzle
    DocActions --> Drizzle
    WeeklyBoard --> DateUtils
    WeeklyBoard --> ProjectUtils
    TaskActions --> Drizzle
    TaskStatusActions --> Drizzle
    ProjectActions --> Drizzle
    TagActions --> Drizzle
    UserActions --> Drizzle
    Drizzle -->|"SQL Queries / Migrations"| Postgres
```

---

## 3. Core Components

### 3.1. Frontend (`src/components/`, `src/app/`)
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

### 3.2. Backend & API (`src/app/actions/`, `src/app/api/`)
- **Server Actions (`src/app/actions/`)**: Direct Drizzle ORM mutations and queries for `workspaces`, `workspace-invites`, `tasks`, `task-statuses`, `docs`, `attachments`, `projects`, `tags`, `auth` (Better Auth instance API integration), and `user` preferences.
- **Route Handlers (`src/app/api/`, `src/app/invite/`)**: `attachments/[id]` generates authenticated presigned Cloudflare R2 URLs for media access; `auth/[...all]` serves Better Auth HTTP API endpoints via `toNextJsHandler`; `invite/[token]` validates invite tokens, auto-joins authenticated users, updates active workspace cookies, and handles unauthenticated auth redirects.
- **Middleware (`src/middleware.ts`)**: Edge runtime session cookie validation (`better-auth/cookies`) protecting root and authentication routes with redirect parameter preservation.
- *For detailed action signatures or component props, refer directly to the respective files in `src/app/actions/` and `src/components/`.*

---

## 4. Data Stores & Persistence

### 4.1. Primary Database & ORM
- **Engine**: PostgreSQL 17 (Alpine container).
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm/node-postgres`) with Drizzle Kit (`npm run db:generate`, `npm run db:migrate`).
- **Connection Pool**: Cached connection pooling in development.

### 4.2. Domain Models & Schema

The data model enforces strict workspace multi-tenancy scoped to the active workspace (`tasks.workspaceId`, `docs.workspaceId`, `projects.workspaceId`, `tags.workspaceId`, `taskStatuses.workspaceId`, `recurringRules.workspaceId`):
- **Authentication & Sessions**: Better Auth managed tables (`users`, `sessions`, `accounts`, `verifications`) with custom user fields (`preferences`, `last_login_at`) and UUID primary keys.
- **Workspaces & Membership**: `workspaces` (UUID, `name`, `ownerId`, `isDefault`, timestamps), `workspace_members` (UUID, `workspaceId`, `userId`, `role`, `joinedAt`), and `workspace_invites` (UUID, `workspaceId`, `invitedBy`, `token`, `email`, `role`, `status`, `expiresAt`, timestamps) supporting multi-user collaboration via secure shareable links and extensible email invitations.
- **Task Statuses & Workflow**: `task_statuses` (UUID, `workspaceId`, `name`, `color`, `category` (`todo`/`doing`/`done`), `order`, `isDefault`, timestamps) providing customizable board columns strictly scoped per workspace.
- **Tasks & Recurrence**: Weekly scheduled, backlog, or kanban items strictly isolated by `workspaceId`, supporting a 1-level subtask hierarchy (`parentId`), `statusId` reference (with `set null` on status deletion), natural duration, and project/tag relations. Recurring routines are managed via `recurring_rules` using an on-demand window projection strategy.
- **Documents & Attachments**: Rich-text workspace notes isolated by `workspaceId` and Cloudflare R2 file attachments linked polymorphically to tasks and docs.

> **Single Source of Truth**: All table schemas, foreign key constraints, indexes, and Drizzle relational mappings are defined strictly in [`src/db/schema.ts`](./src/db/schema.ts). Always inspect that file directly before writing database queries or migrations.

---

## 5. External Integrations & APIs

- **Object Storage (Cloudflare R2)**:
  - S3-compatible cloud object storage without egress fees.
  - Interfaced via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
  - Enforces private bucket security model; objects accessed exclusively via authenticated signed URLs generated on-demand (`files/{attachmentId}/{fileName}`).
  - Automated physical file deletion on task and attachment removal.
- **Static Assets & Fonts**: Google Fonts (`Geist` and `Geist_Mono`) via `next/font/google`.

---

## 6. Security & Authentication

- **Authentication Mechanism**: Session-based authentication managed by **Better Auth** (`better-auth` + `@better-auth/drizzle-adapter`). Session tokens stored in signed, HTTP-only, `SameSite=Lax`, secure cookies (`better-auth.session_token`).
- **Session & Account Storage**: Persisted in PostgreSQL database tables (`sessions`, `accounts`, `verifications`, and `users`), using UUID primary keys and standard Drizzle schema relations.
- **Password Security**: Managed internally by Better Auth via standard one-way password hashing (Scrypt/bcrypt).
- **Edge Middleware Protection**: Fast cookie presence check via `getSessionCookie(request)` from `better-auth/cookies` without cold-start database roundtrips on edge route transitions.
- **Multi-Tenant Data Protection & Isolation**: All task, document, project, tag, and recurring rule queries and mutations strictly verify workspace membership and user session ownership via `getActiveWorkspaceContext(session.userId)` and enforce cascade deletion upon workspace or user removal.


