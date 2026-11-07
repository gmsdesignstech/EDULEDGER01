# Deployed PostgreSQL schema comparison

**Status: NOT PERFORMED — owner export and identity binding are absent.** No export was executed. No database connection or SQL execution occurred. The report below separates source-to-source discrepancies from the still-unknown deployed schema.

## Evidence intake and offline safety

Require the owner to provide an identity attestation and an owner-approved schema-only export. The Phase 2.3.4 [owner guide](../../PHASE_2_3_4_OWNER_EVIDENCE_GUIDE.md) gives the export command shape and [export verification guide](SCHEMA_EXPORT_VERIFICATION_GUIDE.md) gives the detailed checklist. The export must come from the owner-verified production PostgreSQL target; a local database, Preview, staging project, provider backup, or repository schema file is not a substitute.

Before analysis, record the sanitized file name, byte size, SHA-256, export timestamp/timezone, `pg_dump` client version, PostgreSQL server version, schemas included/excluded, owner/reviewer, and deployment/database identity attestation. Preserve the raw artifact owner-side. Work only on an approved copy in a restricted offline workspace; do not commit it or paste it into chat. Do not run `psql`, `pg_restore`, migration tooling, the export itself, or any SQL from it.

Verify that the artifact is schema-only and does not contain table-row payloads (`COPY ... FROM stdin`, row `INSERT` statements, or data sections). Inspect filenames and text; do not open any attached backup/dump that the owner has not declared schema-only. Scan for credential strings, tokens, private keys, student/parent names, emails, phone numbers, addresses, and financial values. Treat function bodies, default literals, comments and policy predicates as potentially sensitive. Redact only in a review copy and document each redaction so it cannot silently change object semantics. If redaction would make a definition ambiguous, request a safe structured catalog inventory instead.

`pg_dump --schema-only --no-owner --no-privileges` dumps object definitions rather than table data, and omits ownership and ACL statements. Do not add `--no-policies`, because policy definitions are part of the requested evidence. Request owner/DBA-generated catalog metadata for ownership, grants, role membership/attributes, RLS flags and policies separately; PostgreSQL stores policy definitions in `pg_policy` and applies them only when row security is enabled. Confirm all application schemas and required objects are in scope; provider-managed schemas may be excluded and must be listed explicitly. A raw full backup is not acceptable. See PostgreSQL [`pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html) and [`pg_policy`](https://www.postgresql.org/docs/current/catalog-pg-policy.html) documentation.

## Object-by-object comparison checklist

Compare normalized object signatures; retain schema-qualified names and source line references. Do not auto-merge or choose a winner when definitions differ.

| Object | Compare and record |
|---|---|
| Relations/tables | Schema/name, ordinary/partitioned/foreign kind, partition parent/children, persistence, comments, ownership and RLS flags. Include tables with no rows. |
| Columns | Ordinal/name, exact PostgreSQL type/schema/typmod, nullability, collation, default, identity/generated status, and comments. Distinguish domain/enum types from text. |
| Primary/foreign keys | Ordered columns, target schema/table/columns, `ON UPDATE`/`ON DELETE`, match type, deferrability/initially-deferred state, and validated/NOT VALID status. Check tenant-key consistency; do not infer from column names. |
| Unique/check/exclusion constraints | Exact expression/columns, predicate, operator class/collation, deferrability, validation state, and owning index. Preserve expression and partial-index semantics. |
| Indexes | Definition, method, key/include columns, order/opclass/collation, predicate, uniqueness, validity/readiness and constraint attachment. |
| Enums and other types | Schema/name, ordered enum labels; domains/ranges/composites and their constraints. Compare against Prisma declarations without creating missing types. |
| Functions/procedures | Signature and overload, arguments/defaults, return type, language, volatility, strictness, security invoker/definer, owner, configuration/search_path, grants and reviewed body. Redact secrets without obscuring behavior. |
| Triggers | Table, timing, event/row-vs-statement, enabled state, constraint/deferred status, referenced function and definition. Separate internal FK triggers. |
| Views/materialized views | Definition, columns, dependencies, owner, grants, security-invoker behavior, refresh/index details. |
| Sequences/identity | Type, bounds, increment/cache/cycle, ownership/dependency, identity defaults. Do not read sequence values. |
| Extensions | Name/version/schema and whether provider supports it. Record extension presence separately from extension-owned objects excluded by dump filters. |
| RLS and policies | Enabled/forced flags per relation; each policy’s command, permissive/restrictive mode, target roles, `USING` and `WITH CHECK`; ownership and bypass behavior. |
| Permissions | Table/column/sequence/function/schema grants, grant option, default privileges, role memberships, role attributes including superuser/BYPASSRLS, and the exact runtime role. Do not export credential verifiers or secrets. |

Record for each object: `MATCH`, `SOURCE-ONLY`, `EXPORT-ONLY`, `DEFINITION-DIFF`, or `UNKNOWN`; include evidence file/hash and exact difference. Missing from a partial export is **UNKNOWN**, not absent. A catalog export plus `pg_dump` may contain different visibility depending on the role; document the effective export role.

## Current source baseline (not deployed truth)

| Source | Known facts | Deployed status |
|---|---|---|
| Runtime `src/lib/db.ts` | PostgreSQL-only `postgres.js`; 56 table names and evolving initialization/patches. | Source verified; not an approved baseline. |
| `prisma/schema.prisma` | 43 models; four enums (`Role`, `Status`, `PaymentStatus`, `AttendanceStatus`). | Separate representation; mapping/deployment unknown. |
| Historical SQL | 38 files under `database/migrations` and `prisma/migrations`. | Application state unknown for every file. |
| Owner-bound schema export | None supplied in the reviewed workspace. | **UNKNOWN / NOT VERIFIED** |

### Known source-to-source discrepancies before export comparison

- Prisma `Student` uses `admissionNo` and a `userId` relation; runtime DDL uses `admission` and has no `students.user_id` in its base definition.
- Prisma `User.institutionId` is nullable; runtime `users.institution_id` is `NOT NULL` and references `institutions`.
- Prisma includes semantic entities such as Parent, Subject, Admission, Invoice, Assignment/Submission, LibraryBook, Transport and Document without same-named semantic runtime `CREATE TABLE` definitions. Some could be unused, represented through other storage, or absent; mapping remains unknown.
- Runtime identifiers are predominantly snake_case; Prisma and historical SQL carry separate mappings/assumptions. Similar names are not proof of object equivalence.
- Prisma enum declarations do not prove matching PostgreSQL enum types exist. Runtime and inspected migration initialization do not establish a canonical enum mapping.
- Runtime initialization includes evolving DDL, conditional indexes, backfills/upserts and data-sensitive constraints. Historical migrations include overlapping object definitions and updates. `IF NOT EXISTS` does not prove a shape match or safe replay.
- Prior static reports found duplicate/overlapping runtime and migration definitions; `202611030001_attendance_upgrade` and `202611050002_attendance_schema_recovery` both define attendance audit/holiday structures and related settings changes. These are potential semantic conflicts, not proof of duplicate application.
- Functions, triggers, views, sequences, extensions, effective grants, RLS policies and deployed roles remain unknown from owner evidence.

See [schema conflict register](SCHEMA_CONFLICT_RESOLUTION.md), [schema inventory](SCHEMA_INVENTORY.md), and [migration matrix](MIGRATION_RECONCILIATION_MATRIX.md) for source-level details. Once an owner export is available, fill the checklist above against the export and all source baselines. Do not automatically merge or select a schema. If a discrepancy can affect school/student/parent/financial data or tenant boundaries, mark it blocking pending DBA and owner disposition.

## Current decision

No deployed-vs-source comparison can be completed yet. Do not author or approve `BASE_SCHEMA.sql`, initialize any database, or proceed to Phase 2.4.
