import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertProductionMigrationAuthorization,
  createMigrationPlan,
  formatMigrationDryRun,
  redactMigrationError,
  type MigrationDefinition,
} from "../src/lib/migration-plan";

const checksum = (digit: string) => digit.repeat(64);
const migrations: MigrationDefinition[] = [
  { id: "202610150002_second", checksum: checksum("b"), dependsOn: ["202610150001_first"] },
  { id: "202610150001_first", checksum: checksum("a") },
];

describe("migration planning", () => {
  it("discovers a stable identifier order and produces a dry run only", () => {
    const plan = createMigrationPlan(migrations);
    expect(plan.map((item) => item.id)).toEqual(["202610150001_first", "202610150002_second"]);
    expect(formatMigrationDryRun(plan)).toContain("no SQL will be executed");
    expect(formatMigrationDryRun(plan)).toContain("APPLY 202610150001_first [transactional]");
  });

  it("rejects duplicate identifiers, invalid names, and missing dependencies", () => {
    expect(() => createMigrationPlan([migrations[0], migrations[0]])).toThrow(/Duplicate migration identifier/);
    expect(() => createMigrationPlan([{ id: "bad-name.sql", checksum: checksum("a") }])).toThrow(/Invalid migration identifier/);
    expect(() => createMigrationPlan([{ id: "202610150001_first", checksum: checksum("a"), dependsOn: ["202610140001_missing"] }])).toThrow(/missing dependency/);
  });

  it("rejects changed, missing, duplicate, and reordered applied history", () => {
    expect(() => createMigrationPlan(migrations, [{ id: migrations[0].id, checksum: checksum("c") }])).toThrow(/Checksum changed/);
    expect(() => createMigrationPlan(migrations, [{ id: "202610140001_missing", checksum: checksum("a") }])).toThrow(/missing from discovery/);
    expect(() => createMigrationPlan(migrations, [{ id: migrations[1].id, checksum: checksum("a") }, { id: migrations[1].id, checksum: checksum("a") }])).toThrow(/Duplicate applied/);
    expect(() => createMigrationPlan(migrations, [{ id: migrations[0].id, checksum: checksum("b") }])).toThrow(/order has a gap/);
  });

  it("requires two independent production execution signals", () => {
    expect(() => assertProductionMigrationAuthorization("production", "1", "change-42", "change-42")).not.toThrow();
    expect(() => assertProductionMigrationAuthorization("production", "1", "wrong", "change-42")).toThrow(/one-time approval/);
    expect(() => assertProductionMigrationAuthorization("production", undefined, "change-42", "change-42")).toThrow(/EDULEDGER_MIGRATION_EXECUTE/);
    expect(() => assertProductionMigrationAuthorization("test", undefined, undefined, "")).not.toThrow();
  });

  it("redacts database URLs and password variables from failures", () => {
    const output = redactMigrationError("postgresql://admin:secret@db.example/app PGPASSWORD=secret DATABASE_URL=postgres://u:p@host/db");
    expect(output).not.toMatch(/secret|admin:|u:p@/);
    expect(output).toContain("[REDACTED_DATABASE_URL]");
  });

  it("keeps migration planning out of ordinary application startup", () => {
    const databaseModule = readFileSync(resolve(process.cwd(), "src/lib/db.ts"), "utf8");
    const developmentLauncher = readFileSync(resolve(process.cwd(), "scripts/dev.mjs"), "utf8");
    expect(databaseModule).not.toContain("migration-plan");
    expect(developmentLauncher).not.toContain("migration-plan");
    expect(developmentLauncher).not.toMatch(/migrat(?:e|ion)/i);
  });
});
