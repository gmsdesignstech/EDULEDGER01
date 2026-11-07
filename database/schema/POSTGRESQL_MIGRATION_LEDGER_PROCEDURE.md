# Owner procedure: PostgreSQL migration history

**Status before owner submission: unknown.** This procedure gathers evidence; it does not execute migrations, connect on behalf of the owner, or authorize schema changes.

## 1. Identify the actual migration mechanism

Ask the Production deployment owner/DBA which process has historically applied schema changes: CI/CD job, hand-run SQL, provider migration feature, application script, or other. Confirm from release/change records and the exact production deployment commit. Do not assume that Prisma, Supabase, a `schema_migrations` table, or any filename is authoritative.

Repository evidence shows a local inventory of 38 SQL files and several standalone `scripts/migrate-*.mjs` references. These scripts are capable of submitting SQL if run, but their presence is not proof they were run. They were not run for this phase. See the per-file `Referenced by local script` field in [migration history verification](MIGRATION_HISTORY_VERIFICATION.md).

## 2. Obtain the actual ledger safely

1. Have the DBA identify the exact ledger schema/table from the migration runner or provider/deployment records.
2. Request its DDL/column list and ledger scope. Verify privately that it belongs to the same database identified in the Production deployment attestation.
3. With an approved read-only role/provider export, provide metadata-only records: migration identifier/name, checksum if stored, start/applied/finished timestamp and timezone, status, failure/incomplete marker, and runner identity/version. Exclude SQL payloads, logs with values, credentials, password hashes, and unrelated data.
4. Include records for failed, partially applied, rolled-back, repaired or manually resolved migrations. State whether each record is transactionally atomic and whether the ledger covers all runners and manual changes.
5. If no ledger exists, provide an explicit owner/DBA statement identifying the evidence searched and why no authoritative ledger is available. A missing table alone does not establish that no migration ran.

Do not create a ledger, execute a query from this agent, run migration-list/repair/push/reset commands, or edit any repository migration. An owner may use a provider-approved read-only inspection method after verifying target identity; this package only asks for a reviewed metadata export.

## 3. Record manual schema changes

For every known manual/out-of-band schema change, record approximate/exact date, environment/database identity, actor role (not credential), change request/ticket, affected objects, whether the change was committed to a migration file, and verification source. Do not submit personal data or sensitive SQL literal values. If unknown, write `UNKNOWN`.

## 4. Compare with repository inventory

Compare the owner evidence against each of the 38 identifiers and paths in `MIGRATION_HISTORY_VERIFICATION.md`. Match checksum when the ledger stores one. A matching filename alone is not enough. Classify each row:

- **Confirmed applied:** identity-bound authoritative record matches the exact migration and owner attests that the ledger is complete.
- **Confirmed not applied:** owner confirms an authoritative complete ledger covers all runners/out-of-band activity and has no matching successful record.
- **UNKNOWN:** partial/absent ledger, unknown target/scope, missing checksum with ambiguous source, multiple runners, or incomplete owner attestation.
- **Conflict:** checksum mismatch, duplicate ledger identifier/rows, success record with unknown source, failed/incomplete record, ordering anomaly, repository file with no ledger record under a supposedly complete ledger, or ledger record with no repository file.

The migration file inventory currently reports 31 Git-tracked files, four untracked files and three ignored local copies. This is source-control provenance, not execution status. The local manifest records 28 quarantined paths and omits 10 on-disk files; it is not a deployment ledger.

## 5. Review failed/partial and overlapping changes

Treat failed or incomplete rows as unknown outcome until the DBA verifies transaction boundaries, object state and follow-up repair. Compare ledger order to the current schema export and deployment/release records. Existing static flags include repeated `attendance_audit_logs`/`school_holidays` definitions in `202611030001` and `202611050002`, pricing/subscription changes repeated across migrations and runtime initialization, and `DROP CONSTRAINT`/`UPDATE`/type-conversion operations documented in the reconciliation matrix. These flags require manual review; they do not establish application or conflict outcome.

Do not mark migrations applied based on Git history, filenames, timestamps, local manifests, build logs, or `IF NOT EXISTS`. Keep unresolved entries `UNKNOWN` and do not prepare a replay order until schema and ledger evidence agree.
