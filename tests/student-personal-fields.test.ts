import { configureSchoolCode } from "./configure-school-code";
import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { addStudent, createAccount, getStudent, listStudents, updateStudent } from "../src/lib/db";
import { bloodGroupSchema, motherNameSchema, studentImportValue } from "../src/lib/student-fields";

describe("student personal fields", () => {
  it("validates supported blood groups and Unicode mother names", () => {
    expect(bloodGroupSchema.safeParse("AB+").success).toBe(true);
    expect(bloodGroupSchema.safeParse("Not Provided").success).toBe(true);
    expect(bloodGroupSchema.safeParse("").success).toBe(true);
    expect(bloodGroupSchema.safeParse("X+").success).toBe(false);
    expect(motherNameSchema.parse("  फ़ातिमा बेगम  ")).toBe("फ़ातिमा बेगम");
    expect(motherNameSchema.safeParse("Name123").success).toBe(false);
    expect(studentImportValue({blood_group:" B+ "},["Blood Group","bloodGroup"])).toBe("B+");
    expect(studentImportValue({"Mother Name":" Fatima Begum "},["mother_name"])).toBe("Fatima Begum");
  });

  it("preserves missing values and persists create, edit and clear", async () => {
    const stamp=Date.now();
    const user=await createAccount({name:"Student Fields Admin",email:`student-fields-${stamp}@example.com`,institution:`Student Fields School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(user.institutionId,user.id);
    const base={name:"Student Fields",admission:`FIELDS-${stamp}`,gender:"Female",dateOfBirth:"2015-04-01",className:"Class 1",section:"A",rollNumber:"4",parent:"Guardian",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:"2026-2027",dueDate:"2027-03-01"};
    const student=await addStudent(user.institutionId,base,user.id);
    expect(student).toMatchObject({bloodGroup:"",motherName:""});
    await updateStudent(user.institutionId,student.id,{bloodGroup:"O-",motherName:"  Fatima Begum  "},user.id);
    expect(await getStudent(user.institutionId,student.id)).toMatchObject({bloodGroup:"O-",motherName:"Fatima Begum"});
    expect((await listStudents(user.institutionId))[0]).toMatchObject({bloodGroup:"O-",motherName:"Fatima Begum"});
    await updateStudent(user.institutionId,student.id,{bloodGroup:"",motherName:""},user.id);
    expect(await getStudent(user.institutionId,student.id)).toMatchObject({bloodGroup:"",motherName:""});
  });
});
