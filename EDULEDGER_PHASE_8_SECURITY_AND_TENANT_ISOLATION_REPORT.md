# EduLedger Phase 8 — Security, Environment & Multi-Tenant Isolation Report

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Multi-Tenant Security & Environment Isolation  
**Date**: November 8, 2026  
**Status**: VERIFIED & SECURE  

---

## 1. Multi-Tenant Role Isolation

The notification architecture enforces strict tenant and role boundaries directly in PostgreSQL queries:

### 1.1 School Administrator Isolation
- Diagnostic routes (`/api/settings/pwa`) require authenticated session with `user.role IN ('SCHOOL_ADMIN', 'SUPER_ADMIN')`.
- Token queries filter exclusively by `institution_id = user.institutionId`.
- Cross-school diagnostic reads are strictly blocked.

### 1.2 Teacher Portal Isolation
- Teacher routes operate under `/teacher` portal scope.
- Notifications for class events (e.g. exams, attendance corrections) query teachers assigned to specific classes within `institution_id`.
- Teachers cannot query or send alerts to unrelated schools.

### 1.3 Parent Portal Isolation
- Student alerts (e.g., absenteeism, homework, fee reminders) query parent-student associations in `parent_student_associations` filtering by `institution_id` and `student_id`.
- Cross-family data access is blocked at the database layer; a parent account only receives alerts for their linked children.

---

## 2. Server-Authoritative Preview Isolation

To prevent staging or preview deployments from broadcasting push messages to real production students or parents, `src/lib/notifications.ts` enforces:

```typescript
const isPreview = process.env.VERCEL_ENV === "preview";
if (isPreview && !input.isServerAuthorizedTest) {
  console.log("[notifications] Preview environment detected. Bypassing push notification.");
  return;
}
```

- Client-supplied metadata (`data.isTest = "true"`) is never trusted.
- Only the authenticated server action `/api/settings/pwa` sets `isServerAuthorizedTest: true` when a verified administrator triggers a diagnostic test push to their own registered device.

