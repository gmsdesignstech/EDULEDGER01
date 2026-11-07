# Owner Evidence Submission Checklist — Phase 2.3.4

Use this checklist with [PHASE_2_3_4_OWNER_EVIDENCE_GUIDE.md](../../PHASE_2_3_4_OWNER_EVIDENCE_GUIDE.md). Submit only approved, redacted artifacts through an encrypted, access-controlled channel. Do not place raw files in Git or paste them into chat.

## A. Deployment and target identity

- [ ] Vercel team/workspace and project name recorded.
- [ ] Production deployment ID/URL, commit SHA, branch, timestamp and status recorded.
- [ ] Database-related Vercel variable names and scopes recorded; **values not shown or copied**.
- [ ] Owner confirms which provider and existing project/cluster serve this deployment.
- [ ] Provider, project/cluster ID/name, region, database name and non-secret role label recorded.
- [ ] Owner privately compared provider endpoint/project identity, database and role to the Production connection mapping without sharing the URI/password.
- [ ] Production and Preview target relationship recorded. If separate targets are not proven, marked **UNKNOWN**.
- [ ] Person responsible for attestation, role and collection date recorded.

## B. Schema-only PostgreSQL export

- [ ] Source is the owner-verified deployed database described above.
- [ ] Produced with `pg_dump --schema-only` or a provider-confirmed equivalent.
- [ ] No table rows, school records, financial records, seed data or full backup are included.
- [ ] Export command/options and compatible client version recorded (without connection string or credential).
- [ ] Object-ownership/ACL omission is recorded; separate grants/ownership metadata is included if required.
- [ ] Export reviewed for sensitive defaults, comments, function/view bodies, policy expressions, internal addresses and secrets.
- [ ] Raw export retained in restricted owner storage; only reviewed/redacted copy selected for submission.
- [ ] SHA-256 checksum recorded for the submitted copy if approved (integrity aid only, not proof of origin).

## C. Migration history

- [ ] Provider dashboard migration-history view or confirmed database ledger identified.
- [ ] Ledger schema/table name, DDL and column names included.
- [ ] Applied IDs and timestamps included; checksums included if the ledger stores them.
- [ ] Owner confirms whether this history is authoritative and describes its source/tool.
- [ ] If absent/untrusted, exact status supplied: **“no known authoritative applied migration history.”**
- [ ] No migration was applied/repaired/initialized to produce this evidence.

## D. PostgreSQL catalog and security metadata

- [ ] PostgreSQL version and provider region/version metadata.
- [ ] Extension names and versions.
- [ ] Tables/columns, defaults/types/nullability, keys/constraints and indexes.
- [ ] Views, sequences, enum/domain types, triggers and functions as visible to the DBA.
- [ ] RLS enabled/forced flags, policies and policy commands/expressions, reviewed for literals.
- [ ] Database/schema/table/column/sequence/function privileges and relevant role memberships/capabilities.
- [ ] Application database role identified by non-secret name; no password/hash included.
- [ ] Catalog query session role distinguished from the application role.

## E. Safe sharing review

- [ ] No password, full connection URI, API/service key, access token, private key, secret fingerprint, password hash, student/parent/staff data, or payment row is present.
- [ ] No raw backup, data dump, database log containing row payloads, or environment-variable screenshot is included.
- [ ] Project/host identifiers are retained only to the degree required for owner identity binding and permitted by policy.
- [ ] Files are sent via the approved restricted channel to the named review recipients.
- [ ] Owner states any omitted schemas/objects and why (for example provider-managed schemas not included by the dump tool).

## Submission index

| Artifact | File/name | Included? | Redaction/omission notes |
|---|---|---|---|
| Identity attestation |  | [ ] |  |
| Schema-only export |  | [ ] |  |
| Migration history |  | [ ] |  |
| Catalog/security inventory |  | [ ] |  |
| Version/extensions metadata |  | [ ] |  |
| Backup/restore metadata (no backup data) |  | [ ] |  |

**Owner sign-off:** I confirm the evidence is from the stated deployed application target to the best of my knowledge, has been reviewed for sensitive content, and contains no database credentials or school data.  
**Name/role:** ____________________  **Date:** ____________________

Incomplete identity binding or any unexplained omission keeps the recovery status **BLOCKED — OWNER EVIDENCE REQUIRED**. Do not proceed to Preview creation or initialization.
