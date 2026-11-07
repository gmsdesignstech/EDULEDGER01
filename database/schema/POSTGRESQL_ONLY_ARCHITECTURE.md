# EduLedger PostgreSQL Architecture

## Approved runtime path

```text
Next.js API/service code
        ↓
src/lib/db.ts (shared query + transaction layer)
        ↓
postgres.js (`postgres` package)
        ↓
DATABASE_URL (server-only PostgreSQL endpoint)
```

Production code validates that `DATABASE_URL` uses a PostgreSQL scheme and fails if it is absent. The module configures a small serverless pool (3 production connections per instance, 5 outside production), bounded connect/idle timeouts, disabled prepared statements, and TLS required in Production. Transactions go through postgres.js `sql.begin`.

`DATABASE_URL` belongs only in server-side Vercel environments and local secret storage; never prefix it with `NEXT_PUBLIC_`, print it, or commit its value. `.env.example` contains a placeholder only.

## Provider-neutral boundary

PostgreSQL is the database engine; the hosting provider is not established by the driver. `DATABASE_URL` can point to a compatible managed PostgreSQL service. Current evidence does not prove whether the Production provider is Neon, Supabase, or another service. Resolve that with the owner identity procedure, not package names or old dashboard reports.

Supabase Auth, Storage, Realtime, and Data API clients are not used in current app code. Supabase SDK packages and unused local public Supabase variables were removed. This does not imply that the Supabase project or its data can be deleted; no provider project was accessed.

## Local development and tests: known exception

The repository is **not yet PostgreSQL-only end-to-end**:

- `scripts/dev.mjs` starts local embedded PostgreSQL, but falls back to SQLite if startup fails.
- `src/lib/db.ts` still contains a SQLite adapter and selects it in non-Production when `DATABASE_URL` is absent.
- Vitest config sets `SQLITE_DATABASE_PATH=data/eduledger.test.db`; the global setup deletes that DB and its WAL/SHM files before tests.

These paths are active and have not been removed because tests/dev workflows depend on them and the existing DB file must be preserved. Strict PG-only completion requires a separate isolated PostgreSQL test target and a validated replacement of these flows. Do not point tests at Production.

## Operator scripts

Maintenance/migration scripts use the same `postgres` driver but create their own direct clients. They are not part of request-path database access and retain their environment guards. All 38 SQL files and Prisma schema history remain quarantined/unverified. No script or migration was executed by this audit.

## Required invariants

- Runtime application database reads/writes go through `src/lib/db.ts`.
- `DATABASE_URL` is the single primary runtime connection variable.
- Any later PostgreSQL-only change must preserve tenant scoping, transaction semantics, assets, payment idempotency and school records.
- Provider identity, deployed schema, migration history and RLS remain owner-evidence blockers.
# Phase 2.3.5 implementation update (2026-11-06)

SQLite execution paths described in the earlier audit are now removed from app, tests, dev launcher, and portal source. PostgreSQL-only source checks passed, but database schema compatibility is still blocked on owner evidence. See the Phase 2.3.5 completion report and test/environment guides.
