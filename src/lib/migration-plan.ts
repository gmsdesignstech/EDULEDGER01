export const MIGRATION_ID_PATTERN = /^\d{12}_[a-z0-9]+(?:_[a-z0-9]+)*$/;

export type MigrationDefinition = {
  id: string;
  checksum: string;
  dependsOn?: readonly string[];
  transactional?: boolean;
};

export type AppliedMigration = { id: string; checksum: string };
export type MigrationPlanItem = MigrationDefinition & { action: "apply" };

export class MigrationPlanError extends Error {
  constructor(message: string) {
    super(redactMigrationError(message));
    this.name = "MigrationPlanError";
  }
}

export function redactMigrationError(message: string): string {
  return message
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s'"<>]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/\b(DATABASE_URL|POSTGRES_URL|PGPASSWORD)=([^\s]+)/gi, "$1=[REDACTED]");
}

export function assertProductionMigrationAuthorization(
  environment: string | undefined,
  execute: string | undefined,
  approval: string | undefined,
  expectedApproval: string,
): void {
  if (environment !== "production") return;
  if (execute !== "1" || !expectedApproval || approval !== expectedApproval) {
    throw new MigrationPlanError(
      "Production migration execution requires both EDULEDGER_MIGRATION_EXECUTE=1 and the expected one-time approval token.",
    );
  }
}

export function createMigrationPlan(
  discovered: readonly MigrationDefinition[],
  applied: readonly AppliedMigration[] = [],
): readonly MigrationPlanItem[] {
  const ordered = [...discovered].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map<string, MigrationDefinition>();

  for (const migration of ordered) {
    if (!MIGRATION_ID_PATTERN.test(migration.id)) {
      throw new MigrationPlanError(`Invalid migration identifier: ${migration.id}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(migration.checksum)) {
      throw new MigrationPlanError(`Invalid SHA-256 checksum for migration ${migration.id}`);
    }
    if (byId.has(migration.id)) throw new MigrationPlanError(`Duplicate migration identifier: ${migration.id}`);
    byId.set(migration.id, migration);
  }

  for (const migration of ordered) {
    for (const dependency of migration.dependsOn ?? []) {
      if (!byId.has(dependency)) {
        throw new MigrationPlanError(`Migration ${migration.id} has missing dependency ${dependency}`);
      }
      if (dependency.localeCompare(migration.id) >= 0) {
        throw new MigrationPlanError(`Migration ${migration.id} depends on non-earlier migration ${dependency}`);
      }
    }
  }

  const appliedById = new Map<string, AppliedMigration>();
  for (const record of applied) {
    if (appliedById.has(record.id)) throw new MigrationPlanError(`Duplicate applied migration identifier: ${record.id}`);
    appliedById.set(record.id, record);
  }

  const knownIds = new Set(ordered.map((migration) => migration.id));
  for (const record of applied) {
    if (!knownIds.has(record.id)) throw new MigrationPlanError(`Applied migration is missing from discovery: ${record.id}`);
    const expected = byId.get(record.id)!;
    if (expected.checksum !== record.checksum) {
      throw new MigrationPlanError(`Checksum changed for applied migration: ${record.id}`);
    }
  }

  const firstPending = ordered.findIndex((migration) => !appliedById.has(migration.id));
  if (firstPending >= 0) {
    const reappliedAfterGap = ordered.slice(firstPending + 1).find((migration) => appliedById.has(migration.id));
    if (reappliedAfterGap) {
      throw new MigrationPlanError(`Applied migration order has a gap before ${reappliedAfterGap.id}`);
    }
  }

  return ordered
    .filter((migration) => !appliedById.has(migration.id))
    .map((migration) => ({ ...migration, transactional: migration.transactional !== false, action: "apply" as const }));
}

export function formatMigrationDryRun(plan: readonly MigrationPlanItem[]): string {
  if (plan.length === 0) return "Migration plan: no pending migrations.";
  return [
    `Migration plan: ${plan.length} pending migration(s); no SQL will be executed.`,
    ...plan.map((item) => `APPLY ${item.id} [${item.transactional === false ? "non-transactional" : "transactional"}]`),
  ].join("\n");
}
