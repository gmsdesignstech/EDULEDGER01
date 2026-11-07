# EduLedger Deployment Manifest

**Status: EMPTY — NO FILE SET OR COMMIT IS APPROVED FOR DEPLOYMENT.**

## Current Production source

Vercel confirms `EDULEDGER01` / `main` / commit `0af2f947d43de6258a5da70040bd726f29373ec2`, matching local `HEAD` and `origin/main`. The current dirty worktree is not included in this source commit.

## Candidate fixes (review only; not selected/staged)

| Candidate files | Git status | Change | Gate |
|---|---|---|---|
| `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | Modified | Replace JPEG blobs with genuine PNGs. | Local production HTTP verified; include only after full diff review. |
| `src/app/manifest.ts`, `src/app/manifest-parent.webmanifest/route.ts`, `src/app/manifest-teacher.webmanifest/route.ts` | Modified | Align declared PWA metadata/orientation with intended app. | Review manifest and app changes together. |
| `src/app/(student-auth)/student/login/page.tsx`, `src/app/student/layout.tsx`, `src/app/student/page.tsx`, `src/app/manifest-student.webmanifest/route.ts`, `src/components/student-portal.tsx`, `src/lib/portal-session.ts` | Untracked | Add guarded Student portal/login and scoped manifest. | Review every dependency and authorization path before commit. |
| `public/firebase-messaging-sw.js`, PWA components and tests | Modified/untracked | Cache/update/offline behavior and regression coverage. | Separate security review; not selected. |

No database migrations, Prisma schema, environment variables, scratch artifacts, school records, or unrelated application/documentation changes are selected. Because the broader worktree is unreviewed and the database gates remain open, this is a candidate list only, not a release manifest.

Before approving any set: verify provider/schema/ledger evidence, compare environment target identities, establish Preview isolation, review complete diffs, test the exact commit in Preview, prepare rollback, and obtain Production authorization. Nothing is staged or deployed.
