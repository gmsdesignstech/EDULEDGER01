# Schema Export Verification Guide

This is an owner/DBA procedure for producing and checking a schema-only PostgreSQL export. It is not authorization to connect to Production on behalf of the agent, change a database, or initialize Preview.

## 1. Before export

1. Complete the identity steps in [Phase 2.3.4 owner guide](../../PHASE_2_3_4_OWNER_EVIDENCE_GUIDE.md).
2. Use only the database owner confirms serves the named Production deployment. Record provider, project/cluster, database and non-secret role labels separately from the export.
3. Use an approved read-only account and an up-to-date `pg_dump` compatible with the server (same or newer client major version, per PostgreSQL guidance).
4. Store output in restricted owner-controlled storage. Confirm disk encryption/access controls and adequate space. Do not use or send a full backup.
5. Use a password prompt or protected PostgreSQL password file/credential manager. Never put the password or full URI in command arguments, shell history, logs, chat or a repository.

## 2. Schema-only export command shape

Replace placeholders before execution; do not insert a password. The connection string contains only endpoint/database/non-secret role metadata and enforces TLS. The client should prompt for authentication if needed, or use the DBA's protected credential store.

```text
pg_dump --schema-only --no-owner --no-privileges --file=eduledger-schema.sql --dbname="host=<verified-host> port=<port> dbname=<database> user=<read-only-role> sslmode=require"
```

`--schema-only` exports definitions rather than table data. `--no-owner` and `--no-privileges` omit original ownership/ACL statements; gather those separately with the catalog query pack. If the provider requires certificate validation stronger than `sslmode=require`, use its documented CA/hostname verification settings. Do not disable TLS. `pg_dump` does not export an application's table rows with this option; nevertheless review output because function bodies, defaults, comments or policy expressions can contain sensitive literals.

For Supabase only after confirming that it is the actual provider: `supabase db dump --linked --file=eduledger-schema.sql` is a CLI alternative and defaults to schema-only, but it excludes managed schemas (including `auth` and `storage`) and extension schemas. Record those omissions; use an approved `pg_dump`/catalog process if those objects are in scope. Do not use `db pull`, `db push`, `migration repair`, or `db reset` to create evidence. References: [Supabase `db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump), [PostgreSQL `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html).

## 3. Verify the artifact locally without restoring it

The DBA/owner should record:

- Source provider/project/database identity attestation and deployment commit.
- Export tool/version, server version, collection timestamp, exact safe options, and selected schemas/exclusions.
- Exit status and output file size. Do not post command history or connection details.
- SHA-256 checksum for the reviewed submission copy where policy allows; this detects accidental change but does not prove source identity.
- Whether ownership/ACL, provider-managed schemas, extension objects, policies, or other objects were excluded.

Review the file without executing/restoring it:

- Confirm the `pg_dump` options clearly identify schema-only output.
- Confirm no data-export mode, data-only flag, table-data inclusion, seed file, or full backup was used.
- Search manually for row data, embedded passwords/tokens, personal data, financial data, internal hostnames, and sensitive literals. Redact only in a copy and document any removed definitions.
- Confirm expected application schemas and objects are represented; compare catalog inventory with the export to identify permission-based omissions.
- Inspect constraints, indexes, enum/domain types, views, functions, triggers, sequences, RLS policies and grants as separate evidence; `--no-owner --no-privileges` intentionally omits owner/ACL statements.
- Do not infer that 56 runtime tables, 43 Prisma models, or repository migration files equal the export.

Never run `psql` on this artifact against any live database as a verification step. A later isolated restore rehearsal needs separate approval, a disposable target and a backup/restore plan.

## 4. Retrieve migration history separately

1. Inspect the provider's migration-history page if available. In a Supabase project, the dashboard may show a **Database → Migrations** view; CLI-managed history is normally in `supabase_migrations.schema_migrations`.
2. Ask the DBA to verify the exact ledger schema/table and columns from catalog metadata before querying it. Existing query pack: [READ_ONLY_DATABASE_DISCOVERY.sql](READ_ONLY_DATABASE_DISCOVERY.sql).
3. Export only approved fields such as migration identifier/version, checksum and applied timestamp. Use explicit columns, never `SELECT *`. Do not export SQL payloads, logs containing row values, or database data.
4. If the table is absent, say so. If another tool/ledger is used, record its name, format and owner attestation. Do not initialize a Supabase or custom migration ledger for this audit.
5. Reconcile ledger rows to immutable migration files and deployment/release evidence. A row proves the ledger recorded an identifier, not necessarily that current schema equals that migration; check for manual changes, failed partial runs, and out-of-band updates.

Supabase's standard history is not guaranteed to exist: projects using a custom/manual migration process may have no `supabase_migrations.schema_migrations` table. See [Supabase migration tracking](https://supabase.com/docs/guides/deployment/database-migrations) and [migration list reference](https://supabase.com/docs/reference/cli/supabase-migration-list).

## 5. Cross-check with read-only catalog evidence

Use the existing [read-only query pack](READ_ONLY_DATABASE_DISCOVERY.sql) through an owner-approved SQL editor/client. It covers:

- Current database/effective role/server version and extensions.
- Schemas, tables, partitioned tables, views, materialized views, sequences and columns.
- PK/FK/unique/check/exclusion constraints and index definitions.
- PostgreSQL enum labels, view definitions, sequence ownership, non-internal triggers and user routines.
- RLS enabled/forced state and policies.
- Table/column, database/schema grants, and role capability metadata.
- Candidate migration tracking relation names and columns.

The query pack's SQL text is intended to run in a read-only transaction and finish with rollback. It was not executed by this audit. Function/view/policy definitions and role names can be sensitive; redact before sharing. SQL Editor's `current_user` may be an administrative role, so do not confuse it with the application's `DATABASE_URL` role.

## 6. Release gate for offline review

Submit the reviewed schema-only export, explicit migration history/absence statement, catalog/security inventory, provider/deployment identity attestation, version/extensions metadata, and [completed submission checklist](OWNER_EVIDENCE_SUBMISSION_CHECKLIST.md) using a restricted encrypted channel. Never send a backup with data, a connection string, a password or an API key. If safe sharing is not possible, retain the original and supply an owner-approved redacted object inventory.

Until the identity binding and artifacts are reviewed, authoritative schema and migration status remain **UNKNOWN** and the project remains **BLOCKED — OWNER EVIDENCE REQUIRED**.
