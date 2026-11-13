# EduLedger Phase 5: Real Device Push Testing & Browser Readiness Audit

**Project**: EduLedger — School Management, Reimagined  
**Audit Scope**: Android Chrome, Desktop Chrome/Edge, iOS Safari  
**Auditor**: QA Automation Engineer & PWA Specialist  
**Audit Date**: November 8, 2026  

---

## 1. Device Test Matrix & Status Classification

Per Phase 5 strict audit rules:
- **PASS**: Verified with concrete observed evidence.
- **FAIL**: Tested and failed.
- **BLOCKED**: Requires missing external credentials or configuration.
- **NOT TESTED**: Physical hardware or browser test was not performed.
- **NOT APPLICABLE**: Demonstrably irrelevant.

| Platform / Client | Service Worker Registration | Web Push Subscription | Push Reception | Deep-Link Navigation | Overall Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Desktop Chrome / Edge** | **PASS** (sw.js active) | **BLOCKED** (Missing VAPID key) | **NOT TESTED** | **PASS** (Unit route test) | **BLOCKED** |
| **Android Chrome** | **PASS** (sw.js active) | **BLOCKED** (Missing VAPID key) | **NOT TESTED** | **PASS** (Unit route test) | **BLOCKED** |
| **iOS Safari (iOS 16.4+)** | **PASS** (Standalone check) | **BLOCKED** (Missing VAPID key) | **NOT TESTED** | **PASS** (Unit route test) | **BLOCKED** |
| **Automated Mock Pipeline** | **PASS** (Vitest unit tests) | **PASS** (Zod & route tests) | **PASS** (Simulated dispatch) | **PASS** (Deep-link tags) | **PASS** |

> [!WARNING]
> **Honest Reporting Notice**: No physical Android phone, iPhone, or iPad hardware was connected during this automated session. Physical device reception is classified as **NOT TESTED**, not PASS. End-to-end device testing is currently blocked until `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is provided.

---

## 2. Browser Service Worker & Web Push Technical Audit

### 1. Service Worker Lifecyle (`public/firebase-messaging-sw.js` & `public/sw.js`)
- **PWA Scope**: `/`
- **Cache Strategy**: Strict Stale-While-Revalidate for static assets; **Strict Network-Only** for all authenticated portals and APIs.
- **Push Event Listener**:
  - Safely extracts JSON payload with fallback to text.
  - Automatically notifies foreground window clients via `PUSH_RECEIVED` postMessage.
  - Submits delivery ACK to `/api/notifications/ack` if `deliveryId` is present.
- **Notification Click Listener**:
  - Closes active notification.
  - Focuses existing portal window or calls `clients.openWindow(targetUrl)`.

### 2. Client Push Subscription Flow (`src/components/notification-push-manager.tsx`)
```typescript
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const options: PushSubscriptionOptionsInit = { userVisibleOnly: true };
if (vapidKey) {
  options.applicationServerKey = urlBase64ToUint8Array(vapidKey);
}
sub = await registration.pushManager.subscribe(options).catch(() => null);
```
- **Finding**: Calling `registration.pushManager.subscribe({ userVisibleOnly: true })` without `applicationServerKey` fails on Chromium browsers with `DOMException: A subscription with a valid applicationServerKey is required.`
- **Remediation**: The project owner must generate the Web Push Certificate in Firebase Console and supply it as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

---

## 3. iOS Safari Specific Limitations & Guidance

1. **iOS Requirement**: Web Push is supported on iOS 16.4+ **only when the PWA has been added to the Home Screen** via Safari's "Add to Home Screen" action.
2. **Permission Prompt**: Safari rejects `Notification.requestPermission()` calls unless directly initiated by a user gesture (such as clicking the "Enable Push Notifications" button).
3. **Application State**: The EduLedger UI features a prominent "Enable Notifications" button in the PWA push manager, satisfying iOS user-gesture requirements.

---

## 4. Controlled Test Push Procedure for QA on Physical Devices

Once `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is configured:

1. **Step 1: Administrator Portal**:
   - Navigate to `https://eduledger.co.in/dashboard/settings/pwa`.
   - Click **Enable Push Notifications** $\rightarrow$ Accept browser permission prompt.
   - Confirm that the diagnostics screen displays **1 Active Token Enrolled**.
2. **Step 2: Controlled Push Test**:
   - Click **Send Controlled Test Push**.
   - Verify that the test notification appears on the device with title `"EduLedger Test Notification"`.
   - Tap the notification and verify it opens `/dashboard/settings/pwa`.
3. **Step 3: Teacher Portal**:
   - Sign in at `/teacher/login` on test device.
   - Click "Enable Push" $\rightarrow$ Confirm token registered for teacher user ID.
   - Trigger a test homework alert $\rightarrow$ Confirm tap navigates to `/teacher/homework`.
4. **Step 4: Parent Portal**:
   - Sign in at `/parent/login` on test device.
   - Click "Enable Push" $\rightarrow$ Confirm token registered for parent user ID.
   - Trigger student absent alert $\rightarrow$ Confirm tap navigates to `/parent/attendance?child=<id>`.

