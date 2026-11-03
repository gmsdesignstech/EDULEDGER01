import { hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { addStudent, addStudentsAtomic, createAccount, findStudentByAdmission, studentImportKeys, type StudentInput } from "../src/lib/db";
import { configureSchoolCode } from "./configure-school-code";

function student(admission:string):StudentInput{return{name:"Import Test",admission,gender:"Male",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Guardian",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:"2026-2027",dueDate:"2027-03-01"}}

describe("atomic student imports",()=>{
  it("keeps admissions and import duplicate checks tenant-local",async()=>{
    const stamp=Date.now(),first=await createAccount({name:"First Import Admin",email:`first-import-${stamp}@example.com`,institution:`First Import School ${stamp}`,passwordHash:await hash("password123",4)}),second=await createAccount({name:"Second Import Admin",email:`second-import-${stamp}@example.com`,institution:`Second Import School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(first.institutionId,first.id,"ONE");await configureSchoolCode(second.institutionId,second.id,"TWO");
    const admission=`SHARED-${stamp}`,firstStudent=await addStudent(first.institutionId,student(admission),first.id);
    expect(await studentImportKeys(second.institutionId)).not.toContainEqual(expect.objectContaining({admission}));
    const secondStudent=await addStudent(second.institutionId,student(admission),second.id);
    expect(firstStudent.rollNumber).not.toBe("");
    expect(secondStudent.rollNumber).not.toBe("");
  });
  it("rolls back the complete batch when an insertion fails",async()=>{
    const stamp=Date.now(),account=await createAccount({name:"Import Admin",email:`import-${stamp}@example.com`,institution:`Import School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(account.institutionId,account.id,"IMP");
    const admission=`ATOMIC-${stamp}`;
    await expect(addStudentsAtomic(account.institutionId,[student(admission),student(admission)],account.id)).rejects.toThrow();
    await expect(findStudentByAdmission(account.institutionId,admission)).resolves.toBeUndefined();
  });

  it("imports a 186-student batch and persists the final record",async()=>{
    const stamp=Date.now(),account=await createAccount({name:"Large Import Admin",email:`large-import-${stamp}@example.com`,institution:`Large Import School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(account.institutionId,account.id,"BIG");
    const inputs=Array.from({length:186},(_,index)=>student(`ADM-${stamp}-${String(index+1).padStart(3,"0")}`));
    const started=Date.now(),ids=await addStudentsAtomic(account.institutionId,inputs,account.id);
    expect(ids).toHaveLength(186);
    await expect(findStudentByAdmission(account.institutionId,inputs[185].admission)).resolves.toMatchObject({name:"Import Test",className:"Class 1",section:"A"});
    expect(Date.now()-started).toBeLessThan(20_000);
  });

  it("supports 1,000 students in controlled import batches",async()=>{
    const stamp=Date.now(),account=await createAccount({name:"Thousand Import Admin",email:`thousand-import-${stamp}@example.com`,institution:`Thousand Import School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(account.institutionId,account.id,"KID");
    const inputs=Array.from({length:1000},(_,index)=>student(`KID-${stamp}-${String(index+1).padStart(4,"0")}`));
    let inserted=0;for(let offset=0;offset<inputs.length;offset+=50)inserted+=(await addStudentsAtomic(account.institutionId,inputs.slice(offset,offset+50),account.id)).length;
    expect(inserted).toBe(1000);
    await expect(findStudentByAdmission(account.institutionId,inputs[999].admission)).resolves.toMatchObject({name:"Import Test"});
  },20_000);
});
