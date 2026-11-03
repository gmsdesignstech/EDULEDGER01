import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { createAccount, listTeachers, saveTeacher, updateTeacher } from "../src/lib/db";
import { parseTeacherClasses, serializeTeacherClasses, standardTeacherClasses, teacherClassesSchema } from "../src/lib/teacher-classes";

describe("teacher assigned classes", () => {
  it("offers individual classes and rejects duplicate or malformed selections", () => {
    expect(standardTeacherClasses).toEqual(["Nursery", "LKG", "UKG", ...Array.from({ length: 10 }, (_, index) => `Class ${index + 1}`)]);
    expect(teacherClassesSchema.safeParse(["LKG", "UKG", "Class 1"]).success).toBe(true);
    expect(teacherClassesSchema.safeParse(["LKG", "lkg"]).success).toBe(false);
    expect(teacherClassesSchema.safeParse(["Class 1, Class 2"]).success).toBe(false);
    expect(parseTeacherClasses("LKG, UKG, CLASS 1, LKG")).toEqual(["LKG", "UKG", "Class 1"]);
    expect(serializeTeacherClasses(["Class 1", "Class 2", "Class 3"])).toBe("Class 1, Class 2, Class 3");
    const completeLabels=["Nursery","LKG","UKG",...Array.from({length:10},(_,index)=>`Class ${index+1}`)];
    expect(parseTeacherClasses(completeLabels.join(", "))).toEqual(completeLabels);
    expect(serializeTeacherClasses(completeLabels)).toBe(completeLabels.join(", "));
  });

  it("persists create, edit and removal while preserving legacy string records", async () => {
    const stamp = Date.now();
    const admin = await createAccount({ name: "Teacher Admin", email: `teacher-classes-${stamp}@example.com`, institution: `Teacher School ${stamp}`, passwordHash: await hash("password123", 4) });
    const input = { name: "Primary Teacher", employeeId: `TEACH-${stamp}`, email: "", phone: "9876543210", department: "Primary", subject: "General", classes: "LKG, UKG, CLASS 1, LKG", joiningDate: "2026-04-01", salary: 20000, status: "Active" };
    const created = await saveTeacher(admin.institutionId, input, admin.id);
    expect(created.classes).toBe("LKG, UKG, Class 1");
    expect(parseTeacherClasses(created.classes)).toEqual(["LKG", "UKG", "Class 1"]);
    const changed = await updateTeacher(admin.institutionId, created.id, { ...input, classes: "Class 1, Class 2, Class 3" }, admin.id);
    expect(parseTeacherClasses(changed?.classes)).toEqual(["Class 1", "Class 2", "Class 3"]);
    const removed = await updateTeacher(admin.institutionId, created.id, { ...input, classes: "Class 1, Class 3" }, admin.id);
    expect(parseTeacherClasses(removed?.classes)).toEqual(["Class 1", "Class 3"]);
    expect(parseTeacherClasses((await listTeachers(admin.institutionId))[0].classes)).toEqual(["Class 1", "Class 3"]);
  });
});
