# EDULEDGER PHASE 10 — NOTIFICATION DELIVERY AUDIT

## 1. Multi-Channel Notification Architecture
EduLedger features an integrated, three-tiered notification architecture:
1. **In-App Notifications**: Stored in the PostgreSQL `notifications` table; surfaced immediately in the portal bell/activity drawer.
2. **WhatsApp Notifications**: Outbound transactional messaging via WhatsApp Business Cloud API.
3. **Firebase Cloud Messaging (FCM)**: Native browser and PWA push notifications across mobile and desktop devices.

---

## 2. Notification Delivery Evidence Levels (A through F)

To prevent unsubstantiated claims, EduLedger grades push notification readiness across six strict evidence levels:

| Level | Evidence Stage | Description | Phase 10 Verification | Status |
| :---: | :--- | :--- | :--- | :---: |
| **A** | **Configuration** | All Firebase Admin & Web Client environment variables populated, valid, and synchronized. | Verified in `.env.local` and Vercel environments. | **PASS** |
| **B** | **OAuth 2.0 Auth** | Server successfully signs RS256 JWT assertion and obtains bearer token from Google OAuth. | Verified via server token exchange automated test. | **PASS** |
| **C** | **FCM v1 Handshake**| Server successfully reaches `https://fcm.googleapis.com/v1/projects/eduledger-e0ac2/messages:send`. | Verified API connectivity; Google FCM v1 endpoint responsive. | **PASS** |
| **D** | **Message Acceptance**| Google FCM accepts payload (`200 OK` with `name: "projects/.../messages/..."`) for an enrolled device token. | Requires a live user device enrolled with genuine token. | **NOT TESTED** |
| **E** | **Physical Receipt** | Android/iOS/Desktop device displays the push banner in the notification center. | Requires physical device testing by device owner. | **NOT TESTED** |
| **F** | **Action Navigation** | User taps notification banner on physical device, waking the app to the target URL. | Requires physical device testing by device owner. | **NOT TESTED** |

---

## 3. Supported Notification Events & Triggers

The following core school notification events are integrated into the FCM push pipeline:

| Event Key | Description | Target Portals | Primary Payloads |
| :--- | :--- | :--- | :--- |
| `attendance_absent` | Student marked absent for the day | Parent Portal | Student name, date, attendance summary, parent portal link. |
| `fee_payment_success`| School fee transaction confirmed | Parent Portal | Invoice number, student name, amount received, fee receipt link. |
| `fee_overdue_reminder`| Pending fee payment due | Parent Portal | Student name, due date, outstanding amount, payment link. |
| `exam_marks_published`| Term/assessment scores published | Parent Portal | Exam title, subject scores, report card link. |
| `timetable_updated` | Class schedule changed or reassigned | Teacher & Parent | Class, section, day, effective date, timetable link. |
| `teacher_assigned` | New subject teacher assigned to class | Teacher & Parent | Subject, teacher name, classroom. |
| `emergency_announcement`| School-wide broadcast notice | Admin, Teacher, Parent | School head notice, instructions, urgency flag. |
| `test_push_diagnostic` | Administrator PWA diagnostic test | Current Admin | Timestamp, diagnostic ID, test payload. |

---

## 4. FCM Payload Structure & WebPush Options

Every outgoing FCM message created by `sendFcmMessage()` is formatted to ensure maximum OS compatibility (Android, iOS Safari PWA, macOS, Windows):

```json
{
  "message": {
    "token": "<fcm_device_token>",
    "notification": {
      "title": "EduLedger — Attendance Alert",
      "body": "Aarav Sharma was marked absent today."
    },
    "data": {
      "url": "/parent/attendance",
      "event_type": "attendance_absent",
      "school_id": "school_uuid_here",
      "notification_id": "notif_uuid_here"
    },
    "webpush": {
      "headers": {
        "Urgency": "high"
      },
      "notification": {
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/badge-72x72.png",
        "tag": "attendance_absent_aarav",
        "renotify": true,
        "requireInteraction": false
      },
      "fcm_options": {
        "link": "https://eduledger.co.in/parent/attendance"
      }
    }
  }
}
```

---

## 5. Token Invalidation & Auto-Eviction
When an FCM token expires or the user uninstalls the PWA, Google FCM v1 responds with:
- `404 NOT_FOUND`
- `400 INVALID_ARGUMENT` (with `UNREGISTERED` detail)

EduLedger automatically captures these status codes in `sendFcmMessage()`, removes the stale token from `user_push_tokens`, and marks the notification log without interrupting delivery to other active devices.

**Delivery System Audit Status**: **READY FOR HARDWARE VERIFICATION**

