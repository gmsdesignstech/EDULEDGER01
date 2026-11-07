# Migration reconciliation matrix

**Deployment status for every file: UNKNOWN.** This is offline static analysis only; no migration was run.

## Manifest discrepancy

- Manifest: 0 active, 28 quarantined (3 database paths + 25 Prisma paths). Disk: 38 SQL files (3 + 35).
- Ten disk paths are absent from the manifest: `202610260001`, `202610270001`, `202610270002`, `202611030001` through `202611030003`, and `202611050001` through `202611050004`.
- The three `database/migrations` files are ignored local copies, absent from current HEAD, but their paths exist in historical Git at `fac13b7`. The four 20261105 Prisma files are untracked and absent from checked Git history. The other 31 Prisma files are tracked and clean.
- `database/tracked-migrations` is absent. The 10 unlisted files are not active and are treated as quarantined pending owner provenance review. The manifest was not modified.

## `database/migrations/202609200001_registration_core.sql`

- Current working-tree status: **ignored local file (not tracked at HEAD)**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `institutions`, `sessions`, `settings`, `users`
- Columns affected: `institutions created: id, name, status, created_at`; `users created: id, email, name, password_hash, role, status, last_login_at, institution_id, created_at`; `sessions created: token, user_id, expires_at, created_at`; `settings created: institution_id, academic_year, school_address, school_phone, school_email, logo_url, updated_at`; `added: institutions.status, settings.school_email, users.last_login_at, users.status`; index keys: `idx_users_email_lower(users.LOWER(email))`, `idx_users_single_super_admin(users.role)`, `idx_sessions_user(sessions.user_id)`
- DDL and data operations: `CREATE TABLE institutions, users, sessions, settings`; `ALTER TABLE institutions, settings, users`; `ADD COLUMN institutions.status, settings.school_email, users.last_login_at, users.status`; `CREATE INDEX idx_users_email_lower ON users, idx_users_single_super_admin ON users, idx_sessions_user ON sessions`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `users`
- Existing-object prerequisites: No external table prerequisite extracted; ALTER targets are created in this file or absent.
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `database/migrations/202609250001_manual_class_configuration.sql`

- Current working-tree status: **ignored local file (not tracked at HEAD)**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `classes`, `institution_classes`
- Columns affected: `updated columns: status, updated_at`
- DDL and data operations: `UPDATE classes, institution_classes`
- Backfills/data changes: `UPDATE institution_classes SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE UPPER(TRIM(name)) = 'LG' AND status <> 'Inactive'`; `UPDATE classes SET status = 'Inactive' WHERE UPPER(TRIM(name)) = 'LG' AND status <> 'Inactive'`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `classes`, `institution_classes`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in classes, institution_classes

## `database/migrations/202609260001_tenant_isolation.sql`

- Current working-tree status: **ignored local file (not tracked at HEAD)**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `class_exams`, `fees`, `students`, `teachers`, `users`
- Columns affected: No explicit CREATE/ALTER/UPDATE column list extracted.; index keys: `students_institution_admission_unique(students.institution_id, admission)`, `students_id_institution_unique(students.id, institution_id)`, `fees_id_institution_unique(fees.id, institution_id)`, `users_id_institution_unique(users.id, institution_id)`, `teachers_id_institution_unique(teachers.id, institution_id)`, `class_exams_id_institution_unique(class_exams.id, institution_id)`
- DDL and data operations: `ALTER TABLE students`; `DROP CONSTRAINT students.students_admission_key`; `CREATE INDEX students_institution_admission_unique ON students, students_id_institution_unique ON students, fees_id_institution_unique ON fees, users_id_institution_unique ON users, teachers_id_institution_unique ON teachers, class_exams_id_institution_unique ON class_exams`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `class_exams`, `fees`, `students`, `teachers`, `users`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: DROP operation present: students.students_admission_key

## `prisma/migrations/202609110001_annual_subscriptions/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `Subscription`, `SubscriptionPlan`
- Columns affected: `added: Subscription.amountPaid, Subscription.createdAt, Subscription.razorpayOrderId, Subscription.razorpayPaymentId, Subscription.razorpaySignature, Subscription.studentCapacity, Subscription.updatedAt, SubscriptionPlan.active, SubscriptionPlan.billingPeriod, SubscriptionPlan.createdAt, SubscriptionPlan.updatedAt`; `altered: SubscriptionPlan.teacherLimit`; index keys: `Subscription_razorpayOrderId_key(Subscription."razorpayOrderId")`, `Subscription_razorpayPaymentId_key(Subscription."razorpayPaymentId")`, `Subscription_institutionId_status_expiryDate_idx(Subscription."institutionId","status","expiryDate")`
- DDL and data operations: `ALTER TABLE Subscription, SubscriptionPlan`; `ADD COLUMN Subscription.amountPaid, Subscription.createdAt, Subscription.razorpayOrderId, Subscription.razorpayPaymentId, Subscription.razorpaySignature, Subscription.studentCapacity, Subscription.updatedAt, SubscriptionPlan.active, SubscriptionPlan.billingPeriod, SubscriptionPlan.createdAt, SubscriptionPlan.updatedAt`; `CREATE INDEX Subscription_razorpayOrderId_key ON Subscription, Subscription_razorpayPaymentId_key ON Subscription, Subscription_institutionId_status_expiryDate_idx ON Subscription`; `INSERT SubscriptionPlan`
- Backfills/data changes: `INSERT into SubscriptionPlan`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `Subscription`, `SubscriptionPlan`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609140001_institution_settings/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `academic_years`, `institution_classes`, `institution_sections`, `promotion_batches`, `promotion_items`, `school_assets`, `settings`, `student_enrollments`, `students`
- Columns affected: `academic_years created: id, institution_id, name, start_month, end_month, status, is_active, created_at, updated_at`; `institution_classes created: id, institution_id, name, sort_order, status, created_at, updated_at`; `institution_sections created: id, institution_id, class_id, name, sort_order, status, created_at, updated_at`; `school_assets created: id, institution_id, kind, mime_type, data, size_bytes, updated_at`; `student_enrollments created: id, institution_id, student_id, academic_year, class_name, section, status, promoted_from_enrollment_id, promoted_at, promoted_by, created_at, updated_at`; `promotion_batches created: id, institution_id, source_academic_year, target_academic_year, source_class, source_section, target_class, target_section, promoted_by, promoted_at, status, correction_reason`; `promotion_items created: id, batch_id, institution_id, student_id, source_enrollment_id, target_enrollment_id, status, error_message, created_at`; `added: settings.affiliation, settings.city, settings.dise_code, settings.fee_receipt_subheader, settings.fee_receipt_title, settings.footer_text, settings.motto, settings.payslip_subheader, settings.payslip_title, settings.pin_code, settings.principal_name, settings.registration_number, settings.school_type, settings.signature_label, settings.state, settings.website, students.academic_year, students.graduation_date, students.leaving_date, students.leaving_reason`; index keys: `idx_academic_years_scope(academic_years.institution_id,status,is_active)`, `idx_institution_classes_scope(institution_classes.institution_id,status,sort_order)`, `idx_institution_sections_scope(institution_sections.institution_id,class_id,status,sort_order)`, `idx_enrollments_scope(student_enrollments.institution_id,academic_year,class_name,section,status)`, `idx_promotion_batches_scope(promotion_batches.institution_id,promoted_at)`, `idx_promotion_items_scope(promotion_items.institution_id,student_id,created_at)`
- DDL and data operations: `CREATE TABLE academic_years, institution_classes, institution_sections, school_assets, student_enrollments, promotion_batches, promotion_items`; `ALTER TABLE settings, students`; `ADD COLUMN settings.affiliation, settings.city, settings.dise_code, settings.fee_receipt_subheader, settings.fee_receipt_title, settings.footer_text, settings.motto, settings.payslip_subheader, settings.payslip_title, settings.pin_code, settings.principal_name, settings.registration_number, settings.school_type, settings.signature_label, settings.state, settings.website, students.academic_year, students.graduation_date, students.leaving_date, students.leaving_reason`; `CREATE INDEX idx_academic_years_scope ON academic_years, idx_institution_classes_scope ON institution_classes, idx_institution_sections_scope ON institution_sections, idx_enrollments_scope ON student_enrollments, idx_promotion_batches_scope ON promotion_batches, idx_promotion_items_scope ON promotion_items`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institution_classes`, `institutions`, `promotion_batches`, `student_enrollments`, `students`, `users`
- Existing-object prerequisites: `institutions`, `settings`, `students`, `users`
- External FK targets: `institutions`, `students`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609140002_private_admin/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `admin_settings`, `institutions`, `users`
- Columns affected: `admin_settings created: id, application_name, support_email, currency, timezone, date_format, session_timeout_minutes, updated_by, updated_at`; `added: institutions.status, users.last_login_at, users.status`; index keys: `idx_users_single_super_admin(users.role)`
- DDL and data operations: `CREATE TABLE admin_settings`; `ALTER TABLE institutions, users`; `ADD COLUMN institutions.status, users.last_login_at, users.status`; `CREATE INDEX idx_users_single_super_admin ON users`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `institutions`, `users`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609140003_salary_management/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `salaries`
- Columns affected: `salaries created: id, institution_id, employee_key, teacher_id, user_id, employee_name, employee_number, employee_role, department, designation, salary_month, salary_year, basic_paise, allowances_paise, bonus_paise, overtime_paise, other_earnings_paise, gross_paise, deductions_paise, advance_deduction_paise, other_deductions_paise, total_deductions_paise, net_paise, paid_paise, payment_status, payment_date, payment_method, payment_reference, payment_notes, notes, payslip_number, created_by, created_at, updated_at`; index keys: `idx_salaries_scope(salaries.institution_id,salary_year,salary_month,payment_status)`, `idx_salaries_employee(salaries.employee_key,created_at)`, `idx_salaries_payment_date(salaries.payment_date)`
- DDL and data operations: `CREATE TABLE salaries`; `CREATE INDEX idx_salaries_scope ON salaries, idx_salaries_employee ON salaries, idx_salaries_payment_date ON salaries`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `teachers`, `users`
- Existing-object prerequisites: `institutions`, `teachers`, `users`
- External FK targets: `institutions`, `teachers`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609150001_subscription_lifecycle/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `admin_settings`, `notifications`, `subscription_notification_events`, `subscription_processing_logs`, `subscriptions`
- Columns affected: `subscription_notification_events created: id, subscription_id, institution_id, milestone, status, attempts, last_error, sent_at, created_at`; `subscription_processing_logs created: id, started_at, finished_at, status, checked_count, expired_count, notification_count, error`; `added: admin_settings.email_notifications_enabled, admin_settings.in_app_notifications_enabled, admin_settings.subscription_grace_days, admin_settings.subscription_notifications_enabled, admin_settings.subscription_warning_days, notifications.delivery_status, notifications.link, subscriptions.auto_renew, subscriptions.currency, subscriptions.grace_period_days, subscriptions.last_notification_sent, subscriptions.payment_status, subscriptions.plan_type, subscriptions.renewal_date`; `updated columns: payment_status`; index keys: `idx_subscriptions_expiry(subscriptions.status,expiry_date)`, `idx_notifications_user_read(notifications.user_id,read_at,created_at)`
- DDL and data operations: `CREATE TABLE subscription_notification_events, subscription_processing_logs`; `ALTER TABLE admin_settings, notifications, subscriptions`; `ADD COLUMN admin_settings.email_notifications_enabled, admin_settings.in_app_notifications_enabled, admin_settings.subscription_grace_days, admin_settings.subscription_notifications_enabled, admin_settings.subscription_warning_days, notifications.delivery_status, notifications.link, subscriptions.auto_renew, subscriptions.currency, subscriptions.grace_period_days, subscriptions.last_notification_sent, subscriptions.payment_status, subscriptions.plan_type, subscriptions.renewal_date`; `CREATE INDEX idx_subscriptions_expiry ON subscriptions, idx_notifications_user_read ON notifications`; `UPDATE subscriptions`
- Backfills/data changes: `UPDATE subscriptions SET payment_status=CASE WHEN status IN ('ACTIVE','EXPIRING_SOON','EXPIRED') AND razorpay_payment_id IS NOT NULL THEN 'Paid' WHEN status='FAILED' THEN 'Failed' WHEN status='REFUNDED' THEN 'Refunded' ELSE payment_status END`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `subscriptions`
- Existing-object prerequisites: `admin_settings`, `institutions`, `notifications`, `subscriptions`
- External FK targets: `institutions`, `subscriptions`
- Potential destructive/data-sensitive operations: UPDATE changes rows in subscriptions

## `prisma/migrations/202609160001_student_personal_fields/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `students`
- Columns affected: `added: students.blood_group, students.mother_name`
- DDL and data operations: `ALTER TABLE students`; `ADD COLUMN students.blood_group, students.mother_name`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `students`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609160002_student_special_quota/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `students`
- Columns affected: `added: students.special_quota, students.special_quota_description`
- DDL and data operations: `ALTER TABLE students`; `ADD COLUMN students.special_quota, students.special_quota_description`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `students`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609160003_student_roll_numbers/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `settings`, `students`
- Columns affected: `added: settings.school_code`; index keys: `students_school_roll_unique(students.institution_id, roll_number)`
- DDL and data operations: `ALTER TABLE settings`; `ADD COLUMN settings.school_code`; `CREATE INDEX students_school_roll_unique ON students`; `DO block with conditional SQL`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `settings`, `students`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609170001_staff_attendance/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `staff_attendance`, `staff_attendance_settings`
- Columns affected: `staff_attendance_settings created: institution_id, work_start_time, work_end_time, late_after_time, break_minutes, working_days, timezone, allow_self_checkin, correction_requires_approval, updated_at`; `staff_attendance created: id, institution_id, staff_key, teacher_id, user_id, attendance_date, status, check_in_at, check_out_at, break_minutes, total_work_minutes, remarks, created_by, updated_by, created_at, updated_at`; index keys: `idx_staff_attendance_date(staff_attendance.institution_id, attendance_date, status)`, `idx_staff_attendance_person(staff_attendance.institution_id, staff_key, attendance_date)`
- DDL and data operations: `CREATE TABLE staff_attendance_settings, staff_attendance`; `CREATE INDEX idx_staff_attendance_date ON staff_attendance, idx_staff_attendance_person ON staff_attendance`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `teachers`, `users`
- Existing-object prerequisites: `institutions`, `teachers`, `users`
- External FK targets: `institutions`, `teachers`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609170002_timetable_timing/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `settings`, `timetable_entries`
- Columns affected: `added: settings.timetable_end_time, settings.timetable_lunch_minutes, settings.timetable_period_minutes, settings.timetable_periods_per_day, settings.timetable_short_break_minutes, settings.timetable_start_time, settings.timetable_timezone, settings.timetable_working_days, timetable_entries.generated`
- DDL and data operations: `ALTER TABLE settings, timetable_entries`; `ADD COLUMN settings.timetable_end_time, settings.timetable_lunch_minutes, settings.timetable_period_minutes, settings.timetable_periods_per_day, settings.timetable_short_break_minutes, settings.timetable_start_time, settings.timetable_timezone, settings.timetable_working_days, timetable_entries.generated`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `settings`, `timetable_entries`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609170003_student_results/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `class_exams`, `class_results`, `result_examinations`, `result_publication_snapshots`, `settings`
- Columns affected: `result_examinations created: id, institution_id, name, academic_year, class_name, section, start_date, end_date, publication_date, status, created_by, verified_by, approved_by, published_by, published_at, created_at, updated_at`; `result_publication_snapshots created: id, institution_id, examination_id, version, snapshot, published_by, published_at`; `added: class_exams.max_marks_cent, class_exams.passing_marks_cent, class_exams.required, class_exams.result_examination_id, class_results.mark_status, class_results.marks_cent, class_results.remarks, class_results.updated_at, class_results.updated_by, settings.result_class_teacher_remarks, settings.result_grade_bands, settings.result_overall_pass_percent, settings.result_principal_remarks, settings.result_ranking_enabled, settings.result_report_format, settings.result_require_subject_pass`; index keys: `idx_result_examinations_scope(result_examinations.institution_id,academic_year,class_name,section,status)`, `idx_result_examinations_publish(result_examinations.institution_id,status,published_at)`, `idx_result_snapshots_scope(result_publication_snapshots.institution_id,examination_id,version)`, `idx_class_exam_group_subject(class_exams.result_examination_id,subject)`, `idx_class_results_exam(class_results.institution_id,exam_id,student_id)`
- DDL and data operations: `CREATE TABLE result_examinations, result_publication_snapshots`; `ALTER TABLE class_exams, class_results, settings`; `ADD COLUMN class_exams.max_marks_cent, class_exams.passing_marks_cent, class_exams.required, class_exams.result_examination_id, class_results.mark_status, class_results.marks_cent, class_results.remarks, class_results.updated_at, class_results.updated_by, settings.result_class_teacher_remarks, settings.result_grade_bands, settings.result_overall_pass_percent, settings.result_principal_remarks, settings.result_ranking_enabled, settings.result_report_format, settings.result_require_subject_pass`; `CREATE INDEX idx_result_examinations_scope ON result_examinations, idx_result_examinations_publish ON result_examinations, idx_result_snapshots_scope ON result_publication_snapshots, idx_class_exam_group_subject ON class_exams, idx_class_results_exam ON class_results`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `result_examinations`, `users`
- Existing-object prerequisites: `class_exams`, `class_results`, `institutions`, `settings`, `users`
- External FK targets: `institutions`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609180001_student_demotions/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `student_demotions`
- Columns affected: `student_demotions created: id, institution_id, student_id, previous_class_id, new_class_id, previous_section_id, new_section_id, previous_academic_year_id, new_academic_year_id, previous_class, new_class, previous_section, new_section, previous_year, new_year, reason, remarks, changed_by, created_at, undone_by, undone_at`; index keys: `idx_student_demotions_scope(student_demotions.institution_id,student_id,created_at)`
- DDL and data operations: `CREATE TABLE student_demotions`; `CREATE INDEX idx_student_demotions_scope ON student_demotions`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `academic_years`, `institution_classes`, `institution_sections`, `institutions`, `students`, `users`
- Existing-object prerequisites: `academic_years`, `institution_classes`, `institution_sections`, `institutions`, `students`, `users`
- External FK targets: `academic_years`, `institution_classes`, `institution_sections`, `institutions`, `students`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609180002_payment_idempotency/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `fees`, `payments`, `receipts`
- Columns affected: `added: payments.request_id`; `updated columns: invoice_number, receipt_number`; index keys: `idx_payments_request_id(payments.institution_id, request_id)`
- DDL and data operations: `ALTER TABLE payments`; `ADD COLUMN payments.request_id`; `CREATE INDEX idx_payments_request_id ON payments`; `UPDATE fees, payments, receipts`
- Backfills/data changes: `UPDATE fees SET invoice_number='INV-LEGACY-'\\|\\|id WHERE TRIM(invoice_number)=''`; `UPDATE payments SET receipt_number='REC-LEGACY-'\\|\\|id WHERE TRIM(receipt_number)=''`; `UPDATE receipts SET invoice_number=f.invoice_number FROM payments p JOIN fees f ON f.id=p.fee_id WHERE r.payment_id=p.id AND TRIM(r.invoice_number)=''`; `UPDATE receipts SET receipt_number=p.receipt_number FROM payments p WHERE r.payment_id=p.id AND TRIM(r.receipt_number)=''`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `fees`, `payments`, `receipts`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in fees, payments, receipts

## `prisma/migrations/202609190001_finance_payment_details/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `fees`, `payments`, `receipts`, `students`
- Columns affected: `added: payments.discount_amount, payments.discount_reason, payments.discount_type, payments.discount_value, payments.late_fee, payments.net_payable, payments.original_amount, payments.payment_frequency, students.leaving_remarks`; `altered: fees.discount, fees.final_amount, fees.paid_amount, fees.pending_amount, fees.total_amount, payments.amount, receipts.amount`; `updated columns: net_payable, original_amount`
- DDL and data operations: `ALTER TABLE fees, payments, receipts, students`; `ADD COLUMN payments.discount_amount, payments.discount_reason, payments.discount_type, payments.discount_value, payments.late_fee, payments.net_payable, payments.original_amount, payments.payment_frequency, students.leaving_remarks`; `UPDATE payments`
- Backfills/data changes: `UPDATE payments SET original_amount=amount,net_payable=amount WHERE original_amount=0 AND net_payable=0`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `fees`, `payments`, `receipts`, `students`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in payments; type conversion may rewrite/fail on existing values

## `prisma/migrations/202609200002_accounting_attendance_timetable/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `account_transactions`, `settings`
- Columns affected: `updated columns: notes, status, timetable_working_days, updated_at`; index keys: `idx_accounts_source(account_transactions.institution_id,source_type,source_id)`
- DDL and data operations: `CREATE INDEX idx_accounts_source ON account_transactions`; `UPDATE account_transactions, settings`
- Backfills/data changes: `UPDATE account_transactions SET status='Voided',notes=CASE WHEN a.notes='' THEN 'Historical duplicate automatically excluded' ELSE a.notes\\|\\|' · Historical duplicate automatically excluded' END,updated_at=CURRENT_TIMESTAMP FROM ranked r WHERE a.id=r.i`; `UPDATE settings SET timetable_working_days='1,2,3,4,5,6',updated_at=CURRENT_TIMESTAMP WHERE timetable_working_days='1,2,3,4,5'`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `account_transactions`, `settings`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in account_transactions, settings

## `prisma/migrations/202609210001_whatsapp_integration/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `students`, `whatsapp_configurations`, `whatsapp_messages`, `whatsapp_templates`
- Columns affected: `whatsapp_configurations created: id, institution_id, enabled, business_account_id, phone_number_id, display_number, access_token_ciphertext, configuration_status, webhook_status, auto_absence, auto_fee_receipt, auto_fee_reminder, auto_marksheet, created_at, updated_at`; `whatsapp_templates created: id, institution_id, name, category, language, provider_template_name, enabled, variables, created_at, updated_at`; `whatsapp_messages created: id, institution_id, student_id, recipient_name, recipient_phone, message_type, template_name, language, parameters, document_kind, document_reference, provider_message_id, idempotency_key, status, attempt_count, next_attempt_at, error_code, error_message, sent_by, sent_at, delivered_at, read_at, failed_at, created_at, updated_at`; `added: students.alternate_whatsapp, students.parent_relationship, students.parent_whatsapp, students.whatsapp_academics, students.whatsapp_attendance, students.whatsapp_enabled, students.whatsapp_fees, students.whatsapp_general, students.whatsapp_notices`; index keys: `idx_whatsapp_queue(whatsapp_messages.status,next_attempt_at)`, `idx_whatsapp_history(whatsapp_messages.institution_id,created_at DESC)`, `idx_whatsapp_student(whatsapp_messages.institution_id,student_id,created_at DESC)`
- DDL and data operations: `CREATE TABLE whatsapp_configurations, whatsapp_templates, whatsapp_messages`; `ALTER TABLE students`; `ADD COLUMN students.alternate_whatsapp, students.parent_relationship, students.parent_whatsapp, students.whatsapp_academics, students.whatsapp_attendance, students.whatsapp_enabled, students.whatsapp_fees, students.whatsapp_general, students.whatsapp_notices`; `CREATE INDEX idx_whatsapp_queue ON whatsapp_messages, idx_whatsapp_history ON whatsapp_messages, idx_whatsapp_student ON whatsapp_messages`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `students`, `users`
- Existing-object prerequisites: `institutions`, `students`, `users`
- External FK targets: `institutions`, `students`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609210002_student_id_hardening/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `students`
- Columns affected: No explicit CREATE/ALTER/UPDATE column list extracted.; index keys: `students_school_roll_unique(students.institution_id, roll_number)`
- DDL and data operations: `CREATE INDEX students_school_roll_unique ON students`; `DO block with conditional SQL`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `students`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202609210003_salary_accounting/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `account_transactions`, `salary_payment_events`
- Columns affected: `salary_payment_events created: id, institution_id, salary_id, request_id, amount_paise, account_transaction_id, created_by, created_at`; `updated columns: category, description, updated_at`; index keys: `idx_salary_payment_events_salary(salary_payment_events.institution_id,salary_id,created_at)`
- DDL and data operations: `CREATE TABLE salary_payment_events`; `CREATE INDEX idx_salary_payment_events_salary ON salary_payment_events`; `UPDATE account_transactions`; `INSERT account_transactions`
- Backfills/data changes: `UPDATE account_transactions SET category='Staff Salaries',description=CASE WHEN description LIKE 'Salary payment - %' THEN description ELSE 'Salary payment - '\\|\\|description END,updated_at=CURRENT_TIMESTAMP WHERE source_type='salary_payment' AND categ`; `INSERT into account_transactions`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `account_transactions`, `institutions`, `salaries`, `users`
- Existing-object prerequisites: `account_transactions`, `institutions`, `salaries`, `users`
- External FK targets: `account_transactions`, `institutions`, `salaries`, `users`
- Potential destructive/data-sensitive operations: UPDATE changes rows in account_transactions

## `prisma/migrations/202609220001_per_student_annual_pricing/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `subscription_payments`, `subscription_plans`, `subscriptions`
- Columns affected: `added: subscriptions.price_per_student`; `updated columns: active, status`; index keys: `idx_subscriptions_pricing_snapshot(subscriptions.institution_id,student_capacity,price_per_student,amount_paid)`
- DDL and data operations: `ALTER TABLE subscriptions`; `ADD COLUMN subscriptions.price_per_student`; `CREATE INDEX idx_subscriptions_pricing_snapshot ON subscriptions`; `UPDATE subscription_payments, subscription_plans`; `INSERT subscription_plans`
- Backfills/data changes: `UPDATE subscription_plans SET active=FALSE WHERE id<>'annual-service'`; `UPDATE subscription_payments SET status='SUCCESS' WHERE status='ACTIVE'`; `INSERT into subscription_plans`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `subscription_payments`, `subscription_plans`, `subscriptions`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in subscription_payments, subscription_plans

## `prisma/migrations/202609220002_subscription_onboarding/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `institutions`
- Columns affected: `added: institutions.planned_student_count`; `updated columns: planned_student_count`
- DDL and data operations: `ALTER TABLE institutions`; `ADD COLUMN institutions.planned_student_count`; `UPDATE institutions`
- Backfills/data changes: `UPDATE institutions SET planned_student_count = GREATEST( COALESCE(( SELECT s.student_capacity FROM subscriptions AS s WHERE s.institution_id = i.id AND s.status IN ('ACTIVE', 'EXPIRING_SOON') ORDER BY s.created_at DESC LIMIT 1 ), 0), COALESCE(`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `institutions`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in institutions

## `prisma/migrations/202609220003_fifty_per_student_pricing/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `subscription_plans`
- Columns affected: `updated columns: price, updated_at`
- DDL and data operations: `UPDATE subscription_plans`
- Backfills/data changes: `UPDATE subscription_plans SET price = 50, updated_at = CURRENT_TIMESTAMP WHERE id = 'annual-service'`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `subscription_plans`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in subscription_plans

## `prisma/migrations/202609230001_school_subscription_period/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `institutions`, `subscriptions`
- Columns affected: `added: institutions.subscription_end_date, institutions.subscription_start_date`; index keys: `idx_subscriptions_school_period(subscriptions.institution_id, activation_date, expiry_date)`
- DDL and data operations: `ALTER TABLE institutions`; `ADD COLUMN institutions.subscription_end_date, institutions.subscription_start_date`; `CREATE INDEX idx_subscriptions_school_period ON subscriptions`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `institutions`, `subscriptions`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202610140001_whatsapp_addon_billing/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `whatsapp_addon_subscriptions`
- Columns affected: `whatsapp_addon_subscriptions created: id, institution_id, student_count, price_per_student, amount_paid, status, payment_status, currency, activation_date, expiry_date, razorpay_order_id, razorpay_payment_id, razorpay_signature, created_at, updated_at`; index keys: `idx_whatsapp_addon_school(whatsapp_addon_subscriptions.institution_id, status, expiry_date)`
- DDL and data operations: `CREATE TABLE whatsapp_addon_subscriptions`; `ALTER TABLE whatsapp_addon_subscriptions`; `CREATE INDEX idx_whatsapp_addon_school ON whatsapp_addon_subscriptions`; `DO block with conditional SQL`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: ENABLE RLS on whatsapp_addon_subscriptions; REVOKE ALL ON TABLE whatsapp_addon_subscriptions FROM anon'; REVOKE ALL ON TABLE whatsapp_addon_subscriptions FROM authenticated'
- Static FK references: `institutions`
- Existing-object prerequisites: `institutions`
- External FK targets: `institutions`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202610150001_whatsapp_production_hardening/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `students`, `whatsapp_campaigns`, `whatsapp_configurations`, `whatsapp_consent_events`, `whatsapp_messages`, `whatsapp_templates`, `whatsapp_webhook_events`
- Columns affected: `whatsapp_webhook_events created: id, provider_event_key, provider_message_id, event_status, event_at, payload_hash, processed_at`; `whatsapp_consent_events created: id, institution_id, student_id, contact_fingerprint, status, source, changed_by, occurred_at, created_at`; `whatsapp_campaigns created: id, institution_id, requested_by, idempotency_key, audience_fingerprint, criteria, message_type, template_name, scheduled_at, status, eligible_count, queued_count, excluded_count, created_at, completed_at`; `added: students.whatsapp_consent_at, students.whatsapp_consent_source, students.whatsapp_consent_status, students.whatsapp_contact_verified_at, students.whatsapp_opted_out_at, whatsapp_configurations.default_country_code, whatsapp_configurations.test_mode, whatsapp_configurations.webhook_last_received_at, whatsapp_messages.audience, whatsapp_messages.campaign_id, whatsapp_messages.cancelled_at, whatsapp_messages.claimed_at, whatsapp_messages.last_worker_id, whatsapp_messages.lease_expires_at, whatsapp_messages.lease_owner, whatsapp_messages.outcome_class, whatsapp_messages.provider_status_at, whatsapp_messages.request_payload_hash, whatsapp_messages.scheduled_at, whatsapp_templates.approval_status, whatsapp_templates.last_synced_at, whatsapp_templates.provider_category, whatsapp_templates.provider_updated_at, whatsapp_templates.rejection_reason`; index keys: `idx_whatsapp_campaign_student(whatsapp_messages.campaign_id, student_id)`, `idx_whatsapp_scheduled_queue(whatsapp_messages.status, scheduled_at, next_attempt_at)`, `idx_whatsapp_claimed(whatsapp_messages.status, lease_expires_at)`, `idx_whatsapp_webhook_message(whatsapp_webhook_events.provider_message_id, event_at)`, `idx_whatsapp_consent_student(whatsapp_consent_events.institution_id, student_id, occurred_at DESC)`
- DDL and data operations: `CREATE TABLE whatsapp_webhook_events, whatsapp_consent_events, whatsapp_campaigns`; `ALTER TABLE students, whatsapp_campaigns, whatsapp_configurations, whatsapp_consent_events, whatsapp_messages, whatsapp_templates, whatsapp_webhook_events`; `ADD COLUMN students.whatsapp_consent_at, students.whatsapp_consent_source, students.whatsapp_consent_status, students.whatsapp_contact_verified_at, students.whatsapp_opted_out_at, whatsapp_configurations.default_country_code, whatsapp_configurations.test_mode, whatsapp_configurations.webhook_last_received_at, whatsapp_messages.audience, whatsapp_messages.campaign_id, whatsapp_messages.cancelled_at, whatsapp_messages.claimed_at, whatsapp_messages.last_worker_id, whatsapp_messages.lease_expires_at, whatsapp_messages.lease_owner, whatsapp_messages.outcome_class, whatsapp_messages.provider_status_at, whatsapp_messages.request_payload_hash, whatsapp_messages.scheduled_at, whatsapp_templates.approval_status, whatsapp_templates.last_synced_at, whatsapp_templates.provider_category, whatsapp_templates.provider_updated_at, whatsapp_templates.rejection_reason`; `ADD CONSTRAINT whatsapp_messages.whatsapp_messages_campaign_fk`; `CREATE INDEX idx_whatsapp_campaign_student ON whatsapp_messages, idx_whatsapp_scheduled_queue ON whatsapp_messages, idx_whatsapp_claimed ON whatsapp_messages, idx_whatsapp_webhook_message ON whatsapp_webhook_events, idx_whatsapp_consent_student ON whatsapp_consent_events`; `DO block with conditional SQL`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: ENABLE RLS on whatsapp_webhook_events; ENABLE RLS on whatsapp_consent_events; ENABLE RLS on whatsapp_campaigns; REVOKE ALL ON TABLE whatsapp_webhook_events FROM anon'; REVOKE ALL ON TABLE whatsapp_webhook_events FROM authenticated'; REVOKE ALL ON TABLE whatsapp_consent_events FROM anon'; REVOKE ALL ON TABLE whatsapp_consent_events FROM authenticated'; REVOKE ALL ON TABLE whatsapp_campaigns FROM anon'; REVOKE ALL ON TABLE whatsapp_campaigns FROM authenticated'
- Static FK references: `institutions`, `students`, `users`, `whatsapp_campaigns`
- Existing-object prerequisites: `institutions`, `students`, `users`, `whatsapp_configurations`, `whatsapp_messages`, `whatsapp_templates`
- External FK targets: `institutions`, `students`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202610240001_fixed_starter_pricing/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest quarantined**
- Deployment status: **UNKNOWN**
- Tables affected: `subscription_payments`, `subscription_plans`, `subscriptions`
- Columns affected: `added: subscription_payments.student_count_at_purchase, subscription_plans.pricing_model, subscriptions.student_count_at_purchase`; `updated columns: student_count_at_purchase`; index keys: `idx_subscriptions_purchase_snapshot(subscriptions.institution_id,plan_id,student_count_at_purchase,amount_paid)`
- DDL and data operations: `ALTER TABLE subscription_payments, subscription_plans, subscriptions`; `ADD COLUMN subscription_payments.student_count_at_purchase, subscription_plans.pricing_model, subscriptions.student_count_at_purchase`; `CREATE INDEX idx_subscriptions_purchase_snapshot ON subscriptions`; `UPDATE subscription_payments, subscriptions`; `INSERT subscription_plans`
- Backfills/data changes: `UPDATE subscriptions SET student_count_at_purchase = student_capacity WHERE student_count_at_purchase IS NULL`; `UPDATE subscription_payments SET student_count_at_purchase = student_capacity WHERE student_count_at_purchase IS NULL`; `INSERT into subscription_plans`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `subscription_payments`, `subscription_plans`, `subscriptions`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in subscription_payments, subscriptions

## `prisma/migrations/202610260001_hundred_per_student_pricing/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `subscription_plans`
- Columns affected: `updated columns: price, updated_at`
- DDL and data operations: `UPDATE subscription_plans`
- Backfills/data changes: `UPDATE subscription_plans SET price = 100, updated_at = CURRENT_TIMESTAMP WHERE id = 'annual-service'`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `subscription_plans`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in subscription_plans

## `prisma/migrations/202610270001_subscription_capacity_adjustments/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `subscription_adjustments`
- Columns affected: `subscription_adjustments created: id, institution_id, subscription_id, old_capacity, new_capacity, amount, credit_amount, status, razorpay_order_id, razorpay_payment_id, created_by, created_at, updated_at`; index keys: `idx_subscription_adjustments_school(subscription_adjustments.institution_id,status,created_at)`
- DDL and data operations: `CREATE TABLE subscription_adjustments`; `CREATE INDEX idx_subscription_adjustments_school ON subscription_adjustments`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `subscriptions`, `users`
- Existing-object prerequisites: `institutions`, `subscriptions`, `users`
- External FK targets: `institutions`, `subscriptions`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202610270002_starter_hundred_student_limit/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `subscription_plans`
- Columns affected: `updated columns: student_limit, updated_at`
- DDL and data operations: `UPDATE subscription_plans`
- Backfills/data changes: `UPDATE subscription_plans SET student_limit = 100, updated_at = CURRENT_TIMESTAMP WHERE id = 'starter-annual-v1' AND student_limit <> 100`
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `subscription_plans`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: UPDATE changes rows in subscription_plans

## `prisma/migrations/202611030001_attendance_upgrade/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `attendance`, `attendance_audit_logs`, `school_holidays`, `settings`
- Columns affected: `attendance_audit_logs created: id, institution_id, attendance_id, student_id, academic_year, class_name, section, date, previous_status, new_status, previous_remarks, new_remarks, changed_by, reason, created_at`; `school_holidays created: id, institution_id, academic_year, date, name, type, description, created_at`; `added: settings.attendance_correction_window_hours`; index keys: `idx_attendance_audit_scope(attendance_audit_logs.institution_id,class_name,section,date)`, `idx_attendance_audit_student(attendance_audit_logs.student_id,date)`, `idx_school_holidays_scope(school_holidays.institution_id,academic_year,date)`
- DDL and data operations: `CREATE TABLE attendance_audit_logs, school_holidays`; `ALTER TABLE attendance, settings`; `ADD COLUMN settings.attendance_correction_window_hours`; `DROP CONSTRAINT attendance.attendance_status_check`; `ADD CONSTRAINT attendance.attendance_status_check`; `CREATE INDEX idx_attendance_audit_scope ON attendance_audit_logs, idx_attendance_audit_student ON attendance_audit_logs, idx_school_holidays_scope ON school_holidays`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `students`, `users`
- Existing-object prerequisites: `attendance`, `institutions`, `settings`, `students`, `users`
- External FK targets: `institutions`, `students`, `users`
- Potential destructive/data-sensitive operations: DROP operation present: attendance.attendance_status_check

## `prisma/migrations/202611030002_parent_portal/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `parent_invitations`, `parent_students`
- Columns affected: `parent_students created: id, institution_id, parent_user_id, student_id, relationship, is_primary, created_at`; `parent_invitations created: id, institution_id, student_id, parent_name, parent_email, parent_phone, invitation_code, status, expires_at, created_by, created_at, accepted_at`; index keys: `idx_parent_students_user(parent_students.parent_user_id)`, `idx_parent_students_student(parent_students.student_id)`, `idx_parent_invitations_code(parent_invitations.invitation_code, status)`, `idx_parent_invitations_student(parent_invitations.institution_id, student_id)`
- DDL and data operations: `CREATE TABLE parent_students, parent_invitations`; `CREATE INDEX idx_parent_students_user ON parent_students, idx_parent_students_student ON parent_students, idx_parent_invitations_code ON parent_invitations, idx_parent_invitations_student ON parent_invitations`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `students`, `users`
- Existing-object prerequisites: `institutions`, `students`, `users`
- External FK targets: `institutions`, `students`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202611030003_notification_engine/migration.sql`

- Current working-tree status: **tracked, clean**
- Git history: **present in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `fcm_device_tokens`, `notification_deliveries`, `notification_events`, `school_notification_settings`
- Columns affected: `fcm_device_tokens created: id, institution_id, user_id, token, device_type, user_agent, status, created_at, updated_at, revoked_at`; `notification_events created: id, institution_id, event_key, event_type, title, body, data, deep_link, recipient_user_ids, status, created_at`; `notification_deliveries created: id, institution_id, event_id, notification_id, user_id, device_token_id, channel, status, attempt_count, max_attempts, provider_message_id, error_code, error_message, next_retry_at, sent_at, delivered_at, created_at, updated_at`; `school_notification_settings created: institution_id, push_enabled, student_absent, attendance_correction, fee_payment, fee_reminders, homework, exam_results, announcements, teacher_leave, updated_at`; index keys: `idx_fcm_tokens_user(fcm_device_tokens.user_id, status)`, `idx_fcm_tokens_inst(fcm_device_tokens.institution_id, status)`, `idx_notif_events_key(notification_events.event_key)`, `idx_notif_events_inst(notification_events.institution_id, event_type)`, `idx_notif_deliv_status(notification_deliveries.status, next_retry_at)`, `idx_notif_deliv_user(notification_deliveries.user_id, created_at DESC)`, `idx_notif_deliv_event(notification_deliveries.event_id)`
- DDL and data operations: `CREATE TABLE fcm_device_tokens, notification_events, notification_deliveries, school_notification_settings`; `CREATE INDEX idx_fcm_tokens_user ON fcm_device_tokens, idx_fcm_tokens_inst ON fcm_device_tokens, idx_notif_events_key ON notification_events, idx_notif_events_inst ON notification_events, idx_notif_deliv_status ON notification_deliveries, idx_notif_deliv_user ON notification_deliveries, idx_notif_deliv_event ON notification_deliveries`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `fcm_device_tokens`, `institutions`, `notification_events`, `notifications`, `users`
- Existing-object prerequisites: `institutions`, `notifications`, `users`
- External FK targets: `institutions`, `notifications`, `users`
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202611050001_student_photo_path/migration.sql`

- Current working-tree status: **untracked local file**
- Git history: **not found in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `students`
- Columns affected: `added: students.photo_path`
- DDL and data operations: `ALTER TABLE students`; `ADD COLUMN students.photo_path`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `students`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: No direct UPDATE/DELETE/TRUNCATE/DROP/type-conversion token detected; not a safety approval.

## `prisma/migrations/202611050002_attendance_schema_recovery/migration.sql`

- Current working-tree status: **untracked local file**
- Git history: **not found in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `attendance`, `attendance_audit_logs`, `school_holidays`, `settings`
- Columns affected: `attendance_audit_logs created: id, institution_id, attendance_id, student_id, academic_year, class_name, section, date, previous_status, new_status, previous_remarks, new_remarks, changed_by, reason, created_at`; `school_holidays created: id, institution_id, academic_year, date, name, type, description, created_at`; `added: settings.attendance_correction_window_hours`; index keys: `idx_attendance_audit_scope(attendance_audit_logs.institution_id, class_name, section, date)`, `idx_attendance_audit_student(attendance_audit_logs.student_id, date)`, `idx_attendance_audit_changed_by(attendance_audit_logs.changed_by)`, `idx_school_holidays_scope(school_holidays.institution_id, academic_year, date)`
- DDL and data operations: `CREATE TABLE attendance_audit_logs, school_holidays`; `ALTER TABLE attendance, settings`; `ADD COLUMN settings.attendance_correction_window_hours`; `DROP CONSTRAINT attendance.attendance_status_check`; `ADD CONSTRAINT attendance.attendance_status_check`; `CREATE INDEX idx_attendance_audit_scope ON attendance_audit_logs, idx_attendance_audit_student ON attendance_audit_logs, idx_attendance_audit_changed_by ON attendance_audit_logs, idx_school_holidays_scope ON school_holidays`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: `institutions`, `students`, `users`
- Existing-object prerequisites: `attendance`, `institutions`, `settings`, `students`, `users`
- External FK targets: `institutions`, `students`, `users`
- Potential destructive/data-sensitive operations: DROP operation present: attendance.attendance_status_check

## `prisma/migrations/202611050003_student_photo_asset_kind/migration.sql`

- Current working-tree status: **untracked local file**
- Git history: **not found in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `school_assets`
- Columns affected: No explicit CREATE/ALTER/UPDATE column list extracted.
- DDL and data operations: `ALTER TABLE school_assets`; `DROP CONSTRAINT school_assets.school_assets_kind_check`; `ADD CONSTRAINT school_assets.school_assets_kind_check`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `school_assets`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: DROP operation present: school_assets.school_assets_kind_check

## `prisma/migrations/202611050004_timetable_publication_state/migration.sql`

- Current working-tree status: **untracked local file**
- Git history: **not found in checked Git history**
- Quarantine status: **manifest-unlisted; no active chain**
- Deployment status: **UNKNOWN**
- Tables affected: `timetable_entries`
- Columns affected: `added: timetable_entries.status`; index keys: `idx_timetable_active_slot(timetable_entries.institution_id, class_name, section, academic_year, weekday, start_time)`, `idx_timetable_published_scope(timetable_entries.institution_id, academic_year, class_name, section, weekday, start_time)`
- DDL and data operations: `ALTER TABLE timetable_entries`; `ADD COLUMN timetable_entries.status`; `DROP CONSTRAINT timetable_entries.timetable_entries_institution_id_class_name_section_academic_year_weekday_start_time_key, timetable_entries.timetable_entries_status_check`; `ADD CONSTRAINT timetable_entries.timetable_entries_status_check`; `CREATE INDEX idx_timetable_active_slot ON timetable_entries, idx_timetable_published_scope ON timetable_entries`
- Backfills/data changes: No UPDATE/INSERT/DELETE/TRUNCATE recognized.
- RLS / grants: No RLS/GRANT/REVOKE token.
- Static FK references: None extracted
- Existing-object prerequisites: `timetable_entries`
- External FK targets: No external FK prerequisite extracted; ALTER prerequisites still apply.
- Potential destructive/data-sensitive operations: DROP operation present: timetable_entries.timetable_entries_institution_id_class_name_section_academic_year_weekday_start_time_key, timetable_entries.timetable_entries_status_check
