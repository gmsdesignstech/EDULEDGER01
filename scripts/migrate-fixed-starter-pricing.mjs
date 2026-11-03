import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
  throw new Error("A PostgreSQL DATABASE_URL is required.");
}

const migration = await readFile(
  new URL(
    "../prisma/migrations/202610240001_fixed_starter_pricing/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
  ssl: "require",
});

try {
  await sql.begin(async (transaction) => transaction.unsafe(migration));
  console.log("Fixed Starter pricing migration completed.");
} finally {
  await sql.end({ timeout: 5 });
}
