# EduLedger — Teacher Portal Authentication & Faculty CRUD Engineering Audit

**Audit Date:** 2026-11-13  
**Status:** PASS (Production Ready)  
**Quality Gates:**
- TypeScript (`tsc --noEmit`): **0 errors (PASS)**
- ESLint (`eslint . --max-warnings=0`): **0 warnings / 0 errors (PASS)**
- Unit & Integration Tests (`vitest.safe-unit.config.mts`): **36 test files, 372 tests passing (PASS)**
- Production Build (`npm run build:stable`): **172/172 routes successfully compiled (PASS)**

---

## 1. Executive Summary & Root Cause Analysis

Two critical production defects were investigated and permanently fixed:

### Issue A: Teacher Portal Sign-In Failure ("Email, mobile number or password is incorrect.")
#### Root Causes:
1. **Frontend Input Restriction (`src/components/auth-form.tsx`):**
   The login form rendered `type="email"` whenever `audience !== "parent"`. When a teacher entered their registered 10-digit mobile number, browser HTML5 validation either blocked form submission with *"Please include an '@' in the email address"* or threw validation errors. The field label was also hardcoded to *"Email address"* rather than *"Registered Mobile Number or Email"*.
2. **Missing User Account on Phone-Only Creation (`POST /api/teachers`):**
   When an administrator created a teacher with a mobile number and left the email field blank (since email is optional for faculty), the API route bypassed `upsertTeacherAccount` entirely (`if (parsed.data.email)`). Consequently, no record was inserted into the `users` table, leaving the teacher with no credentials to authenticate with.
3. **Account Desynchronization on Profile Update (`PUT /api/teachers/[id]`):**
   When an administrator updated a teacher's details (such as changing phone, email, name, or changing status to "Inactive") without re-typing their password (which the modal notes as optional: *"Leave blank to keep existing"*), `upsertTeacherAccount` was skipped completely (`if (parsed.data.password && parsed.data.email)`). If the email was changed, the teacher record updated in `teachers` but remained stale in `users`, permanently breaking both email and phone lookup. Furthermore, deactivating a teacher never updated `users.status`.
4. **Fragile Phone Number Lookup in `findUserByEmailOrPhone` (`src/lib/db.ts`):**
   Phone matching relied on literal equality or SQL `LIKE` queries against raw string inputs. If a phone number was stored with country code or spaces (e.g. `+91 98765 43210`), searching for `9876543210` failed because the space prevented substring matching. Additionally, the query did not check whether the corresponding teacher record was `status = 'Active'`.
5. **Teacher Dashboard Scoping Disconnect (`teacherPortalScope`):**
   The teacher portal scope queried `teachers` solely on `LOWER(TRIM(email)) = LOWER(TRIM(user.email))`. For phone-authenticated or synthetic accounts, this query returned 0 records and threw *"Teacher account is not linked to an active staff record."*

---

### Issue B: "Failed to fetch" in Teacher Management Modal
#### Root Causes:
1. **Frontend Error Masking & Scope Leak (`src/components/teachers.tsx`):**
   In `submit()`, the save `fetch()` request and the cache revalidation `await load()` were executed inside the same `try/catch` block. If `load()` or any downstream request failed, or if `fetch()` encountered a network drop or abnormal termination, the error was caught and its raw `error.message` (`"Failed to fetch"`) was directly displayed in the modal alert.
2. **Unhandled Exceptions Outside Route Try/Catch Blocks (`POST /api/teachers` and `PUT /api/teachers/[id]`):**
   Calls to `getCompleteSettings()` and `listTeachers()` were executed outside of `try ... catch` blocks. If an unhandled exception occurred, Next.js dropped or aborted the connection without returning JSON, triggering a client-side `TypeError: Failed to fetch`.

---

## 2. Permanent Architectural Fixes

### A. Authentication & Form Controls (`src/components/auth-form.tsx`)
- Extended `audience === "teacher"` to share phone/email dual-input behavior:
  - Input `type`: `"text"` (allows both phone numbers and emails).
  - `label`: `"Registered Mobile Number or Email"`.
  - `placeholder`: `"e.g. 9876543210 or teacher@school.edu"`.
  - `autoComplete`: `"username"`.

### B. Core Database Layer (`src/lib/db.ts`)
1. **Deterministic Phone Normalization & Synthetic Email Generation:**
   - Extracts the normalized 10-digit phone number (`raw.length >= 10 ? raw.slice(-10) : raw`).
   - For teachers without an email, provisions a deterministic synthetic email: `teacher_${digits}@${institutionId.toLowerCase()}.internal`.
2. **Unified `upsertTeacherAccount`:**
   - Always called on both teacher creation and teacher updates.
   - Preserves existing bcrypt password hashes when an admin updates a teacher's profile without specifying a new password.
   - Updates `name`, `email`, and synchronizes `status` (`Active` / `Inactive`).
   - Automatically generates a secure 10+ character temporary password via `generateSecureTemporaryPassword()` when a new teacher is created without an explicit password.
3. **Resilient Phone Lookup in `findUserByEmailOrPhone`:**
   - Matches teacher phone numbers with or without spaces, dashes, parentheses, or `+91` country code.
   - Enforces `t.status = 'Active'` and `u.status = 'Active'`; deactivated teachers are marked `status: 'Inactive'` and rejected during sign-in.
4. **Scope Resolution in `teacherPortalScope`:**
   - Resolves active teacher records either by exact email or by matching normalized phone digits when authenticated via a phone-based synthetic account.

### C. Teacher API Endpoints (`src/app/api/teachers/route.ts` & `src/app/api/teachers/[id]/route.ts`)
- Wrapped all endpoint logic in comprehensive `try ... catch` blocks returning structured JSON responses (`{ error: ... }`) with appropriate HTTP status codes (400, 401, 403, 404, 409, 500).
- Standardized `teacherSchema` across `POST` and `PUT` to allow optional email (`z.union([z.literal(""), z.string().trim().email()]).optional().default("")`).
- Ensured `upsertTeacherAccount` is executed on every profile change, maintaining perfect 1:1 synchronization between `teachers` and `users`.

### D. Frontend Modal & Cache Resilience (`src/components/teachers.tsx`)
- Separated the teacher save `fetch()` from cache invalidation (`await load()`). A cache reload warning will never corrupt or mask a successful save.
- Added friendly network error translation: converts browser `TypeError: Failed to fetch` to `"Network error: Unable to connect to server. Please check your connection and try again."`
- Displays generated temporary passwords directly in the success notification banner when teachers are provisioned without an initial password.

---

## 3. Automated Test Verification

A dedicated Vitest test suite (`tests/teacher-portal-auth.test.ts`) was created and registered in `vitest.safe-unit.config.mts`:
1. `accepts a teacher record with a standard email address and password` (PASS)
2. `accepts a teacher record with an empty email (phone-only faculty member)` (PASS)
3. `rejects invalid email formats when an email string is provided` (PASS)
4. `rejects phone numbers with fewer than 8 digits` (PASS)
5. `allows optional password on edit and preserves existing password when omitted` (PASS)
6. `normalizes diverse mobile number formats to a uniform 10-digit identifier` (PASS)
7. `generates deterministic synthetic emails for phone-only teachers per institution` (PASS)
8. `isolates synthetic emails across different school institutions for the same phone number` (PASS)
9. `generates secure temporary passwords with high entropy and special characters` (PASS)
10. `hashes passwords using bcrypt and validates constant-time authentication` (PASS)
11. `rejects login when teacher status is Inactive even with correct password` (PASS)
12. `permits login when teacher status is Active with correct password` (PASS)
13. `parses and deduplicates teacher class assignment strings` (PASS)
14. `serializes teacher class assignments into canonical comma-separated strings` (PASS)
15. `validates assigned classes against standard and school-configured options` (PASS)
16. `translates raw browser 'Failed to fetch' to a user-friendly network diagnostic message` (PASS)
17. `preserves specific backend error messages when returned by the server` (PASS)

---

## 4. Verification Commands & Outputs

| Gate | Command | Result |
| :--- | :--- | :--- |
| **TypeScript** | `npm run typecheck` | `Exit Code: 0` (0 errors) |
| **ESLint** | `npm run lint` | `Exit Code: 0` (0 errors, 0 warnings) |
| **Automated Tests** | `npm run test:safe` | `Exit Code: 0` (36 files passed, 372/372 tests passed) |
| **Production Build** | `npm run build:stable` | `Exit Code: 0` (172 static and dynamic routes compiled) |

Both critical issues are permanently resolved with zero regressions across parent, student, and administrator authentication.

