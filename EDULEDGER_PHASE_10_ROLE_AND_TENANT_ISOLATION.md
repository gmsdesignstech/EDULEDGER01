# EDULEDGER PHASE 10 — ROLE & TENANT ISOLATION AUDIT

## 1. Multi-Tenant Architecture Overview
EduLedger is a multi-tenant school-management SaaS where every school organization is partitioned by unique `school_id` identifiers.

Data isolation between schools (tenants) and between roles (School Admin, Teacher, Parent, Student) is enforced across:
1. PostgreSQL Database queries (mandatory tenant filters).
2. Server Actions and API Handlers (`session.user.schoolId`).
3. Push notification dispatch logic (recipient filtering).
4. Client PWA manifests and route middleware.

---

## 2. Notification Dispatch Isolation Matrix

| Role | Permitted Inbound Notifications | Permitted Outbound Triggers | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **Super Admin** | Platform alerts, diagnostic tests | Diagnostics, emergency global notices | System-level authorization check. |
| **School Administrator** | Staff leaves, school billing, diagnostic tests | School broadcasts, fee reminders, timetable changes | Scoped strictly to `session.user.schoolId`. |
| **Teacher** | Timetable changes, student submissions, notices | Attendance submission alerts, marks entries | Gated by class and subject teacher assignments within school. |
| **Parent** | Student attendance, fee invoices, exam marks | None (recipient only) | Gated by `parent_student_mappings` within the school. |
| **Student** | Academic notices, schedule updates | None | Handled via parent accounts currently (`/student` placeholder). |

---

## 3. Push Token Ingestion Tenant Gating
In `src/app/api/notifications/push-token/route.ts`:
- The incoming request is authenticated using `getSessionUser()`.
- The token is saved in `user_push_tokens` with:
  - `user_id = session.user.id`
  - `school_id = session.user.schoolId`
- Cross-tenant token registration is impossible because `schoolId` is derived strictly from the cryptographically verified session token, never from untrusted client input.
- Deletion queries match both `user_id` and the token value.

---

## 4. Cross-Tenant Notification Prevention Test
The notification dispatcher (`sendNotificationNow` in `src/lib/notifications.ts`) enforces the following invariants:
1. **Recipient Lookup**: Device push tokens are resolved by querying `user_push_tokens` joined on `users.id IN (...)` and `users.school_id = target_school_id`.
2. **Tenant Boundary**: Even if an admin from School A attempts to trigger an announcement event, the recipient query filters users strictly by School A's `school_id`. No push token belonging to School B can ever be selected.
3. **Automated Verification**: Re-verified in unit test suite (`tests/firebase-activation.test.ts` Scenario 5: Cross-tenant notification isolation).

---

## 5. Middleware and Route Isolation
- `/admin/*`: Restricted to `role === "admin"` or `role === "super_admin"`.
- `/teacher/*`: Restricted to `role === "teacher"`.
- `/parent/*`: Restricted to `role === "parent"`.
- Unauthorized access attempts are intercepted at Next.js middleware and redirected to `/login` or `/unauthorized`.

**Role & Tenant Isolation Status**: **PASS**

