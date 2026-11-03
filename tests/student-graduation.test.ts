import {describe,expect,it} from "vitest";
import {hash} from "bcryptjs";
import {addStudent,createAccount,getCompleteSettings,getStudent,graduateStudents,promoteStudents,promotionOptions,saveCompleteSettings,studentAcademicHistory} from "../src/lib/db";

describe("highest-class graduation",()=>{
 it("graduates without creating a next-class enrollment and is idempotently rejected",async()=>{
  const stamp=Date.now(),admin=await createAccount({name:"Graduation Admin",email:`graduate-${stamp}@example.com`,institution:`Graduation School ${stamp}`,passwordHash:await hash("password123",4)}),settings=await getCompleteSettings(admin.institutionId);
  await saveCompleteSettings(admin.institutionId,admin.id,{...settings,schoolCode:"GRD",academicYear:"2026-2027",startMonth:4,endMonth:3,academicYears:[{name:"2025-2026",startMonth:4,endMonth:3,status:"Active"},{name:"2026-2027",startMonth:4,endMonth:3,status:"Active"}],classes:[{name:"Class 9",sections:["A"]},{name:"Class 10",sections:["A"]}]});
  expect((await promotionOptions(admin.institutionId)).highestClass).toBe("Class 10");
  const student=await addStudent(admin.institutionId,{name:"Graduate",admission:`GR-${stamp}`,gender:"Other",dateOfBirth:"2010-01-01",className:"Class 10",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:1000,academicYear:"2026-2027",dueDate:"2027-03-01"},admin.id);
  await expect(promoteStudents(admin.institutionId,admin.id,{sourceYear:"2026-2027",targetYear:"2025-2026",sourceClass:"Class 10",sourceSection:"A",targetClass:"Class 9",targetSection:"A",studentIds:[student.id]})).rejects.toThrow("highest configured class");
  expect(await graduateStudents(admin.institutionId,admin.id,{academicYear:"2026-2027",className:"Class 10",section:"A",studentIds:[student.id],effectiveDate:"2027-03-31"})).toEqual({graduated:1});
  expect(await getStudent(admin.institutionId,student.id)).toMatchObject({status:"Graduated",className:"Class 10",admission:student.admission});
  expect(await studentAcademicHistory(admin.institutionId,student.id)).toHaveLength(1);
  await expect(graduateStudents(admin.institutionId,admin.id,{academicYear:"2026-2027",className:"Class 10",section:"A",studentIds:[student.id],effectiveDate:"2027-03-31"})).rejects.toThrow("already graduated");
 });
});
