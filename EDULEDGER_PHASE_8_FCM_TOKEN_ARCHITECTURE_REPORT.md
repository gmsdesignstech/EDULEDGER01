# EduLedger Phase 8 — FCM Token Architecture & Protocol Analysis

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Token Architecture & Protocol Resolution  
**Date**: November 8, 2026  
**Status**: ARCHITECTURE RESOLVED — FIREBASE CLOUD MESSAGING (OPTION A)  

---

## 1. Architectural Dilemma: Option A vs Option B

The audit evaluated whether EduLedger implements **Option A (Firebase Cloud Messaging)** or **Option B (Standard Web Push)**:

| Evaluation Factor | Option A: Firebase Cloud Messaging | Option B: Standard Web Push | EduLedger Reality |
| :--- | :--- | :--- | :--- |
| **Server Delivery Protocol** | FCM HTTP v1 (`messages:send`) | RFC 8291 / RFC 8292 to push endpoint | Uses FCM HTTP v1 |
| **Database Token Storage** | Single `token TEXT` column | `endpoint`, `keys.p256dh`, `keys.auth` | Table `fcm_device_tokens` has `token TEXT` |
| **Authentication** | Google OAuth2 RS256 Service Account | VAPID Authorization header on raw fetch | Uses Google OAuth2 RS256 |
| **Channel Identifier** | `channel: "FCM"` | `channel: "WEB_PUSH"` | Hardcoded as `channel: "FCM"` |
| **Client Requirement** | Genuine FCM token via Firebase SDK | Browser PushSubscription object | **Requires genuine FCM token** |

### Decision
EduLedger's backend, database schema, credentials, and service worker are explicitly designed for **Option A: Firebase Cloud Messaging**. Standard WebPush subscriptions cannot be used directly with FCM HTTP v1.

---

## 2. Token Normalization & Validation Engine

The unsafe token slicing logic has been completely replaced with a comprehensive token validator:

```typescript
export function validateFcmToken(rawToken: unknown): TokenValidationResult {
  // 1. Non-empty string check
  // 2. Length boundary check (10 to 4096 bytes)
  // 3. WebPush PushSubscription JSON rejection
  // 4. Endpoint URL rejection
  // 5. Character set verification (/^[a-zA-Z0-9_\-.:]+$/)
}
```

### Empirical Test Evidence
- Raw endpoint slice sent to FCM v1: `400 INVALID_ARGUMENT` ("The registration token is not a valid FCM registration token").
- Genuine FCM token format sent to FCM v1: `404 NOT_FOUND` ("NotRegistered"), confirming syntax acceptance by Google's parser.

