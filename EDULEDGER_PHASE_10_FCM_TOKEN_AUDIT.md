# EDULEDGER PHASE 10 — FCM TOKEN AUDIT

## 1. Token Architecture Overview
Prior to Phase 10, the application suffered from a fundamental architectural flaw regarding FCM tokens:
- When a user subscribed in the browser via standard WebPush APIs (`registration.pushManager.subscribe`), the resulting `PushSubscription` provided an endpoint URL formatted as:
  `https://fcm.googleapis.com/fcm/send/e9x2...`
- Legacy client code sliced or truncated this endpoint URL (e.g., stripping the prefix) and submitted the remainder to `/api/notifications/push-token` as an "FCM token".
- When passed to the Google FCM v1 HTTP API (`https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`), FCM v1 rejected this with:
  `400 INVALID_ARGUMENT`
- Sliced WebPush endpoints are not valid FCM device registration tokens.

In Phase 10, the token architecture was completely replaced with the official Firebase Web SDK (`firebase/messaging`):
1. The browser requests an FCM token using `getToken(messaging, { vapidKey, serviceWorkerRegistration })`.
2. The Firebase Web SDK communicates directly with Firebase Installations Service (`https://firebaseinstallations.googleapis.com/v1/projects/...`).
3. An authentic, Google-signed FCM registration token (typically 140+ characters, base64url-like format) is returned.
4. Server-side token validation strictly inspects incoming tokens before storage or push transmission.

---

## 2. Token Lifecycle & Server-Side Validation Matrix

| Step | Component | Action | Validation Rule |
| :--- | :--- | :--- | :--- |
| **1. Minting** | `src/lib/firebase-client.ts` | Calls `getToken(messaging, { vapidKey, serviceWorkerRegistration })` | Validates `vapidKey` presence and ServiceWorker registration. |
| **2. Client Ingestion** | `src/components/notification-push-manager.tsx` | Passes token to `/api/notifications/push-token` | Only executed upon explicit user permission grant. |
| **3. API Ingestion Gate** | `src/app/api/notifications/push-token/route.ts` | Validates token before database upsert | `validateFcmToken(token)`: rejects endpoints, JSON subscriptions, empty strings, and control characters. |
| **4. Database Storage** | PostgreSQL `user_push_tokens` table | Upserts `(user_id, token, endpoint, user_agent, updated_at)` | Scoped strictly to authenticated user's session ID. |
| **5. Pre-Send Gate** | `src/lib/notifications.ts` (`sendFcmMessage`) | Re-validates token prior to Google FCM API request | If invalid, short-circuits locally without network request (`errorCode: "INVALID_ARGUMENT", retryable: false`). |
| **6. Stale Token Eviction**| `src/lib/notifications.ts` | Handles FCM v1 error responses (`UNREGISTERED`, `NOT_FOUND`) | Automatically deletes inactive token from `user_push_tokens` table. |

---

## 3. Strict Validation Implementation (`validateFcmToken`)

Implemented in `src/lib/notifications.ts` and shared with push token ingestion endpoints:

```typescript
export function validateFcmToken(rawToken: unknown): { valid: boolean; reason?: string; token?: string } {
  if (typeof rawToken !== "string") {
    return { valid: false, reason: "Token must be a string." };
  }

  const token = rawToken.trim();
  if (!token) {
    return { valid: false, reason: "Token is empty." };
  }

  // Reject raw WebPush JSON subscriptions
  if (token.startsWith("{") && token.endsWith("}")) {
    return { valid: false, reason: "PushSubscription JSON cannot be used as an FCM token directly." };
  }

  // Reject sliced endpoint URLs
  if (token.includes("://") || token.includes("/send/") || token.includes("fcm.googleapis.com")) {
    return { valid: false, reason: "Endpoint URL or sliced endpoint cannot be used as an FCM token." };
  }

  // Reject tokens that are abnormally short or contain invalid characters
  if (token.length < 20 || token.length > 4096) {
    return { valid: false, reason: "Token length is out of acceptable bounds (20-4096 characters)." };
  }

  // Valid FCM tokens consist of base64url characters, colons, underscores, and dashes
  if (!/^[A-Za-z0-9_\-:]+$/.test(token)) {
    return { valid: false, reason: "Token contains invalid characters for an FCM registration token." };
  }

  return { valid: true, token };
}
```

---

## 4. Verification Evidence

### Automated Test Coverage (`tests/firebase-activation.test.ts`)
1. **Valid Token Acceptance**: Re-verified standard FCM registration tokens pass validation.
2. **Endpoint URL Slicing Rejection**: Re-verified tokens containing `https://`, `fcm.googleapis.com`, or `/send/` return `valid: false` with reason `Endpoint URL or sliced endpoint cannot be used as an FCM token.`.
3. **WebPush Subscription JSON Rejection**: Re-verified JSON objects stringified return `valid: false` with reason `PushSubscription JSON cannot be used as an FCM token directly.`.
4. **Malformed Token Rejection**: Re-verified short tokens, empty strings, and special character strings are rejected.
5. **Pre-flight Short-circuit in `sendFcmMessage`**: Re-verified that invalid tokens immediately produce `{ success: false, errorCode: "INVALID_ARGUMENT", retryable: false }` without triggering external HTTP requests to Google.

**Audit Status**: **PASS**

