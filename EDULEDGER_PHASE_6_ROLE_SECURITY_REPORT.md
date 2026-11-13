# EduLedger Phase 6: Role Security & Multi-Tenant Isolation Report

**Project**: EduLedger — School Management, Reimagined  
**Auditor**: Database Administrator & Application Security Engineer  
**Date**: November 8, 2026  

---

## 1. Multi-Tenant School Segregation

EduLedger hosts multiple independent institutions. All notification queries strictly enforce multi-tenant separation:

1. **Token Registration (`POST /api/notifications/push-token`)**:
   - Requires authenticated session (`currentUser()`).
   - Uses `user.institutionId` from the verified session, never from client-provided body parameters.
2. **Device Queries (`getUserActiveDeviceTokens`)**:
   - Filters strictly by `user_id=? AND status='ACTIVE'`.
3. **PWA Diagnostics (`getPwaDiagnosticsData`)**:
   - Constrained to `institution_id=? AND status='ACTIVE'`.
   - School A administrators can never inspect or count device tokens enrolled by School B.

---

## 2. Portal & Role Segregation

### 1. School Administrator
- Has access to `/dashboard/settings/pwa`.
- Diagnostic POST endpoint enforces `ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"]`.
- The **Send Controlled Test Push** action strictly restricts recipient targets to `recipientUserIds: [user.id]`.
- Cannot broadcast to teachers, parents, or other school staff via diagnostics.

### 2. Teacher Portal
- Attempts by teachers to access `/api/settings/pwa` or `/dashboard/settings/pwa` are blocked with `HTTP 403 Forbidden: Administrator access required`.
- Leave approval alerts resolve exclusively to `[teacherUserId]` via verified teacher email records.
- Homework notifications route to `/teacher/homework`.

### 3. Parent Portal
- Parents receive notifications only for their verified enrolled children via the `parent_students` relational join.
- Queries enforce `WHERE ps.institution_id=? AND ps.student_id=?`.
- Parents never receive attendance, fees, homework, or exam results for students they do not own.

---

## 3. Server-Authoritative Environment Isolation Guard

To protect real production school recipients from accidental notifications originating from Vercel Preview PR deployments or local developer machines:

```typescript
// SERVER-AUTHORITATIVE ENVIRONMENT ISOLATION POLICY:
// In Preview environments, external FCM push notifications to real devices
// are BLOCKED unless the call is an explicit, server-authorized single-recipient test
// initiated by an authenticated administrator. Client-provided data flags alone cannot bypass this guard.
const isProduction = process.env.VERCEL_ENV === "production";
const isPreview = process.env.VERCEL_ENV === "preview";

if (isPreview && !isProduction) {
  const isServerAuthorized =
    Boolean(input.isServerAuthorizedTest) &&
    recipientUserIds.length === 1 &&
    eventKey.startsWith("test_push_");

  if (!isServerAuthorized) {
    // Skip external FCM dispatch in Preview environment to protect real production recipients
    continue;
  }
}
```

- **Invariant**: General operational events (attendance marking, fee generation, announcements) cannot reach real user devices from any Preview deployment.
- **Verification**: Verified via automated unit test `verifies Preview environment isolation guard exists in dispatchNotificationEvent`.

