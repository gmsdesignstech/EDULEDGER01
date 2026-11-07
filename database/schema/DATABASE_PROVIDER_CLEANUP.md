# Database Provider and Dependency Cleanup

**Result: unused Supabase SDK configuration removed; PostgreSQL remains the production database engine. SQLite remains active in local development/tests and is a documented non-compliance with repository-wide PostgreSQL-only acceptance.**

## Dependency results

| Package/config | Audit result | Action |
|---|---|---|
| `postgres` | Used by `src/lib/db.ts` and operator scripts | Kept |
| `pg-embedded` | Used by local PostgreSQL dev launcher | Kept |
| `@supabase/ssr` | No source imports or active SSR/auth integration found | Removed from package manifest and lockfile |
| `@supabase/supabase-js` | No source imports or client calls found | Removed from package manifest and lockfile |
| Prisma client/CLI | Not present as dependencies; no `PrismaClient` usage | No package cleanup needed |
| Prisma schema/migrations | Historical schema artifacts only; 38 migration files are safety-sensitive evidence | Preserved, not merged/deleted/activated |
| MySQL/MongoDB/PlanetScale/Firebase database clients | No active connection implementation found in app source/scripts/tests | None removed |

## Environment/config results

- `.env.example` already contains a PostgreSQL `DATABASE_URL` placeholder only; no Supabase variable entry was present.
- Unused `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` lines were removed from `.env.local` after confirming no app consumers. `.env.local` remains, and all other values were left intact and never displayed.
- `DATABASE_URL` values were not read or changed.
- `PORTAL_READONLY_DATABASE_URL` appears by name in `.env.local` but has no source reference. Its value was not inspected or changed to preserve the local owner environment. Owner should confirm whether it is still needed.
- No Vercel or provider settings were changed.

### Database-related variable names found in code/config

| Variable name | Source use / classification |
|---|---|
| `DATABASE_URL` | Primary postgres.js runtime URL; PostgreSQL only. |
| `STAGING_DATABASE_URL`, `STAGING_DATABASE_HOST`, `STAGING_DATABASE_NAME` | Guarded staging migration target metadata; PostgreSQL scripts, not alternate engines. Values were not inspected. |
| `WHATSAPP_TEST_DATABASE_URL`, `WHATSAPP_PRODUCTION_DATABASE_IDENTITY` | Guarded PostgreSQL integration-test target and credential-free comparison identity. No DB test was run. |
| `SQLITE_DATABASE_PATH` | Active SQLite test target; test setup deletes that file before tests. |
| `PORTAL_READONLY_DATABASE_URL` | Local env name only; no source reference found; value preserved and not inspected. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Removed from local `.env.local` after confirming no app call sites; absent from `.env.example`. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Firebase messaging/push configuration, not a database connection; preserve. Values were not read. |

## Preserved integrations

EduLedger's own DB-backed auth/session services and PostgreSQL `school_assets` storage are active source implementations. Razorpay payments, Meta WhatsApp, and Firebase Cloud Messaging are external services, not database providers. None were removed.

## Still active: SQLite

SQLite is not an unused dependency: `node:sqlite` adapter exists in `src/lib/db.ts`, Vitest config points at a SQLite test DB, global setup deletes that test DB before a run, and `scripts/dev.mjs` uses SQLite as fallback. Removing it without a PostgreSQL replacement could break local workflows and tests. It remains until an isolated PG-only test/dev migration is separately designed and verified. Consequently the final provider audit cannot claim PostgreSQL is the sole database system across all repository execution modes.

## Verification limits

Static searches and dependency metadata were inspected; no tests were run because the current suite deletes an existing DB file and uses SQLite. Typecheck/lint/build results are recorded in `POSTGRESQL_ONLY_ARCHITECTURE_REPORT.md`. No database connectivity, provider project, Production data, or Vercel state was accessed.
# Phase 2.3.5 addendum (2026-11-06)

Correction: `PORTAL_READONLY_DATABASE_URL` had an active source reference in the standalone portal server. That service now uses only this explicitly configured variable, requires a development-marked PostgreSQL target distinct from the credential-free production identity, and has no SQLite or primary `DATABASE_URL` fallback. Provider identity for the deployed main application remains unconfirmed.
