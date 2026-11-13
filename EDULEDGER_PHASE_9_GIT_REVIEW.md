# EduLedger Phase 9 — Git Review & Release Staging Manifest

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 9 — Git Review & Release Preparation  
**Current HEAD Commit**: `3e0c9d1`  
**Date**: November 8, 2026  
**Status**: AUDITED & SAFE — HOLDING FOR USER APPROVAL  

---

## 1. Safety Checks & Worktree Segregation

- **Branch**: `main`
- **Secrets Audit**:
  - `.env.local` is untracked and excluded by `.gitignore`.
  - Zero private keys (`*.pem`, `*.key`) or service-account JSON files are staged.
- **Unrelated User Work**:
  - `src/app/parent/timetable/page.tsx` is completely preserved in its local unstaged state.
  - Zero database migrations or schema alterations staged.

---

## 2. Proposed Files for Release Commit

The following files contain verified Phase 8/9 Firebase Cloud Messaging and PWA enhancements:

### Source Code & Dependencies
1. `package.json` (added `firebase: "^13.2.0"`)
2. `package-lock.json`
3. `src/lib/firebase-client.ts` (client Firebase Web SDK integration, no hardcoded fallbacks)
4. `src/lib/notifications.ts` (credential quote stripping, `validateFcmToken`, error classification)
5. `src/app/api/notifications/push-token/route.ts` (strict token validation on POST/DELETE)
6. `src/app/api/settings/pwa/route.ts` (diagnostics status and remediation calculation)
7. `src/components/notification-push-manager.tsx` (FCM token generation via `requestClientFcmToken`)
8. `src/components/pwa-diagnostics-client.tsx` (diagnostics UI and test push trigger)
9. `public/firebase-messaging-sw.js` (absolute origin deep links and cache safety)
10. `vitest.safe-unit.config.mts` (unit test suite pattern)
11. `.gitignore` (un-ignore Phase 9 reports and ignore private keys)

### Tests & Documentation
12. `tests/firebase-activation.test.ts` (expanded to 35 automated tests)
13. `EDULEDGER_PHASE_9_*.md` (Phase 9 governance reports)
14. Prior phase governance reports (`EDULEDGER_PHASE_8_*.md`, `EDULEDGER_PHASE_7_*.md`, etc.)

---

## 3. Deployment Gate Statement

In strict compliance with instructions:
> **NO GIT COMMIT, GIT PUSH, OR VERCEL DEPLOYMENT HAS BEEN EXECUTED.**  
> Work is paused at the approval gate waiting for your explicit command.

