import { describe, expect, it } from "vitest";
import { registrationSchema } from "../src/lib/registration-schema";

const validRegistration = {
  name: "School Administrator",
  email: "ADMIN@Example.test",
  institution: "Example Academy",
  phone: "+91 98765 43210",
  password: "SecurePass1",
  studentCount: 100,
  subscriptionStartMonth: "2026-04",
  subscriptionEndMonth: "2027-03",
  acceptedTerms: true as const,
};

describe("registration request validation", () => {
  it("normalizes email and accepts a complete registration", () => {
    const result = registrationSchema.parse(validRegistration);
    expect(result.email).toBe("admin@example.test");
  });

  it.each([
    ["missing uppercase", "securepass1"],
    ["missing lowercase", "SECUREPASS1"],
    ["missing number", "SecurePassword"],
  ])("rejects a password with %s", (_reason, password) => {
    expect(registrationSchema.safeParse({ ...validRegistration, password }).success).toBe(false);
  });

  it("requires explicit terms and privacy acceptance", () => {
    expect(registrationSchema.safeParse({ ...validRegistration, acceptedTerms: false }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...validRegistration, acceptedTerms: undefined }).success).toBe(false);
  });
});
