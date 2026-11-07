# EDULEDGER — PWA SECURITY AND DATA PRIVACY AUDIT

**Target Application**: EduLedger (`https://eduledger.co.in`)  
**Security Focus**: Service Worker Cache Isolation, Credential Protection, Push Security  
**Audit Status**: VERIFIED SECURE  

---

## 1. Zero Cache of Sensitive School Data (CacheStorage Policy)

In school ERP applications, storing student records, fee transactions, or parent phone numbers in client-side Service Worker CacheStorage exposes private data if multiple users share a tablet, computer, or device.

### Enforced Prefix Exclusions
In [`public/firebase-messaging-sw.js`](file:///c:/Users/abrar/OneDrive/Desktop/EDULEDGER/public/firebase-messaging-sw.js), every request matching the following sensitive prefixes **bypasses cache completely** and executes as **Network Only**:
```javascript
const SENSITIVE_PREFIXES = [
  "/api/",
  "/admin",
  "/parent",
  "/teacher",
  "/student",
  "/dashboard",
  "/students",
  "/fees",
  "/attendance",
  "/marks",
  "/salaries",
  "/reports",
  "/settings",
  "/auth",
  "/accounts",
  "/cash-book",
  "/classes",
  "/documents",
  "/exams",
  "/results",
  "/subscription",
  "/timetable",
];
```
* **Offline Behavior for Protected Routes**: If the user loses network connectivity while navigating inside a portal, the Service Worker displays the safe static fallback `/offline.html` rather than leaking stale cached student records.
* **Non-GET Requests**: All `POST`, `PUT`, `PATCH`, and `DELETE` requests bypass Service Worker caching unconditionally.

---

## 2. Server Credential Protection & Secret Isolation

### A. Environment Variable Guard
* Public Variable: `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Contains only the public base64 VAPID public key; safe for client usage).
* Private Variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` / `FIREBASE_SERVICE_ACCOUNT_KEY`.
* **Zero Exposure Verification**:
  * In [`src/app/api/settings/pwa/route.ts`](file:///c:/Users/abrar/OneDrive/Desktop/EDULEDGER/src/app/api/settings/pwa/route.ts), server credentials are only checked as booleans (`Boolean(...)`).
  * The API response returns `hasPrivateKey: true` or `false` and **never echoes back the private key string, tokens, or email addresses**.

### B. Role-Based Diagnostics Access
* `/api/settings/pwa` and `/dashboard/settings/pwa` enforce strict role authorization. Requests from unauthenticated users return `401 Unauthorized`. Requests from `TEACHER`, `STUDENT`, or `PARENT` roles return `403 Forbidden`.

---

## 3. Web Push Notification Privacy & Targeting

* **Tenant Isolation**: Every device token in `fcm_device_tokens` is foreign-keyed to an `institution_id` and `user_id`.
* **Notification Scoping**: Notifications are dispatched only to the specific `user_id` belonging to the affected student or guardian. A notification intended for Parent A can never be delivered to Parent B.
* **Token Invalidation**: When a user revokes permissions or logs out, `/api/notifications/push-token` updates the token status to `REVOKED`.
