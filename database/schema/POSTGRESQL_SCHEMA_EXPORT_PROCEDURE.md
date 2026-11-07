# Owner procedure: schema-only PostgreSQL export

**Owner/DBA action only.** This procedure does not authorize an agent to connect to any database. Do not export from an unverified endpoint. Do not export table data or a full backup.

## 1. Confirm target before export

1. Complete [provider verification](POSTGRESQL_PROVIDER_VERIFICATION.md) and [deployment/database attestation](DEPLOYMENT_DATABASE_ATTESTATION_TEMPLATE.md) for the Production deployment serving `https://eduledger.co.in`.
2. Have the authorized database owner privately match the target to Vercel Production `DATABASE_URL` without exposing its value. If mapping is uncertain, stop and report `UNKNOWN`.
3. Use a provider-approved, read-only catalog role and a workstation/storage location restricted to authorized reviewers. Do not use an application owner/superuser credential unless the owner has approved it for export.
4. Use a `pg_dump` client compatible with the server. Record client and server versions, export time/timezone, schemas, role label and identity attestation separately.

## 2. Export schema only

Use the provider-approved secure connection profile or interactive credential store. Do not place a password or full connection URI in a shell command, script, terminal transcript, process listing, chat, or repository. Example command shape using a preconfigured private libpq service profile:

```text
pg_dump --schema-only --no-owner --no-privileges --file=eduledger-schema.sql --dbname="service=eduledger-owner-readonly"
```

Use the provider's recommended TLS settings. Do not disable TLS. Do not add `--data-only`, `--include-foreign-data`, `--large-objects`, `--no-policies`, or a narrow `--schema` filter that would silently omit required app objects. Without schema filters, `pg_dump --schema-only` emits object definitions rather than table data for non-system schemas. Enumerate any provider-managed schemas intentionally excluded and obtain separate metadata if in scope. See PostgreSQL [`pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html).

`--no-owner --no-privileges` deliberately removes ownership/ACL statements from the shared copy. Obtain ownership, grants, default privileges, role membership/attributes, RLS flags and policies as separate reviewed catalog evidence. Do not provide password hashes or credential verifiers.

## 3. Verify the artifact offline before transfer

1. Keep the raw export owner-side. Calculate SHA-256 and record byte size, timestamp, client/server versions and exact schema scope.
2. Check that it is a plain-text SQL schema export and contains no row payloads such as table `COPY ... FROM stdin` data sections or row `INSERT` statements. The `--schema-only` option is the primary safeguard; the text review is a second check, not a substitute.
3. Review object names, defaults, comments, function/procedure bodies, view definitions, policy expressions and extension metadata for secret values, internal endpoint data or personal information. Definitions can themselves be sensitive even with all rows excluded.
4. Make a redacted review copy only after the owner approves it. Preserve SQL semantics; if a literal cannot be safely redacted without changing meaning, omit that object from the copy and provide an owner-reviewed structured summary instead.
5. Have a second authorized reviewer verify the redacted copy, checksum it, complete the [submission template](OWNER_POSTGRESQL_EVIDENCE_SUBMISSION_TEMPLATE.md), and transfer it through an encrypted, access-controlled channel.

## 4. Object coverage to accompany the dump

Confirm visibility/completeness for tables and partitions, columns/types/defaults, PK/FK/unique/check/exclusion constraints, indexes, enums/domains/custom types, views/materialized views, sequences, functions/procedures, triggers and extensions. Include RLS enabled/forced flags and each policy's roles, command, `USING` and `WITH CHECK` expressions. Include effective application-role grants, memberships, ownership and BYPASSRLS/superuser attributes without any credentials.

A collection role may not see every catalog object. Record the effective role and mark unseen objects `Not visible to collection role`, not `absent`. The PostgreSQL policy catalog records policy role/command and expressions; policies only apply when row security is enabled. See [`pg_policy`](https://www.postgresql.org/docs/current/catalog-pg-policy.html).

## 5. Prohibited shortcuts

- No full provider backup, `pg_dump` without `--schema-only`, `pg_dumpall`, table-data dump, storage-object export, or school-record sample.
- No `psql`, `pg_restore`, schema diff applying, migration, reset, repair, or initialization as part of this evidence procedure.
- No production URI, password, API key, token, private key or `.env*` file in the evidence package.
- No raw dump in Git, a public directory, support ticket, or chat.
