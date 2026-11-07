# SQLite removal report — Phase 2.3.5

## Active paths removed

| Location | Removed behavior |
|---|---|
| `src/lib/db.ts` | Node SQLite adapter, local file creation, PRAGMA setup, SQLite SQL rewriting/bindings, and SQLite-only schema rebuild branches. |
| `scripts/dev.mjs` | Embedded PostgreSQL auto-provisioning, database creation, fallback to SQLite, and automatic selection of an arbitrary `DATABASE_URL`. |
| `vitest.config.mts`, `tests/global-setup.ts` | SQLite test path and automatic deletion of database/WAL/SHM files. Setup now validates a separately designated PostgreSQL test target without connecting. |
| `eduledger-portals/scripts/serve.mjs` | SQLite read-only file fallback and fallback to the primary application's generic `DATABASE_URL`. |
| `src/lib/server-errors.ts` and tests | SQLite error classification and SQLite-specific test naming. |

`pg-embedded` was removed because the development launcher no longer starts an embedded server. The application and portal use `postgres` (`postgres.js`) for PostgreSQL access.

## Preserved items

- All 38 historical PostgreSQL migration SQL files were preserved.
- Existing `.db`, `-wal`, and `-shm` files under `data/` were preserved and not opened, inspected for contents, modified, or deleted. File names and sizes were read only to verify retention requirements.
- Historical audit/report text that describes prior SQLite behavior remains historical evidence; it is not executable configuration.
- `.env.local` was not modified or printed.

## Current result and limitation

Static source search found no active SQLite execution path in application runtime, test setup, launch scripts, or the standalone portal service. This verifies source removal only; it does not verify PostgreSQL schema compatibility. The owner-verified deployed schema and applied migration history remain unavailable. Do not initialize a database until the Phase 2.3.4 evidence gate is satisfied.
