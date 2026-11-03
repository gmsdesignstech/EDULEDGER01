export function normalizeEligibleStudentCount(value: unknown): number {
  const count = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
    throw new Error("The eligible active-student count returned by the database is invalid.");
  return count;
}
