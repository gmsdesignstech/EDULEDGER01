# EduLedger PostgreSQL evidence submission template

**Instructions:** Fill with non-secret metadata only. Leave unknown values as `UNKNOWN`; do not guess. Attach only an approved redacted schema-only export and metadata-only migration evidence using an access-controlled channel. Never paste credentials or school records into this document.

## Submission control

| Field | Value |
|---|---|
| Evidence package ID | |
| Submitter name / authorized role | |
| Organization/team | |
| Collection date/time and timezone | |
| Independent reviewer / role | |
| Approved transfer channel | |
| Raw evidence retained by owner at | `Owner-controlled restricted storage` |
| Redaction reviewed by | |

## A. Provider and target

| Field | Value (redacted/non-secret only) |
|---|---|
| Provider | |
| Project/instance ID | |
| Region | |
| PostgreSQL version | |
| Database name (if safe) | |
| Application role label (no username/credential) | |
| Endpoint/project identity independently matched? | `Yes / No / Unknown` |
| Connection pooled? | `Yes / No / Unknown` |
| Environment | `Production / Preview / Development / Other / Unknown` |
| Production deployment association | See attestation template |

## B. Schema-only export artifact

| Field | Value |
|---|---|
| Approved redacted filename (no secrets in path) | |
| SHA-256 of submitted copy | |
| File size | |
| Export timestamp/timezone | |
| `pg_dump` client version or provider export tool/version | |
| PostgreSQL server version source | |
| Schemas included | |
| Schemas/objects excluded and reason | |
| Export option confirmed schema-only | `Yes / No` |
| Table data/COPY/INSERT/large-object payload excluded | `Yes / No` |
| Ownership/ACL omitted? | `Yes / No; separate evidence attached?` |
| Function/policy definitions reviewed for secrets and PII | `Yes / No` |
| Raw artifact retained owner-side | `Yes / No` |

## C. Object/security catalog evidence

Mark `Included`, `Not present per owner`, `Not visible to collection role`, or `Unknown` for each category. A blank does not mean absent.

| Category | Status | Evidence file/section |
|---|---|---|
| Tables, partitions and columns/types/defaults | | |
| PK/FK/unique/check/exclusion constraints | | |
| Indexes | | |
| Enums/domains/custom types | | |
| Views/materialized views | | |
| Sequences/identity dependencies | | |
| Functions/procedures | | |
| Triggers | | |
| Extensions and versions | | |
| RLS enabled/forced flags | | |
| RLS policy definitions | | |
| Schemas/table/column/sequence/function privileges | | |
| Role membership and non-secret role attributes | | |
| Ownership/default privileges | | |

## D. Migration ledger

| Field | Value |
|---|---|
| Migration framework/runner identified from | |
| Ledger schema/table (or `none known`) | |
| Ledger definition/columns evidence | |
| Ledger scope and target identity | |
| Complete for all runners/out-of-band changes? | `Yes / No / Unknown` |
| Metadata-only rows artifact/hash | |
| Failed/incomplete records included? | `Yes / No` |
| Duplicate/checksum mismatches found? | |
| Manual schema changes known? | `Yes / No / Unknown` |
| Manual change evidence reference | |
| Owner statement if no authoritative ledger | |

## E. Evidence handling attestation

- [ ] No `.env`, `.env.local`, database URI/connection string, passwords, tokens, API keys, private keys, or role verifiers included.
- [ ] No student, parent, staff, school, payment, payroll, or other row data included.
- [ ] No full database backup included.
- [ ] Files were reviewed for sensitive object names/definitions and embedded literals before sharing.
- [ ] Raw artifacts remain owner-controlled; submitted copies are redacted and hashed.
- [ ] No artifact was committed to Git or placed under a public web directory.

Submitter attestation: `I confirm the supplied metadata is accurate to the best of my knowledge and that the attached copies were reviewed for the exclusions above.`

Name/role: ____________________  Date/time: ____________________  Reviewer: ____________________
