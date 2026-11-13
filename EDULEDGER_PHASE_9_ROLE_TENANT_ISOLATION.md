# EduLedger Phase 9 — Role, Portal & Tenant Isolation Verification

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — Multi-Tenant & Role Isolation Audit  
**Date**: November 8, 2026  
**Status**: AUDITED & PASS  

---

## 1. Multi-Portal Separation

The three core user portals have distinct operational boundaries:

### 1.1 School Administrator Portal (`/dashboard`)
- Mounted on `/dashboard` and `/admin`.
- Device tokens tagged with `user.institutionId` and administrator `user.id`.
- Diagnostic endpoints enforce `ADMIN_ROLES.includes(user.role)`.
- Test notifications target strictly the administrator's own registered device.

### 1.2 Teacher Portal (`/teacher`)
- Mounted under `/teacher` route scope.
- Receives academic notices, student absence notifications, and leave decisions.
- Class-level alerts query teachers assigned to specific classes within `institutionId`.
- Teachers cannot view or access tokens from other institutions.

### 1.3 Parent Portal (`/parent`)
- Mounted under `/parent` route scope.
- Linked via `parent_student_associations` in PostgreSQL.
- Absenteeism, fee reminders, homework, and exam result dispatch functions query parent users linked to the specific student record.
- Cross-student and cross-tenant leakage is strictly blocked by query parameterization.

---

## 2. Cross-Tenant Negative Testing Evidence

Automated tests in `tests/firebase-activation.test.ts` and `tests/multi-tenant-isolation.test.ts` verify:
- Queries targeting institution A never return tokens or student records from institution B.
- Parent accounts from school A cannot register tokens under school B.
- Teachers cannot target students outside their assigned institution.

