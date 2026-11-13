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

export function classifyDatabaseConfiguration(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      status: "MISSING_CONFIGURATION",
      exitCode: 2,
      description: "DATABASE_URL is not set in environment or configuration files (.env.local / .env).",
    };
  }

  const trimmed = rawUrl.trim();
  if (!/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    return {
      status: "INVALID_URL",
      exitCode: 2,
      description: `DATABASE_URL must start with postgres:// or postgresql:// (received prefix: ${trimmed.slice(0, 15)}...).`,
    };
  }

  try {
    const parsed = new URL(trimmed);
    const host = (parsed.hostname || "").toLowerCase();
    if (!host || host === "host" || host === "placeholder" || host === "localhost.invalid" || host === "prod_host") {
      return {
        status: "PLACEHOLDER_CONFIGURATION",
        exitCode: 2,
        description: `DATABASE_URL points to a template placeholder host ('${host}'). Real database credentials must be provided.`,
      };
    }

    return {
      status: "CONFIGURED",
      exitCode: 0,
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, ""),
      user: parsed.username || "postgres",
    };
  } catch (err) {
    return {
      status: "INVALID_URL",
      exitCode: 2,
      description: `Failed to parse DATABASE_URL as a valid URI: ${err.message}`,
    };
  }
}

export function classifyDatabaseError(err) {
  const msg = err?.message || "";
  const code = err?.code || "";

  // 1. DNS Failure
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || /getaddrinfo ENOTFOUND/i.test(msg)) {
    return {
      category: "DNS_FAILURE",
      exitCode: 1,
      title: "DNS Resolution Failure",
      remediation: "The database host could not be resolved. Verify the hostname or network connection.",
    };
  }

  // 2. Connection Refused
  if (code === "ECONNREFUSED" || /ECONNREFUSED/i.test(msg)) {
    return {
      category: "CONNECTION_REFUSED",
      exitCode: 1,
      title: "Connection Refused",
      remediation: "The database server is not reachable on the specified port. Check if PostgreSQL is running and port is open.",
    };
  }

  // 3. TLS / SSL Failure
  if (
    code === "CERT_HAS_EXPIRED" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    /ssl|tls|certificate|handshake/i.test(msg)
  ) {
    return {
      category: "TLS_FAILURE",
      exitCode: 1,
      title: "TLS / SSL Negotiation Failure",
      remediation: "SSL negotiation failed. Check whether your PostgreSQL provider requires sslmode=require or custom CA certs.",
    };
  }

  // 4. Authentication Failure
  if (code === "28P01" || code === "28000" || /password authentication failed|no pg_hba.conf entry/i.test(msg)) {
    return {
      category: "AUTHENTICATION_FAILURE",
      exitCode: 1,
      title: "Authentication Failure",
      remediation: "The database rejected the username or password. Verify the credentials in your connection string.",
    };
  }

  // 5. Database Not Found
  if (code === "3D000" || (/database/i.test(msg) && /does not exist/i.test(msg))) {
    return {
      category: "DATABASE_NOT_FOUND",
      exitCode: 1,
      title: "Database Not Found",
      remediation: "The target database name does not exist on the PostgreSQL cluster. Verify the database path name in the URL.",
    };
  }

  // 6. Generic Query / Execution Failure
  return {
    category: "QUERY_FAILURE",
    exitCode: 1,
    title: "Database Operation / Query Failure",
    remediation: `PostgreSQL returned an operational error: ${msg}`,
  };
}

async function runCheck() {
  console.log("================================================================================");
  console.log("  EDULEDGER DATABASE READ-ONLY HEALTH CHECK & READINESS AUDIT");
  console.log("================================================================================");

  const rawUrl =
    loadEnvValue("DATABASE_URL") ||
    loadEnvValue("POSTGRES_URL") ||
    loadEnvValue("PORTAL_READONLY_DATABASE_URL");

  const config = classifyDatabaseConfiguration(rawUrl);

  if (config.exitCode !== 0) {
    console.error(`\n[DIAGNOSTIC STATUS] ${config.status} (Exit Code: ${config.exitCode})`);
    console.error(`Description: ${config.description}\n`);
    console.error("Action Required:");
    console.error("  To connect EduLedger to a live database (Supabase, Neon, Railway, AWS RDS),");
    console.error("  configure DATABASE_URL in .env.local:");
    console.error("    DATABASE_URL=\"postgresql://postgres:[PASSWORD]@[HOST]:5432/[DB]?sslmode=require\"");
    console.error("================================================================================");
    process.exit(config.exitCode);
  }

  console.log(`Target Host    : ${config.host}`);
  console.log(`Target Port    : ${config.port}`);
  console.log(`Target Database: ${config.database}`);
  console.log(`Database User  : ${config.user}`);
  console.log("Connecting (read-only, 5s timeout, SSL enforced)...");

  const sql = postgres(rawUrl, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 3,
    ssl: config.host === "localhost" || config.host === "127.0.0.1" ? false : "require",
  });

  try {
    const [dbInfo] = await sql`
      SELECT 
        version() AS version, 
        current_database() AS db_name, 
        current_user AS db_user,
        inet_server_addr()::text AS server_ip;
    `;

    console.log("\n[PASS] Connection established successfully!");
    console.log(`[INFO] Server Version: ${dbInfo.version.split("\n")[0]}`);
    console.log(`[INFO] Connected User : ${dbInfo.db_user} on database ${dbInfo.db_name}`);

    // Audit tables
    console.log("\nAuditing Public Schema Tables:");
    const expectedTables = [
      { name: "institutions", category: "Core School Isolation" },
      { name: "users", category: "Authentication & Roles" },
      { name: "students", category: "Student Records" },
      { name: "whatsapp_configurations", category: "WhatsApp Integration" },
      { name: "whatsapp_templates", category: "WhatsApp Integration" },
      { name: "whatsapp_messages", category: "WhatsApp Integration" },
      { name: "whatsapp_addon_subscriptions", category: "WhatsApp Addon Billing" },
      { name: "whatsapp_webhook_events", category: "WhatsApp Production Hardening" },
      { name: "whatsapp_consent_events", category: "WhatsApp Production Hardening" },
      { name: "whatsapp_campaigns", category: "WhatsApp Production Hardening" },
      { name: "whatsapp_worker_heartbeats", category: "Background Worker Infrastructure" },
    ];

    const rows = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    const presentTableNames = new Set(rows.map((r) => r.table_name));

    let allWhatsAppPresent = true;
    for (const exp of expectedTables) {
      const isPresent = presentTableNames.has(exp.name);
      if (!isPresent && exp.category.includes("WhatsApp")) {
        allWhatsAppPresent = false;
      }
      console.log(`  ${isPresent ? "[OK]     " : "[MISSING]"} ${exp.name.padEnd(30)} (${exp.category})`);
    }

    if (!allWhatsAppPresent) {
      console.log("\n[WARNING] Some WhatsApp tables are missing.");
      console.log("Run `npm run db:migrate:whatsapp` to create missing tables and indexes.");
    } else {
      console.log("\n[PASS] All core and WhatsApp tables exist.");

      // Check Queue Depth and Worker Heartbeat
      const [queueStats] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'Queued') AS queued_count,
          COUNT(*) FILTER (WHERE status = 'Processing' OR status = 'Sending') AS processing_count,
          COUNT(*) FILTER (WHERE status = 'Sent') AS sent_count,
          COUNT(*) FILTER (WHERE status = 'Delivered') AS delivered_count,
          COUNT(*) FILTER (WHERE status = 'Read') AS read_count,
          COUNT(*) FILTER (WHERE status = 'Failed') AS failed_count
        FROM whatsapp_messages;
      `;

      console.log("\nWhatsApp Queue Telemetry:");
      console.log(`  - Queued     : ${queueStats.queued_count}`);
      console.log(`  - Processing : ${queueStats.processing_count}`);
      console.log(`  - Sent       : ${queueStats.sent_count}`);
      console.log(`  - Delivered  : ${queueStats.delivered_count}`);
      console.log(`  - Read       : ${queueStats.read_count}`);
      console.log(`  - Failed     : ${queueStats.failed_count}`);

      const recentWorkers = await sql`
        SELECT worker_id, hostname, pid, last_heartbeat_at, processed_count, status
        FROM whatsapp_worker_heartbeats
        WHERE last_heartbeat_at > NOW() - INTERVAL '5 minutes'
        ORDER BY last_heartbeat_at DESC;
      `;

      console.log("\nActive Worker Heartbeats (last 5 min):");
      if (recentWorkers.length === 0) {
        console.log("  No active workers detected within the last 5 minutes.");
        console.log("  (Start a worker with `npm run worker:whatsapp` or deploy with PM2/Docker)");
      } else {
        for (const w of recentWorkers) {
          console.log(`  - Worker: ${w.worker_id} (${w.hostname}:${w.pid}) status=${w.status} processed=${w.processed_count} last_beat=${w.last_heartbeat_at.toISOString()}`);
        }
      }
    }

    console.log("================================================================================");
    console.log("  DATABASE READINESS AUDIT COMPLETE: PASS (Exit Code: 0)");
    console.log("================================================================================");
    process.exit(0);
  } catch (err) {
    const errorClassification = classifyDatabaseError(err);
    console.error(`\n❌ [OPERATIONAL ERROR] ${errorClassification.title} (${errorClassification.category})`);
    console.error(`Details: ${err.message}`);
    console.error(`Remediation: ${errorClassification.remediation}`);
    console.log("================================================================================");
    process.exit(errorClassification.exitCode);
  } finally {
    await sql.end({ timeout: 3 });
  }
}

// Only run immediately if invoked as main module
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  runCheck();
}
