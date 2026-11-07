# Schema dependency map

**Evidence class:** static references only; relationships below are extracted from working-tree DDL and migration text. This is not a verified deployed-schema graph.

## Runtime base relationships

The runtime DDL in `src/lib/db.ts` defines 56 table names. Most application-owned records carry `institution_id`; notable global/platform or subordinate tables without a direct school key include `sessions`, `subscription_plans`, `razorpay_webhook_events`, `subscription_processing_logs`, and some event/delivery records. This does not prove that every query is tenant-safe.

Core FK dependency groups visible in DDL:

- `institutions` is a root for `users`, school `settings`, `students`, `teachers`, `classes`, `fees`, subscriptions, attendance, assets, academic configuration, results, payroll, accounting, notifications, and integrations.
- `users` is referenced by sessions, audit rows, payment/receipt actors, attendance changes, promotions, result workflow actors, payroll creators, WhatsApp senders, notification/device rows, and admin settings.
- `students` references `institutions`; it is referenced by attendance, fees/payments, results, enrollment/demotion, parent linkage, consent/messages, and photo assets (asset ownership is represented by institution + kind key rather than a direct student FK in the base table).
- `teachers` references institutions and is referenced by staff attendance and timetable entries. `staff_attendance` allows either teacher or user identity with an XOR check in current runtime DDL.
- `fees` references institution/student; `payments` reference institution/student/fee/user; `receipts` reference payment/student and enforce a unique payment link. `account_transactions` connect finance operations through source type/id rather than FK polymorphism.
- `class_exams` reference institution and `class_results` reference exam/student. Result workflow tables include `result_examinations` → `result_publication_snapshots`; exam/result rows also link back through optional result-examination IDs patched during initialization.
- `academic_years` and `institution_classes` belong to institutions; sections reference configured classes; enrollments reference students and have a self-reference to prior enrollment; promotion batches/items and demotions link students, users, enrollments, classes, sections, and academic years.
- `subscription_plans` is referenced by subscriptions; subscriptions are referenced by adjustment, notification, and payment history tables. Some payment/source relations are textual IDs without declarative FKs.
- WhatsApp configuration/templates/messages/consent/webhook/campaign objects relate to institutions, students, and users. Notification events/deliveries and FCM tokens relate to institution/user, with event references.
- Library, transport, assignment, submission, and other Prisma-only models are defined in `prisma/schema.prisma` but are not present in the 56 runtime CREATE TABLE names; they may be unused, stored in `module_records`, or require missing schema evidence.

## Required creation order implied by FKs

1. `institutions`, `subscription_plans` (roots).
2. `users`, school `settings`, `teachers`, `students`, `classes`, `academic_years`, `institution_classes`, admin settings.
3. Student/staff attendance, fees, subscriptions, academic sections, timetable, class exams, notifications/assets, and audit records.
4. Dependent payments, receipts, results/snapshots, enrollments/promotions/demotions, salary/accounting details, parent links, WhatsApp message lifecycle, notification deliveries, and adjustment ledgers.
5. Self-referencing enrollment edges and circular runtime patch relationships require a reviewed two-pass/constraint plan if reconstructed; do not infer a runnable order from this list.

## Tenancy and access boundaries

- Most runtime application tables store `institution_id`, and many application queries pass a server-derived institution ID. This is an application-layer pattern, not PostgreSQL row-level security. Runtime initialization contains no RLS declarations. Two quarantined historical migrations (`202610140001_whatsapp_addon_billing` and `202610150001_whatsapp_production_hardening`) enable RLS on `whatsapp_addon_subscriptions`, `whatsapp_webhook_events`, `whatsapp_consent_events`, and `whatsapp_campaigns`, and conditionally revoke table privileges from `anon`/`authenticated`. No `CREATE POLICY` statement was found. Their deployed state and behavior under the app's DB role are unknown.
- The historical `202609260001_tenant_isolation.sql` adds unique indexes but does not add composite foreign keys that force every related object to share the same institution. Its file comment describes composite keys as enabling future FKs.
- Global uniqueness in runtime definitions (for example email/admission/receipt identifiers) differs from the historical tenant-scoped admission intent. Current working-tree source has changed admission uniqueness relative to that historical migration in later runtime patches; deployed semantics are unknown.
- Authorization is implemented in server-side session/role/API code; no database grants establish per-role table permissions. A table-by-table permission matrix requires a dedicated route-to-service audit and authenticated tenant tests. It is not inferred here.
