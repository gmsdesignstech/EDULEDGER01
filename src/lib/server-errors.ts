import "server-only";

type DatabaseError = Error & {
  code?: string;
  constraint_name?: string;
  constraint?: string;
};

export type ServerErrorCategory =
  | "database_unavailable"
  | "database_configuration"
  | "database_schema"
  | "database_constraint"
  | "unknown";

const CONNECTION_CODES = new Set([
  "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
  "ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "ETIMEDOUT", "EAI_AGAIN",
]);
const CONFIGURATION_CODES = new Set(["28P01", "28000", "3D000"]);
const SCHEMA_CODES = new Set(["42P01", "42703", "42883"]);

export function serverErrorCategory(error: unknown): ServerErrorCategory {
  const databaseError = error as DatabaseError;
  const code = typeof databaseError?.code === "string" ? databaseError.code : "";
  const message = error instanceof Error ? error.message : "";

  if (CONNECTION_CODES.has(code)) return "database_unavailable";
  if (CONFIGURATION_CODES.has(code)) return "database_configuration";
  if (SCHEMA_CODES.has(code)) return "database_schema";
  if (isUniqueConstraintError(error)) return "database_constraint";
  if (/No PostgreSQL connection URL|DATABASE_URL must be/i.test(message))
    return "database_configuration";
  if (/no such (?:table|column)|has no column named/i.test(message))
    return "database_schema";
  return "unknown";
}

export function isUniqueConstraintError(error: unknown, constraint?: string) {
  const databaseError = error as DatabaseError;
  const isUnique =
    databaseError?.code === "23505" ||
    databaseError?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    databaseError?.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    (databaseError?.code === "ERR_SQLITE_ERROR" &&
      databaseError.message.startsWith("UNIQUE constraint failed:"));

  if (!isUnique || !constraint) return isUnique;
  return [databaseError.constraint_name, databaseError.constraint].some((value) =>
    value?.includes(constraint),
  );
}

export function logServerError(operation: string, error: unknown, context: Record<string, string | number | boolean | null> = {}) {
  const databaseError = error as DatabaseError;

  // Deliberately omit messages, queries, parameters and connection strings.
  console.error("Server operation failed", JSON.stringify({
    operation,
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode:
      typeof databaseError?.code === "string" ? databaseError.code : undefined,
    category: serverErrorCategory(error),
    timestamp: new Date().toISOString(),
    ...context,
  }));
}
