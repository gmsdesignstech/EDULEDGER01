# EduLedger Phase 6: Firebase Push Notification Root Cause Analysis & Permanent Repair Report

**Project**: EduLedger — School Management, Reimagined  
**Production Domain**: https://eduledger.co.in  
**GitHub Repository**: `gmsdesignstech/EDULEDGER01`  
**Current Branch**: `main` (Head Commit: `3e0c9d1`)  
**Date**: November 8, 2026  
**Auditor**: Principal Next.js Engineer, Application Security Engineer, and Reliability Specialist  

---

## 1. Executive Summary

Phase 6 executed a forensic inspection across the entire Firebase and Web Push messaging architecture in EduLedger. Rather than relying on previous audit summaries, every layer—from client service workers and browser subscription APIs to backend RS256 JWT assertion generation, token normalization, and multi-tenant PostgreSQL queries—was audited and verified.

Four critical root causes were discovered and permanently resolved.

---

## 2. Root Cause Analysis & Permanent Fixes

### Root Cause 1: WebPush Subscription JSON vs. Plain FCM Registration Token Mismatch
- **Symptoms**: If a browser registered via `registration.pushManager.subscribe()`, the client serialized the entire `PushSubscription` object (`{ endpoint: "https://fcm.googleapis.com/fcm/send/...", keys: { ... } }`) into the database. When `sendFcmMessage` dispatched this token to Google's FCM v1 endpoint (`https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`), FCM v1 rejected it with `HTTP 400 Bad Request` or `HTTP 404 NOT_FOUND: Invalid registration token`.
- **Root Cause**: The FCM v1 API strictly expects an un-serialized FCM registration token string in `message.token`, not a raw Web Push subscription JSON structure.
- **Permanent Fix**: Implemented `normalizeFcmToken(rawToken)` in `src/lib/notifications.ts`. If the token is a JSON string containing an `endpoint`, it automatically parses the JSON and extracts the clean FCM token from the `/send/<FCM_TOKEN>` endpoint path.
- **Status**: **PASS** (Verified by automated unit test).

### Root Cause 2: Missing Public VAPID Key in Browser Runtime
- **Symptoms**: Calling `registration.pushManager.subscribe({ userVisibleOnly: true })` without `applicationServerKey` threw a `DOMException` on Desktop Chrome, Android Chrome, Edge, and iOS Safari.
- **Root Cause**: Modern web push security requires an uncompressed P-256 public key (VAPID key) to authenticate the application server.
- **Permanent Fix**: Configured the verified 87-character public Web Push certificate key (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`) across Vercel **Production**, **Preview**, and **Development** environments using type `Config`.
- **Status**: **PASS** (Confirmed via Vercel CLI).

### Root Cause 3: Potential Preview Cross-Contamination of Production Devices
- **Symptoms**: If Preview deployments shared database credentials, test events in Preview could trigger notifications to real production school recipients.
- **Root Cause**: The environment check previously relied partly on client-provided metadata (`data.isTest`).
- **Permanent Fix**: Upgraded the isolation guard in `src/lib/notifications.ts` to require a server-authoritative parameter `isServerAuthorizedTest: true` on `DispatchNotificationInput`. Only internal authenticated admin endpoints (such as `POST /api/settings/pwa`) can set this flag, and it strictly enforces `recipientUserIds: [user.id]`. All other notification dispatches in Preview automatically skip external device push.
- **Status**: **PASS** (Verified by automated unit test).

### Root Cause 4: Relative URL Navigation Failure in Service Worker Notification Clicks
- **Symptoms**: When clicking a push notification on mobile devices, relative links (e.g. `/parent/attendance?child=123`) could fail or open `about:blank` in certain browser implementations.
- **Root Cause**: `clients.openWindow()` requires an absolute URL.
- **Permanent Fix**: In `public/firebase-messaging-sw.js`, wrapped destination URLs with `new URL(rawUrl, self.location.origin).href`.
- **Status**: **PASS** (Verified by service worker code audit).

---

## 3. Files Inspected & Modified

### Files Inspected:
- `src/lib/notifications.ts`
- `src/app/api/settings/pwa/route.ts`
- `src/app/api/notifications/push-token/route.ts`
- `src/components/notification-push-manager.tsx`
- `src/components/pwa-diagnostics-client.tsx`
- `public/firebase-messaging-sw.js`
- `public/sw.js`
- `src/lib/db.ts`
- `vitest.safe-unit.config.mts`
- `tests/firebase-activation.test.ts`
- `.gitignore`
- `.env.local`

### Files Modified:
- `src/lib/notifications.ts`
- `src/app/api/settings/pwa/route.ts`
- `src/components/notification-push-manager.tsx`
- `src/components/pwa-diagnostics-client.tsx`
- `public/firebase-messaging-sw.js`
- `tests/firebase-activation.test.ts`
- `.gitignore`

---

## 4. Test Evidence & Exit Codes

- **Vitest Safe Unit Suites**: `npx vitest run --config vitest.safe-unit.config.mts` $\rightarrow$ **25 passed (25 files), 240 passed (240 tests)**, Exit Code **0**.
- **TypeScript Typecheck**: `npx tsc --noEmit` $\rightarrow$ **0 errors**, Exit Code **0**.
- **ESLint Analysis**: `npm run lint` $\rightarrow$ **0 warnings, 0 errors**, Exit Code **0**.
- **Production Webpack Build**: `npx next build --webpack` $\rightarrow$ **147 routes successfully compiled**, Exit Code **0**.

