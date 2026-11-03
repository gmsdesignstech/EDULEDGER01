import { describe, expect, it } from "vitest";
import { normalizeEligibleStudentCount } from "../src/lib/student-eligibility";

describe("eligible active-student count normalization", () => {
  it.each([[0, 0], [77, 77], ["0", 0], ["77", 77]])(
    "normalizes database count %s to %i",
    (value, expected) => expect(normalizeEligibleStudentCount(value)).toBe(expected),
  );

  it.each([undefined, null, "", "not-a-count", -1, 1.5, Number.NaN])(
    "rejects an invalid database count: %s",
    (value) => expect(() => normalizeEligibleStudentCount(value)).toThrow(/count returned by the database is invalid/),
  );
});
