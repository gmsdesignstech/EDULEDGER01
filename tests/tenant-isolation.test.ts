import { hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  addClassExam,
  addClassResult,
  addStudent,
  createAccount,
  createFee,
  deleteStudent,
  getStudent,
  listFees,
  listStudents,
  markAttendance,
  studentImportKeys,
} from "../src/lib/db";
import { configureSchoolCode } from "./configure-school-code";

const input=(admission:string,name:string)=>({
  name,admission,gender:"Other",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",
  parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",
  totalFee:1000,academicYear:"2026-2027",dueDate:"2027-03-01",
});

describe("multi-tenant isolation",()=>{
  it("isolates student reads, writes, deletes, fees, attendance, imports, and results",async()=>{
    const stamp=Date.now(),passwordHash=await hash("password123",4);
    const schoolA=await createAccount({name:"Admin A",email:`tenant-a-${stamp}@example.com`,institution:`Tenant A ${stamp}`,passwordHash});
    const schoolB=await createAccount({name:"Admin B",email:`tenant-b-${stamp}@example.com`,institution:`Tenant B ${stamp}`,passwordHash});
    await configureSchoolCode(schoolA.institutionId,schoolA.id);
    await configureSchoolCode(schoolB.institutionId,schoolB.id);

    // Admission identifiers are tenant-owned and may legitimately match.
    const admission=`ADM-${stamp}`;
    const studentA=await addStudent(schoolA.institutionId,input(admission,"Student A"),schoolA.id);
    const studentB=await addStudent(schoolB.institutionId,input(admission,"Student B"),schoolB.id);

    expect((await listStudents(schoolA.institutionId,{})).map(item=>item.id)).toContain(studentA.id);
    expect((await listStudents(schoolA.institutionId,{})).map(item=>item.id)).not.toContain(studentB.id);
    expect(await getStudent(schoolA.institutionId,studentB.id)).toBeUndefined();
    expect(await deleteStudent(schoolA.institutionId,studentB.id,schoolA.id)).toBe(false);
    await expect(createFee(schoolA.institutionId,studentB.id,{feeType:"Annual Fee",academicYear:"2026-2027",totalAmount:100,dueDate:"2027-03-01"},schoolA.id)).rejects.toThrow("Student not found");
    await expect(markAttendance(schoolA.institutionId,"2026-09-26",[{studentId:studentB.id,status:"Present"}],schoolA.id,schoolA.id)).rejects.toThrow();

    expect((await listFees(schoolA.institutionId,{})).every(item=>item.studentId===studentA.id)).toBe(true);
    const importKeys=await studentImportKeys(schoolA.institutionId);
    expect(importKeys).toEqual([expect.objectContaining({admission,rollNumber:studentA.rollNumber})]);

    const examId=await addClassExam(schoolA.institutionId,"Class 1","2026-2027",{name:"Isolation Exam",examDate:"2026-09-26",section:"A",subject:"Math",maxMarks:100,passingMarks:35});
    await expect(addClassResult(schoolA.institutionId,examId,studentB.id,80)).rejects.toThrow("does not belong");
    await expect(addClassResult(schoolA.institutionId,examId,studentA.id,80)).resolves.toBeTypeOf("string");
  });
});
