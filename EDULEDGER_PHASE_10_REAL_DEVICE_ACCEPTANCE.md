# EDULEDGER PHASE 10 — REAL DEVICE ACCEPTANCE MANUAL & CHECKLIST

## 1. Physical Device Testing Notice
In accordance with honest engineering principles:
- **Current Status for Physical Hardware Push Delivery**: **NOT TESTED**
- Reason: Delivery Levels D, E, and F require physical mobile hardware, manual permission prompts, and OS notification shade rendering which cannot be simulated in automated unit/build runners.
- This manual provides the step-by-step test procedure for the school owner to verify push delivery on real devices following production deployment.

---

## 2. Prerequisites for Real Device Testing
1. Production application deployed on `https://eduledger.co.in` with synchronized environment variables.
2. A physical Android device (Google Chrome / Samsung Internet) or iOS device (iOS 16.4+ with Safari PWA installed to Home Screen).
3. Active school test accounts for:
   - **School Administrator**
   - **Teacher**
   - **Parent**

---

## 3. Step-by-Step Device Acceptance Procedure

### Phase A: School Administrator Portal Testing
1. On the physical device browser, navigate to: `https://eduledger.co.in/login`
2. Log in with School Administrator credentials.
3. Observe the bottom prompt banner: `"Enable push notifications to receive real-time school updates"`.
4. Tap **"Enable Notifications"**.
5. When the browser prompts `"eduledger.co.in wants to show notifications"`, tap **Allow**.
6. Verify the confirmation toast: `"Push notifications enabled successfully"`.
7. Navigate to `/dashboard/settings/pwa`.
8. Verify the diagnostic card shows:
   - **Firebase Server Credentials**: `CONFIGURED`
   - **Firebase Web Client Config**: `CONFIGURED`
   - **Service Worker**: `REGISTERED & ACTIVE`
   - **Device Push Token**: `ENROLLED`
9. Tap **"Send Test Push Notification"**.
10. Lock the device or switch to the home screen.
11. **Verification Check**:
    - [ ] Notification banner appears in the OS notification shade.
    - [ ] Title displays `"EduLedger — System Diagnostic"`.
    - [ ] Tapping the notification opens or focuses `https://eduledger.co.in/dashboard/settings/pwa`.

---

### Phase B: Teacher Portal Testing
1. On the device, log out and log in with Teacher credentials (`/teacher`).
2. Tap **"Enable Notifications"** and grant browser permission.
3. From an Administrator workstation or alternate session, update or reassign a class timetable for this teacher.
4. **Verification Check**:
    - [ ] Teacher receives push notification: `"Timetable Updated: Class 10-A Mathematics"`.
    - [ ] Tapping the notification navigates directly to `/teacher/timetable`.

---

### Phase C: Parent Portal Testing
1. On the device, log out and log in with Parent credentials (`/parent`).
2. Tap **"Enable Notifications"** and grant browser permission.
3. From the Teacher portal, mark the parent's linked student as **Absent** for today.
4. **Verification Check**:
    - [ ] Parent immediately receives push notification: `"Attendance Alert: Aarav was marked absent today"`.
    - [ ] Tapping the notification opens `/parent/attendance`.
5. Trigger a fee payment receipt for the student:
    - [ ] Parent receives: `"Payment Receipt: Fee payment of ₹15,000 confirmed"`.
    - [ ] Tapping notification opens `/parent/fees`.

---

### Phase D: iOS Safari Specific PWA Testing (iOS 16.4+)
1. Open `https://eduledger.co.in/login` in Mobile Safari.
2. Tap the Safari Share button (square with arrow up).
3. Tap **"Add to Home Screen"**.
4. Launch the application from the Home Screen icon (standalone mode).
5. Log in and tap **"Enable Notifications"**.
6. Approve the iOS system notification prompt.
7. Send diagnostic test push.
8. **Verification Check**:
    - [ ] Notification banner appears on iOS Lock Screen and Dynamic Island.
    - [ ] App badge counter increments properly.

---

## 4. Real-Device Acceptance Matrix

| Test Case | Device / OS | Role | Expected Action | Acceptance Sign-Off |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | Android Chrome | Admin | Receive diagnostic test push | Pending Hardware Test |
| **TC-02** | Android Chrome | Teacher | Receive timetable update push | Pending Hardware Test |
| **TC-03** | Android Chrome | Parent | Receive student absence push | Pending Hardware Test |
| **TC-04** | iOS Safari PWA | Parent | Receive fee payment push | Pending Hardware Test |
| **TC-05** | Windows Chrome | Admin | Click notification opens tab | Pending Hardware Test |
| **TC-06** | macOS Safari | Teacher | Background notification received | Pending Hardware Test |

