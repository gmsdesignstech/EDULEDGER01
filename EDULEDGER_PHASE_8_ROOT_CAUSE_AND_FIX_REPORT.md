# EduLedger Phase 8 — Root Cause and Fix Report

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Complete System Audit, Root-Cause Fixes & PWA Hardening  
**Date**: November 8, 2026  
**Status**: AUDITED & ROOT CAUSES REPAIRED  

---

## 1. Executive Summary

This report documents the architectural flaws, security risks, and configuration gaps discovered during the Phase 8 audit of EduLedger's Firebase Cloud Messaging and PWA systems, along with the source-code corrections implemented to resolve them.

---

## 2. Root Cause Analysis

### 2.1 Root Cause 1: Endpoint Slicing Falsely Treated as FCM Registration Tokens
- **Flaw**: Prior implementations in `NotificationPushManager`, `PwaDiagnosticsClient`, and `normalizeFcmToken()` invoked browser `pushManager.subscribe(...)`, obtained a standard WebPush `PushSubscription`, and extracted `endpoint.split('/send/').pop()` or passed the raw JSON object.
- **Impact**: Google FCM HTTP v1 (`https://fcm.googleapis.com/v1/projects/eduledger-e0ac2/messages:send`) explicitly rejected these tokens with `400 INVALID_ARGUMENT` ("The registration token is not a valid FCM registration token"). Standard WebPush subscriptions and endpoint URLs cannot be used as FCM v1 registration tokens.
- **Fix**: Replaced unsafe slicing with `validateFcmToken()`, which strictly validates token format, character sets, and payload boundaries, rejecting WebPush subscription JSON and endpoint URLs before they reach the database or FCM API.

### 2.2 Root Cause 2: Missing Quote Trimming on Server Project and Email Credentials
- **Flaw**: In `src/lib/notifications.ts`, `projectId` and `clientEmail` were read without stripping surrounding quotes, whereas `privateKey` was. When `FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@eduledger-e0ac2.iam.gserviceaccount.com"` was quoted, Google OAuth rejected RS256 token exchange with `invalid_grant: account not found`.
- **Fix**: Added `.replace(/^"|"$/g, "").trim()` across all credential readers in `src/lib/notifications.ts`.

### 2.3 Root Cause 3: Client Firebase Web App Configuration Missing
- **Flaw**: The Firebase project `eduledger-e0ac2` has a service account and VAPID key configured, but no Web App has been created in the Firebase Console. Browser-side generation of genuine FCM tokens via the Firebase Web SDK requires `apiKey` and `appId`.
- **Fix**: Documented the exact requirement; updated `PwaDiagnosticsClient` and `src/app/api/settings/pwa/route.ts` to report `TEST REQUIRED` with clear remediation instructions rather than misleading `READY`.

### 2.4 Root Cause 4: Lack of Input Sanitization on Token Registration
- **Flaw**: `POST /api/notifications/push-token` previously accepted any string between 10 and 4096 characters without validating whether it was an endpoint URL, HTML, or malformed JSON.
- **Fix**: Implemented strict schema validation and `validateFcmToken` integration in both `POST` and `DELETE` endpoints, returning HTTP 400 Bad Request with descriptive failure types.

---

## 3. Verification & Evidence

- Unit test suite: **247 passed across 25 test files**, including 24 tests in `tests/firebase-activation.test.ts`.
- TypeScript validation (`tsc --noEmit`): **0 errors**.
- ESLint (`npm run lint`): **0 errors, 0 warnings**.
- Real FCM v1 API verification confirmed HTTP 400 rejection for endpoint slices vs HTTP 404/NotRegistered for properly formatted test tokens.

