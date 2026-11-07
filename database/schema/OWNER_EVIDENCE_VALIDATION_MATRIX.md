# Owner evidence validation matrix — Phase 2.3.6.2

**Review scope:** Approved EduLedger repository documentation and the existing `database/schema/` evidence/documentation location only. No Vercel or database account access. No owner-supplied artifacts were found to process.

| Evidence category | Required evidence | Intake result | Validation result | Required owner action |
|---|---|---|---|---|
| PostgreSQL provider confirmation | Provider, redacted project/instance identity, environment, and confirmation this is the Production DB | **MISSING** | **UNVERIFIED**; source proves PostgreSQL driver only. Historical Vercel variable names and a separately supplied Supabase project do not bind the Production endpoint. | Complete the provider attestation in `DEPLOYMENT_DATABASE_ATTESTATION_TEMPLATE.md`. |
| Production database identity | Actual non-secret identity matched privately to Vercel Production `DATABASE_URL` | **MISSING** | **UNVERIFIED**; no owner mapping or live account inspection. | Owner/deployment administrator confirms the mapping without sharing the URI. |
| Schema-only export | Owner-provided PostgreSQL schema dump or equivalent catalog export with requested objects | **MISSING** | **NOT PERFORMED**; no export file was supplied. No SQL export was parsed or executed. | Follow `POSTGRESQL_SCHEMA_EXPORT_PROCEDURE.md`; retain raw artifact owner-side. |
| Migration ledger | Actual tracking table/process, metadata rows, failures/incomplete records, manual changes | **MISSING** | **NOT PERFORMED**; no ledger or owner no-ledger attestation was supplied. All 38 migration statuses remain `UNKNOWN`. | Follow `POSTGRESQL_MIGRATION_LEDGER_PROCEDURE.md`. |
| Deployment attestation | Production deployment ID/URL, environment, provider/DB association, authorized confirmation | **MISSING** | **UNVERIFIED**; local Vercel metadata and historical reports are not current owner attestation. | Complete the deployment/database attestation template. |
| Evidence security | Secret/PII review of actual submitted export and ledger | **MISSING** | **NOT PERFORMED**; no owner evidence artifact exists to scan. Project documentation was not treated as a substitute. | Owner reviews and submits approved redacted copies through a controlled channel. |
| Migration inventory consistency | Repository file count, IDs, paths, static references | **AVAILABLE — repository only** | **VERIFIED locally**: 38 files; detailed inventory in `MIGRATION_HISTORY_VERIFICATION.md`. This does not verify deployment history. | Compare owner ledger to every inventory row after receipt. |
| Schema comparison readiness | Identity-bound export and known source baselines | **EXPORT MISSING** | **BLOCKED**; runtime/Prisma/migration source conflicts are recorded, but no deployed comparison can be performed. | Provide verified export; reconcile object-by-object offline. |
| Repository preservation | Portal Git state and preservation risk | **AVAILABLE — repository only** | **DOCUMENTED**: `eduledger-portals/` is ignored/untracked workspace content, not a nested repo. Owner tracking decision remains pending. | Review `EDULEDGER_PORTALS_GIT_PRESERVATION_REPORT.md`; no tracking changes without approval. |

## Disposition vocabulary

- **MISSING** — no owner artifact was found in the approved project documentation/evidence location.
- **UNVERIFIED** — evidence is absent or does not establish the claim.
- **NOT PERFORMED** — the validation would require an artifact that was not supplied.
- **VERIFIED locally** — repository fact only; not a Production/database fact.

No sensitive owner artifact was found, so this matrix records no evidence validation failure. Missing evidence keeps Phase 2.3.7 blocked pending owner submission.
