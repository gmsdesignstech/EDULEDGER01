# EduLedger Phase 5: Role & Multi-Tenant Notification Isolation Audit

**Project**: EduLedger — School Management, Reimagined  
**Auditor**: Database Administrator & Security Specialist  
**Audit Date**: November 8, 2026  

---

## 1. Multi-Tenant Database Architecture & SQL Invariant Verification

In a multi-school environment like EduLedger, preventing notification leakage between separate schools (e.g. School A receiving notices from School B) and between separate parents (e.g. Parent X receiving marks/attendance for Parent Y's child) is a mission-critical security requirement.

### 1. Device Token Registration (`POST /api/notifications/push-token`)
- **Authentication**: Requires valid server session via `currentUser()`.
- **Institution Binding**:
  ```typescript
  await registerDeviceToken(
    user.institutionId,
    user.id,
    parsed.data.token,
    parsed.data.deviceType,
    parsed.data.userAgent
  );
  ```
- **Database Query**:
  ```sql
  INSERT INTO fcm_device_tokens(id, institution_id, user_id, token, device_type, user_agent, status, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
  ON CONFLICT(token) DO UPDATE SET
    user_id=EXCLUDED.user_id,
    institution_id=EXCLUDED.institution_id,
    device_type=EXCLUDED.device_type,
    user_agent=EXCLUDED.user_agent,
    status='ACTIVE',
    revoked_at=NULL,
    updated_at=CURRENT_TIMESTAMP
  ```
- **Invariant**: If a shared browser device is re-used by a different user or different school account, the token registration automatically updates to the current authenticated `institution_id` and `user_id`.
- **Status**: **PASS** (Verified by automated unit test).

### 2. Device Token Revocation (`DELETE /api/notifications/push-token`)
- **Authentication**: Requires valid user session.
- **SQL Scoping**:
  ```sql
  UPDATE fcm_device_tokens 
  SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP 
  WHERE token=? AND user_id=?
  ```
- **Invariant**: A user cannot revoke device tokens belonging to another user.
- **Status**: **PASS** (Verified by automated unit test).

---

## 2. Parent-Child Notification Scoping

| Event Trigger | Recipient Resolution Function | Database Query Constraints | Navigation Deep-Link |
| :--- | :--- | :--- | :--- |
| **Student Absent Alert** | `getParentsForStudent(instId, studentId)` | `SELECT parent_user_id FROM parent_students WHERE institution_id=? AND student_id=?` | `/parent/attendance?child=${studentId}` |
| **Attendance Correction** | `getParentsForStudent(instId, studentId)` | `WHERE institution_id=? AND student_id=?` | `/parent/attendance?child=${studentId}` |
| **Fee Payment Confirmation** | `getParentsForStudent(instId, studentId)` | `WHERE institution_id=? AND student_id=?` | `/parent/fees?child=${studentId}` |
| **Fee Due Reminder** | `getParentsForStudent(instId, studentId)` | `WHERE institution_id=? AND student_id=?` | `/parent/fees?child=${studentId}` |
| **Homework Assigned** | `getParentsForClass(instId, class, sec)` | `WHERE ps.institution_id=? AND e.class_name=? AND e.status='Active'` | `/parent/homework` |
| **Exam Results Published** | `getParentsForStudent(instId, studentId)` | `WHERE institution_id=? AND student_id=?` | `/parent/results?child=${studentId}` |

### Security Verification:
1. Every query strictly checks `institution_id=?`.
2. Parent queries resolve only via verified entries in the `parent_students` table.
3. Parents can never receive attendance, fee receipts, or exam mark sheets for children that do not belong to them.
- **Status**: **PASS** (Verified by unit test suite).

---

## 3. Teacher & Staff Role Isolation

| Event Trigger | Recipient Resolution Function | Query Constraints | Security Scope |
| :--- | :--- | :--- | :--- |
| **Teacher Leave Decision** | `getTeacherUserId(instId, teacherId)` | `SELECT email FROM teachers WHERE institution_id=? AND id=?` $\rightarrow$ `SELECT id FROM users WHERE institution_id=? AND LOWER(email)=LOWER(?)` | Scoped strictly to that specific teacher's `user.id`. |
| **Admin Diagnostics Test Push** | `POST /api/settings/pwa` | Restricted to `ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"]` | Scoped strictly to `[user.id]`. Cannot broadcast to teachers or parents. |

- **Diagnostics Access Guard**:
  - Teachers and Parents attempting to access `/api/settings/pwa` receive `HTTP 403 Forbidden: Administrator access required`.
  - Non-authenticated requests receive `HTTP 401 Unauthenticated`.
- **Status**: **PASS** (Verified by unit test suite).

---

## 4. Sensitive Route Caching Isolation

In `public/firebase-messaging-sw.js`, the service worker enforces:
```javascript
const SENSITIVE_PREFIXES = [
  "/api/", "/admin", "/parent", "/teacher", "/student", "/dashboard",
  "/students", "/fees", "/attendance", "/marks", "/salaries", "/reports",
  "/settings", "/auth", "/accounts", "/cash-book", "/classes",
  "/documents", "/exams", "/results", "/subscription", "/timetable"
];
```
- **Fetch Handler Invariant**: Any request matching a sensitive prefix is handled exclusively via **Network-Only** (`fetch(request)`).
- **Offline Shell**: Only non-sensitive static assets (`/offline.html`, `/icons/*`, Next.js bundles) are cached in `eduledger-pwa-v5`.
- **Status**: **PASS** (Verified by unit test).

