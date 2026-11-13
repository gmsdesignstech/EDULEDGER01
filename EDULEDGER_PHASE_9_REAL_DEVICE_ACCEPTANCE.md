# EduLedger Phase 9 — Real Physical Device Push Acceptance Protocol

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — Physical Device Acceptance Testing  
**Date**: November 8, 2026  
**Status**: NOT TESTED (Physical hardware validation pending deployment to real devices)  

---

## 1. Compliance Statement

In strict adherence to the project guidelines:
> **Status Classification**: Tests on real physical hardware must be marked `NOT TESTED` until physically executed and verified on actual devices.

Automated CLI environments and headless test runners cannot simulate physical touchscreens, physical push receipt across cellular/WiFi basebands, Apple APNs gateways, or native Android system tray notification clicks.

---

## 2. Real Hardware Verification Matrix

| Device Platform | Browser / Environment | Portal | Test Target | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Android Smartphone** | Google Chrome (Mobile) | Admin | Web Push permission prompt & badge | **NOT TESTED** |
| **Android Smartphone** | Installed PWA (Standalone) | Teacher | Background notification delivery & vibration | **NOT TESTED** |
| **Android Smartphone** | Installed PWA (Standalone) | Parent | Multi-student attendance push alert | **NOT TESTED** |
| **Apple iPhone (iOS 16.4+)** | Mobile Safari (Browser Mode) | Any | Push notification eligibility (Requires Home Screen) | **NOT TESTED** |
| **Apple iPhone (iOS 16.4+)** | Installed PWA (Home Screen) | Parent | Apple Web Push permission prompt & lock-screen alert | **NOT TESTED** |
| **Apple iPad (iPadOS 16.4+)**| Installed PWA (Home Screen) | Teacher | Marks / Homework notification banner | **NOT TESTED** |
| **Windows PC** | Microsoft Edge / Chrome | Admin | Windows Action Center toast alert | **NOT TESTED** |
| **Apple Mac (macOS Ventura+)**| Safari / Chrome | Admin | macOS Notification Center alert banner | **NOT TESTED** |

---

## 3. Step-by-Step Operator Verification Checklist

1. **Android Testing**:
   - Open Chrome on Android, visit `https://eduledger.co.in/login`.
   - Tap **Install App** to add to Home Screen.
   - Launch in standalone mode.
   - Log in and tap **Enable Notifications**.
   - Tap **Allow** on the native Android permission dialog.
   - Background the app or lock the device.
   - Send a test notification from the admin panel (`/dashboard/settings/pwa`).
   - Confirm notification banner appears in the Android notification shade with EduLedger icon and sound/vibrate.
   - Tap notification and verify it opens directly to `/dashboard/settings/pwa`.

2. **iOS Testing (iPhone/iPad with iOS 16.4+)**:
   - Open Safari on iPhone, visit `https://eduledger.co.in/parent/login`.
   - Tap the Safari **Share** icon → **Add to Home Screen**.
   - Launch EduLedger from the Home Screen.
   - Log in as Parent and tap **Enable Notifications**.
   - Tap **Allow** on the native Apple permission dialog.
   - Lock screen.
   - Trigger an attendance or fee alert for linked student.
   - Verify notification banner appears on iOS Lock Screen and Notification Center.

