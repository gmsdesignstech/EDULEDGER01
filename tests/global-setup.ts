import { assertTestPostgresTarget } from "../src/lib/postgres-target";

export default function setup() {
  if (process.env.DATABASE_URL) {
    throw new Error("Do not pass DATABASE_URL to the Vitest launcher. Configure only TEST_DATABASE_URL.");
  }
  const url = process.env.TEST_DATABASE_URL;
  const productionIdentity = process.env.TEST_DATABASE_PRODUCTION_IDENTITY;
  if (!url || !productionIdentity) {
    throw new Error("PostgreSQL integration tests require TEST_DATABASE_URL and TEST_DATABASE_PRODUCTION_IDENTITY.");
  }
  if (process.env.TEST_DATABASE_TARGET_CONFIRMED_DISPOSABLE !== "1") {
    throw new Error("Set TEST_DATABASE_TARGET_CONFIRMED_DISPOSABLE=1 only after confirming the isolated target is disposable.");
  }
  if (process.env.TEST_DATABASE_ALLOW_SCHEMA_INIT !== "1") {
    throw new Error("Set TEST_DATABASE_ALLOW_SCHEMA_INIT=1 only to authorize schema creation on the isolated test target.");
  }
  if (process.env.EDULEDGER_TEST_TARGET_ISOLATED !== "1") {
    throw new Error("Set EDULEDGER_TEST_TARGET_ISOLATED=1 only after verifying the test target is isolated.");
  }
  assertTestPostgresTarget(url, productionIdentity);
}
