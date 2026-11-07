# `eduledger-portals/` Git preservation audit

**Audit type:** Read-only Git/filesystem inspection. No files were staged, force-added, moved, deleted, or committed. `.gitignore` and Git repository structure were not changed.

## Repository tracking result

- Root `git rev-parse --show-toplevel` resolves to the EduLedger repository.
- `git ls-files -- eduledger-portals` returns no tracked paths.
- `git check-ignore -v` identifies the root `.gitignore` rule `eduledger-portals/` (line 32 in the reviewed working tree) as the ignore source.
- That rule is grouped under the comment `Local submodules and reports`.
- `eduledger-portals/.git` is absent; `git -C eduledger-portals rev-parse --show-toplevel` resolves back to the root repository. Root `.gitmodules` is absent.
- Therefore, this directory is **ignored, untracked workspace content**, not an independent Git repository or registered submodule. The exact historical intent for the ignore rule cannot be established from its comment alone.

## Phase 2.3.5 PostgreSQL cleanup present in workspace

The following files contain or document the Phase 2.3.5 portal changes:

| File | Audit result |
|---|---|
| `eduledger-portals/scripts/serve.mjs` | PostgreSQL `postgres.js` only; uses explicit `PORTAL_READONLY_DATABASE_URL`; requires `EDULEDGER_ENVIRONMENT=development`, a development-marked DB and a credential-free Production identity comparison; no `node:sqlite`, `DATABASE_URL` fallback, SQLite file fallback, or `.env.local` loader. Portal queries use a read-only transaction. |
| `eduledger-portals/README.md` | Documents the PostgreSQL-only target and startup gate, no primary `DATABASE_URL` fallback, no SQLite fallback, and retention of local `.db` files. |
| `eduledger-portals/package.json` | Standalone Node project configuration with `postgres` dependency and dev/test scripts; no SQLite package dependency. This does not establish a Git repository. |

These edits are present in the shared workspace. Since the directory is ignored and untracked, they are not preserved in root Git history or ordinary root commits. Do not rely on a root Git deployment carrying these files until the owner chooses an approved tracking strategy.

## Directory inventory and generated output

The directory contains 16 files at audit time: 5 project/source/documentation files and 11 files under `dist/`. The `dist/` files are generated static PWA output (HTML, JS, CSS, SVG and web manifests); they are not the PostgreSQL server source. Their generation provenance is not established here, and they were not modified.

The project has its own `package.json`, `scripts/serve.mjs`, test file and README, but no independent `.git`, `.gitmodules` entry, or package lockfile was found. It is configured as a standalone Node package within the root workspace, not a Git submodule. An exact SHA-256 comparison by basename against root `src/`, `public/`, `scripts/` and `tests/` files found no identical copies. This does not rule out similar product/UI behavior in the main EduLedger application.

## Secret-pattern review

A static pattern scan of readable portal source/docs/generated text looked for private-key headers, JWT-like strings, common GitHub/AWS/Stripe/Supabase token formats, long bearer tokens, and credential-bearing PostgreSQL URLs. It found no actual-looking match. No `.env*` or key files were present in this directory; the scan did not read any environment files. The README contains obvious placeholder connection examples (`READ_ONLY_USER`, `PASSWORD`, `HOST`), not actual credentials. Pattern scanning is not a guarantee that every sensitive object name or literal is absent; owner review remains required before public or Git tracking.

## Why the root ignore rule exists

The root `.gitignore` labels its relevant section `Local submodules and reports` and ignores the entire `eduledger-portals/` directory. The filesystem provides no nested Git metadata or `.gitmodules` record to support the submodule interpretation. No additional reliable evidence identifies who added the rule or why. Do not remove or narrow it without owner approval.

## Safe preservation options for owner decision

No option was applied. The owner can later approve one of these:

1. **Root tracking:** review all files, generated `dist/` policy, secret scan, build artifacts and licensing; then make a narrowly scoped ignore-rule/tracking proposal for review. Do not bulk-add the directory.
2. **Separate repository:** have the owner designate/create an approved repository, review the content transfer and remote access controls, then establish its independent Git history through an approved workflow.
3. **Formal submodule:** only if the owner designates a remote repository and accepts submodule/update/deployment semantics; this requires deliberate `.gitmodules` and root tracking changes.
4. **Remain local-only:** document that the portal is not preserved in root history and do not deploy or depend on a root Git checkout containing it.

Before any option is implemented, obtain explicit owner approval. This report authorizes no Git tracking change, ignore-rule edit, submodule creation, transfer, or deployment.
