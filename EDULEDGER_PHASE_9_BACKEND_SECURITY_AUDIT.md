# EduLedger Phase 9 — Backend Token Registration API & Security Audit

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — API Security & Authorization Verification  
**Date**: November 8, 2026  
**Status**: AUDITED & SECURE  

---

## 1. Token Ingestion API (`POST /api/notifications/push-token`)

- **Authentication**: Requires valid server session (`currentUser()`). Unauthenticated requests return HTTP 401.
- **Tenant Derivation**: Institution ID is extracted directly from the authenticated server session (`user.institutionId`); client-supplied institution IDs are ignored.
- **Input Validation**: Uses Zod schema (`token: z.string().trim().min(1).max(4096)`) and `validateFcmToken()`.
- **Rejection of WebPush Objects**: WebPush subscription JSON or endpoint URLs are rejected with HTTP 400 and descriptive error types (`endpoint_url`, `webpush_subscription`).
- **PostgreSQL Persistence**: Persisted using `registerDeviceToken()` with parameterization, preventing SQL injection.

---

## 2. Token Revocation API (`DELETE /api/notifications/push-token`)

- **Authentication**: Requires valid session (`currentUser()`).
- **Authorization**: `revokeDeviceToken(cleanToken, user.id)` ensures a user can **only revoke tokens associated with their own user ID**, preventing denial-of-service against other users.

---

## 3. Automated Security Test Evidence

Ten specific automated security scenarios passed with zero failures in `tests/firebase-activation.test.ts`:
1. Unauthenticated request rejection (HTTP 401).
2. Teacher attempting administrator diagnostics rejection (HTTP 403).
3. Parent attempting administrator diagnostics rejection (HTTP 403).
4. Forged client authorization flag bypass prevention.
5. Institution ownership derivation from server session.
6. Diagnostic test notification scoped exclusively to authenticated admin's own ID.
7. Cross-tenant request isolation.
8. Missing device token detection (`NO_ACTIVE_DEVICE_TOKENS`).
9. Idempotency key generation for repeated test requests.
10. Malformed payload rejection (HTTP 400).

