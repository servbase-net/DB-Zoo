# DB Zoo

Modern phpMyAdmin-inspired database panel built with Next.js App Router + TypeScript.
DB Zoo is an open-source project by Servbase.

## Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma (metadata DB)
- Zod validation
- Route Handlers for backend operations
- Provider abstraction for multi-engine support

## Supported Engines
- MySQL (`mysql2`)
- MariaDB (`mysql2` provider specialization)
- PostgreSQL (`pg`)
- SQLite (`better-sqlite3`)
- MongoDB architecture hooks reserved via provider interface extension

## MVP Features Implemented
- phpMyAdmin-style connection/login shell (no user account required)
- Temporary connection sessions (cookie + session table)
- Optional encrypted saved connections
- Connection test, reconnect, and saved connection management
- Schema explorer (database/schema/object tree)
- Table browser: columns, indexes, foreign keys, rows, triggers placeholder
- Row operations: insert, duplicate, delete (update API foundation included)
- SQL editor with Monaco, destructive-query warning, history, execution stats
- Import/Export endpoints (CSV/SQL)
- Table designer scaffold
- Server metadata panel
- Query history + audit log persistence structures
- Role/permission scaffolding (`admin`, `operator`, `read_only`)

## Project Structure
- `app/` App Router pages + API route handlers
- `components/db-manager/` feature UI components
- `components/ui/` reusable UI primitives
- `lib/db/providers/` provider abstraction and engine providers
- `lib/services/` service layer (UI-free backend logic)
- `lib/validation/` Zod schemas
- `lib/security/` encryption + permission scaffolding
- `lib/session/` connection session handling
- `prisma/` metadata schema

## Environment
Create `.env`:

```bash
DATABASE_URL="file:./prisma/dev.db"
APP_ENCRYPTION_KEY="dev-32-byte-minimum-secret-key-12345"
SESSION_SECRET="dev-session-secret"
```

## Run
```bash
npm install
npm run prisma:generate
npm run dev
```

Build check:
```bash
npm run build
```

## Notes
- Credentials are encrypted on save and never returned to clients.
- Read-only connections block destructive queries and write mutations.
- Real provider calls exist for core metadata/query paths; some DDL/mutation/import paths are intentionally scaffolded and marked for deeper engine-specific implementations.
- Metadata DB is intentionally separate from managed DB connections.


