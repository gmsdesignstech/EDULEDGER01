# Schema Conflict Resolution Register — Phase 2.3.3

**Status: BLOCKED — no conflict is merged or selected as canonical.** This is static source comparison, not deployed-schema evidence.

## Evidence status vocabulary

- **VERIFIED** — repository content was inspected in the current working tree; not proof of deployment.
- **HISTORICAL** — artifact records an earlier/proposed change; execution remains unknown.
- **INFERRED** — relationship or intent suggested by source, names, or behavior, not established by a deployed catalog.
- **UNKNOWN** — evidence is absent or insufficient, especially for deployed state.

## Schema artifact classification

| Schema element | Classification | What is established |
|---|---|---|
| Runtime DDL/patches in `src/lib/db.ts` | **VERIFIED** (working-tree source) | 56 table names and source-declared columns/constraints/indexes plus evolving initialization. Not a deployed baseline. |
| `prisma/schema.prisma` models/relations/enums | **VERIFIED** (source); **HISTORICAL** as alternate representation | 43 models/four enum declarations. Runtime does not use Prisma Client; equivalence is unestablished. |
| 38 SQL migration files | **HISTORICAL** | SQL text and repository presence are verifiable. Applied state for every file is **UNKNOWN**. |
| Local ignored migration manifest | **VERIFIED** (local artifact only) | `active: []`; 28 entries quarantined; 10 current files omitted. Not deployment history. |
| `database/tracked-migrations` | **UNKNOWN / ABSENT** | No authoritative executable chain exists there. |
| Production/Preview catalog, ledger, version, provider and role | **UNKNOWN** | No owner-bound export/catalog evidence was supplied. |
| School ownership and effective tenant access | **INFERRED** for many `institution_id` relationships; **UNKNOWN** for isolation | A tenant column or query predicate does not prove RLS, complete authorization, or tenant-consistent references. |

## Confirmed source conflicts — no automatic resolution

| Conflict | Evidence | Risk / status |
|---|---|---|
| Model/table coverage | Runtime declares 56 table names; Prisma declares 43 models. Prisma-only entities include Parent, Subject, Admission, Invoice, Assignment/Submission, LibraryBook, Transport, and Document, with no same-named semantic runtime CREATE TABLE definition. | **Unresolved.** They may be unused, represented differently (e.g. generic records), or missing; mapping is **UNKNOWN**. |
| Naming and mapping | Runtime SQL is predominantly snake_case; Prisma and historical SQL use separate mappings, including Prisma-era quoted/PascalCase assumptions. | **Unresolved.** Do not merge based on similar names. |
| Student identity fields | Prisma `Student` declares `admissionNo` and `userId`; runtime `students` uses `admission` and has no `user_id` in its base definition. | **Unresolved.** Linkage, uniqueness, and compatibility need actual catalog/query evidence. |
| User institution nullability | Prisma `User.institutionId` is nullable; runtime `users.institution_id` is `NOT NULL` and references institutions. | **Unresolved.** Nullability can affect platform/system accounts and school ownership. |
| Tenant uniqueness/integrity | Historical `202609260001_tenant_isolation.sql` describes tenant-scoped index/constraint changes; runtime has its own uniqueness/index declarations and has evolved. | **Unresolved.** Global vs per-institution uniqueness and cross-tenant FK behavior are data-sensitive. |
| Subscription/pricing | Historical migrations alter plan/subscription fields, prices, capacity and lifecycle; runtime also patches/upserts plans. | **Unresolved.** Replay could overwrite commercial state or collide with existing data. |
| WhatsApp security | Two quarantined migrations enable RLS on four WhatsApp tables and conditionally revoke roles; they declare no policies. Runtime DDL has no RLS declarations. | **Unresolved.** Neither proves live policy/privilege behavior. |
| Bootstrap/order | Historical SQL includes alterations, data updates/backfills, constraint replacement and overlapping definitions. Runtime initialization also applies patches and data-sensitive work. | **Unresolved.** Ordering and `IF NOT EXISTS` do not prove safe replay or shape equivalence. |
| Enums/database-only objects | Prisma has four enums; inspected runtime/migration sources do not establish matching PostgreSQL enum types. Extensions, triggers, functions, views, sequences and grants lack owner catalog evidence. | Deployed state **UNKNOWN**. Do not create inferred objects. |
| Applied migration state | No owner-verified ledger/export. Manifest is local and incomplete. | **UNKNOWN for all 38 SQL files.** Quarantine does not prove that files never ran. |

Full field-level differences are preserved in [SCHEMA_INVENTORY.md](SCHEMA_INVENTORY.md); migration effects/status are in [MIGRATION_RECONCILIATION_MATRIX.md](MIGRATION_RECONCILIATION_MATRIX.md). These remain separate evidence classes, not a merged schema.

## Data integrity and tenant risks

The [dependency map](SCHEMA_DEPENDENCY_MAP.md) covers schools/institutions, administrators/users, students, teachers/staff, parents, attendance, fees/payments, accounting, exams/results, timetables, assets/photos/documents, subscriptions/Razorpay, WhatsApp, notifications and Super Admin. These are source relationships only.

- Many school-owned records have `institution_id`; some platform, session, event, or subordinate records do not. Verify each read/write derives school identity from an authenticated server principal.
- Single-column FKs may allow a child to reference a different institution's parent unless tenant consistency is enforced or checked transactionally.
- Polymorphic account/source IDs may lack declarative FKs; orphan and cross-school references need reconciliation.
- Parent/student membership, teacher/staff identity, administrator privileges and Super Admin boundaries need adversarial role/object tests.
- Attendance, fees, accounting, payments and subscriptions need verified idempotency, immutable references, and duplicate handling before data backfills or uniqueness changes.
- Current source stores student photos, school images, signatures and documents in PostgreSQL-backed `school_assets`; verify ownership predicates, access paths, backup coverage and privacy. No Supabase Storage client use was found in application source.
- Razorpay and WhatsApp tenant linkage/consent/message ownership need provider and database evidence.
- Server-side authorization patterns do not prove deployed grants, RLS or two-school access isolation.

## Resolution rule

Bind owner evidence to the deployment; compare it object-by-object with runtime, Prisma and historical SQL; disposition each conflict with data impact and owner sign-off; only then plan a separately authorized isolated rehearsal. This document authorizes no SQL or database action.
