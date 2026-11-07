# EduLedger deployment-to-database attestation

**Non-secret template.** Do not enter, attach, or reveal the value of `DATABASE_URL`, credentials, access tokens, private endpoints that the owner considers sensitive, or screenshots containing secret values. Use `UNKNOWN` where unverified.

## Vercel Production deployment

| Field | Value |
|---|---|
| Organization/team name | `GMS Designs and Tech` / owner-confirmed value: |
| Vercel project name and non-secret project ID | |
| Git repository and production branch | |
| Production domain | `https://eduledger.co.in` |
| Deployment ID or immutable deployment URL | |
| Deployment environment/status | `Production / Current / other / unknown` |
| Source commit SHA and timestamp/timezone | |
| `DATABASE_URL` exists in Production scope? | `Yes / No / Unknown` (scope only; value not shown) |
| Preview/Development/custom scope relationship | |

## PostgreSQL provider/resource (no credentials)

| Field | Value |
|---|---|
| Provider | |
| Project/instance ID (redacted if sensitive) | |
| Region | |
| PostgreSQL version | |
| Database name (if safe to disclose) | |
| Application role label (not username/password) | |
| Pooled endpoint used? | `Yes / No / Unknown` |
| Provider endpoint/project identity matched privately? | `Yes / No / Unknown` |
| Matched by authorized owner on | |

## Owner statement

Check one:

- [ ] I attest that the identified Production deployment's server-side `DATABASE_URL` resolves to the PostgreSQL provider resource and database listed above. I verified this privately without disclosing the connection string or credentials.
- [ ] I cannot verify that mapping; Production deployment-to-database identity remains `UNKNOWN`.

Describe the safe evidence used for the private comparison (for example, provider integration/resource association plus owner provisioning record). Do not include secret values:

>

## Environment separation

| Environment | Vercel variable scope only | Provider/database identity redacted | Distinct from Production proven? | Evidence/reviewer |
|---|---|---|---|---|
| Production | | | `N/A` | |
| Preview | | | | |
| Development | | | | |
| Custom (name) | | | | |

## Attestors

Deployment owner/administrator name and role: ______________________________
Provider/database owner/DBA name and role: ______________________________
Independent reviewer and role: ______________________________
Attestation date/time and timezone: ______________________________

No database connection, test, environment-variable change, deployment, or migration is authorized by this attestation template.
