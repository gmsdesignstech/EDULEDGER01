# PostgreSQL provider and deployment verification

**Status: BLOCKED – OWNER EVIDENCE REQUIRED.** This procedure is read-only. It does not ask the owner to expose `DATABASE_URL` or change Vercel settings.

## What repository evidence establishes

- `src/lib/db.ts` uses `postgres.js` and reads `DATABASE_URL`. No provider-specific PostgreSQL SDK is the application runtime driver.
- `vercel.json` contains install/build configuration and cron paths; it contains no database project/endpoint binding.
- Local `.vercel/project.json` identifies a project named `eduledger` and contains Vercel project/organization IDs. This is local linkage metadata, not proof of current remote project settings or the live database.
- The historical Phase 2.2 report records an authenticated Vercel inspection in which Neon-related variable names and `DATABASE_URL` were shared across Production, Preview and Development. It intentionally did not inspect values. This suggests a Neon-associated configuration but does **not** prove the host behind `DATABASE_URL`, the active provider, or the current scope state.
- The owner supplied a Supabase project URL in an earlier turn. No evidence binds it to the deployed `DATABASE_URL`; historical Supabase project references also differed. It remains a candidate only.

**Conclusion: PostgreSQL is verified from source; provider and active database target are not verified. Do not assume Neon or Supabase.** Variable names, integration labels, package history, and separately supplied project URLs are leads, not target proof.

## Owner procedure in Vercel

1. Sign in to the authorized Vercel team. Select the `eduledger` project and compare its project name, project ID, organization/team ID, Git repository, project root directory, production branch and production domain with the owner’s deployment records. Do not relink or edit settings.
2. Open **Deployments**. Select the deployment serving `https://eduledger.co.in`; verify it is marked **Production**, record the deployment ID/URL, source branch, commit SHA, creation time, and status. Confirm the custom domain is assigned to that deployment/project. Do not promote, redeploy, or create a deployment.
3. Open **Settings → Environment Variables**. Filter/inspect `DATABASE_URL` by environment and record only its name, environment scope(s), Preview branch scope if shown, and whether Vercel identifies it as a linked integration variable. Do not reveal, copy, export, screenshot, pull, or print its value. Do not run `vercel env pull` or commands that retrieve values.
4. Check **Production**, **Preview**, and **Development** separately. Record whether the same variable name has separate entries or one entry shared across environments. Include any custom environment and branch-specific Preview override. A shared scope means target isolation is **not established**; a different secret value is not proven merely because entries look separate.
5. In project integrations/Marketplace resources, note any attached PostgreSQL provider resource, resource/project name, provider label, and the environments to which it is linked. Treat this only as supporting evidence; it does not prove the app’s `DATABASE_URL` uses that resource.
6. Ask the deployment owner who provisioned the Production connection to privately match the secret variable to the provider project/cluster and database. The owner should attest to the provider, provider project/resource ID, region, PostgreSQL major version, database name, non-secret role label, endpoint/project identity, and whether a pooled endpoint is used. The owner must not disclose the URI, username/password, query parameters, token, or a credential-bearing screenshot.
7. Have a second authorized reviewer compare that attestation with the selected provider project dashboard. Match the project/cluster ID and endpoint identity privately. For Supabase, compare the project reference and database endpoint; for Neon, compare project/branch and endpoint; for any other service, use its equivalent stable resource identity. Neither project name nor domain alone is sufficient.
8. Repeat the attestation separately for Preview and Development. Record target differences without copying credentials. If the owner cannot confidently distinguish a target, mark it **UNKNOWN** and do not initialize or use it for recovery.

Vercel’s current documentation describes projects as groupings of deployments, domains, settings and integrations, and distinguishes Production, Preview and Development variable scopes. Changes apply to new deployments; this review must not make changes or create one. See [Vercel projects](https://vercel.com/docs/projects), [environment variables](https://vercel.com/docs/environment-variables), [deployment environments](https://vercel.com/docs/deployments/environments), and [project settings](https://vercel.com/docs/project-configuration/project-settings).

## Evidence record template

| Field | Production | Preview | Development |
|---|---|---|---|
| Vercel project ID / team ID | | | |
| Deployment ID / branch / commit | | | |
| Domain or branch scope | | | |
| `DATABASE_URL` scope label only | | | |
| Provider and resource/project ID | | | |
| Region / PostgreSQL version | | | |
| Database name / non-secret role label | | | |
| Endpoint identity privately matched by | | | |
| Separate target confirmed by owner? | | | |
| Evidence timestamp and reviewer | | | |

Do not enter the actual URL or any credentials in this table. Transfer the completed metadata attestation with the owner-approved schema and migration evidence using an access-controlled channel. Provider acceptance remains blocked until Production mapping and environment separation are supported by owner evidence.
