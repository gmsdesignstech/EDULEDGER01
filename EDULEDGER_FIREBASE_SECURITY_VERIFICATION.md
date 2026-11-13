# EDULEDGER FIREBASE PUSH NOTIFICATION SECURITY VERIFICATION

**Project:** EduLedger — School Management, Reimagined  
**Security Standard:** Principle of Least Privilege, Zero Client Secret Exposure, Multi-Tenant Data Isolation  
**Date:** 2026-11-08  
**Audit Status:** **VERIFIED SECURE**

---

## 1. Zero Client Secret Exposure Audit

| Threat Vector | Protection Mechanism | Verification Result |
| :--- | :--- | :--- |
| **Frontend Leakage** | Private keys and client email are strictly read on the server (`node:crypto` RS256 assertion in `src/lib/notifications.ts`). None are exposed through `NEXT_PUBLIC_*`. | **PASS · Zero Leakage** |
| **API Diagnostics Leakage** | `/api/settings/pwa` uses `Boolean(...)` flags (`hasVapidKey`, `hasProjectId`, `hasPrivateKey`) and returns only boolean configured statuses. Zero credential strings are serialized. | **PASS · Verified** |
| **Git Repository Safety** | `.env*` files are strictly gitignored. Neither service account keys nor private certificates exist in git tracking. | **PASS · Verified** |
| **Browser Storage Safety** | Only the public Web Push `PushSubscription` JSON is stored client-side in the browser's ServiceWorker registration. No Google OAuth tokens or private keys ever touch the browser. | **PASS · Verified** |

---

## 2. Multi-Tenant Data Isolation & Cross-School Protection

* **Database Constraints:** In `fcm_device_tokens`, every device registration is explicitly tied to `institution_id` and `user_id`:
  ```sql
  INSERT INTO fcm_device_tokens (id, institution_id, user_id, token, device_type, user_agent, status)
  VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
  ```
* **Notification Scoping:** When notifications are dispatched, recipient user IDs are resolved server-side through strict tenant relations:
  * `getParentsForStudent(institutionId, studentId)`: Only returns guardians tied to that specific student.
  * `getParentsForClass(institutionId, classId)`: Only returns guardians of students enrolled in that specific class.
  * `getTeacherUserId(institutionId, teacherId)`: Only returns the specific teacher's user record.
* **Invariant:** A notification for School A can never be delivered to a device registered in School B. A parent in School A cannot receive attendance or fee details for any child other than their own linked dependents.

---

## 3. Device Token Security & Revocation

1. **Authentication Requirement:** The `/api/notifications/push-token` endpoint enforces `await currentUser()` session validation. Unauthenticated clients receive HTTP 401.
2. **Re-assignment Safety:** If a device is passed to another family member or user, `ON CONFLICT (token) DO UPDATE` updates `user_id = EXCLUDED.user_id`, immediately revoking access from the previous user.
3. **Logout Revocation:** When a user logs out, `DELETE /api/notifications/push-token` updates the token status to `REVOKED`, halting all future push dispatches to that device.
4. **Stale Token Pruning:** FCM error responses indicating `UNREGISTERED` or `NOT_FOUND` automatically invoke `revokeDeviceToken(token)` to prevent repeated failed dispatches.

---

## 4. Controlled Test Push Safety

* The test push action in `/api/settings/pwa` is restricted to `ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"]`.
* Test dispatches are scoped strictly to `recipientUserIds: [user.id]`.
* The system prevents accidental broadcasting of test alerts to teachers, parents, or students.

