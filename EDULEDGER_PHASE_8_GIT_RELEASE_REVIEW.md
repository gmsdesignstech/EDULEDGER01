# EduLedger Phase 8 — Git Release Review & Staging Plan

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 8 — Git Audit & Release Staging Plan  
**Current HEAD Commit**: `3e0c9d1`  
**Date**: November 8, 2026  
**Status**: AUDITED & SAFE — HOLDING FOR USER APPROVAL  

---

## 1. Working Tree & Security Invariants

- **Branch**: `main`
- **Secrets Check**:
  - `.env.local` is untouched and excluded by `.gitignore`.
  - Zero private keys, PEM files, or service account JSON files are staged.
- **Unrelated User Work**:
  - `src/app/parent/timetable/page.tsx` is completely unstaged and preserved.

---

## 2. Proposed Files for Release Commit

The following files contain verified Phase 8 corrections and documentation:

### Code Modifications
1. `src/lib/notifications.ts` (credential quote stripping, token validator, error classification)
2. `src/app/api/notifications/push-token/route.ts` (strict token validation)
3. `src/app/api/settings/pwa/route.ts` (diagnostics status and remediation calculation)
4. `src/components/notification-push-manager.tsx` (portal scope and subscription alignment)
5. `src/components/pwa-diagnostics-client.tsx` (diagnostics UI and test push trigger)
6. `public/firebase-messaging-sw.js` (absolute origin deep links and cache safety)
7. `vitest.safe-unit.config.mts` (unit test suite pattern)
8. `.gitignore` (un-ignore Phase 8 reports and ignore private keys)

### Tests & Documentation
9. `tests/firebase-activation.test.ts` (expanded unit tests)
10. `EDULEDGER_PHASE_8_*.md` (Phase 8 governance reports)

---

## 3. Deployment Gate Statement

In strict compliance with instructions:
> **NO GIT COMMIT, GIT PUSH, OR VERCEL DEPLOYMENT HAS BEEN EXECUTED.**  
> Work is paused at the approval gate waiting for your explicit command.

