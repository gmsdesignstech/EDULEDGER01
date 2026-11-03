import {describe,expect,it} from "vitest";
import {hash} from "bcryptjs";
import {addStudent,createAccount,getInstitution,listClassSummaries,saveStudentAttendance,studentAttendanceSheet} from "../src/lib/db";
import {configureSchoolCode} from "./configure-school-code";

describe("student attendance history",()=>{
 it("does not invent Present records for an unrecorded date",async()=>{
  const stamp=Date.now(),admin=await createAccount({name:"Attendance Admin",email:`attendance-${stamp}@example.com`,institution:`Attendance School ${stamp}`,passwordHash:await hash("password123",4)});await configureSchoolCode(admin.institutionId,admin.id);const year=(await getInstitution(admin.institutionId)).academicYear;await listClassSummaries(admin.institutionId,year);
  const student=await addStudent(admin.institutionId,{name:"Attendance Student",admission:`ATT-${stamp}`,gender:"Other",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:year,dueDate:"2027-03-01"},admin.id);
  expect(await studentAttendanceSheet(admin.institutionId,year,"Class 1","A","2026-10-10")).toEqual([expect.objectContaining({studentId:student.id,status:null,recorded:false})]);
  await saveStudentAttendance(admin.institutionId,admin.id,{academicYear:year,className:"Class 1",section:"A",date:"2026-10-10",records:[{studentId:student.id,status:"Late",remarks:"Bus delay"}]});
  expect(await studentAttendanceSheet(admin.institutionId,year,"Class 1","A","2026-10-10")).toEqual([expect.objectContaining({status:"Late",remarks:"Bus delay",recorded:true})]);
  expect(await studentAttendanceSheet(admin.institutionId,year,"Class 1","A","2026-10-09")).toEqual([expect.objectContaining({status:null,recorded:false})]);
 });
});
