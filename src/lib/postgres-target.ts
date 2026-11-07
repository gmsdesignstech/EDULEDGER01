export type Target = { host: string; port: string; database: string };

export function parseTarget(value: string, credentialFree = false): Target {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Database target is not a valid PostgreSQL URL or identity.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    throw new Error("EduLedger requires a PostgreSQL connection URL.");
  if (credentialFree && (url.username || url.password))
    throw new Error("Database identity must not contain credentials.");
  const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  if (!url.hostname || !database || database.includes("/"))
    throw new Error("Database identity must include a host and database name.");
  return { host: url.hostname.toLowerCase(), port: url.port || "5432", database };
}

export function sameTarget(left: Target, right: Target): boolean {
  return left.host === right.host && left.port === right.port && left.database === right.database;
}

export function assertPreviewPostgresTarget(url: string, productionIdentity: string) {
  const target = parseTarget(url);
  const production = parseTarget(productionIdentity, true);
  if (sameTarget(target, production))
    throw new Error("Preview PostgreSQL target matches the configured production identity. Preview must use an isolated database.");
}

export function assertDevelopmentPostgresTarget(url: string, productionIdentity: string) {
  const target = parseTarget(url);
  const production = parseTarget(productionIdentity, true);
  if (!/(^|[-_])dev(elopment)?($|[-_])/.test(target.database))
    throw new Error("Development PostgreSQL database name must contain a dev marker.");
  if (sameTarget(target, production))
    throw new Error("Development PostgreSQL target matches the configured production identity.");
}

export function assertTestPostgresTarget(url: string, productionIdentity: string) {
  const target = parseTarget(url);
  const production = parseTarget(productionIdentity, true);
  if (!/(^|[-_])test($|[-_])/.test(target.database))
    throw new Error("Test PostgreSQL database name must contain a test marker.");
  if (sameTarget(target, production))
    throw new Error("Test PostgreSQL target matches the configured production identity.");
}

export function assertRuntimePostgresTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required; no local database fallback exists.");
  if (process.env.NODE_ENV === "development" && process.env.EDULEDGER_ENVIRONMENT !== "development")
    throw new Error("Development must be launched with the explicit EduLedger development environment configuration.");
  if (process.env.NODE_ENV === "test" && process.env.EDULEDGER_ENVIRONMENT !== "test")
    throw new Error("Tests must be launched through the guarded PostgreSQL test configuration.");
  if (process.env.EDULEDGER_ENVIRONMENT === "development") {
    const explicit = process.env.EDULEDGER_DEV_DATABASE_URL;
    const production = process.env.EDULEDGER_PRODUCTION_DATABASE_IDENTITY;
    if (!explicit || url !== explicit || !production)
      throw new Error("Development requires an explicitly configured, production-distinct PostgreSQL target.");
    assertDevelopmentPostgresTarget(url, production);
  }
  if (process.env.EDULEDGER_ENVIRONMENT === "test") {
    const explicit = process.env.TEST_DATABASE_URL;
    const production = process.env.TEST_DATABASE_PRODUCTION_IDENTITY;
    if (!explicit || url !== explicit || !production)
      throw new Error("Tests require an explicitly configured, production-distinct PostgreSQL target.");
    if (process.env.TEST_DATABASE_TARGET_CONFIRMED_DISPOSABLE !== "1" || process.env.TEST_DATABASE_ALLOW_SCHEMA_INIT !== "1" || process.env.EDULEDGER_TEST_TARGET_ISOLATED !== "1")
      throw new Error("Tests require explicit disposable-target, schema-initialization, and isolation confirmations.");
    assertTestPostgresTarget(url, production);
  }
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.EDULEDGER_ENVIRONMENT === "preview";
  if (isPreview) {
    const production = process.env.EDULEDGER_PRODUCTION_DATABASE_IDENTITY;
    if (production) {
      assertPreviewPostgresTarget(url, production);
    }
  }
  parseTarget(url);
}
