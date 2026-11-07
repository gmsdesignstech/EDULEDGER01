# Phase 2.3.7 entry criteria

**Scope once admitted:** Offline schema reconciliation and migration recovery planning only. Phase 2.3.7 must not connect to a database, execute SQL, run migrations, initialize/synchronize schema, change Vercel, modify Production, or alter school data.

## Required gates

All eight gates must be verified and recorded before Phase 2.3.7 begins:

1. **PostgreSQL provider verified.** Owner attestation identifies the actual provider and stable project/instance identity, region and PostgreSQL version without credentials.
2. **Production database identity verified.** Authorized deployment and database owners attest that the Production deployment serving `https://eduledger.co.in` uses the named PostgreSQL database through server-side `DATABASE_URL`, matched privately without revealing its value.
3. **Owner-provided schema-only export available.** A redacted, hashed, owner-reviewed export from that exact target is available for offline inspection; it contains no table rows or school/financial data, and its schemas/scope are documented.
4. **Migration ledger available.** Owner/DBA identifies the actual runner and authoritative ledger, supplies its definition and metadata-only records including failed/incomplete states, or provides an explicit attestation that no authoritative ledger exists. Completeness/scope is documented.
5. **Deployment-to-database attestation available.** The deployment ID/URL, environment, commit, provider/database identity and authorized owner confirmation are complete using `DEPLOYMENT_DATABASE_ATTESTATION_TEMPLATE.md`.
6. **Evidence reviewed for secrets and personal data.** A reviewer records that no `.env*`, `DATABASE_URL`, credentials, tokens, API keys, personal/school/payment rows, or unreviewed sensitive definitions are included. Raw evidence remains owner-controlled.
7. **All 38 repository migrations inventoried.** `MIGRATION_HISTORY_VERIFICATION.md` has all 38 file rows, local references/risks, owner-ledger comparisons and an evidence-backed disposition. Any row without proof remains `UNKNOWN`; all duplicates, missing artifacts, checksum conflicts, failures and overlaps are documented.
8. **Repository preservation risks documented.** The owner has reviewed `EDULEDGER_PORTALS_GIT_PRESERVATION_REPORT.md` and explicitly decided how to preserve the ignored portal cleanup. No tracking change occurs as a side effect of admission.

## Phase 2.3.7 allowed work after all gates pass

- Compare the verified export object-by-object against runtime DDL, Prisma, and all 38 historical SQL files.
- Reconcile migration ledger records with each local identifier/checksum and document verified applied/unapplied/unknown/conflict states.
- Prepare a recovery plan and proposed base-schema artifact only if discrepancies are resolved and owner/DBA approve its scope.
- Record unresolved conflicts without merging or choosing a winner automatically.

## Explicitly out of scope for Phase 2.3.7

No Production or unknown-target connections, SQL execution, database writes, migration execution/repair, initialization, schema synchronization, reset, deployment, Vercel setting changes, or school-data modification. Any later execution requires a separate phase and explicit target-specific authorization.

## Current gate result

Provider identity, Production database mapping, owner schema export, migration ledger, deployment attestation, and evidence safety review remain outstanding. Phase 2.3.7 entry is therefore **not yet satisfied**. Do not proceed automatically.
