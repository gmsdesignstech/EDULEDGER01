# EduLedger Phase 8 — Notification Delivery & Error Handling Report

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Notification Delivery Architecture  
**Date**: November 8, 2026  
**Status**: AUDITED & ERROR-CLASSIFICATION REFINED  

---

## 1. FCM HTTP v1 Delivery Engine

All external push dispatches pass through `sendFcmMessage()` targeting:
`https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`

### Error Classification Matrix

| HTTP Status | FCM v1 Error Code | Error Classification | System Action |
| :---: | :--- | :--- | :--- |
| **200** | — | `SUCCESS` | Update delivery to `SENT`, increment `pushSentCount`. |
| **400** | `INVALID_ARGUMENT` | `INVALID_TOKEN_FORMAT` | Mark delivery `FAILED`, do not retry, log error details. |
| **401** | `UNAUTHENTICATED` | `AUTH_EXPIRED` | Invalidate cached OAuth token, do not revoke client token. |
| **403** | `PERMISSION_DENIED` | `PERMISSIONS_ERROR` | Check IAM roles for service account, do not revoke token. |
| **404** | `NOT_FOUND` / `UNREGISTERED` | `TOKEN_UNREGISTERED` | Automatically revoke device token (`status='REVOKED'`). |
| **429** | `RESOURCE_EXHAUSTED` | `RATE_LIMITED` | Retry with exponential backoff (retryable = true). |
| **500 / 503**| `INTERNAL` / `UNAVAILABLE` | `TEMPORARY_OUTAGE` | Retry with exponential backoff (retryable = true). |

Tokens are **never deactivated** for transient network failures or rate limits; only confirmed `UNREGISTERED` or `NOT_FOUND` responses mark a token as revoked.

