# EDULEDGER — LIGHTHOUSE PWA AUDIT REPORT

**Target Application**: EduLedger (`https://eduledger.co.in`)  
**Audit Standard**: Google Lighthouse Progressive Web App Specification  
**Status**: COMPLIANT  

---

## 1. PWA Installability Checklist

| Audit Item | Status | Verification Detail |
| :--- | :---: | :--- |
| **Web App Manifest detected** | **PASS** | Valid manifest linked in `<head>` with correct MIME type `application/manifest+json`. |
| **Registers a Service Worker** | **PASS** | `/sw.js` registered with scope `/`, controlling page loads and offline requests. |
| **Responds with 200 when offline** | **PASS** | When network is terminated, navigation requests resolve to `/offline.html`. |
| **Has a `name` or `short_name`** | **PASS** | Manifest contains `name: "EduLedger"` and `short_name: "EduLedger"`. |
| **Has a valid `start_url`** | **PASS** | Manifest `start_url` is set to `/` (and `/teacher`, `/parent` respectively). |
| **Specifies `display: standalone`** | **PASS** | Configured for fullscreen, chrome-less native app appearance. |
| **Provides icons sized 192px and 512px** | **PASS** | Raster PNG icons `/icons/icon-192.png` and `/icons/icon-512.png` confirmed on disk. |
| **Provides a maskable icon** | **PASS** | Maskable icons `/icons/icon-maskable-192.png` and `512.png` defined with `purpose: "maskable"`. |
| **Has a `theme_color`** | **PASS** | Declared in manifest and HTML meta tags (`#2563eb`). |
| **Content sized correctly for viewport** | **PASS** | Meta viewport tag `width=device-width, initial-scale=1, viewport-fit=cover` present. |
| **HTTPS enforced** | **PASS** | Production domain enforces TLS/SSL with HSTS headers via Vercel Edge. |

---

## 2. Distinction Between PWA Installability vs. Actual Installation

* **Manifest Validity**: All 4 manifests (`/manifest.webmanifest`, `/manifest-teacher.webmanifest`, `/manifest-parent.webmanifest`, `/manifest-student.webmanifest`) are structurally valid JSON adhering to the W3C Web App Manifest specification.
* **PWA Installability**: The web app triggers the `beforeinstallprompt` event on Chromium browsers and provides valid standalone icons and scope definitions.
* **Actual Device Installation**: Requires explicit user consent on the physical device. The application never fakes or auto-triggers installation without user interaction.
* **Standalone Operation**: When launched from the device home screen or taskbar, `window.matchMedia('(display-mode: standalone)').matches` evaluates to `true`, suppressing install prompts and rendering native UI chrome.
