# Database Evidence Readiness — Phase 2.3.3

**Status: BLOCKED — OWNER EVIDENCE REQUIRED**  
**Scope:** Offline repository review only. No database connection, provider dashboard, SQL execution, credential inspection, migration, or deployment was performed.

## Evidence availability

| Required evidence | Available evidence | Readiness |
|---|---|---|
| PostgreSQL schema-only export bound to deployed application DB | None supplied. `SCHEMA_INVENTORY.md` is source-derived, not an export. | **UNKNOWN — owner required** |
| Applied migration history / tracking table | No owner-supplied ledger or catalog evidence. Local manifest has zero active migrations and 28 quarantined entries; 10 of 38 SQL files are not listed. | **UNKNOWN — owner required** |
| PostgreSQL version | No owner-provided server version. | **UNKNOWN** |
| Extensions and versions | No server catalog export. Static source search is not authoritative for installed extensions. | **UNKNOWN** |
| Tables and columns | Runtime source declares 56 table names; Prisma declares 43 models. Neither establishes deployed objects. | **Source verified; deployed state UNKNOWN** |
| PK/FK/unique/check constraints and indexes | Source declarations are inventoried; no catalog evidence. | **Source verified; deployed state UNKNOWN** |
| Triggers, functions, views, sequences, types | No owner-supplied catalog evidence. Absence in selected source does not prove absence in DB. | **UNKNOWN** |
| RLS state and policies | Two quarantined migrations enable RLS on four WhatsApp tables and contain conditional revokes; no policy declarations were found in those files. | **Deployed state UNKNOWN** |
| Database role privileges / ownership | No grants, role metadata, or owner confirmation supplied. | **UNKNOWN** |
| Provider and deployment binding | Owner supplied a Supabase project URL, but no evidence binds it to Production Vercel or `DATABASE_URL`. Runtime uses postgres.js and `DATABASE_URL`. | **UNKNOWN** |
| Backup/restore state | No backup metadata or isolated restore evidence supplied. | **UNKNOWN** |

## Repository baseline

- `src/lib/db.ts`: current working-tree runtime definitions and incremental initialization logic, 56 table names.
- `prisma/schema.prisma`: 43 model declarations and four enums; Prisma Client/CLI are not configured as runtime persistence.
- SQL inventory: 38 files (3 under `database/migrations`, 35 under `prisma/migrations`), all with unknown application state.
- `database/tracked-migrations` is absent. The local ignored manifest has `active: []`, 28 quarantined paths, and omits 10 on-disk SQL files.
- Runtime initialization combines DDL with patches, conditional indexes, data repairs/backfills, and plan upserts; it is not a frozen baseline.
- Details: [schema inventory](SCHEMA_INVENTORY.md), [migration matrix](MIGRATION_RECONCILIATION_MATRIX.md), [dependency map](SCHEMA_DEPENDENCY_MAP.md), [validation report](SCHEMA_VALIDATION_REPORT.md), [evidence register](AUTHORITATIVE_SCHEMA_EVIDENCE.md).

## Evidence acceptance gates

Before calling any schema authoritative, an owner/DBA must provide and confirm:

1. Vercel deployment identity/commit/environment and confirmation which database serves it.
2. Provider/project, region, PostgreSQL version, database name, and non-secret role label bound to that deployment.
3. A reviewed schema-only export or complete catalog inventory: columns, constraints, indexes, triggers, functions, views, sequences, types, extensions, grants, RLS flags and policies.
4. Migration ledger name/schema/DDL/rows/checksums/timestamps, or explicit confirmation no authoritative ledger exists.
5. Backup recency and isolated restore evidence before any later rehearsal.

Follow [OWNER_RECOVERY_CHECKLIST.md](OWNER_RECOVERY_CHECKLIST.md). Keep raw exports owner-controlled and redact sensitive literals before sharing. Never send passwords, full connection strings, API/service keys, tokens, private keys, or school records.

## Gate decision

**BLOCKED — OWNER EVIDENCE REQUIRED.** Do not initialize a Preview database, select a bootstrap, activate a migration, or infer that the supplied Supabase URL is the Production target. The next step is owner/DBA evidence delivery and identity binding, not database creation.


## Phase 2.3.6 verification update (2026-11-06)

**BLOCKED – OWNER EVIDENCE REQUIRED.** No owner export, migration ledger, or current deployment-to-provider attestation was supplied. The prior Phase 2.2 report records Neon-related Vercel variable names and a shared Production/Preview/Development database scope, but does not prove the endpoint and is not freshly verified. All 38 migration files remain deployment-UNKNOWN. Do not initialize or choose a base schema. See `POSTGRESQL_PROVIDER_VERIFICATION.md`, `DEPLOYED_SCHEMA_COMPARISON.md`, and `MIGRATION_HISTORY_VERIFICATION.md`.


## Phase 2.3.6.1 readiness addendum (2026-11-06)

The owner collection checklist, export/ledger procedures, attestation/submission templates, complete 38-file source inventory and portal Git preservation audit are prepared. No owner evidence has yet been supplied. The actual provider/database/schema/ledger remain unknown and this evidence gate remains unresolved.


## Phase 2.3.6.2 intake update (2026-11-06)

Repository-only intake found no owner-supplied schema export, migration ledger, provider confirmation, or deployment attestation. The source inventory is available, but all 38 applied statuses remain UNKNOWN. Phase 2.3.7 is blocked pending owner evidence.
