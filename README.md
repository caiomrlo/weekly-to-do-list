# Weekly To-Do List

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

An open-source, high-signal weekly productivity web application built for individuals and collaborative teams. It combines an interactive weekly schedule, a flexible Kanban workflow, rich document editing, and a native conversational AI assistant with speech-to-text dictation.

---

## Overview & Key Features

Weekly To-Do List is designed around cognitive load reduction and fluid task management, keeping your primary views fast and distraction-free:

- **Weekly Interactive Planner**: Drag-and-drop tasks across week days, manage single-level subtasks, toggle day visibility, and maintain a persistent unscheduled backlog.
- **Kanban Board**: Columnar workflow board with customizable statuses, inline card creation, and HTML5 drag-and-drop task progression.
- **Conversational AI Assistant**: Integrated assistant powered by OpenAI and Vercel AI SDK (`@assistant-ui/react`), supporting voice input with real-time waveform visualization, audio transcription (`gpt-transcribe`), and direct task mutations via type-safe server tool calling.
- **Rich Documentation & Notes**: Split-pane notes workspace featuring a Tiptap WYSIWYG editor with task linking, search, and attachments.
- **Multi-Tenant Workspaces**: Switch between workspaces seamlessly, invite teammates via shareable links, and assign tasks to members.
- **Web Push Notifications & Cron**: Morning daily briefings and proactive pre-task reminders delivered via standard Web Push, backed by database idempotency logs.
- **Cloud Object Storage**: File, image, and PDF attachment management via Cloudflare R2 (S3-compatible) with private bucket access, server-side magic byte validation, and sharp-powered WebP avatar thumbnails.
- **Robust Authentication**: Powered by Better Auth with session tokens stored in secure, HTTP-only cookies and protected via Edge middleware.

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL**: `v17` (or use the provided Docker Compose service)

---

### Step-by-Step Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/weekly-to-do-list.git
   cd weekly-to-do-list
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in the necessary configuration:
   - `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://appuser:apppass@localhost:5432/weekly_todo_db`).
   - `BETTER_AUTH_SECRET`: Random 32+ character secret string.
   - `BETTER_AUTH_URL`: Local URL (e.g. `http://localhost:3000`).
   - `OPENAI_API_KEY`: (Optional, for AI Assistant) Your OpenAI API key.
   - `R2_*`: (Optional, for file attachments & avatars) Cloudflare R2 credentials.

4. **Start PostgreSQL database**
   If you have Docker, you can launch only the PostgreSQL database container:
   ```bash
   docker compose up -d db
   ```
   Or use your own local PostgreSQL 17 instance matching the database credentials in `.env`.

5. **Run database migrations**
   Apply the Drizzle ORM schema to your database:
   ```bash
   npm run db:migrate
   ```

6. **Generate Web Push VAPID keys**
   ```bash
   npm run webpush:keys
   ```
   Copy the generated public and private keys into `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` inside your `.env` file.

7. **Start the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running via Docker (Full Environment)

You can run the entire application along with PostgreSQL in isolated containers using Docker Compose.

### Development Mode (with Live Reloading & Watch)
```bash
npm run docker:dev
```
This utilizes Docker Compose Watch to sync changes in `./src`, `./public`, and `./drizzle` in real time with Fast Refresh without rebuilding containers.

### Background Daemon
```bash
npm run docker:up
```

### Useful Docker Commands
```bash
# View live application logs
npm run docker:logs

# Stop all running containers
npm run docker:down
```

---

## Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server with hot-reload |
| `npm run build` | Compiles the production build and validates TypeScript types |
| `npm run start` | Starts the Next.js production server |
| `npm run lint` | Runs ESLint across the codebase |
| `npm run test` | Runs the full Vitest automated test suite |
| `npm run test:unit` | Runs fast, zero-I/O unit tests (`tests/unit`) |
| `npm run test:integration` | Runs integration tests validating actions, queries, and mocks (`tests/integration`) |
| `npm run test:watch` | Starts Vitest in interactive watch mode |
| `npm run db:generate` | Generates new SQL migration files from `src/db/schema.ts` |
| `npm run db:migrate` | Applies pending Drizzle migrations to PostgreSQL |
| `npm run db:studio` | Opens Drizzle Studio GUI in your browser |
| `npm run db:reset` | Resets the database and reapplies all migrations |
| `npm run webpush:keys` | Generates a new pair of VAPID keys for Web Push notifications |
| `npm run notifications:dispatch` | Manually triggers the notification dispatcher CLI script |
| `npm run docker:dev` | Runs full containerized development environment with compose watch |
| `npm run docker:up` | Builds and launches all containers in background mode |
| `npm run docker:down` | Shuts down active Docker containers |
| `npm run docker:logs` | Streams live logs from the `app` container |

---

## Scheduled Jobs & Web Push in Production

For automated dispatch of daily morning briefings and pre-task reminders in production, configure an external scheduler (e.g. cron-job.org, EasyCron, system crontab, or cloud scheduler):

### Endpoint Details
- **URL**: `https://<your-domain>/api/cron/notifications`
- **HTTP Methods**: `GET` or `POST`
- **Authentication**:
  - **Option 1 (Query parameter - recommended for simple webhook callers)**:
    ```
    https://<your-domain>/api/cron/notifications?secret=YOUR_CRON_SECRET
    ```
  - **Option 2 (Authorization header)**:
    ```http
    Authorization: Bearer YOUR_CRON_SECRET
    ```

### Recommended Interval
- **Every 5 minutes** (`*/5 * * * *`).
- *Rationale*: Pre-task reminders fire with configurable lead time (e.g. 15 minutes before scheduled task time). A 5-minute cron frequency ensures accurate alerts while database-level idempotency prevents duplicate notifications.

### Local Testing (CLI)
To run the notification dispatcher locally without an external scheduler:
```bash
npm run notifications:dispatch

# Optional simulation flags:
npm run notifications:dispatch -- --force-morning   # Simulate 08:00 AM morning check
npm run notifications:dispatch -- --dry-run          # Evaluate matching tasks without sending pushes
```

### Required Notification Environment Variables
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
VAPID_SUBJECT="mailto:notifications@yourdomain.com"
CRON_SECRET="your-secure-cron-secret-token"
```

---

## Contributing

Contributions from the open-source community are very welcome! Whether you are reporting a bug, proposing an improvement, or submitting a feature, please follow these steps:

### Workflow

1. **Fork the Repository** and clone your fork locally.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Make your changes**:
   - Write clear, self-documenting code.
   - Keep comments concise and written in English.
   - Follow UI/UX guidelines: inline grouping, opaque floating surfaces, and transient mutation feedback.
   - For architectural details and guidelines, consult [ARCHITECTURE.md](./ARCHITECTURE.md).
4. **Validate your changes**:
   Run the verification suite before opening a pull request:
   ```bash
   npm run lint
   npm run test:unit
   npm run test:integration
   npm run build
   ```
5. **Commit and Push**:
   Use meaningful commit messages following standard conventions:
   ```bash
   git commit -m "feat(kanban): add custom status color picker"
   git push origin feature/my-new-feature
   ```
6. **Open a Pull Request**:
   Describe the motivation, changes made, and any testing performed.

---

## License

This project is licensed under the [MIT License](./LICENSE).
