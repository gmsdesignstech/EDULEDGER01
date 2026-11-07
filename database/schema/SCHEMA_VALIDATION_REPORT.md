# Static schema validation report

**Status: PARTIAL / BLOCKED.** This report records offline source checks only. No database connection, migration, PostgreSQL parser execution, or deployment was performed.

## Checks performed

- Located 56 distinct `CREATE TABLE IF NOT EXISTS` names in the current working-tree `src/lib/db.ts` initialization SQL.
- Located 43 Prisma models and four Prisma enums in `prisma/schema.prisma`.
- Located 38 SQL migration files in the current working tree: 3 under `database/migrations` and 35 under `prisma/migrations`.
- Compared current DDL against Git history, the migration architecture decision, migration manifest, and historical SQL files.
- Reviewed source-level foreign key declarations, runtime `ALTER TABLE` patches, index DDL, and transaction wrappers in selected migrations.
- Static FK-reference extraction from runtime CREATE TABLE definitions found 20 referenced table identifiers; all targets match one of the 56 runtime table names. This is a lexical source check, not PostgreSQL validation and not a check of historical migration prerequisites.
- Confirmed no `CREATE TYPE`, `CREATE FUNCTION`, `CREATE TRIGGER`, `CREATE VIEW`, or `CREATE EXTENSION` declaration in inventoried SQL/initialization sources. The four Prisma enum declarations are schema-tool metadata; they are not evidence of database enum types because the application runtime does not use Prisma Client. Two quarantined migrations contain RLS enablement for four WhatsApp tables and conditional `REVOKE` statements, but no policy declarations.
- Confirmed migration planning helper is pure and non-executing; no authoritative migration discovery/execution runner was found in package scripts.

## Findings

| Check | Result | Detail |
|---|---|---|
| Canonical single schema | **FAIL** | Runtime DDL, Prisma schema, migrations, and ignored local manifest differ in table names, columns, and semantics. |
| SQL dependency order | **PARTIAL** | FK references reveal object dependencies; data backfills, conditional constraints, and runtime patches prevent proving total safe order. |
| Foreign-key target names | **PARTIAL** | Base runtime relationships are visible; migration files include prerequisites and optional links that depend on prior state. No PostgreSQL catalog check was performed. |
| Duplicate definitions | **CONFIRMED** | Many tables/indexes/columns are defined both in runtime initialization and historical migrations; `CREATE IF NOT EXISTS` does not ensure shape equivalence. |
| Type compatibility | **NOT VERIFIED** | SQL types are statically visible, but cross-version/runtime database compatibility and historical conversion outcomes require PostgreSQL rehearsal/catalog evidence. |
| Prisma/runtime entity mapping | **CONFIRMED STATIC DIFFERENCE** | 43 Prisma models versus 56 runtime table names. Models such as `Parent`, `Subject`, `Admission`, `Invoice`, `Assignment`, `Submission`, `LibraryBook`, `Transport`, and `Document` have no corresponding semantic runtime CREATE TABLE definition under those model entities. Some may be unused, mapped, or stored differently; mapping is unverified. |
| Application query consistency | **PARTIAL** | Main `src/lib/db.ts` query implementation was searched; dynamically assembled SQL, route authorization, and newly modified code require targeted follow-up. No database-backed integration validation was allowed. |
| Tenant isolation | **NOT VERIFIED** | Institution predicates exist in many runtime query functions, but no RLS policies or comprehensive composite tenant FKs were found. Four tables have RLS enablement in quarantined SQL with no policies in the files; effective runtime-role behavior is unknown. Route tests are not equivalent to PostgreSQL cross-tenant validation. |
| SQL syntax | **NOT VERIFIED BY ENGINE** | No PostgreSQL parser/server was invoked. Balanced static extraction cannot prove syntax or migration execution. |

## Specific inconsistencies / risks

1. `prisma/schema.prisma` is a second, incomplete/overlapping model of the application data, not an authoritative migration baseline. For example, its `Student` model uses `admissionNo` and a `userId` relation, while runtime DDL uses `admission`, has no `students.user_id`, and scopes admission uniqueness by institution. Prisma `User.institutionId` is nullable, while runtime `users.institution_id` is `NOT NULL`.
2. Migration identifiers and timestamp order do not prove applied order; migrations contain updates and constraint replacement that depend on existing data.
3. The local ignored manifest omits 10 files currently on disk and names no active migration; the authoritative directory does not exist.
4. Runtime initialization combines DDL, incremental patches, conditional index installation, data backfills, and subscription-plan upserts. It is not a clean, immutable base-schema artifact.
5. Database extension/function/trigger/view/sequence configuration and grants are not documented by the sources inspected.

## Safe next validation

Use only an explicitly disposable PostgreSQL instance in a separately authorized later phase. First approve a schema source, then run parser/server validation and compare `pg_catalog` output at each rehearsed stage. Production remains out of scope. Do not describe the current schema as PostgreSQL-validated.

## Phase 2.3.3 evidence readiness addendum (2026-11-06)

**Status: BLOCKED — OWNER EVIDENCE REQUIRED.** The checks above are source-only and do not establish deployed schema. No owner-bound schema-only export, applied migration ledger, provider/deployment identity binding, PostgreSQL version/catalog inventory, or effective security metadata was supplied. No database connection or SQL execution occurred. See `PHASE_2_3_3_DATABASE_EVIDENCE_REPORT.md`, `DATABASE_EVIDENCE_READINESS.md`, and `SCHEMA_CONFLICT_RESOLUTION.md`. Preview creation/initialization remains blocked. Earlier findings are retained.
