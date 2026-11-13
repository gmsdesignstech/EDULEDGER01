# EduLedger Phase 9 — Genuine FCM Token Generation & Protocol Verification

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — Token Generation Protocol Verification  
**Date**: November 8, 2026  
**Status**: VERIFIED & PASS  

---

## 1. End-to-End Token Generation Lifecycle

The token acquisition flow has been verified across all integration touchpoints:

```
[User Action: "Enable Notifications"]
           │
           ▼
[Notification.requestPermission()]
           │ (granted)
           ▼
[navigator.serviceWorker.ready]
           │
           ▼
[requestClientFcmToken(registration)]
           │
           ├─► getClientFirebaseApp() (Initializes client app with public config)
           ├─► isFirebaseMessagingSupported() (Verifies PushManager, Notification, IndexedDB)
           ├─► getMessaging(app)
           └─► getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
                       │
                       ▼ (Contacts Firebase Installations service)
           [Genuine FCM Registration Token (e.g. bk3RNw...)]
                       │
                       ▼
[POST /api/notifications/push-token]
           │
           ├─► validateFcmToken() (Validates token syntax; rejects endpoints & raw JSON)
           ├─► Session check (Verifies user.id and user.institutionId)
           └─► registerDeviceToken() (ON CONFLICT (token) DO UPDATE in fcm_device_tokens)
```

---

## 2. Failure & Edge Case Handling

`requestClientFcmToken()` handles all client failure scenarios gracefully without throwing unhandled exceptions:
- **Unsupported Browser**: Returns `{ token: null, error: "Firebase Web Messaging is not supported..." }`.
- **Missing Environment Variables**: Returns `{ token: null, error: "Missing required Firebase client environment configuration..." }`.
- **Missing VAPID Key**: Returns `{ token: null, error: "Missing required Web Push VAPID key..." }`.
- **User Dismisses Prompt**: Session storage remembers dismissal (`eduledger_push_prompt_dismissed`); does not repeatedly prompt user.
- **Server Side Rendering (SSR)**: Returns `{ token: null, error: "Cannot request token during server-side rendering." }`.

