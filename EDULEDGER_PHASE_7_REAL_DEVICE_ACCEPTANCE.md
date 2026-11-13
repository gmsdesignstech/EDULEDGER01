# EduLedger Phase 7 — Real Device Push Notification Acceptance Matrix & Test Protocol

**Project**: EduLedger — School Management, Reimagined  
**Production Domain**: https://eduledger.co.in  
**Phase**: Phase 7 — Real Physical Device Push Notification Acceptance Protocol  
**Reporting Status**: NOT TESTED (Physical hardware validation pending deployment to real devices)  

---

## 1. Compliance Statement & Hardware Testing Policy

Automated CI/CD environments and headless CLI test runners cannot simulate physical touchscreens, physical push receipt across cellular/WiFi basebands, Apple APNs gateways, or native Android system tray notification clicks.

In strict adherence to the project guidelines:
> **Status Classification**: Tests on real physical hardware must be marked `NOT TESTED` until physically executed and verified on actual devices.

This document serves as the formal **Acceptance Testing Matrix and Step-by-Step Operator Guide** for the school administration team to validate real Android, iPhone/iPad, and desktop devices once production deployment is approved.

---

## 2. Device Test Matrix

| Device Platform | Browser / Environment | Role Tested | Test Scope | Current Status |
| :--- | :--- | :--- | :--- | :---: |
| **Android Smartphone** | Google Chrome (Mobile) | School Admin | Browser Notification Permission & Foreground Push | **NOT TESTED** |
| **Android Smartphone** | Installed PWA (Standalone) | Teacher | Background Push Receipt & Click-Through URL Handling | **NOT TESTED** |
| **Android Smartphone** | Installed PWA (Standalone) | Parent | Multi-child Attendance Alert Background Delivery | **NOT TESTED** |
| **Apple iPhone (iOS 16.4+)** | Mobile Safari (Browser Mode) | Any Role | Push Notification Eligibility (Expected: Needs Home Screen) | **NOT TESTED** |
| **Apple iPhone (iOS 16.4+)** | Installed PWA (Add to Home Screen) | Parent | Web Push Permission Prompt & Background Push Receipt | **NOT TESTED** |
| **Apple iPad (iPadOS 16.4+)**| Installed PWA (Add to Home Screen) | Teacher | Marks / Homework Notification Delivery | **NOT TESTED** |
| **Windows PC / Laptop** | Chrome / Edge | Administrator | Diagnostics UI Test Push & System Tray Notification | **NOT TESTED** |
| **Apple Mac (macOS Ventura+)**| Safari / Chrome | Administrator | macOS Notification Center Push Banner Delivery | **NOT TESTED** |

---

## 3. Step-by-Step Device Acceptance Procedures

### 3.1 Android Physical Device Verification Protocol (Samsung, Pixel, Xiaomi, OnePlus)

1. **Step 1: PWA Installation**
   - Open Chrome on the Android phone and navigate to `https://eduledger.co.in/login`.
   - Tap the **Install App** button or the browser menu (three dots) → **Add to Home screen** / **Install app**.
   - Confirm the app appears in the Android App Drawer and Home screen with the EduLedger icon.

2. **Step 2: Role Login & Token Enrollment**
   - Launch EduLedger from the Home screen in standalone mode (no browser address bar).
   - Log in as a Teacher or Administrator.
   - When the notification bell or banner appears, tap **Enable Notifications**.
   - Tap **Allow** on the Android system permission dialog.

3. **Step 3: Background Notification Delivery Test**
   - Press the Android Home button to put EduLedger in the background (or lock the screen).
   - From another device or admin panel, trigger a notification (or click **Send Test Notification** in `/dashboard/settings/pwa`).
   - **Verification Point**:
     - Does the device vibrate / play notification sound?
     - Does the notification appear in the Android notification drawer with EduLedger icon, title, and body?
     - Tapping the notification must launch EduLedger and navigate directly to the target URL.

---

### 3.2 Apple iPhone / iPad Verification Protocol (iOS / iPadOS 16.4 or Higher)

> [!IMPORTANT]
> Apple iOS and iPadOS **require** Web Push apps to be added to the Home Screen and launched in standalone mode. Safari in standard browser tabs does not permit Web Push subscriptions.

1. **Step 1: Add to Home Screen**
   - Open Safari on the iPhone and navigate to `https://eduledger.co.in/parent/login`.
   - Tap the iOS **Share** button (box with upward arrow).
   - Scroll down and tap **Add to Home Screen**.
   - Confirm name is "EduLedger Parent" and tap **Add**.

2. **Step 2: Launch & Permission Grant**
   - Tap the newly created icon on the iPhone Home Screen to launch EduLedger in standalone mode.
   - Log in with parent credentials.
   - Tap **Enable Push Notifications**.
   - When iOS displays the native permission prompt (*"EduLedger would like to send you notifications"*), tap **Allow**.

3. **Step 3: Lock Screen & Notification Center Test**
   - Lock the iPhone screen.
   - Trigger an attendance or fee notification for the parent's child.
   - **Verification Point**:
     - The notification wakes the screen and appears in iOS Lock Screen / Notification Center.
     - Tapping the notification unlocks into the EduLedger Parent portal at the appropriate page.

---

### 3.3 Windows / macOS Desktop Acceptance Protocol

1. **Step 1: Install Desktop PWA**
   - Open Chrome or Edge on Windows/macOS and visit `https://eduledger.co.in`.
   - Click the **Install** icon in the browser address bar.
   - EduLedger opens in a separate desktop app window.

2. **Step 2: Test Notification Trigger**
   - Log into `/dashboard/settings/pwa`.
   - Click **Send Test Notification**.
   - **Verification Point**:
     - Windows Action Center or macOS Notification Center displays the notification banner.
     - Notification action opens the dashboard tab seamlessly.

