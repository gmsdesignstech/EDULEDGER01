import { readFile } from "node:fs/promises";
import process from "node:process";
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL is required to run the registration migration.");
if (!/^postgres(?:ql)?:\/\//i.test(url))
  throw new Error("DATABASE_URL must be a postgres:// or postgresql:// URL.");

const migration = await readFile(
  new URL("../database/migrations/202609200001_registration_core.sql", import.meta.url),
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  prepare: false,
  ssl: process.env.NODE_ENV === "production" ? "require" : undefined,
});

try {
  await sql.unsafe(migration);
  console.log("Registration database migration completed.");
} finally {
  await sql.end({ timeout: 5 });
}
