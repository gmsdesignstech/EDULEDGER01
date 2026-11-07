import { spawn } from "node:child_process";
import process from "node:process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment may be supplied by the shell or an approved secret manager.
}

const databaseUrl = process.env.EDULEDGER_DEV_DATABASE_URL;
const productionIdentity = process.env.EDULEDGER_PRODUCTION_DATABASE_IDENTITY;
if (process.env.EDULEDGER_ENVIRONMENT !== "development" || !databaseUrl || !productionIdentity) {
  console.error("EduLedger development requires EDULEDGER_ENVIRONMENT=development, EDULEDGER_DEV_DATABASE_URL, and a credential-free EDULEDGER_PRODUCTION_DATABASE_IDENTITY.");
  process.exit(1);
}

function target(value, credentialFree = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Database target is not a valid PostgreSQL URL or identity."); }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("EduLedger development requires PostgreSQL.");
  if (credentialFree && (url.username || url.password)) throw new Error("Production identity must not contain credentials.");
  const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  if (!url.hostname || !database || database.includes("/")) throw new Error("Database target must include a host and database name.");
  return { host: url.hostname.toLowerCase(), port: url.port || "5432", database };
}

try {
  const dev = target(databaseUrl);
  const production = target(productionIdentity, true);
  if (!/(^|[-_])dev(elopment)?($|[-_])/.test(dev.database)) throw new Error("Development database name must contain a dev marker.");
  if (dev.host === production.host && dev.port === production.port && dev.database === production.database) throw new Error("Development database matches the configured production identity.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Development database target failed validation.");
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], { env: process.env, stdio: "inherit", windowsHide: true });
next.on("exit", (code) => process.exit(code ?? 1));
next.on("error", () => {
  console.error("Could not start the Next.js development server.");
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
