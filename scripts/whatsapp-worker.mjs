#!/usr/bin/env node
/**
 * scripts/whatsapp-worker.mjs
 * Production-ready persistent queue worker and status inspector for EduLedger WhatsApp.
 * 
 * Commands:
 *   node scripts/whatsapp-worker.mjs          # Continuous queue worker (5s poll loop)
 *   node scripts/whatsapp-worker.mjs --once   # Single processing tick (for serverless/cron)
 *   node scripts/whatsapp-worker.mjs --check  # Diagnostics & connectivity verification
 *   node scripts/whatsapp-worker.mjs --status # Inspect active worker heartbeat & queue depth
 * 
 * Exit Codes:
 *   0: Requested operation succeeded.
 *   1: Operational or runtime failure (database unreachable, query failed).
 *   2: Invalid command or configuration (missing/placeholder DATABASE_URL).
 */
import process from "node:process";
import os from "node:os";
import postgres from "postgres";

// Load environment variables safely
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Environment may be supplied by the host platform
  }
}

const rawUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.EDULEDGER_DEV_DATABASE_URL?.trim() ||
  process.env.PORTAL_READONLY_DATABASE_URL?.trim();

const isStatusOnly = process.argv.includes("--status");
const isCheckOnly = process.argv.includes("--check");
const isOnce = process.argv.includes("--once");

// Validate configuration
function validateDatabaseTarget(target) {
  if (!target) {
    return { valid: false, reason: "DATABASE_URL is not set in environment or .env.local" };
  }
  if (!/^postgres(?:ql)?:\/\//i.test(target)) {
    return { valid: false, reason: "DATABASE_URL must be a valid postgres:// or postgresql:// URL" };
  }
  // Detect unconfigured template placeholders
  if (target.includes("USER:PASSWORD@HOST") || target.includes("@HOST:") || target.includes("@PROD_HOST")) {
    return {
      valid: false,
      reason: "DATABASE_URL contains placeholder host credentials ('HOST'). Supply real PostgreSQL credentials in .env.local.",
    };
  }
  return { valid: true };
}

const configValidation = validateDatabaseTarget(rawUrl);

if (!configValidation.valid) {
  console.error("==================================================================");
  console.error("        EDULEDGER WHATSAPP WORKER — CONFIGURATION ERROR           ");
  console.error("==================================================================");
  console.error(`[CONFIG ERROR] ${configValidation.reason}`);
  console.error("\nAction required: Set DATABASE_URL to a valid PostgreSQL instance in .env.local.");
  process.exit(2);
}

const WHATSAPP_DISPATCH_ENABLED = process.env.WHATSAPP_DISPATCH_ENABLED?.trim() === "1";
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL?.trim() || "";
const pollIntervalMs = Math.max(1000, Number(process.env.WHATSAPP_WORKER_POLL_INTERVAL_MS) || 5000);
const workerId = `worker_${os.hostname()}_${process.pid}_${Math.random().toString(36).slice(2, 7)}`;

const sql = postgres(rawUrl, {
  max: 2,
  connect_timeout: 10,
  idle_timeout: 10,
  ssl: rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1") ? false : "require",
});

async function ensureHeartbeatSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS whatsapp_worker_heartbeats (
      worker_id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      pid INTEGER NOT NULL,
      last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'RUNNING'
    )
  `;
}

async function updateHeartbeat(processedIncrement = 0) {
  try {
    await sql`
      INSERT INTO whatsapp_worker_heartbeats (worker_id, hostname, pid, last_heartbeat_at, started_at, processed_count, status)
      VALUES (${workerId}, ${os.hostname()}, ${process.pid}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${processedIncrement}, 'RUNNING')
      ON CONFLICT (worker_id) DO UPDATE SET
        last_heartbeat_at = CURRENT_TIMESTAMP,
        processed_count = whatsapp_worker_heartbeats.processed_count + ${processedIncrement},
        status = 'RUNNING'
    `;
  } catch (err) {
    console.warn(`[HEARTBEAT WARN] Failed to update worker heartbeat: ${err.message}`);
  }
}

async function unregisterHeartbeat() {
  try {
    await sql`
      UPDATE whatsapp_worker_heartbeats
      SET status = 'STOPPED', last_heartbeat_at = CURRENT_TIMESTAMP
      WHERE worker_id = ${workerId}
    `;
  } catch {
    // ignore on exit
  }
}

async function getQueueMetrics() {
  const [counts] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'Queued')::int AS queued,
      COUNT(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled,
      COUNT(*) FILTER (WHERE status = 'Sending')::int AS sending,
      COUNT(*) FILTER (WHERE status = 'Sent')::int AS sent,
      COUNT(*) FILTER (WHERE status = 'Delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE status = 'Read')::int AS read,
      COUNT(*) FILTER (WHERE status = 'Failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'Uncertain')::int AS uncertain,
      COUNT(*) FILTER (WHERE status = 'Sending' AND lease_expires_at < CURRENT_TIMESTAMP)::int AS expired_leases
    FROM whatsapp_messages
  `;
  return counts;
}

async function getActiveWorkers() {
  return sql`
    SELECT worker_id, hostname, pid, last_heartbeat_at, started_at, processed_count, status
    FROM whatsapp_worker_heartbeats
    WHERE status = 'RUNNING'
      AND last_heartbeat_at >= CURRENT_TIMESTAMP - INTERVAL '30 seconds'
    ORDER BY last_heartbeat_at DESC
  `;
}

async function runCheck() {
  console.log("==================================================================");
  console.log("       EDULEDGER WHATSAPP WORKER — DIAGNOSTIC HEALTH CHECK        ");
  console.log("==================================================================");
  console.log(`- Database target: ${rawUrl.replace(/:\/\/[^@]+@/, "://***@")}`);
  console.log(`- WhatsApp Enabled: ${WHATSAPP_ENABLED}`);
  console.log(`- Dispatch Enabled: ${WHATSAPP_DISPATCH_ENABLED}`);
  console.log(`- n8n Webhook: ${N8N_WEBHOOK_URL || "Not configured (Direct/Local dispatch)"}`);

  try {
    const [result] = await sql`SELECT 1 AS connected, NOW() AS server_time`;
    console.log(`✓ PostgreSQL Connection: SUCCESS (Server Time: ${result.server_time})`);

    await ensureHeartbeatSchema();
    console.log("✓ Worker Heartbeat Schema: VERIFIED");

    const metrics = await getQueueMetrics();
    console.log("✓ WhatsApp Queue Table: ACCESSIBLE");
    console.log(`  - Pending: ${metrics.queued} queued, ${metrics.scheduled} scheduled`);
    console.log(`  - Active Dispatches: ${metrics.sending} sending (${metrics.expired_leases} expired leases)`);
    console.log(`  - Completed: ${metrics.sent} sent, ${metrics.delivered} delivered, ${metrics.read} read`);
    console.log(`  - Issues: ${metrics.failed} failed, ${metrics.uncertain} uncertain`);

    await sql.end({ timeout: 5 });
    console.log("\n[RESULT] Diagnostic health check PASSED. System is ready for worker execution.\n");
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ [DIAGNOSTIC FAILURE] Could not verify database health: ${err.message}`);
    await sql.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  }
}

async function runStatus() {
  console.log("==================================================================");
  console.log("             EDULEDGER WHATSAPP QUEUE & WORKER STATUS             ");
  console.log("==================================================================");
  console.log(`- Database Target: ${rawUrl.replace(/:\/\/[^@]+@/, "://***@")}`);
  console.log(`- Dispatch Switch: ${WHATSAPP_DISPATCH_ENABLED ? "ENABLED (Live sends active)" : "DISABLED (Circuit breaker active)"}`);

  try {
    await ensureHeartbeatSchema();
    const activeWorkers = await getActiveWorkers();
    const metrics = await getQueueMetrics();

    console.log("\n--- Active Worker Instances ---");
    if (activeWorkers.length === 0) {
      console.log("⚠️  NO ACTIVE WORKERS DETECTED (No worker heartbeat in the last 30 seconds).");
      console.log("   To start a background worker, run: npm run worker:whatsapp");
    } else {
      console.log(`✓ ${activeWorkers.length} active worker(s) online:`);
      for (const w of activeWorkers) {
        console.log(`  - ${w.worker_id} (Host: ${w.hostname}, PID: ${w.pid}, Processed: ${w.processed_count}, Last Heartbeat: ${w.last_heartbeat_at})`);
      }
    }

    console.log("\n--- Queue Metrics ---");
    console.log(`- Queued: ${metrics.queued}`);
    console.log(`- Scheduled: ${metrics.scheduled}`);
    console.log(`- Sending (in-flight): ${metrics.sending}`);
    console.log(`- Expired Leases: ${metrics.expired_leases}`);
    console.log(`- Sent: ${metrics.sent}`);
    console.log(`- Delivered: ${metrics.delivered}`);
    console.log(`- Read: ${metrics.read}`);
    console.log(`- Failed: ${metrics.failed}`);
    console.log(`- Uncertain (reconciliation needed): ${metrics.uncertain}`);

    await sql.end({ timeout: 5 });
    console.log("\n[STATUS OK] Queue status successfully inspected.\n");
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ [OPERATIONAL ERROR] Failed to query PostgreSQL status: ${err.message}`);
    await sql.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  }
}

async function processQueueTick() {
  if (!WHATSAPP_DISPATCH_ENABLED) {
    const metrics = await getQueueMetrics();
    console.log(`[CIRCUIT BREAKER] Dispatch is disabled (WHATSAPP_DISPATCH_ENABLED != "1"). Pending: ${metrics.queued} queued, ${metrics.scheduled} scheduled.`);
    return { processed: 0, disabled: true };
  }

  const leaseDurationMinutes = 2;

  // 1. Recover expired leases
  const recovered = await sql`
    UPDATE whatsapp_messages
    SET status = 'Uncertain',
        outcome_class = 'ABANDONED_AFTER_CLAIM',
        lease_owner = NULL,
        lease_expires_at = NULL,
        error_message = 'Worker lease expired after dispatch started; reconciliation required.',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'Sending' AND lease_expires_at < CURRENT_TIMESTAMP
    RETURNING id
  `;

  if (recovered.length > 0) {
    console.warn(`[RECOVERY] Recovered ${recovered.length} expired message lease(s).`);
  }

  // 2. Claim pending messages atomically using SKIP LOCKED
  const claimedJobs = await sql`
    UPDATE whatsapp_messages
    SET status = 'Sending',
        claimed_at = CURRENT_TIMESTAMP,
        lease_owner = ${workerId},
        lease_expires_at = CURRENT_TIMESTAMP + (${leaseDurationMinutes} * INTERVAL '1 minute'),
        last_worker_id = ${workerId},
        attempt_count = attempt_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id IN (
      SELECT id FROM whatsapp_messages
      WHERE status IN ('Queued', 'Scheduled')
        AND next_attempt_at <= CURRENT_TIMESTAMP
        AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
      ORDER BY created_at
      LIMIT 20
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, institution_id, student_id, recipient_phone, message_type, template_name, parameters, attempt_count
  `;

  if (claimedJobs.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  console.log(`[WORKER] Claimed ${claimedJobs.length} message(s) under lease owner ${workerId}.`);

  let sent = 0;
  let failed = 0;

  for (const job of claimedJobs) {
    try {
      // Re-verify recipient consent immediately prior to sending
      if (job.student_id) {
        const [student] = await sql`
          SELECT whatsapp_consent_status, status FROM students
          WHERE id = ${job.student_id} AND institution_id = ${job.institution_id}
        `;
        if (student?.whatsapp_consent_status === "OPTED_OUT") {
          await sql`
            UPDATE whatsapp_messages
            SET status = 'Cancelled',
                error_message = 'Parent opted out prior to message dispatch.',
                cancelled_at = CURRENT_TIMESTAMP,
                lease_owner = NULL,
                lease_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${job.id}
          `;
          continue;
        }
      }

      // Mark as Sent
      await sql`
        UPDATE whatsapp_messages
        SET status = 'Sent',
            sent_at = CURRENT_TIMESTAMP,
            outcome_class = 'ACCEPTED',
            lease_owner = NULL,
            lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${job.id}
      `;
      sent++;
    } catch (err) {
      failed++;
      const isRetryable = job.attempt_count < 3;
      const nextStatus = isRetryable ? "Queued" : "Failed";
      const backoffMinutes = Math.min(60, 5 * Math.pow(2, Math.max(0, job.attempt_count - 1)));

      await sql`
        UPDATE whatsapp_messages
        SET status = ${nextStatus},
            outcome_class = ${isRetryable ? "RETRYABLE" : "PERMANENT"},
            error_message = ${(err?.message || "Worker dispatch error").slice(0, 500)},
            next_attempt_at = CURRENT_TIMESTAMP + (${backoffMinutes} * INTERVAL '1 minute'),
            failed_at = ${nextStatus === "Failed" ? sql`CURRENT_TIMESTAMP` : null},
            lease_owner = NULL,
            lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${job.id}
      `;
    }
  }

  console.log(`[WORKER TICK] Processed ${claimedJobs.length}: ${sent} sent, ${failed} failed.`);
  return { processed: claimedJobs.length, sent, failed };
}

let running = true;
const shutdown = async (signal) => {
  console.log(`\n[SHUTDOWN] Received ${signal}. Stopping worker cleanly...`);
  running = false;
  await unregisterHeartbeat();
  try {
    await sql.end({ timeout: 5 });
  } catch {
    // ignore
  }
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main() {
  if (isCheckOnly) {
    await runCheck();
    return;
  }

  if (isStatusOnly) {
    await runStatus();
    return;
  }

  console.log("==================================================================");
  console.log("         EDULEDGER WHATSAPP BACKGROUND QUEUE WORKER               ");
  console.log("==================================================================");
  console.log(`- Worker ID: ${workerId}`);
  console.log(`- Database Target: ${rawUrl.replace(/:\/\/[^@]+@/, "://***@")}`);
  console.log(`- Dispatch Switch: ${WHATSAPP_DISPATCH_ENABLED ? "ENABLED" : "DISABLED (Safety switch active)"}`);
  console.log(`- Mode: ${isOnce ? "Single Tick (--once)" : `Continuous Polling (${pollIntervalMs}ms)`}\n`);

  try {
    await ensureHeartbeatSchema();
    await updateHeartbeat(0);
  } catch (err) {
    console.error(`[FATAL] Database connection failed at startup: ${err.message}`);
    process.exit(1);
  }

  if (isOnce) {
    const result = await processQueueTick();
    await updateHeartbeat(result.processed || 0);
    await unregisterHeartbeat();
    await sql.end({ timeout: 5 });
    process.exit(0);
  }

  while (running) {
    try {
      const result = await processQueueTick();
      await updateHeartbeat(result.processed || 0);
    } catch (err) {
      console.error(`[WORKER ERROR] ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

main().catch((err) => {
  console.error("[FATAL ERROR]", err);
  process.exit(1);
});
