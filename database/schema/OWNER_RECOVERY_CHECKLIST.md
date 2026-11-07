# Owner/DBA Recovery Checklist

**Purpose:** Collect safe evidence of the actual EduLedger database schema and migration history before any Preview initialization. Owner-operated only; no agent database connection is part of this phase.

## Never share

Do not provide passwords, full connection strings/URIs, access tokens, API keys (including Supabase secret/service-role keys), private keys, password hashes, school records, payment data, or unredacted screenshots. Do not put secrets in shell history, command arguments, chat, tickets, reports, or this repository.

## 1. Confirm target identity

An authorized owner/DBA should record, separately from the schema output:

- Vercel project, Production/Preview target, deployed commit or immutable deployment ID.
- Provider actually used (Supabase, Neon, or other), project identifier/name, region, database name and non-secret role name.
- Owner confirmation that this is the database reached by that deployment’s `DATABASE_URL`.
- For Preview, explicit confirmation of isolation from Production and production school data.
- Vercel environment variable **names and scopes only**, never values.

The supplied Supabase URL identifies an intended project endpoint only; it does not prove the Production database mapping.

## 2. Prepare schema-only evidence

Using approved provider dashboard tooling or an administrator workstation, export schema only from the owner-confirmed target. Keep the original owner-controlled. Omit ownership/ACL output where appropriate. Do not export table data.

Review function bodies, views, defaults, comments, policy expressions and literals for credentials, tokens, personal data or internal metadata. Share only a reviewed/redacted copy that retains the definitions needed for comparison. If export is unavailable, an authorized DBA may use [READ_ONLY_DATABASE_DISCOVERY.sql](READ_ONLY_DATABASE_DISCOVERY.sql) through approved tooling and review its output. Do not execute that file on Production as part of this phase.

## 3. Include catalog and history metadata

- PostgreSQL version and provider region/version labels.
- Extension names/versions.
- Schemas, tables, columns, types, nullability, defaults, generated/identity attributes.
- Primary, foreign, unique and check constraints; indexes and predicates.
- Views/materialized views, sequences, enum/domain types, functions, procedures and triggers.
- RLS enabled/forced state, policies, and database/schema/table/sequence/function grants.
- Database owner and application role name/attributes/privileges; never passwords or hashes.
- Migration ledger schema/table, DDL, applied identifiers/checksums/timestamps, plus owner attestation of authority. If absent, state “no known authoritative ledger”; do not derive applied status from filenames.
- Backup recency/retention and isolated restore evidence; never provide backup data.

## 4. Preserve chain of custody

Keep raw files in a restricted owner location and out of Git. Record collection time, tool/provider, operator role, target identity, source deployment commit, and owner-approved file hash if policy permits. Share only the approved redacted file and evidence index through the project’s secure channel. Mark each item provided/not available/not applicable and name the attesting owner.

## 5. Stop before initialization

Do not create a Preview database, apply schema, replay migrations, invoke runtime initialization, seed records, or run DB integration tests until target separation is verified, evidence is reviewed, conflicts are dispositioned, backup/restore is confirmed, an isolated rehearsal is approved, and a separate phase authorizes exact operations.

No password or connection secret is needed for this checklist.
