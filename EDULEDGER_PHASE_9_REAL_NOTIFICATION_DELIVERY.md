# EduLedger Phase 9 — Notification Delivery & Error Classification Audit

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — Real Notification Delivery Verification  
**Date**: November 8, 2026  
**Status**: VERIFIED & AUDITED  

---

## 1. Notification Delivery Engine

Server-side push delivery is governed by `sendFcmMessage()` in `src/lib/notifications.ts` targeting Google FCM v1 (`https://fcm.googleapis.com/v1/projects/eduledger-e0ac2/messages:send`).

### Real Live Tests vs Automated Mocks
- **Live Google OAuth Exchange**: Tested live with Google's OAuth 2.0 token endpoint; returned valid bearer tokens (HTTP 200).
- **Live FCM v1 Endpoint Validation**: Tested live against FCM v1 API:
  - Non-FCM sliced endpoint tokens returned `400 INVALID_ARGUMENT`.
  - Properly formatted test tokens returned `404 NOT_FOUND` (`UNREGISTERED`), proving Google FCM endpoint connectivity.
- **Physical Device Push Receipt**: **NOT TESTED** pending physical mobile hardware verification by the project owner.

---

## 2. Error Classification & Token Preservation Rules

| Condition | Error Code | Retryable | Token Action |
| :--- | :--- | :---: | :--- |
| Google FCM 200 | None | No | Status updated to `SENT`; token preserved as `ACTIVE`. |
| Google FCM 404 / UNREGISTERED | `UNREGISTERED` | No | Token marked `REVOKED`; delivery marked `REVOKED`. |
| Google FCM 400 (Invalid token) | `INVALID_ARGUMENT` | No | Delivery marked `FAILED`; token preserved or checked. |
| Google FCM 401 (Auth expired) | `UNAUTHENTICATED` | Yes | Cached OAuth token purged; token preserved. |
| Google FCM 429 (Rate limit) | `RESOURCE_EXHAUSTED` | Yes | Exponential backoff retry; token preserved. |
| Google FCM 500 / 503 (Outage) | `INTERNAL` / `UNAVAILABLE` | Yes | Exponential backoff retry; token preserved. |
| Network Timeout | `NETWORK_ERROR` | Yes | Delivery marked pending retry; token preserved. |

