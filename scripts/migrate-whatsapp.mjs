import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

function loadEnvValue(key) {
  if (process.env[key]?.trim()) return process.env[key].trim();
  for (const envFile of [".env.local", ".env"]) {
    if (existsSync(envFile)) {
      try {
        const content = readFileSync(envFile, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const k = trimmed.substring(0, eq).trim();
          if (k === key) {
            const val = trimmed.substring(eq + 1).trim().replace(/^['"]|['"]$/g, "");
            if (val) return val;
          }
        }
      } catch {
        // ignore read error
      }
    }
  }
  return "";
}

function validateDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    return {
      valid: false,
      reason: "DATABASE_URL is not set in environment or .env.local",
    };
  }
  if (!/^postgres(?:ql)?:\/\//i.test(rawUrl)) {
    return {
      valid: false,
      reason: "DATABASE_URL must be a valid postgres:// or postgresql:// connection URL",
    };
  }
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "host" || host === "placeholder" || host === "localhost.invalid") {
      return {
        valid: false,
        reason: `DATABASE_URL host is a placeholder (${parsed.hostname}). Set a live PostgreSQL connection URL in .env.local.`,
      };
    }
    return { valid: true, host: parsed.hostname, port: parsed.port || 5432, dbname: parsed.pathname.replace(/^\//, "") };
  } catch (err) {
    return { valid: false, reason: `Failed to parse DATABASE_URL: ${err.message}` };
  }
}

const rawUrl = loadEnvValue("MIGRATION_DATABASE_URL") || loadEnvValue("DATABASE_URL") || loadEnvValue("POSTGRES_URL");
const validation = validateDatabaseUrl(rawUrl);

if (!validation.valid) {
  console.error("================================================================================");
  console.error("  EDULEDGER WHATSAPP MIGRATION: CONFIGURATION ERROR");
  console.error("================================================================================");
  console.error(`  ${validation.reason}`);
  console.error("");
  console.error("  To execute migrations against a real PostgreSQL database, provide a live");
  console.error("  connection string in .env.local:");
  console.error("    DATABASE_URL=\"postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DB]?sslmode=require\"");
  console.error("================================================================================");
  process.exit(2);
}

const isDryRun = process.argv.includes("--dry-run") || process.argv.includes("--check");

console.log("================================================================================");
console.log("  EDULEDGER WHATSAPP DATABASE MIGRATION RUNNER");
console.log("================================================================================");
console.log(`  Target Host    : ${validation.host}`);
console.log(`  Target Database: ${validation.dbname || "default"}`);
console.log(`  Execution Mode : ${isDryRun ? "DRY-RUN / VERIFY ONLY" : "APPLY MIGRATIONS"}`);
console.log("================================================================================");

const migrationFiles = [
  {
    name: "202609210001_whatsapp_integration",
    path: "../prisma/migrations/202609210001_whatsapp_integration/migration.sql",
    description: "Core WhatsApp tables (whatsapp_configurations, whatsapp_templates, whatsapp_messages) and student WhatsApp preference columns",
  },
  {
    name: "202610140001_whatsapp_addon_billing",
    path: "../prisma/migrations/202610140001_whatsapp_addon_billing/migration.sql",
    description: "WhatsApp add-on billing ledger (whatsapp_addon_subscriptions) and RLS policies",
  },
  {
    name: "202610150001_whatsapp_production_hardening",
    path: "../prisma/migrations/202610150001_whatsapp_production_hardening/migration.sql",
    description: "Production hardening: atomic leases, consent events, webhook deduplication, campaign batches",
  },
];

const heartbeatTableSql = `
CREATE TABLE IF NOT EXISTS whatsapp_worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  pid INTEGER NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RUNNING'
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_worker_heartbeats_last_beat ON whatsapp_worker_heartbeats(last_heartbeat_at DESC);
`;

const sql = postgres(rawUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 5,
  ssl: "require",
});

try {
  // Test connection
  const [version] = await sql`SELECT version() AS db_version, current_database() AS current_db`;
  console.log(`[PASS] Connected successfully to database: ${version.current_db}`);
  console.log(`[INFO] Server version: ${version.db_version.split("\n")[0]}`);

  if (isDryRun) {
    console.log("\nChecking existing WhatsApp tables...");
    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'whatsapp_configurations', 
          'whatsapp_templates', 
          'whatsapp_messages', 
          'whatsapp_addon_subscriptions', 
          'whatsapp_webhook_events', 
          'whatsapp_consent_events', 
          'whatsapp_campaigns', 
          'whatsapp_worker_heartbeats'
        )
      ORDER BY table_name;
    `;
    const found = existingTables.map((r) => r.table_name);
    console.log(`Found ${found.length}/8 WhatsApp tables in database:`);
    for (const t of found) {
      console.log(`  - [PRESENT] ${t}`);
    }
    const allExpected = [
      "whatsapp_configurations",
      "whatsapp_templates",
      "whatsapp_messages",
      "whatsapp_addon_subscriptions",
      "whatsapp_webhook_events",
      "whatsapp_consent_events",
      "whatsapp_campaigns",
      "whatsapp_worker_heartbeats",
    ];
    const missing = allExpected.filter((t) => !found.includes(t));
    if (missing.length > 0) {
      console.log(`Missing ${missing.length} table(s):`);
      for (const t of missing) {
        console.log(`  - [MISSING] ${t}`);
      }
      console.log("\nRun `npm run migrate:whatsapp` to apply all migrations.");
    } else {
      console.log("\n[PASS] All WhatsApp tables are present in the database.");
    }
    process.exit(0);
  }

  // Execute migrations sequentially in a single transaction
  console.log("\nExecuting migrations sequentially...");
  await sql.begin(async (tx) => {
    for (const mig of migrationFiles) {
      console.log(`Applying migration: ${mig.name}`);
      console.log(`  -> ${mig.description}`);
      const sqlContent = await readFile(new URL(mig.path, import.meta.url), "utf8");
      await tx.unsafe(sqlContent);
      console.log(`  [OK] Applied ${mig.name}`);
    }

    console.log("Applying whatsapp_worker_heartbeats table definition...");
    await tx.unsafe(heartbeatTableSql);
    console.log("  [OK] whatsapp_worker_heartbeats applied.");
  });

  console.log("\n================================================================================");
  console.log("  [SUCCESS] All WhatsApp database migrations applied successfully.");
  console.log("================================================================================");
  process.exit(0);
} catch (err) {
  console.error("\n================================================================================");
  console.error("  [ERROR] WhatsApp migration failed:");
  console.error(`  ${err.message}`);
  console.error("================================================================================");
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
