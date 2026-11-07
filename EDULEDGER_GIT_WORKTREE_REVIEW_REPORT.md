# Git Worktree Review Report

**Review date:** 2026-11-07  
**Status:** REVIEW REQUIRED — NO FILES STAGED; NO RELEASE SET APPROVED.

## Snapshot

Inventory: 110 tracked modified, 1 tracked deleted, 128 untracked non-ignored paths; 239 total status entries; 0 staged paths. main and origin/main were verified at `0af2f947d43de6258a5da70040bd726f29373ec2`. The inventory includes this report itself. Status alone does not establish review or release approval.

## Classification rules

Each current path is listed below with its Git state and a conservative category. “Review/preserve” means retain the worktree content and review its diff; it does not mean stage or deploy. Untracked SQL/migrations and scratch artifacts are preserved for review, not executed.

| Git state | Category | Path | Handling |
|---|---|---|---|
| M | Build/deployment/configuration | `.env.example` | Preserve; review complete diff before staging |
| M | Build/deployment/configuration | `.gitignore` | Preserve; review complete diff before staging |
| D | Documentation/evidence | `PRODUCTION_READINESS.md` | Deletion observed; preserve/recover only from an owner-approved copy; do not overwrite |
| M | Documentation/evidence | `README.md` | Preserve; review complete diff before staging |
| M | Build/deployment/configuration | `eslint.config.mjs` | Preserve; review complete diff before staging |
| M | Build/deployment/configuration | `package-lock.json` | Preserve; review complete diff before staging |
| M | Build/deployment/configuration | `package.json` | Preserve; review complete diff before staging |
| M | Other repository content | `prisma/schema.prisma` | Preserve; review complete diff before staging |
| M | Application source/assets | `public/firebase-messaging-sw.js` | Preserve; review complete diff before staging |
| M | Application source/assets | `public/icons/apple-touch-icon.png` | Preserve; review complete diff before staging |
| M | Application source/assets | `public/icons/icon-192.png` | Preserve; review complete diff before staging |
| M | Application source/assets | `public/icons/icon-512.png` | Preserve; review complete diff before staging |
| M | Application source/assets | `public/icons/icon-maskable-192.png` | Preserve; review complete diff before staging |
| M | Application source/assets | `public/icons/icon-maskable-512.png` | Preserve; review complete diff before staging |
| M | Application source/assets | `public/offline.html` | Preserve; review complete diff before staging |
| M | Application source/assets | `scripts/dev.mjs` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/(parent-auth)/parent/activate/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/admin/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/auth/login/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/export/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/import/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/modules/[module]/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/notifications/ack/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/parent/children/[id]/pay-fee/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/parent/children/[id]/verify-payment/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/api/timetable/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/dashboard/layout.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/dashboard/students/[id]/id-card/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/globals.css` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/layout.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/manifest-parent.webmanifest/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/manifest-teacher.webmanifest/route.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/manifest.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/offline/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/attendance/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/fees/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/homework/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/notices/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/notifications/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/profile/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/results/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/parent/timetable/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/attendance/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/exams/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/homework/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/leave/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/notifications/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/students/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/app/teacher/timetable/page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/accounts-dashboard.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/accounts-reports.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/admin-login-form.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/admin-overview.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/admin-section.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/audit-log-dashboard.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/auth-form.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/cash-book.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/class-workspace.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/data-actions.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/delete-record-button.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/edu-cache-provider.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/fee-receipts.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/landing-page.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/notification-center.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/notification-push-manager.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/parent-context.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/parent-shell.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/payments.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/print-button.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/pwa-install-prompt.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/results-management.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/school-salary-management.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/settings.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/staff-attendance.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/student-attendance.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/student-demotion.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/student-id-cards.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/student-lifecycle.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/student-promotion.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/students.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/subscription-details.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/super-admin-login-form.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/teacher-shell.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/teachers.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/theme.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/timetable-workspace.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/whatsapp-addon-checkout.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/whatsapp-consent-manager.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/components/whatsapp-dashboard.tsx` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/lib/api-response.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/lib/auth-redirect.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/lib/db.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/lib/notifications.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/lib/payment.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/lib/registration-schema.ts` | Preserve; review complete diff before staging |
| M | Application source/assets | `src/lib/server-errors.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/api-response.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/auth-db.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/auth-redirect.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/global-setup.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/notification-engine.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/notification-routes.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/parent-portal.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/pwa.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/registration.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/super-admin-portal.test.ts` | Preserve; review complete diff before staging |
| M | Test | `tests/timetable-timing.test.ts` | Preserve; review complete diff before staging |
| M | Build/deployment/configuration | `vercel.json` | Preserve; review complete diff before staging |
| M | Build/deployment/configuration | `vitest.config.mts` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/CHANGELOG.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/SKILL.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/_contributing.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/_sections.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/_template.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/conn-limits.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/conn-pooling.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/data-pagination.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/data-upsert.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/lock-advisory.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/query-composite-indexes.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/query-covering-indexes.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/query-index-types.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/query-missing-indexes.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/query-partial-indexes.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/schema-constraints.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/schema-data-types.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/schema-partitioning.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/security-privileges.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase-postgres-best-practices/references/security-rls-performance.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase/CHANGELOG.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase/SKILL.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase/assets/feedback-issue-template.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `.agents/skills/supabase/references/skill-feedback.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_BLOCKER_RESOLUTION_MASTER_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_DATABASE_MIGRATION_EVIDENCE_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_DEPLOYMENT_MANIFEST.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_DEPLOYMENT_SOURCE_COMMIT_VERIFICATION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_FINAL_OWNER_ACTIONS.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_FINAL_TEST_RESULTS.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_GIT_WORKTREE_REVIEW_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_POSTGRESQL_ISOLATION_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_PRODUCTION_REDEPLOYMENT_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_PWA_ICON_MIME_FIX_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_SECURITY_AND_REGRESSION_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_STUDENT_LOGIN_ROUTE_FIX_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_STUDENT_MANIFEST_FIX_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `EDULEDGER_VERCEL_PREVIEW_VERIFICATION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/AUTHORITATIVE_SCHEMA_EVIDENCE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/DATABASE_EVIDENCE_READINESS.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/DATABASE_PROVIDER_CLEANUP.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/DEPLOYED_SCHEMA_COMPARISON.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/DEPLOYMENT_DATABASE_ATTESTATION_TEMPLATE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/EDULEDGER_PORTALS_GIT_PRESERVATION_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/MIGRATION_HISTORY_VERIFICATION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/MIGRATION_LEDGER_EVIDENCE_ANALYSIS.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/MIGRATION_RECONCILIATION_MATRIX.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/MIGRATION_RECOVERY_PLAN.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/OWNER_DATABASE_EVIDENCE_REQUEST.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/OWNER_EVIDENCE_COLLECTION_CHECKLIST.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/OWNER_EVIDENCE_SUBMISSION_CHECKLIST.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/OWNER_EVIDENCE_VALIDATION_MATRIX.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/OWNER_POSTGRESQL_EVIDENCE_SUBMISSION_TEMPLATE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/OWNER_RECOVERY_CHECKLIST.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/PHASE_2_3_7_ENTRY_CRITERIA.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/PHASE_2_3_7_READINESS_DECISION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/POSTGRESQL_COMPATIBILITY_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/POSTGRESQL_ENVIRONMENT_SEPARATION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/POSTGRESQL_MIGRATION_LEDGER_PROCEDURE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/POSTGRESQL_ONLY_ARCHITECTURE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/POSTGRESQL_PROVIDER_VERIFICATION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/POSTGRESQL_SCHEMA_EXPORT_PROCEDURE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/POSTGRESQL_TEST_ARCHITECTURE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/PRODUCTION_SCHEMA_EVIDENCE_ANALYSIS.md` | Preserve; review complete diff before staging |
| ?? | Database evidence/migration source | `database/schema/READ_ONLY_DATABASE_DISCOVERY.sql` | Preserve; never execute pending owner evidence/review |
| ?? | Documentation/evidence | `database/schema/RECOVERY_DECISION_MATRIX.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/SCHEMA_CONFLICT_RESOLUTION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/SCHEMA_DEPENDENCY_MAP.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/SCHEMA_EXPORT_VERIFICATION_GUIDE.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/SCHEMA_INVENTORY.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/SCHEMA_RECOVERY_DECISION.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/SCHEMA_VALIDATION_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Documentation/evidence | `database/schema/SQLITE_REMOVAL_REPORT.md` | Preserve; review complete diff before staging |
| ?? | Database evidence/migration source | `prisma/migrations/202611050001_student_photo_path/migration.sql` | Preserve; never execute pending owner evidence/review |
| ?? | Database evidence/migration source | `prisma/migrations/202611050002_attendance_schema_recovery/migration.sql` | Preserve; never execute pending owner evidence/review |
| ?? | Database evidence/migration source | `prisma/migrations/202611050003_student_photo_asset_kind/migration.sql` | Preserve; never execute pending owner evidence/review |
| ?? | Database evidence/migration source | `prisma/migrations/202611050004_timetable_publication_state/migration.sql` | Preserve; never execute pending owner evidence/review |
| ?? | Scratch/generated/embedded repository | `scratch/npm-audit-after-fix.json` | Preserve; inspect ownership before cleanup |
| ?? | Scratch/generated/embedded repository | `scratch/npm-audit-after-upgrades.json` | Preserve; inspect ownership before cleanup |
| ?? | Scratch/generated/embedded repository | `scratch/npm-audit-before.json` | Preserve; inspect ownership before cleanup |
| ?? | Scratch/generated/embedded repository | `scratch/npm-audit-current.json` | Preserve; inspect ownership before cleanup |
| ?? | Scratch/generated/embedded repository | `scratch/production-students-schema-before-photo-20261105.json` | Preserve; inspect ownership before cleanup |
| ?? | Application source/assets | `scripts/migrate-student-photo-timetable.mjs` | Preserve; review complete diff before staging |
| ?? | Build/deployment/configuration | `skills-lock.json` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/(student-auth)/student/login/page.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/api/reports/analytics/route.ts` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/api/students/[id]/photo/route.ts` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/dashboard/reports/page.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/manifest-student.webmanifest/route.ts` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/student/layout.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/student/page.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/app/teacher/marks/page.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/components/app-download-section.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/components/portal-network-status.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/components/portal-update-prompt.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/components/student-photo-image.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/components/student-portal.tsx` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/lib/accounting-engine.ts` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/lib/payroll-calculations.ts` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/lib/portal-session.ts` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/lib/postgres-target.ts` | Preserve; review complete diff before staging |
| ?? | Application source/assets | `src/lib/qr-code.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/accounting-engine.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/landing-apps.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/notifications-provider.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/parent-fee-payment-verification.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/payroll-calculations.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/portal-session.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/pwa-completion.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/reports-analytics.test.ts` | Preserve; review complete diff before staging |
| ?? | Test | `tests/student-photo-storage.test.ts` | Preserve; review complete diff before staging |
| ?? | Build/deployment/configuration | `vitest.safe-unit.config.mts` | Preserve; review complete diff before staging |

## Exceptional worktree event

`PRODUCTION_READINESS.md` is shown as deleted. It was locally modified before this review; its uncommitted content cannot be reconstructed from the current Git index without losing those edits. It was therefore not restored from `HEAD`. `OPERATIONS.md` was clean at initial review and is present from `HEAD`. Several pre-existing untracked historical reports also disappeared during the review without an intentional cleanup operation; their origin/cause could not be established. No broad restore, clean, reset, deletion, force-add, or staging operation was used. Check OneDrive/local history or a separate backup before attempting recovery.

## Release disposition

No paths are staged. Do not stage this entire worktree. Construct any future release from an explicitly reviewed allowlist after resolving the database evidence, Preview isolation, security acceptance, and rollback gates.
