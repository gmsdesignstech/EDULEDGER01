# EduLedger Final Owner Actions Master Checklist

**Document Status:** ACTIVE & PRIORITIZED  
**Date:** 2026-11-07  
**Repository:** `gmsdesignstech/EDULEDGER01`  
**Production Target:** `https://eduledger.co.in`  

---

## Action 1: Separate Vercel Scopes & Isolate Preview Database (CRITICAL)

**Why:** Vercel currently assigns `DATABASE_URL` to **Production, Preview, and Development**. This means any Preview deployment will write to the live Production database!

**Steps to Complete (5 minutes):**
1. **Identify your provider:** Look at `DATABASE_URL` in Vercel.
   - If the domain is `*.neon.tech`, create a branch named `preview` in [Neon Console](https://console.neon.tech).
   - If the domain is `*.supabase.co`, create a preview project or branch in [Supabase Dashboard](https://supabase.com/dashboard).
2. **In Vercel Dashboard (`gmsdesignstechs-projects/eduledger` -> Settings -> Environment Variables):**
   - Click `...` on existing `DATABASE_URL` -> Edit -> **Uncheck `Preview` and `Development`** -> Save (so it is **Production only**).
   - Repeat for `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.
3. **Add Preview Database Connection:**
   - Click **Add Environment Variable**.
   - Name: `DATABASE_URL`
   - Value: `<paste your isolated preview database connection string>`
   - Environments: Check **ONLY `Preview`**.
   - Save.

---

## Action 2: Run Read-Only Schema Discovery on Live Database (3 minutes)

**Why:** Reconcile all 38 migrations without making assumptions or running risky DDL.

**Steps to Complete:**
1. Open the SQL Editor in your database console ([Neon](https://console.neon.tech) or [Supabase](https://supabase.com/dashboard)).
2. Copy the entire contents of [`database/schema/READ_ONLY_DATABASE_DISCOVERY_SINGLE_JSON.sql`](file:///c:/Users/abrar/OneDrive/Desktop/EDULEDGER/database/schema/READ_ONLY_DATABASE_DISCOVERY_SINGLE_JSON.sql).
3. Paste into the SQL Editor and click **Run**.
4. Copy the single JSON cell result.
5. Save it in your local repository as:  
   `database/schema/PRODUCTION_READ_ONLY_DATABASE_DISCOVERY.json`

---

## Action 3: Approve Staging & Committing the 16-File Bug-Fix Package

**Why:** Fixes the 3 confirmed production blockers (JPEG icons, 404 on `/student/login`, 404 on `/manifest-student.webmanifest`).

- **Verification:** 158 tests passed, 0 TypeScript errors, 0 ESLint warnings, clean build.
- **Scope:** Zero schema changes, zero database mutations, zero unrelated files staged.
- **Action:** Reply with: `"Approved to stage and commit the 16-file bug-fix package."`

---

## Action 4: Authorize Preview Deployment & Acceptance Testing

**Why:** Validate all fixes on a live Vercel Preview URL connected to your isolated database before touching Production.

- **Prerequisite:** Action 1 and Action 3 completed.
- **Action:** Reply with: `"Approved to deploy Preview branch."`

---

## Action 5: Authorize Production Release (Final Gate)

**Why:** Deploy verified fixes to `https://eduledger.co.in`.

- **Prerequisite:** Preview acceptance fully verified and signed off.
- **Action:** Reply with: `"Approved for Production deployment."`
