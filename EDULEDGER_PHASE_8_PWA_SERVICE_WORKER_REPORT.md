# EduLedger Phase 8 — PWA Manifests, Service Workers & Caching Policy Report

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Service Worker & PWA Caching Audit  
**Date**: November 8, 2026  
**Status**: AUDITED & PASS  

---

## 1. PWA Manifest Architecture

EduLedger provides distinct manifest endpoints for different user roles:

| Manifest Path | Role | Start URL | Scope | Theme Color |
| :--- | :--- | :--- | :--- | :--- |
| `/manifest.webmanifest` | Main / Admin | `/` | `/` | `#4f46e5` |
| `/manifest-teacher.webmanifest` | Teacher | `/teacher` | `/teacher` | `#059669` |
| `/manifest-parent.webmanifest` | Parent | `/parent` | `/parent` | `#2563eb` |
| `/manifest-student.webmanifest` | Student | `/student` | `/student` | `#7c3aed` |

All manifests return valid `application/manifest+json` MIME types with standalone display modes and verified icon paths.

---

## 2. Service Worker & Caching Invariants

The service worker in `public/firebase-messaging-sw.js` (imported by `public/sw.js`) enforces:

1. **Security Invariant: Sensitive Routes are NETWORK ONLY**:
   - `/api/*`, `/admin/*`, `/teacher/*`, `/parent/*`, `/student/*`, `/dashboard/*`, `/fees/*`, `/attendance/*`, `/marks/*`, `/salaries/*` are **never cached**.
   - Student records, marks, and financials cannot leak into browser disk caches.
2. **Static Asset Caching**:
   - `/_next/static/*`, `/icons/*`, and core logo images are cached with cache-first strategy.
3. **Background Push Handling**:
   - Handles FCM data messages, triggers browser notification banners, and posts `PUSH_RECEIVED` messages to active foreground tabs.
4. **Deep-Link Navigation**:
   - In `notificationclick`, URLs are normalized to absolute origin URLs (`new URL(rawUrl, self.location.origin).href`) before navigating or opening client windows, preventing open-redirect vulnerabilities.

