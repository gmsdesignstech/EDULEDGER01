import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (process.env.EDULEDGER_ENVIRONMENT !== "staging") {
  throw new Error("Set EDULEDGER_ENVIRONMENT=staging for a dedicated staging deployment.");
}
if (!process.argv.includes("--confirm-backup")) {
  throw new Error("Create and independently verify a staging database backup, then rerun with --confirm-backup.");
}
if (!process.argv.includes("--confirm-staging-target")) {
  throw new Error("Verify the exact staging target, then rerun with --confirm-staging-target.");
}
const url = process.env.STAGING_DATABASE_URL?.trim();
if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
  throw new Error("A dedicated STAGING_DATABASE_URL is required; DATABASE_URL is intentionally not accepted.");
}
const expectedHost = process.env.STAGING_DATABASE_HOST?.trim().toLowerCase();
const expectedDatabase = process.env.STAGING_DATABASE_NAME?.trim();
if (!expectedHost || !expectedDatabase) throw new Error("Set STAGING_DATABASE_HOST and STAGING_DATABASE_NAME to the independently verified staging target.");
const parsedUrl = new URL(url);
const urlDatabase = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
if (parsedUrl.hostname.toLowerCase() !== expectedHost || urlDatabase !== expectedDatabase) {
  throw new Error("STAGING_DATABASE_URL does not match the expected staging host and database; no connection was opened.");
}

const photoMigration = await readFile(new URL("../prisma/migrations/202611050003_student_photo_asset_kind/migration.sql", import.meta.url), "utf8");
const timetableMigration = await readFile(new URL("../prisma/migrations/202611050004_timetable_publication_state/migration.sql", import.meta.url), "utf8");
const sql = postgres(url, { max: 1, connect_timeout: 15, idle_timeout: 5, ssl: "require" });

try {
  const target = await sql`SELECT current_database() AS database, inet_server_addr()::text AS server`;
  if (target[0]?.database !== expectedDatabase) throw new Error("Connected database identity did not match STAGING_DATABASE_NAME; no migration was applied.");
  console.log(`Migration target verified: ${target[0].database} at ${expectedHost}`);
  const schema = await sql`SELECT to_regclass('public.school_assets') AS school_assets, to_regclass('public.timetable_entries') AS timetable_entries`;
  if (!schema[0]?.school_assets || !schema[0]?.timetable_entries) {
    throw new Error("Expected school_assets and timetable_entries tables were not found; no migration was applied.");
  }
  await sql.begin(async (transaction) => {
    await transaction.unsafe(photoMigration);
    await transaction.unsafe(timetableMigration);
    const checks = await transaction`SELECT
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.school_assets'::regclass AND conname='school_assets_kind_check' AND pg_get_constraintdef(oid) LIKE '%student-photo:%') AS photo_kind_check,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.school_assets'::regclass AND contype='f' AND confrelid='public.institutions'::regclass AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.school_assets'::regclass AND attname='institution_id')::smallint]) AS asset_institution_foreign_key,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.timetable_entries'::regclass AND conname='timetable_entries_status_check' AND pg_get_constraintdef(oid) LIKE '%Draft%' AND pg_get_constraintdef(oid) LIKE '%Published%' AND pg_get_constraintdef(oid) LIKE '%Archived%') AS timetable_status_check,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_timetable_active_slot' AND indexdef LIKE '%WHERE (status <> ''Archived''::text)%') AS timetable_slot_index,
      NOT EXISTS (SELECT 1 FROM timetable_entries WHERE status IS NULL OR status NOT IN ('Draft','Published','Archived')) AS timetable_data_valid`;
    if (!checks[0]?.photo_kind_check || !checks[0]?.asset_institution_foreign_key || !checks[0]?.timetable_status_check || !checks[0]?.timetable_slot_index || !checks[0]?.timetable_data_valid) {
      throw new Error("A migration schema/data verification failed; transaction rolled back.");
    }
  });
  console.log("Staging student photo asset and timetable publication migrations applied and verified.");
} finally {
  await sql.end({ timeout: 5 });
}
