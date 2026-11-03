import { configureSchoolCode } from "./configure-school-code";
import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { addStudent, createAccount, getStudent, listStudents, updateStudent } from "../src/lib/db";
import { studentImportValue } from "../src/lib/student-fields";
import { quotaDescriptionSchema, quotaPairError, specialQuotaSchema } from "../src/lib/student-quota";

describe("student special quota", () => {
  it("validates options, descriptions and import aliases", () => {
    expect(specialQuotaSchema.safeParse("RTE").success).toBe(true);
    expect(specialQuotaSchema.safeParse("Sports").success).toBe(true);
    expect(specialQuotaSchema.parse("No Special Quota")).toBe("");
    expect(specialQuotaSchema.safeParse("Unsupported").success).toBe(false);
    expect(quotaDescriptionSchema.parse("  Alumni Child  ")).toBe("Alumni Child");
    expect(quotaPairError("Other", "")).toBeTruthy();
    expect(quotaPairError("RTE", "Alumni Child")).toBeTruthy();
    expect(quotaPairError("Other", "Alumni Child")).toBeNull();
    expect(studentImportValue({ special_quota: " RTE " }, ["Special Quota", "Quota"])).toBe("RTE");
    expect(studentImportValue({ specialQuotaDescription: " Alumni Child " }, ["Quota Description", "specialQuotaDescription"])).toBe("Alumni Child");
  });

  it("persists quota changes and preserves old students", async () => {
    const stamp = Date.now();
    const user = await createAccount({ name: "Quota Admin", email: `quota-${stamp}@example.com`, institution: `Quota School ${stamp}`, passwordHash: await hash("password123", 4) });
    await configureSchoolCode(user.institutionId,user.id);
    const student = await addStudent(user.institutionId, { name: "Quota Student", admission: `QUOTA-${stamp}`, gender: "Female", dateOfBirth: "2015-04-01", className: "Class 1", section: "A", rollNumber: "4", parent: "Guardian", parentPhone: "9876543210", parentEmail: "", address: "", admissionDate: "2026-04-01", totalFee: 0, academicYear: "2026-2027", dueDate: "2027-03-01" }, user.id);
    expect(student).toMatchObject({ specialQuota: "", specialQuotaDescription: "" });
    await updateStudent(user.institutionId, student.id, { specialQuota: "Other", specialQuotaDescription: "Alumni Child" }, user.id);
    expect(await getStudent(user.institutionId, student.id)).toMatchObject({ specialQuota: "Other", specialQuotaDescription: "Alumni Child" });
    expect((await listStudents(user.institutionId))[0]).toMatchObject({ specialQuota: "Other", specialQuotaDescription: "Alumni Child" });
    await updateStudent(user.institutionId, student.id, { specialQuota: "RTE", specialQuotaDescription: "" }, user.id);
    expect(await getStudent(user.institutionId, student.id)).toMatchObject({ specialQuota: "RTE", specialQuotaDescription: "" });
  });
});
