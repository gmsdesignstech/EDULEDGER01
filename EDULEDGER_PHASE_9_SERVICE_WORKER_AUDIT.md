# EduLedger Phase 9 — Service Worker & PWA Caching Audit

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — Service Worker & Security Isolation Audit  
**Date**: November 8, 2026  
**Status**: AUDITED & PASS  

---

## 1. Single Service Worker Architecture

EduLedger registers a single unified service worker across all portals:
- Entry point: `/sw.js` (imports `/firebase-messaging-sw.js` via `importScripts`).
- Scope: `/`
- Caches: Named `eduledger-pwa-v5`.

No overlapping or competing service worker registrations exist. When `/teacher` or `/parent` portals mount, they operate under the root registration without conflicting service worker unregistrations.

---

## 2. Sensitive Route Cache Exclusion Invariant

`public/firebase-messaging-sw.js` strictly enforces:
```javascript
const SENSITIVE_PREFIXES = [
  "/api/", "/admin", "/parent", "/teacher", "/student", "/dashboard",
  "/students", "/fees", "/attendance", "/marks", "/salaries", "/reports",
  "/settings", "/auth", "/accounts", "/cash-book", "/classes", "/documents",
  "/exams", "/results", "/subscription", "/timetable"
];
```
- **NETWORK ONLY**: All sensitive paths bypass the service worker cache entirely.
- Sensitive school data, student records, fee receipts, and marks are **never cached** on the user's disk or service worker cache storage.

---

## 3. Push Event & Deep Linking Verification

- Background FCM push events invoke `self.registration.showNotification(title, options)`.
- Client acknowledgment fetch is dispatched to `/api/notifications/ack` with `deliveryId`.
- In `notificationclick`, target URLs are sanitized via `new URL(rawUrl, self.location.origin).href` to ensure navigation remains same-origin and prevents open redirects.

