# Migration recovery plan

**Status: BLOCKED — forensic inventory only. No migration was restored, activated, or executed.**

## What is known

- `MIGRATION_ARCHITECTURE.md` records the reason for quarantine: no trusted deployment ledger or schema baseline establishes which hand-authored SQL ran where; several files overlap with runtime `initialize()` DDL/backfills; historical Prisma-era objects use quoted PascalCase names while current postgres.js runtime uses snake_case names. The accepted prospective decision is a custom SQL runner, not Prisma Migrate.
- The same architecture record says quarantine is intentional until clean PostgreSQL rehearsal and deployment baselines establish compatibility. It is not evidence that the files never ran in any environment.
- The migration manifest is ignored under the broad `database/` ignore rule and is not tracked in Git. It currently has 28 quarantine entries total (3 `database/migrations` + 25 `prisma/migrations`), while current disk has 3 + 35 = 38 files. Ten SQL files are absent from that manifest inventory. `database/tracked-migrations` is absent.
- Git history has two relevant commits: `363f488` initially introduced the first subscription migration/schema; `e61b621` and `bd89ecb` added subsequent migrations; `fac13b7` added the then-current three `database/migrations` files and 27 then-existing Prisma files/schema; `2835fcf` added later Prisma migrations. No SQL deletion or rename was found in available `--all` history. Four 20261105 migrations are untracked working-tree files, not recovered from Git history in this audit.

## Current local migration inventory (38 exact files)

All files below have **unknown deployment state** and remain non-executable candidates. Presence in Git proves repository history only, not application to any database. The four `20261105` SQL files are current working-tree files not found in the checked Git commits. No file was moved or changed.

| Exact path | Repository evidence | Header/comment description |
|---|---|---|
| `database/migrations/202609200001_registration_core.sql` | in Git history by `fac13b7` | 202609200001_registration_core |
| `database/migrations/202609250001_manual_class_configuration.sql` | in Git history by `fac13b7` | 202609250001_manual_class_configuration |
| `database/migrations/202609260001_tenant_isolation.sql` | in Git history by `fac13b7` | 202609260001_tenant_isolation |
| `prisma/migrations/202609110001_annual_subscriptions/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609140001_institution_settings/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609140002_private_admin/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609140003_salary_management/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609150001_subscription_lifecycle/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609160001_student_personal_fields/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609160002_student_special_quota/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609160003_student_roll_numbers/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609170001_staff_attendance/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609170002_timetable_timing/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609170003_student_results/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609180001_student_demotions/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609180002_payment_idempotency/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609190001_finance_payment_details/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609200002_accounting_attendance_timetable/migration.sql` | in Git history by `fac13b7` | Preserve historical duplicate ledger rows while excluding them from totals. |
| `prisma/migrations/202609210001_whatsapp_integration/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609210002_student_id_hardening/migration.sql` | in Git history by `fac13b7` | Backfill/repair is performed by the transactional administrator action, because each tenant's validated school code is required. This migration installs the uniqueness gu |
| `prisma/migrations/202609210003_salary_accounting/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609220001_per_student_annual_pricing/migration.sql` | in Git history by `fac13b7` | Preserve every historical plan, subscription, and payment. Only the current customer-facing offering is changed. |
| `prisma/migrations/202609220002_subscription_onboarding/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202609220003_fifty_per_student_pricing/migration.sql` | in Git history by `fac13b7` | New purchases and renewals use ₹50 per student per year. Historical subscription and payment rows retain their stored price and amount. |
| `prisma/migrations/202609230001_school_subscription_period/migration.sql` | in Git history by `fac13b7` | migration |
| `prisma/migrations/202610140001_whatsapp_addon_billing/migration.sql` | in Git history by `fac13b7` | Additive billing ledger for new WhatsApp Communication add-on purchases. Existing subscriptions, payments, invoices, receipts, and school data are not modified. |
| `prisma/migrations/202610150001_whatsapp_production_hardening/migration.sql` | in Git history by `fac13b7` | Forward-only WhatsApp hardening. Existing school, billing, attendance, fee, payment, result, and message rows are preserved. |
| `prisma/migrations/202610240001_fixed_starter_pricing/migration.sql` | in Git history by `fac13b7` | Add a versioned, opt-in fixed annual plan without modifying historical subscriptions, payments, prices, or renewal dates. |
| `prisma/migrations/202610260001_hundred_per_student_pricing/migration.sql` | in Git history by `fac13b7` | Future per-student purchases and renewals use ₹100 per student per year. Historical subscription and payment snapshots remain unchanged. |
| `prisma/migrations/202610270001_subscription_capacity_adjustments/migration.sql` | in Git history by `2835fcf` | Additive ledger for mid-term capacity changes. Existing subscriptions and successful payment history remain untouched. |
| `prisma/migrations/202610270002_starter_hundred_student_limit/migration.sql` | in Git history by `2835fcf` | Align the persisted plan catalogue with the published 1-100 student Starter boundary. Historical subscriptions and payment snapshots are not modified; only future plan se |
| `prisma/migrations/202611030001_attendance_upgrade/migration.sql` | in Git history by `2835fcf` | Safe, forward-only attendance system upgrade. Preserves existing attendance rows and does not duplicate database tables. |
| `prisma/migrations/202611030002_parent_portal/migration.sql` | in Git history by `2835fcf` | migration |
| `prisma/migrations/202611030003_notification_engine/migration.sql` | in Git history by `2835fcf` | migration |
| `prisma/migrations/202611050001_student_photo_path/migration.sql` | working-tree only / not in checked historical commits | migration |
| `prisma/migrations/202611050002_attendance_schema_recovery/migration.sql` | working-tree only / not in checked historical commits | Reconcile attendance schema objects required by the attendance API. Safe to rerun: tables, indexes, and the settings column are guarded. |
| `prisma/migrations/202611050003_student_photo_asset_kind/migration.sql` | working-tree only / not in checked historical commits | Allow student images in the existing private, institution-scoped asset store. Existing logo and signature assets remain valid and are not modified. |
| `prisma/migrations/202611050004_timetable_publication_state/migration.sql` | working-tree only / not in checked historical commits | Keep existing timetables visible while adding an explicit publication lifecycle. |

The inventory spans `database/migrations` (3 files) and `prisma/migrations` (35 files). The ignored local manifest currently has 28 quarantined entries total (3 database + 25 Prisma) and omits 10 files now on disk. An older architecture/completion report records 27 entries at an earlier snapshot. `database/tracked-migrations` remains absent.

## Recovery gates

1. Preserve a copy of every historical file and capture SHA-256 before any future adoption decision.
2. Reconcile `MIGRATION_ARCHITECTURE.md`, manifest, current ignored migration files, Git objects, runtime DDL, and the actual deployed migration ledger/schema using owner-authorized read-only schema-only evidence. Do not connect to Production as part of this recovery phase.
3. Rehearse candidate histories only on a disposable, isolated PostgreSQL instance, after identifying a trustworthy baseline. Compare object names, columns, data types, defaults, constraints, indexes, and backfills at each step.
4. Design a ledger and runner separately; the current `src/lib/migration-plan.ts` is pure planning/validation code and does not discover files, connect, lock, or execute.
5. Present exact original checksums, dependencies, compatibility impact, and proposed adoption/new migration IDs for owner review. Keep all quarantined files inactive until a separate approval.

## Owner evidence still needed

- Sanitized schema-only snapshots and migration ledger from each supported non-production/deployment environment; Production connection is explicitly out of scope for this phase.
- Confirmation of which deployed schema is the intended compatibility baseline and whether working-tree-only migration files are approved project artifacts.
- A disposable PostgreSQL validation target and permission to run isolated rehearsals in a later phase.
