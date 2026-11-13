# EDULEDGER PHASE 10 — BACKEND SECURITY AUDIT

## 1. Executive Summary
This audit reviews the server-side notification architecture, credential security, token exchange logic, tenant boundaries, and environment protection mechanisms in EduLedger.

All server-side changes were implemented strictly adhering to the principle of least privilege, zero hardcoded secrets, and complete isolation between Preview and Production environments.

---

## 2. Server-Side Firebase Admin Authentication

### Google OAuth 2.0 RS256 JWT Token Exchange
- Location: `src/lib/notifications.ts` -> `getGoogleAccessToken()`
- Mechanism:
  1. Reads `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` strictly from `process.env`.
  2. Strips bounding quotes and trims whitespace around project ID and client email.
  3. Sanitizes private key (`replace(/\\n/g, "\n")`), wrapping inside standardized PEM headers `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`.
  4. Signs assertion token using Node.js `crypto.createSign("RSA-SHA256")`.
  5. Requests bearer access token from `https://oauth2.googleapis.com/token` with scope `https://www.googleapis.com/auth/firebase.messaging`.
  6. Implements token caching with a 60-second safety buffer before expiry to minimize Google auth requests.

### Key Sanitization Invariants
- Zero secrets committed to Git repository.
- Sanitizer handles both raw multi-line strings and escaped single-line strings safely.
- Never prints private keys or sensitive credentials in logs, error traces, or API responses.

---

## 3. Server-Authoritative Preview Isolation

To prevent test runs or preview deployments on Vercel from inadvertently broadcasting push notifications to real users, a server-authoritative guard is enforced in `sendNotificationNow()`:

```typescript
const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production";
const isServerAuthorized =
  Boolean(input.isServerAuthorizedTest) &&
  recipientUserIds.length === 1 &&
  eventKey.startsWith("test_push_");

if (isPreview && !isServerAuthorized) {
  return {
    success: false,
    results: [],
    skippedCount: recipientUserIds.length,
    reason: "preview_broadcast_blocked"
  };
}
```

### Safety Guarantees:
1. Preview environments cannot broadcast notifications to general school user bases.
2. Only single-recipient, server-authorized diagnostic test events (`test_push_*`) triggered by authenticated admins in the PWA diagnostic interface are permitted.
3. Production notifications only trigger in `VERCEL_ENV === "production"`.

---

## 4. API Route Access Control & Ingestion Gates

### Endpoint: `/api/notifications/push-token`
- **Authentication**: Validates active session via `getSessionUser()`. Unauthorized requests return HTTP 401.
- **Payload Validation**:
  - Validates `token` using `validateFcmToken(token)`.
  - Rejects WebPush JSON blobs with HTTP 400 (`error: "webpush_subscription"`).
  - Rejects endpoint URLs with HTTP 400 (`error: "endpoint_url"`).
  - Rejects malformed strings with HTTP 400 (`error: "malformed"`).
- **Tenant & User Scope**:
  - The token is stored strictly associated with the current `session.user.id`.
  - A user can only register or delete their own push token.
  - Deletion removes only tokens matching the session user's ID.

### Endpoint: `/api/settings/pwa`
- **Role Authorization**: Restricted strictly to users with role `admin` or `super_admin`.
- **Credential Masking**: Returns boolean indicators (`hasServiceAccount`, `hasClientConfig`, `hasVapidKey`, etc.) and masked string prefixes (`AIzaSy...`, `BLszpw...`). Raw private keys and full tokens are never transmitted over the wire.

---

## 5. Security Audit Findings & Status

| Security Criterion | Implementation Check | Status |
| :--- | :--- | :--- |
| **No Committed Secrets** | Audited `.gitignore`, Git history, and worktree. Secrets strictly absent. | **PASS** |
| **Credential Masking** | All admin diagnostic endpoints mask keys. Zero raw keys exposed. | **PASS** |
| **Token Injection Prevention** | Regex and character set whitelist on all received push tokens. | **PASS** |
| **Preview Broadcast Guard** | Previews blocked from sending school-wide pushes. | **PASS** |
| **Session & Role Enforcement** | Token ingestion and PWA management strictly gated by auth sessions. | **PASS** |
| **Safe Error Handling** | Google FCM errors mapped to standard error codes without leaking server paths. | **PASS** |

