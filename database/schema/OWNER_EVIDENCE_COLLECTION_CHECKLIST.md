# Owner PostgreSQL evidence collection checklist

**Purpose:** Collect enough non-secret evidence to verify the PostgreSQL database serving the EduLedger Production deployment and prepare offline schema/migration review. This checklist does not authorize database initialization, migration execution, deployment, or Production changes.

## 1. Identify the exact deployment

- [ ] Confirm Vercel team/organization and project name/ID against owner records.
- [ ] In **Project → Deployments**, select the current deployment serving `https://eduledger.co.in`; record deployment ID/URL, environment, source branch, commit SHA, creation time and status.
- [ ] Confirm the deployment is the Production deployment assigned to the production domain. Do not create, promote, redeploy, or change domain settings.
- [ ] In **Settings → Environment Variables**, record `DATABASE_URL` name and scopes only. Never reveal, copy, screenshot, pull, or print the value.
- [ ] Record any Preview branch-specific overrides, Development scope, custom environments, and provider integration labels. Do not infer provider from names.
- [ ] Record who privately mapped the Production variable to the provider resource/database and who independently reviewed that mapping.

## 2. Verify provider and target identity

- [ ] Record actual provider (or `unknown`), stable project/instance ID with sensitive portions redacted, region, PostgreSQL version, database name if owner approves disclosure, and non-secret role label.
- [ ] Confirm by owner attestation that this database is the target used by the identified Production deployment's `DATABASE_URL`.
- [ ] Record Production, Preview, and Development separately. State whether each database target is distinct; if unproven, mark `UNKNOWN`.
- [ ] Do not provide connection strings, credentials, private addresses, tokens, API keys, or unredacted endpoint details.

## 3. Provide schema-only evidence

- [ ] Follow [PostgreSQL schema export procedure](POSTGRESQL_SCHEMA_EXPORT_PROCEDURE.md) on an owner-controlled workstation or provider-approved interface, using the verified target and an approved read-only role.
- [ ] Provide only an owner-reviewed **schema-only** export. No table rows, large objects, backups, seed data, or school/financial records.
- [ ] Include all EduLedger application schemas and disclose omitted/provider-managed schemas.
- [ ] Supply export metadata: generation time/timezone, server/client versions, schema scope, role label, file size and SHA-256. Do not supply the database URI.
- [ ] Supply separate catalog metadata for ownership, ACL/grants, role membership/attributes, RLS flags/policies, and objects not represented in the dump.
- [ ] Review the export for sensitive object names/definitions, default literals, comments, function/view bodies, policy expressions, embedded endpoints/secrets, and personal information. Keep the raw artifact under owner control.

## 4. Provide migration history

- [ ] Follow [migration ledger procedure](POSTGRESQL_MIGRATION_LEDGER_PROCEDURE.md); identify the actual migration runner and ledger from owner/deployment evidence, not assumptions.
- [ ] Provide the ledger schema/table name and DDL/columns, if present, plus metadata-only rows with identifier, checksum if stored, applied/start/finish time, status, and failure/incomplete markers.
- [ ] State whether the ledger covers every migration runner and out-of-band change. If no authoritative ledger exists, provide an explicit owner/DBA statement and supporting evidence; do not infer all files are pending.
- [ ] Identify manually applied DDL or schema changes, with date, target, actor role, ticket/change record, and object scope. Do not submit sensitive SQL literals or data values.
- [ ] Compare the owner record to all 38 rows in [migration history verification](MIGRATION_HISTORY_VERIFICATION.md). Resolve repo-only, ledger-only, duplicate-ID, checksum, ordering, and failed-record anomalies; leave unresolved rows `UNKNOWN`.

## 5. Deployment attestation and secure handoff

- [ ] Complete [deployment/database attestation template](DEPLOYMENT_DATABASE_ATTESTATION_TEMPLATE.md).
- [ ] Complete [submission template](OWNER_POSTGRESQL_EVIDENCE_SUBMISSION_TEMPLATE.md) and include an evidence index/hash manifest.
- [ ] Exclude `.env`, `.env.local`, `DATABASE_URL`, all credentials/tokens/API keys, password files, role verifiers, and personal/school/payment records.
- [ ] Keep evidence files outside public directories and outside Git. Do not paste raw exports or screenshots into chat, issues, logs, or reports.
- [ ] Transfer the reviewed redacted evidence via the owner-approved encrypted/access-controlled channel. The owner retains the raw artifacts and source hash.

## 6. Reviewer disposition

- [ ] Confirm artifact hash and provenance against the owner submission manifest.
- [ ] Confirm provider/deployment identity is consistent across the attestation and export metadata without seeing credentials.
- [ ] Complete offline object comparison and migration history disposition; do not execute the export or migrations.
- [ ] Record discrepancies and owner/DBA decisions without merging conflicting schemas.
- [ ] Keep Phase 2.3.6 acceptance blocked until the required evidence is verified. Phase 2.3.7 may begin only when [entry criteria](PHASE_2_3_7_ENTRY_CRITERIA.md) are satisfied.
