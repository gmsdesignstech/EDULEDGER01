# EduLedger Phase 9 — Device Token Lifecycle & Schema Audit

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — Device Token Lifecycle Management  
**Date**: November 8, 2026  
**Status**: VERIFIED & PASS  

---

## 1. Database Schema Verification

The PostgreSQL table `fcm_device_tokens` definition in `src/lib/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS fcm_device_tokens (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_type TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ
);
```

### Schema Assessment
- **Sufficient**: The schema accurately represents genuine FCM tokens (`token TEXT UNIQUE`), user ownership (`user_id`), school association (`institution_id`), device type, and active status.
- **Migration Requirement**: **NO MIGRATION REQUIRED**. The existing schema represents genuine FCM tokens cleanly.

---

## 2. Token Lifecycle States & Transitions

1. **ACTIVE**: Inserted on registration. If token re-registers (e.g. after browser reboot or re-login), `ON CONFLICT (token) DO UPDATE` refreshes `updated_at`, reactivates status to `ACTIVE`, and clears `revoked_at`.
2. **REVOKED (User Action)**: Set when user logs out or clicks "Disable Notifications".
3. **REVOKED (FCM Pruning)**: Set automatically when Google FCM v1 returns `404 NOT_FOUND` or `UNREGISTERED`.
4. **Account Deletion**: Handled by database foreign key `ON DELETE CASCADE`.

