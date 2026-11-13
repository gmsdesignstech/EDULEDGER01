# EduLedger Phase 8 — Device Token Lifecycle Management Report

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Token Lifecycle & Storage  
**Date**: November 8, 2026  
**Status**: AUDITED & REINFORCED  

---

## 1. Device Token Lifecycle Stages

1. **User Authentication**: User logs into `/admin`, `/teacher`, or `/parent`. Server session identifies `user.id` and `user.institutionId`.
2. **Permission Request**: User interacts with the UI (prompt banner or settings button). Notification permission is requested.
3. **Token Acquisition**: Client generates genuine FCM registration token via Firebase SDK with the project's VAPID key.
4. **Ingestion & Validation**:
   - `POST /api/notifications/push-token`
   - Validates token syntax using `validateFcmToken()`.
   - Rejects endpoint URLs and malformed strings with HTTP 400.
5. **Persistence**:
   - PostgreSQL table `fcm_device_tokens`.
   - `ON CONFLICT (token) DO UPDATE` ensures idempotent re-registrations and prevents duplicates.
6. **Delivery & Status Tracking**:
   - Deliveries recorded in `notification_deliveries` with initial status `PENDING`.
   - Updated to `SENT` upon FCM acceptance.
   - Updated to `DELIVERED` when the service worker acknowledges receipt at `/api/notifications/ack`.
7. **Pruning & Revocation**:
   - Tokens returning `UNREGISTERED` or `404` from Google FCM are automatically revoked (`status='REVOKED'`).
   - User logout triggers `DELETE /api/notifications/push-token` to revoke the device association.

