# EduLedger Phase 9 — Vercel Release Preflight & Environment Audit

**Project**: EduLedger — School Management, Reimagined  
**Vercel Project**: `eduledger`  
**Production Domain**: `https://eduledger.co.in`  
**Phase**: Phase 9 — Production Deployment Preflight  
**Date**: November 8, 2026  
**Status**: PREFLIGHT PASSED — ALL ENVIRONMENT VARIABLES CONFIGURED & VERIFIED  

---

## 1. Vercel Environment Configuration Verification

The Vercel environment variables were verified active across **Production**, **Preview**, and **Development**:

| Variable Name | Environment Scopes | Type | Value Classification |
| :--- | :--- | :---: | :--- |
| `FIREBASE_PROJECT_ID` | Production, Preview, Development | Plaintext/Secret | `eduledger-e0ac2` |
| `FIREBASE_CLIENT_EMAIL` | Production, Preview, Development | Plaintext/Secret | Service Account Client Email |
| `FIREBASE_PRIVATE_KEY` | Production, Preview, Development | Secret | RSA 2048-bit Private Key |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Production, Preview, Development | Secret | Full JSON Service Account Backup |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Production, Preview, Development | Config | 87-character P-256 Public Key |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Production, Preview, Development | Config | Browser Client API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production, Preview, Development | Config | `eduledger-e0ac2.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Production, Preview, Development | Config | `eduledger-e0ac2` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Production, Preview, Development | Config | `eduledger-e0ac2.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| Production, Preview, Development | Config | `660125545182` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Production, Preview, Development | Config | `1:660125545182:web:1db9f017911f38c9aa484f` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Production, Preview, Development | Config | `G-SES0YEPV16` |

---

## 2. Shared Database Environment Warning

If Preview deployments connect to the same PostgreSQL database as Production:
- **Server Guard Active**: `src/lib/notifications.ts` enforces `process.env.VERCEL_ENV === "preview"` suppression to block preview builds from dispatching push messages to real production recipients.
- **Database Safety**: Zero destructive operations or unapproved schema migrations.

