# EduLedger Phase 8 — Real Device Push Acceptance Matrix & Protocol

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Physical Hardware Testing Matrix  
**Date**: November 8, 2026  
**Status**: NOT TESTED (Pending post-deployment execution on real physical hardware)  

---

## 1. Compliance Statement

In strict adherence to project guidelines:
> **Status Classification**: Tests on real physical hardware must be marked `NOT TESTED` until physically executed and verified on actual devices.

Automated CLI environments and headless browsers cannot simulate native Android notification drawers, Apple APNs gateways, cellular network handoffs, or touchscreen installation banners.

---

## 2. Real Hardware Verification Matrix

| Device Platform | Browser / Environment | Portal | Test Target | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Android Phone** | Google Chrome Mobile | Admin | Web Push permission prompt & badge | **NOT TESTED** |
| **Android Phone** | Standalone Installed PWA | Teacher | Background notification delivery & vibration | **NOT TESTED** |
| **Android Phone** | Standalone Installed PWA | Parent | Multi-student attendance push alert | **NOT TESTED** |
| **Apple iPhone (iOS 16.4+)**| Safari (Browser Tab) | Any | Push eligibility (Requires Home Screen) | **NOT TESTED** |
| **Apple iPhone (iOS 16.4+)**| Standalone (Added to Home Screen) | Parent | Apple Web Push permission prompt & lock-screen alert | **NOT TESTED** |
| **Apple iPad (iPadOS 16.4+)**| Standalone (Added to Home Screen) | Teacher | Homework/exam notification banner | **NOT TESTED** |
| **Windows PC** | Microsoft Edge / Chrome | Admin | Windows Action Center toast alert | **NOT TESTED** |
| **macOS Laptop** | Safari / Chrome | Admin | macOS Notification Center alert | **NOT TESTED** |

---

## 3. Operator Execution Instructions

1. **Android**: Visit `https://eduledger.co.in`, tap **Install**, log in, grant notification permissions, background the app, trigger a test notification from the admin panel, and verify notification appears in the notification shade.
2. **iOS**: Open Safari, navigate to `https://eduledger.co.in/parent/login`, tap **Share → Add to Home Screen**, launch EduLedger from the Home Screen, tap **Enable Notifications**, accept the native iOS prompt, lock screen, and verify notification displays on Lock Screen.

