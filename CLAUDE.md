# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install               # package manager is pnpm; native build scripts are allow-listed in pnpm-workspace.yaml
pnpm exec prisma migrate deploy   # apply migrations to the metadata SQLite DB
pnpm prisma:generate       # regenerate Prisma client after schema changes
pnpm dev                   # next dev
pnpm build && pnpm start
pnpm lint                  # eslint .
pnpm exec tsc --noEmit     # typecheck
```

There is no test runner configured. Copy `.env.example` to `.env`; `APP_ENCRYPTION_KEY` must be at least 32 bytes.

## Architecture

DB Zoo is a phpMyAdmin-style web DB manager on Next.js (App Router, React 19) + TypeScript. Backend is Route Handlers under `app/api/*`; there is no separate server.

- **Two kinds of databases.** Prisma (`prisma/schema.prisma`, SQLite via `DATABASE_URL`) stores only app metadata: `SavedConnection`, `ConnectionSession`, `QueryHistory`, `AuditLog`, `AppUser`. The databases the user *manages* are reached through providers and are never touched by Prisma.
- **Provider abstraction.** `lib/db/providers/*` implement `DatabaseProvider` (`types.ts`) per engine (mysql, mariadb, postgresql, sqlite, plus `MockProvider`). `lib/db/provider-factory.ts#getProvider` picks one from `ConnectionInput.engine`; unknown engines fall back to the mock. New engine features go on the interface and every provider.
- **Services layer.** `lib/services/*` holds the logic that route handlers call (connections, explorer, query execution, table rows/meta/design, import/export, ERD, audit log). Route handlers should stay thin: validate with Zod (`lib/validation/*`), call a service, return via the `ok`/`fail` helpers in `lib/`.
- **Metadata-DB fallback.** Services and session code wrap Prisma calls in try/catch and fall back to the in-memory `lib/services/fallback-store.ts` when the metadata DB is unavailable. Keep both paths in sync when changing connection/session behavior.
- **Sessions and auth.** Login (`/api/auth/connect`) creates a `ConnectionSession` (24h TTL, expired rows swept on login, password encrypted with `lib/security/encryption.ts`) and sets the `ACTIVE_SESSION_COOKIE`. `proxy.ts` (Next 16's middleware replacement) only checks that cookie exists for dashboard routes (`/connections`, `/explorer`, `/query`, `/tables`, `/relational-diagram`, `/server-info`); add new dashboard routes to both its path check and its `matcher`.
- **Saved-connection ownership.** `SavedConnection.ownerId` is an anonymous per-browser id from the `servbase_owner` cookie (`lib/session/owner.ts`, 24h). Every list/update/delete/connect must pass `ownerId`; never query saved connections without it. Rows older than 24h are swept.
- **Authorization.** Roles `read_only < operator < admin` (`lib/security/permissions.ts`). The role comes from the `x-servbase-role` request header and defaults to `operator` (`request-context.ts`). Read-only connections and `lib/db/query-safety.ts` (`classifyQueryRisk`) gate destructive SQL.
- **Frontend.** Dashboard pages live in `app/(dashboard)`, the login in `app/(auth)`. Feature components are in `components/db-manager/` (workspace layout, tabs, ERD in `erd/` built on `@xyflow/react` + dagre); primitives in `components/ui/` (shadcn/Radix + Tailwind 3). Server state uses TanStack Query; the SQL editor is Monaco. Path alias `@/*` maps to the repo root.

## Working rules

- Never use em dashes in anything you write (code, comments, docs, commit messages, PR text).
- Never add Co-Authored-By lines or any other attribution, in commits, PRs, or files.
- Use the `ponytail` and `karpathy-guidelines` skills on most coding tasks where they apply.
