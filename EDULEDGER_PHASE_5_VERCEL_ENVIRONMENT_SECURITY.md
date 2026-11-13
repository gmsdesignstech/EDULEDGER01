# EduLedger Phase 5: Vercel Environment Security & Secret Audit

**Project**: EduLedger — School Management, Reimagined  
**Target Environments**: Production, Preview, Development  
**Auditor**: Application Security Specialist  
**Audit Date**: November 8, 2026  

---

## 1. Environment Variable Audit & Security Status

An independent audit of the Vercel project `eduledger` (`gmsdesignstechs-projects/eduledger`) was executed via the official Vercel CLI.

| Variable Name | Environment Scope | Storage Type | Format Validity | Required | Security Evaluation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | Production, Preview, Development | **Secret** (Encrypted) | **Valid** (`eduledger-e0ac2`) | **Required** | **SAFE** · Encrypted at rest, never returned to browser |
| `FIREBASE_CLIENT_EMAIL` | Production, Preview, Development | **Secret** (Encrypted) | **Valid** (IAM Service Account) | **Required** | **SAFE** · Encrypted at rest, never returned to browser |
| `FIREBASE_PRIVATE_KEY` | Production, Preview, Development | **Secret** (Encrypted) | **Valid** (RSA 2048 PEM) | **Required** | **SAFE** · Newlines preserved, never returned to browser |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Production, Preview, Development | **Secret** (Encrypted) | **Valid** (Full JSON payload) | **Optional** | **SAFE** · Fallback secret, never returned to browser |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | None | Not Defined | **Missing** | **Required for Client Push** | **BLOCKED** · Needs generation in Firebase Console |

> [!IMPORTANT]
> **Zero Exposure Guarantee**: No private keys, RSA headers, or secret strings are exposed via `NEXT_PUBLIC_*` prefixes, frontend API responses, diagnostic screens, git commits, or client-side bundles.

---

## 2. Environment Separation & Cross-Environment Safety

### Intended Separation Architecture:
- **Production (`VERCEL_ENV=production`)**: Dispatches legitimate operational notifications to authenticated students, parents, and teachers whose schools have enabled notification preferences.
- **Preview (`VERCEL_ENV=preview`)**: PR preview deployments sharing the same database or project credentials.
- **Development (`VERCEL_ENV=development`)**: Local developer instances.

### Risk Identified:
When Preview and Production share the same Firebase service account, an automated event or manual test in Preview could dispatch pushes to production devices registered in the database.

### Mitigation Implemented in `src/lib/notifications.ts`:
```typescript
const isPreview = process.env.VERCEL_ENV === "preview";
const isExplicitTest =
  Boolean(data?.isTest) ||
  eventKey.startsWith("test_") ||
  eventKey.startsWith("test-");

if (isPreview && !isExplicitTest) {
  // Skip external FCM dispatch in Preview environment to protect real production recipients
  continue;
}
```
**Outcome**:
- General broadcast and operational events triggered in a Preview environment are prevented from calling external Google FCM endpoints for real school users.
- Controlled administrator diagnostics (`/dashboard/settings/pwa`) send an explicit test event targeting only the administrator's own registered test device.

---

## 3. Credential Parsing & Signing Security

1. **Algorithm**: RS256 (RSA with SHA-256) strictly enforced in `src/lib/notifications.ts`.
2. **Implementation**: Native `node:crypto` (`createSign("RSA-SHA256")`), eliminating bloated third-party SDKs.
3. **Audience & Scope**:
   - `aud`: `https://oauth2.googleapis.com/token`
   - `scope`: `https://www.googleapis.com/auth/firebase.messaging`
4. **Token Caching**:
   - Google OAuth2 access tokens have a 3,600s TTL.
   - Cached in serverless runtime memory and renewed automatically when expiration is within 60 seconds (`expiresAt > now + 60`).
   - Token is never exported, logged, or returned in HTTP responses.

---

## 4. Git Worktree Secret Leak Audit

- **`.gitignore` Rules**:
  - `.env*` blocked (whitelists only `!.env.example`).
  - Added explicit patterns: `*.pem`, `*.key`, `*service-account*.json`, `*firebase-adminsdk*.json`.
- **Git Grep Verification**:
  - Searched for `BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE KEY`, and service account client secrets.
  - Zero private credentials present in tracked files or staging areas.

