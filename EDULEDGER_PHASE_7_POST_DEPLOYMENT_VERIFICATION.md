# EduLedger Phase 7 — Post-Deployment Verification & Operational Protocol

**Project**: EduLedger — School Management, Reimagined  
**Production URL**: https://eduledger.co.in  
**Phase**: Phase 7 — Post-Deployment Operational Verification Protocol  
**Status**: SPECIFICATION READY — TO BE EXECUTED IMMEDIATELY FOLLOWING PRODUCTION PROMOTION  

---

## 1. Post-Deployment Endpoint Health Protocol

Upon deployment promotion to Vercel production (`https://eduledger.co.in`), execute the following automated HTTP health checks:

### 1.1 Core API & Manifest Probes
```bash
# 1. System Health
curl -s -o /dev/null -w "%{http_code}\n" https://eduledger.co.in/api/health
# Expected: 200

# 2. Main Manifest
curl -s -o /dev/null -w "%{http_code}\n" https://eduledger.co.in/manifest.webmanifest
# Expected: 200

# 3. Role Manifests
curl -s -o /dev/null -w "%{http_code}\n" https://eduledger.co.in/manifest-teacher.webmanifest
curl -s -o /dev/null -w "%{http_code}\n" https://eduledger.co.in/manifest-parent.webmanifest
curl -s -o /dev/null -w "%{http_code}\n" https://eduledger.co.in/manifest-student.webmanifest
# Expected: 200 for all

# 4. Service Worker Availability
curl -s -o /dev/null -w "%{http_code}\n" https://eduledger.co.in/firebase-messaging-sw.js
# Expected: 200 with Content-Type: application/javascript
```

### 1.2 PWA Diagnostics Endpoint Probe
```bash
curl -s https://eduledger.co.in/api/settings/pwa
```
**Expected Response Structure**:
```json
{
  "status": "ready", // or "test_required"
  "firebaseConfigured": true,
  "vapidKeyConfigured": true,
  "serviceAccountEmail": "firebase-adminsdk-fbsvc@eduledger-e0ac2.iam.gserviceaccount.com",
  "registeredTokensCount": "<integer >= 0>"
}
```

---

## 2. Interactive Operational Verification Workflow

### 2.1 Administrator Portal Verification (`/dashboard/settings/pwa`)
1. Log in to the production dashboard as a School Administrator.
2. Navigate to **Settings → PWA & Notifications**.
3. Verify the **Firebase Cloud Messaging Status Badge** displays `READY` or `TEST REQUIRED` with green indicator.
4. Click **Enable Push Notifications** to grant browser permission.
5. Once subscribed, click **Send Test Notification**.
6. **Expected Outcome**: A desktop/mobile notification banner appears with:
   - Title: `EduLedger Test Notification`
   - Body: `Push notifications are active for EduLedger.`
   - Click action: Focuses or opens the `/dashboard/settings/pwa` tab.

### 2.2 Teacher Portal Verification (`/teacher`)
1. Log in as a Teacher at `https://eduledger.co.in/teacher/login`.
2. Observe the push notification prompt banner at the top or in the navigation bar.
3. Click **Subscribe / Enable Notifications**.
4. Confirm in developer tools (`F12 → Network`) that `POST /api/notifications/push-token` completes with HTTP 200 and `{ success: true }`.
5. Trigger a student attendance notice or test announcement to verify teacher-scoped delivery.

### 2.3 Parent Portal Verification (`/parent`)
1. Log in as a Parent at `https://eduledger.co.in/parent/login`.
2. Click **Enable Notifications**.
3. Confirm `POST /api/notifications/push-token` registers the token with `role_scope: "parent"` and the respective `school_id`.
4. Trigger an attendance notification or homework notification for their linked student.
5. Verify notification arrives on the parent's phone or browser.

---

## 3. Rollback & Emergency Contingency Plan

If any critical regression occurs during or immediately after deployment:

1. **Vercel Instant Rollback**:
   - Access the Vercel Dashboard at `https://vercel.com/gmsdesignstechs-projects/eduledger/deployments`.
   - Identify prior stable deployment commit (`3e0c9d1` or `223ac42`).
   - Click the three dots menu (`...`) on that deployment and select **Promote to Production**.
   - Rollback takes effect globally within seconds with zero downtime.

2. **Database Integrity**:
   - No database schema migrations were applied; all notification and token tables (`notification_push_tokens`, `notifications`) remain 100% backward compatible.
   - Zero risk of database locks or schema corruption.

