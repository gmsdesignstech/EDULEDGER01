# PostgreSQL environment separation

## Development

The root `dev` and `dev:next` scripts both use `scripts/dev.mjs`. It requires:

- `EDULEDGER_ENVIRONMENT=development`;
- `EDULEDGER_DEV_DATABASE_URL`, using PostgreSQL and a database name containing a `dev` marker;
- `EDULEDGER_PRODUCTION_DATABASE_IDENTITY`, a credential-free PostgreSQL identity distinct from the development target.

The launcher sets the application's in-memory `DATABASE_URL` from `EDULEDGER_DEV_DATABASE_URL`; it does not select a preexisting generic `DATABASE_URL`. `.env.local` may be loaded by the root launcher, but its values are never printed. Missing or unsafe target configuration stops startup before Next.js starts.

Schema initialization is disabled by default. `EDULEDGER_ALLOW_SCHEMA_INITIALIZATION=1` is a future explicit opt-in and must not be set until owner evidence is verified and the target is confirmed as an isolated development database. The sample value is `0`.

## Tests

Vitest uses only `TEST_DATABASE_URL`, which must be a marked test database and distinct from `TEST_DATABASE_PRODUCTION_IDENTITY`. The launcher rejects a shell-provided generic `DATABASE_URL`; worker configuration maps the explicit test URL into runtime `DATABASE_URL`. Disposable, isolation, and schema-init opt-ins are required. See `POSTGRESQL_TEST_ARCHITECTURE.md`.

## Production

Production continues to receive its PostgreSQL `DATABASE_URL` from the deployment secret manager. Do not copy it to developer machines, tests, or Preview. Provider identity remains unconfirmed until the owner completes the Phase 2.3.4 deployment-to-database evidence chain.

## Standalone portal server

`eduledger-portals/scripts/serve.mjs` reads only `PORTAL_READONLY_DATABASE_URL` and `EDULEDGER_PRODUCTION_DATABASE_IDENTITY`; it does not load `.env.local` and does not fall back to `DATABASE_URL` or local files. It requires a development-marked PostgreSQL target distinct from production and runs dashboard queries in read-only transactions. Supply configuration through an approved local secret store or shell without printing connection values.
