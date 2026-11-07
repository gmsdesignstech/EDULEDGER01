# Database Recovery Decision Matrix — Phase 2.3.3

**Current decision: BLOCKED — OWNER EVIDENCE REQUIRED.** No option is authorized by this matrix.

| Option | Required evidence | Benefits | Risks / limits | Current status / rule |
|---|---|---|---|---|
| **A. Recover actual deployed schema from verified schema-only export** | Owner/DBA export or complete catalog inventory, Vercel-to-provider/database identity binding, migration ledger, PG/version/security metadata, backup/restore status | Highest fidelity to current objects; reveals out-of-band changes | Wrong-target export risk without identity binding; sensitive literals; schema alone may not explain intent; ledger can be incomplete | **Preferred, unavailable.** Use as baseline only after owner proves it came from the database serving the identified deployment and it passes review. |
| **B. Recover from independently verified deployment artifacts** | Immutable deployed commit/build, deployment-to-database binding, scripts/checksums proven executed, release/operations records, corroborating ledger or snapshot | Helps explain history when export is unavailable | May omit manual/runtime DDL, console changes, hotfixes, failed/partial runs; Git presence/timestamps do not prove execution | **Fallback/corroboration, not supplied.** Must still obtain current catalog evidence before initialization. |
| **C. Reconstruct from runtime and historical evidence** | Explicit owner approval of intended semantics, object-by-object conflict disposition, compatibility/data tests, disposable PostgreSQL rehearsal, backup/restore plan | Can create a maintained schema if historical authority is lost | Highest risk of invented/missing objects, broken compatibility, changed tenant/payment/student meaning, or unsafe replay | **Not approved.** Last resort only with owner sign-off and separately authorized isolated testing; never auto-merge. |

## Recommendation and stop condition

Pursue **A** first. Use **B** to corroborate or explain history; it cannot substitute for current target identity/catalog proof. Consider **C** only if A/B are insufficient and the owner explicitly approves reconstruction and rehearsal.

No schema export, verified applied ledger, owner-confirmed provider/target mapping, PostgreSQL version, complete catalog/security inventory, or Preview isolation evidence is available. Therefore:

> **BLOCKED — OWNER EVIDENCE REQUIRED. Do not proceed to Preview database creation or initialization.**

This permits only evidence collection and offline review. It authorizes no database connection, SQL execution, migration, project creation, Vercel change, or deployment.
