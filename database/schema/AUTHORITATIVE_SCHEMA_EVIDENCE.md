# Authoritative schema evidence register

**Status: BLOCKED — actual deployed database schema is unverified.** This register separates repository definitions from deployed database evidence.

## Owner-supplied Supabase project endpoint (2026-11-06)

The owner supplied `https://bovflvueeuxpemsjjvih.supabase.co` and identified it as the new Supabase project. Record this as **owner-provided endpoint metadata**, not independent verification. It identifies a Supabase project URL, but does not establish that Production/Vercel `DATABASE_URL` points to that project's PostgreSQL database, that this is the actual production target, or that its deployed schema/migration history matches the application. No request was sent to this endpoint and no credentials were read.

## Schema categories

| Category | Evidence | What it establishes | Status |
|---|---|---|---|
| **A. Current application runtime schema** | Current working-tree `src/lib/db.ts` postgres.js adapter and `initialize()`; 56 runtime CREATE TABLE names plus later ALTER/index/data initialization | The shape the checked-out source attempts to create/use in its initialization and queries | **Verified from working-tree source only**; source has pre-existing edits and is not proof of what the deployed commit runs |
| **B. Historical Prisma schema** | `prisma/schema.prisma`; 43 model declarations and four enums | A separate model representation, including fields, relations, mappings, defaults, and constraints declared there | **Verified source artifact; not established as runtime-authoritative**. Prisma Client/CLI are not configured as the app runtime |
| **C. Historical SQL migration schemas** | 38 current local SQL files, Git history for 34 paths, architecture/migration reports | Schema and data changes proposed in those files; some include base-like DDL, most have prerequisites, and several overlap runtime DDL | **Files verified; application state unknown**. No migration is proved applied |
| **D. Actual deployed database schema** | No authorized catalog export or migration ledger was supplied | Would establish the real deployed objects when bound to a verified deployment/database identity | **UNKNOWN / NOT VERIFIED** |
| **E. Unknown/unverified elements** | Functions, triggers, views, extensions, sequences, policies, effective grants, applied migration ledger, deployment-to-database mapping | Provider/deployment configuration and database objects not evidenced by the repository alone | **Owner evidence required** |

## Why A, B, or C cannot stand in for D

- Runtime initialization is mutable and combines table creation, ALTER patches, conditional index creation, data-sensitive backfills, and subscription-plan upserts.
- Prisma model fields differ from runtime SQL. Example: Prisma `Student` uses `admissionNo` and a `userId` relation; runtime `students` uses `admission` and contains no `user_id`. Prisma `User.institutionId` is nullable while runtime DDL requires `users.institution_id`.
- Migration files have unknown deployment state, and there is no complete active chain. The ignored manifest lists 28 quarantined files while 38 exist locally.
- Git history proves files/commits existed, not that a deployment executed them.
- Existing readiness and architecture reports explicitly say no live migration ledger/schema was inspected.

## Evidence that would change this status

1. A schema-only PostgreSQL catalog export from the owner-verified deployed database, with deployment/database identity recorded separately and safely redacted.
2. Read-only migration ledger metadata and rows, if such a ledger exists.
3. PostgreSQL version, extension inventory, RLS/policies, privileges, and provider metadata.
4. Vercel deployment commit/environment association and variable names/scopes only; never variable values.
5. Owner confirmation of the actual provider and the database used by the production application.

The exact request is in `OWNER_DATABASE_EVIDENCE_REQUEST.md`; owner-run read-only catalog queries are in `READ_ONLY_DATABASE_DISCOVERY.sql`.


## Phase 2.3.6 evidence review (2026-11-06)

No owner-provided schema-only export or migration ledger was present for offline review. Provider and Vercel deployment mapping remain unverified; the owner-supplied Supabase project endpoint is not bound to the runtime `DATABASE_URL`. Runtime, Prisma, and migration artifacts remain separate source evidence. Acceptance remains **BLOCKED – OWNER EVIDENCE REQUIRED**.


## Phase 2.3.6.1 owner submission preparation (2026-11-06)

The evidence package is ready for owner action, but no schema export, ledger or deployment attestation has been provided. Category D (deployed schema) remains UNKNOWN; runtime, Prisma and migration sources remain separate and unmerged.


## Phase 2.3.6.2 intake update (2026-11-06)

No owner evidence artifacts were supplied in the approved project location. The deployed schema and Production identity remain UNKNOWN; no source artifact was promoted to authoritative schema evidence.
