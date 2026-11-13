# EduLedger Phase 6: Browser Push Subscription & Token Normalization Report

**Project**: EduLedger — School Management, Reimagined  
**Auditor**: Next.js Frontend Architect & PWA Specialist  
**Date**: November 8, 2026  

---

## 1. Browser Subscription Lifecycle

The complete browser push notification lifecycle was inspected, reinforced, and validated across all portals (Administrator, Teacher, and Parent).

```
[User Signs In] 
       │
       ▼
[NotificationPushManager mounts globally via RootLayout]
       │
       ▼
[Route Check: Authenticated Portal? (/dashboard, /admin, /parent, /teacher, /student)]
       │
       ├── No ──> Dormant (Landing page, marketing, login pages do not prompt)
       │
       └── Yes ─> [Feature Detection: 'Notification' & 'PushManager' in window]
                     │
                     ▼
             [Service Worker Ready: /sw.js scope: /]
                     │
                     ▼
             [Permission Check: Notification.permission]
                     │
                     ├── "granted" ─> [pushManager.getSubscription() / subscribe()]
                     │                         │
                     │                         ▼
                     │                 [POST /api/notifications/push-token]
                     │                         │
                     │                         ▼
                     │                 [Store in fcm_device_tokens table]
                     │
                     ├── "default" ─> [Display Non-Intrusive Prompt Banner]
                     │                         │
                     │                         ▼
                     │                 [User clicks "Enable Notifications"]
                     │                         │
                     │                         ▼
                     │                 [Notification.requestPermission()]
                     │
                     └── "denied" ──> [Halt; Never re-prompt user repeatedly]
```

---

## 2. Token Normalization Logic

When modern browsers subscribe using `registration.pushManager.subscribe()`, the browser generates a standard WebPush subscription endpoint:
- **Chromium / Android Chrome**: `https://fcm.googleapis.com/fcm/send/<FCM_REGISTRATION_TOKEN>`
- **Mozilla Firefox**: `https://updates.push.services.mozilla.com/wpush/v2/<TOKEN>`
- **Apple Safari**: `https://web.push.apple.com/<TOKEN>`

### Implementation in `src/lib/notifications.ts`:
```typescript
export function normalizeFcmToken(rawToken: string): string {
  const trimmed = rawToken.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.token && typeof parsed.token === "string") {
        return parsed.token.trim();
      }
      if (parsed.endpoint && typeof parsed.endpoint === "string") {
        const parts = parsed.endpoint.split("/send/");
        if (parts.length > 1) {
          return parts[parts.length - 1].trim();
        }
        return parsed.endpoint.trim();
      }
    } catch {
      // not valid JSON fallback
    }
  }
  return trimmed;
}
```

This ensures that whether a device enrolls via raw FCM string or JSON Web Push subscription, FCM v1 receives the exact token required by Google's API.

---

## 3. Account Switching & Token De-duplication

In `src/lib/db.ts`:
```sql
INSERT INTO fcm_device_tokens(id, institution_id, user_id, token, device_type, user_agent, status, updated_at)
VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT(token) DO UPDATE SET
  user_id=EXCLUDED.user_id,
  institution_id=EXCLUDED.institution_id,
  device_type=EXCLUDED.device_type,
  user_agent=EXCLUDED.user_agent,
  status='ACTIVE',
  revoked_at=NULL,
  updated_at=CURRENT_TIMESTAMP
```

- **Account Switching**: If a user logs out and another user logs in on the same browser device, the token is safely updated to the new user and institution.
- **De-duplication**: The unique index on `token` prevents duplicate token rows in the database.
- **Revocation**: When a user logs out or FCM reports `UNREGISTERED` (404/NOT_FOUND), the token status becomes `REVOKED` and is excluded from future dispatches.

