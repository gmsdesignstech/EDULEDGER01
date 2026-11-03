import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL is required to run the WhatsApp migration.");
if (!/^postgres(?:ql)?:\/\//i.test(url)) {
  throw new Error("DATABASE_URL must be a postgres:// or postgresql:// URL.");
}

const migration = await readFile(
  new URL("../prisma/migrations/202609210001_whatsapp_integration/migration.sql", import.meta.url),
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  ssl: "require",
});

try {
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
  });
  console.log("WhatsApp database migration completed.");
} finally {
  await sql.end({ timeout: 5 });
}
