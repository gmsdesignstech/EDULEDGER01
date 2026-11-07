# PostgreSQL test architecture

## Target requirements

Vitest integration tests may run only against a separately provisioned PostgreSQL database that:

- is named with a `test` marker;
- is distinct from the credential-free production identity;
- the owner has confirmed is isolated and disposable;
- is authorized for schema initialization and test writes;
- is not the development database or a shared staging/production database.

Required shell/secret-store variables:

```text
TEST_DATABASE_URL=postgresql://.../eduledger-test
TEST_DATABASE_PRODUCTION_IDENTITY=postgresql://HOST:5432/PRODUCTION_DATABASE
TEST_DATABASE_TARGET_CONFIRMED_DISPOSABLE=1
TEST_DATABASE_ALLOW_SCHEMA_INIT=1
EDULEDGER_TEST_TARGET_ISOLATED=1
```

The production identity must contain only a PostgreSQL scheme, host, port, and database name; it must not contain a username or password. Do not place these test variables in a shared environment file or copy Production credentials into the test environment.

## Guard behavior

`tests/global-setup.ts` validates the target configuration and exits before tests if any required evidence/opt-in is missing. It refuses an inherited shell `DATABASE_URL`. It does not open a connection, query the server, create/drop a database, create a schema, or delete files. The Vitest worker receives `DATABASE_URL` only from `TEST_DATABASE_URL`. Runtime target checks independently verify PostgreSQL URL syntax, the test-name marker, production identity difference, and required opt-ins.

The existing WhatsApp concurrency suite has a separate guarded PostgreSQL target and explicit schema create/drop behavior. Do not enable that suite until its own target and disposable-target confirmations have been reviewed. No tests were executed for Phase 2.3.5.

## Before enabling tests

1. Obtain owner-verified schema and migration-history evidence as described in `PHASE_2_3_4_OWNER_EVIDENCE_GUIDE.md`.
2. Have the database owner provision or designate a dedicated disposable test target; this repository phase does not create one.
3. Confirm the database identity without sharing connection credentials and verify it differs from Production.
4. Obtain explicit owner authorization before setting the disposable-target, isolation, and schema-init flags.
5. Review each integration test for fixture scope and cleanup behavior before running it.

The test harness never cleans or resets the whole database. Test-level cleanup must be scoped to objects created by that test, and a failed suite must not prompt a broad database reset.
