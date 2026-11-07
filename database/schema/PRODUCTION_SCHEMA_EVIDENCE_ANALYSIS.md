# Production schema evidence analysis — Phase 2.3.6.2

**Production export: MISSING.** No owner-provided schema-only SQL export, catalog inventory, or database-bound object definition was found in the approved project documentation/evidence location. Consequently, schema parsing, security scanning of an export, and deployed-vs-source comparison were **NOT PERFORMED**. No SQL was executed or imported.

## Repository baseline only

- Runtime source uses PostgreSQL through `postgres.js` and `DATABASE_URL`; the current working tree has 56 runtime table definitions as recorded in the schema inventory.
- `prisma/schema.prisma` contains 43 models and four enum declarations (`Role`, `Status`, `PaymentStatus`, `AttendanceStatus`). Prisma is a separate model description, not the runtime DB driver or proof of live PostgreSQL types.
- The repository has 38 historical SQL migration files. Their deployment status is `UNKNOWN`.
- These facts describe repository artifacts only. They do not establish the Production provider, endpoint, table set, column definitions, constraints, indexes, functions, triggers, RLS policies, grants or extensions.

## Export validation matrix

| Required category | Evidence received | Validation result |
|---|---|---|
| Schema-qualified tables/partitions | **MISSING** | Not parsed; deployed objects unknown. |
| Columns, PostgreSQL types, nullability, defaults, identity/generated attributes | **MISSING** | Not compared. |
| Primary, foreign, unique, check and exclusion constraints | **MISSING** | Not compared. |
| Index definitions, predicates and validity | **MISSING** | Not compared. |
| Enums, domains and custom types | **MISSING** | Not compared; four Prisma enums do not prove PostgreSQL enums. |
| Views/materialized views | **MISSING** | Not compared. |
| Functions/procedures and triggers | **MISSING** | Not compared. |
| Sequences and ownership/default linkage | **MISSING** | Not compared. |
| Extensions and versions | **MISSING** | Not compared. |
| RLS enabled/forced flags and policies | **MISSING** | Not compared; effective Production role behavior unknown. |
| Grants, ownership, default privileges, role memberships/attributes | **MISSING** | Not compared; runtime privilege model unknown. |
| Export provenance, hash, timestamp, server/client version and scope | **MISSING** | Identity and completeness cannot be checked. |
| Data-free and secret/PII review | **MISSING** | No export exists to scan. |

## Known source conflicts (not Production findings)

Existing repository reports identify differences that must be checked after an identity-bound export arrives:

- Prisma `Student.admissionNo` and `userId` relation versus runtime `students.admission` and no `students.user_id` in its base DDL.
- Prisma `User.institutionId` nullable versus runtime `users.institution_id NOT NULL` with an institution reference.
- Prisma semantic models including Parent, Subject, Admission, Invoice, Assignment/Submission, LibraryBook, Transport and Document do not have same-named semantic runtime `CREATE TABLE` definitions; actual representation/use is unknown.
- Runtime snake_case identifiers and Prisma/historical naming/mapping conventions differ.
- Prisma enum declarations do not establish deployed enum types; runtime and migrations have overlapping DDL, pricing changes, backfills, and constraint updates.
- Prior static review flags repeated attendance audit/holiday structures and settings changes in `202611030001` and `202611050002`, plus runtime/migration overlap. This does not prove a deployed conflict or either migration's execution.

No discrepancy with Production can be declared until owner evidence is supplied. Do not choose or merge a schema based on these source differences. Do not create `BASE_SCHEMA.sql`, import the export, initialize a database, or start Phase 2.3.7 without its entry gates.

## Owner action

Submit an identity-bound schema-only export and separately reviewed catalog/security metadata per `POSTGRESQL_SCHEMA_EXPORT_PROCEDURE.md`. Keep the raw artifact owner-controlled, inspect a redacted copy offline, and record every object as `MATCH`, `SOURCE-ONLY`, `EXPORT-ONLY`, `DEFINITION-DIFF`, or `UNKNOWN`. See `DEPLOYED_SCHEMA_COMPARISON.md` for object-level comparison requirements.
