import { hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { addStudent, createAccount, deleteStudent, generateMissingStudentIds, getStudent, previewStudentRoll, updateStudent } from "../src/lib/db";
import { admissionYear, formatRollNumber, isValidStudentId, normalizeSchoolCode } from "../src/lib/roll-number";
import { configureSchoolCode } from "./configure-school-code";

function input(stamp: string, year = "2026-2027") {
  return { name: "Student ID Test", admission: `ROLL-${stamp}`, gender: "Male", dateOfBirth: "2015-04-01", className: "Class 1", section: "A", rollNumber: "FORGED", parent: "Guardian", parentPhone: "9876543210", parentEmail: "", address: "", admissionDate: `${year.slice(0,4)}-04-01`, totalFee: 0, academicYear: year, dueDate: `${year.slice(5)}-03-01` };
}

describe("student IDs", () => {
  it("validates and formats the canonical ID", () => {
    expect(normalizeSchoolCode(" ops ")).toBe("OPS");
    expect(() => normalizeSchoolCode("OP1")).toThrow();
    expect(admissionYear("2027-2028")).toBe("2027");
    expect(() => admissionYear("2027-2029")).toThrow();
    expect(formatRollNumber("OPS", "2026", 1)).toBe("OPS-2026-0001");
    expect(isValidStudentId("OPS-2026-0001", "2026")).toBe(true);
    expect(isValidStudentId("OPS2026001", "2026")).toBe(false);
  });

  it("allocates atomically by school/year, validates imports, preserves edits, and is idempotent", async () => {
    const stamp = Date.now();
    const a = await createAccount({ name: "ID Admin", email: `id-a-${stamp}@example.com`, institution: `ID School A ${stamp}`, passwordHash: await hash("password123", 4) });
    const b = await createAccount({ name: "ID Admin", email: `id-b-${stamp}@example.com`, institution: `ID School B ${stamp}`, passwordHash: await hash("password123", 4) });
    await expect(previewStudentRoll(a.institutionId, "2026-2027")).rejects.toThrow("School code");
    await configureSchoolCode(a.institutionId, a.id, "OPS");
    await configureSchoolCode(b.institutionId, b.id, "DPS");
    expect(await previewStudentRoll(a.institutionId, "2026-2027")).toBe("OPS-2026-0001");
    const first = await addStudent(a.institutionId, input(`${stamp}-1`), a.id);
    expect(first.rollNumber).toBe("OPS-2026-0001");
    const concurrent = await Promise.all([2, 3, 4].map(i => addStudent(a.institutionId, input(`${stamp}-${i}`), a.id)));
    expect(concurrent.map(item => item.rollNumber).sort()).toEqual(["OPS-2026-0002", "OPS-2026-0003", "OPS-2026-0004"]);
    expect((await addStudent(a.institutionId, input(`${stamp}-5`, "2027-2028"), a.id)).rollNumber).toBe("OPS-2027-0001");
    expect((await addStudent(b.institutionId, input(`${stamp}-6`), b.id)).rollNumber).toBe("DPS-2026-0001");
    await updateStudent(a.institutionId, first.id, { name: "Changed", rollNumber: "FORGED" }, a.id);
    expect((await getStudent(a.institutionId, first.id))?.rollNumber).toBe("OPS-2026-0001");
    await deleteStudent(a.institutionId, concurrent[2].id, a.id);
    expect((await addStudent(a.institutionId, input(`${stamp}-7`), a.id)).rollNumber).toBe("OPS-2026-0005");
    const imported = await addStudent(a.institutionId, { ...input(`${stamp}-8`), rollNumber: "OPS-2026-0010" }, a.id, { allowImportedRoll: true });
    expect(imported.rollNumber).toBe("OPS-2026-0010");
    await expect(addStudent(a.institutionId, { ...input(`${stamp}-9`), rollNumber: "OPS-2026-0010" }, a.id, { allowImportedRoll: true })).rejects.toThrow("already exists");
    await expect(addStudent(a.institutionId, { ...input(`${stamp}-10`), rollNumber: "BAD-2026-0011" }, a.id, { allowImportedRoll: true })).rejects.toThrow("must match");
    expect((await addStudent(a.institutionId, input(`${stamp}-11`), a.id)).rollNumber).toBe("OPS-2026-0011");
    await configureSchoolCode(a.institutionId, a.id, "NPS");
    expect((await getStudent(a.institutionId, first.id))?.rollNumber).toBe("OPS-2026-0001");
    expect((await addStudent(a.institutionId, input(`${stamp}-12`), a.id)).rollNumber).toBe("NPS-2026-0012");
    expect(await generateMissingStudentIds(a.institutionId, a.id)).toMatchObject({ generated: 0, errors: 0, duplicates: 0 });
    expect((await generateMissingStudentIds(a.institutionId, a.id)).generated).toBe(0);
  });
});
