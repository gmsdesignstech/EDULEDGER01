# PostgreSQL Compatibility Report

**Status: SOURCE-LEVEL COMPATIBILITY ONLY — no live PostgreSQL test was run.** Production runtime explicitly selects postgres.js from `DATABASE_URL`; this report does not certify the deployed schema or provider.

## Connection and query layer

- `src/lib/db.ts` owns the lazy PostgreSQL client and query/row/run helpers used by application services.
- `postgres.js` is the runtime driver. Production requires `DATABASE_URL` and PostgreSQL URL syntax.
- Pool configuration: max 3 in Production / 5 otherwise, connect timeout 15 seconds, idle timeout 20 seconds, prepared statements disabled, production TLS required.
- Transactions use `sql.begin`. This is source evidence; actual rollback/locking/connection behavior was not tested against the deployed PostgreSQL version.
- The same module retains SQLite-specific SQL translation and adapter branches. Vitest uses SQLite, so tests passing there would not establish PostgreSQL compatibility.

## Module coverage (static mapping)

| EduLedger capability | Storage path identified in source | PostgreSQL evidence status |
|---|---|---|
| School registration/admin authentication/sessions | Central DB services: institutions, users, sessions and related tables | Source reviewed; live schema/auth behavior unverified |
| Students, parents, teachers/staff | Central DB services with institution-scoped records and parent links | Source reviewed; tenant isolation not proven |
| Attendance and academic management | Central DB services for attendance, class configuration, exams/results, timetables | Source reviewed; PG constraints/query behavior untested |
| Fees, Razorpay and subscriptions | PostgreSQL records plus external Razorpay API/signature integration | Source reviewed; no gateway or PG transaction test in this audit |
| Accounting/cashbook/reports | Central DB services and accounting records | Source reviewed; numeric/constraint semantics not live-verified |
| Photographs, school images and documents | PostgreSQL `school_assets` in current source | Source reviewed; no Supabase Storage client use found; privacy/access not live-tested |
| WhatsApp and parent communication | PostgreSQL event/configuration/consent records plus external Meta API | Source reviewed; provider, webhook, RLS and runtime role state unverified |
| Notifications | PostgreSQL notification/token records plus Firebase Cloud Messaging provider calls | Source reviewed; no Firebase database client found |
| Super Admin | Server-side admin/session services backed by central DB layer | Source reviewed; role isolation not live-tested |

This mapping covers feature areas requested, not every route/table/authorization pair. The schema inventory and dependency map remain the authoritative static references; no table merge is implied.

## Compatibility risks requiring isolated PostgreSQL validation

1. Runtime DDL currently has 56 tables; Prisma separately declares 43 models/four enums; historical migrations number 38. Deployed schema and applied migration history are unknown.
2. Runtime SQL uses PostgreSQL-specific types/features (for example `JSONB`, `TIMESTAMPTZ`, casts, `ILIKE`, row locks, and `RETURNING`) while the SQLite adapter rewrites only selected syntax.
3. Current initialization mixes DDL, patches, indexes, backfills, and upserts. Do not treat a successful build as DB compatibility proof.
4. Tenant isolation, composite school consistency, RLS/grants, foreign keys, partial indexes, locking/idempotency, and payment/webhook transaction boundaries require an approved isolated PG target and review.
5. Pool settings must be validated against the eventual provider and deployment concurrency; provider is not confirmed.

## Verification status

- TypeScript (`npm run typecheck`): **PASS**.
- ESLint (`npm run lint`): **PASS**.
- Production build (`npm run build`): **PASS** — Next.js 16.4.5; 143 static pages generated.
- Existing Vitest suite: **NOT RUN**. Its global setup deletes `data/eduledger.test.db`, which existed before this work; no isolated disposable PostgreSQL test target has been verified.
- PostgreSQL connectivity/catalog/RLS tests: **NOT RUN**; no connection was made.
- Production/domain checks: not part of this architecture audit; no deployment performed.

## Gate

Do not claim full PostgreSQL compatibility or PostgreSQL-only repository status. First obtain owner evidence using Phase 2.3.4, then separately authorize a disposable PostgreSQL compatibility/test migration with explicit isolation. Preserve the existing SQLite test file and all school records.
# Phase 2.3.5 addendum (2026-11-06)

This compatibility report describes the earlier source state. The SQLite runtime adapter, dev fallback, test-file cleanup, and standalone portal fallback documented there have since been removed. PostgreSQL-only code/configuration checks pass (`typecheck`, `lint`, `build`), but no deployed schema evidence or test database is available; PostgreSQL compatibility remains unverified. See `PHASE_2_3_5_POSTGRESQL_ONLY_COMPLETION_REPORT.md`.
