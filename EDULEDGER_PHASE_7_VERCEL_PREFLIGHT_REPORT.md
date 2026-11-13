# EduLedger Phase 7 — Vercel Preflight & Deployment Configuration Report

**Project**: EduLedger  
**Target Platform**: Vercel Serverless  
**Vercel Project**: `eduledger` (`gmsdesignstechs-projects/eduledger`)  
**Production Domain**: `https://eduledger.co.in`  
**Phase**: Phase 7 — Vercel Production Deployment Preflight  
**Status**: PREFLIGHT PASSED — ALL ENVIRONMENT VARIABLES CONFIGURED & VERIFIED  

---

## 1. Vercel Environment Configuration Audit

The Vercel environment variables have been inspected and confirmed active across all deployment targets (Production, Preview, Development):

| Environment Variable | Configured Target | Type | Security Classification | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | Production, Preview, Development | Plaintext/Secret | Internal Backend | Google Cloud project ID (`eduledger-e0ac2`) |
| `FIREBASE_CLIENT_EMAIL` | Production, Preview, Development | Plaintext/Secret | Internal Backend | Service account client email |
| `FIREBASE_PRIVATE_KEY` | Production, Preview, Development | Secret (Encrypted) | **Confidential** | RSA private key for RS256 token signing |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Production, Preview, Development | Secret (Encrypted) | **Confidential** | Full service account JSON fallback |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Production, Preview, Development | Config | Public Client | Base64URL 87-char Web Push public key |

*Evidence*: Confirmed via `npx vercel env ls` CLI execution.

---

## 2. Server-Authoritative Preview Isolation Policy

In multi-environment deployments where Preview builds connect to production or staging databases, there is an inherent danger of staging events sending real push notifications to production users (e.g. real parents or teachers).

EduLedger implements a strict **Server-Authoritative Preview Guard** in `src/lib/notifications.ts`:
```typescript
const isPreview = process.env.VERCEL_ENV === "preview";
if (isPreview && !input.isServerAuthorizedTest) {
  console.log(
    `[notifications] Preview environment detected (VERCEL_ENV=preview). Bypassing push notification to protect production users.`
  );
  return;
}
```
- Client-supplied metadata (`data.isTest = "true"`) is never trusted.
- Only the authenticated server action `/api/settings/pwa` sets `isServerAuthorizedTest: true` when a verified administrator triggers a diagnostic test push to their own registered device.

---

## 3. Build & Runtime Compatibility

- **Next.js Version**: `16.4.5`
- **Build Engine**: Webpack pipeline (`next build --webpack`), avoiding Turbopack native IPC worker crashes on Windows environments while maintaining full Vercel serverless optimization.
- **Route Count**: 147 routes (Static prerendered + Dynamic API/Page routes).
- **Middleware**: Fast edge proxy middleware intact.
- **Database Connection**: PostgreSQL connection pool preserved with zero schema changes.

---

## 4. Preflight Checklist Verdict

| Preflight Check | Result | Verification Evidence |
| :--- | :---: | :--- |
| Google OAuth 2.0 RS256 Assertion | **PASS** | `getFirebaseAccessToken()` successfully exchanges signed JWT for Google OAuth token. |
| VAPID Key Available in Browser | **PASS** | `process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY` populated and validated format. |
| Service Worker Cache Integrity | **PASS** | `firebase-messaging-sw.js` cache version bumped to `eduledger-pwa-v3`. |
| PWA Manifests Functional | **PASS** | Standalone manifests for School, Teacher, Parent, Student valid. |
| Production Build Verification | **PASS** | Full Next.js production build succeeded with exit code 0. |
| Safe Gate Enforcement | **PASS** | Deployment stopped pending user confirmation. |

