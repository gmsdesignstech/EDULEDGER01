import { describe,expect,it } from "vitest";
import { hash } from "bcryptjs";
import { addStudent,createAccount,demoteStudent,demotionHistory,demotionOptions,getCompleteSettings,getStudent,saveCompleteSettings,undoStudentDemotion } from "../src/lib/db";

describe("student demotion",()=>{
 it("moves one existing student down, records history, rejects repetition and restores placement",async()=>{
  const stamp=Date.now();
  const admin=await createAccount({name:"Demotion Admin",email:`demotion-${stamp}@example.com`,institution:`Demotion School ${stamp}`,passwordHash:await hash("password123",4)});
  const other=await createAccount({name:"Other Admin",email:`demotion-other-${stamp}@example.com`,institution:`Other School ${stamp}`,passwordHash:await hash("password123",4)});
  const settings=await getCompleteSettings(admin.institutionId);
  await saveCompleteSettings(admin.institutionId,admin.id,{...settings,schoolCode:"DMT",academicYear:"2026-2027",startMonth:4,endMonth:3,academicYears:[{name:"2026-2027",startMonth:4,endMonth:3,status:"Active"}],classes:[{name:"LKG",sections:["A"]},{name:"UKG",sections:["A"]},{name:"Class 1",sections:["A"]},{name:"Class 2",sections:["A"]},{name:"Class 3",sections:["A"]},{name:"Class 4",sections:["A"]},{name:"Class 5",sections:["A"]}]});
  const student=await addStudent(admin.institutionId,{name:"Demotion Student",admission:`DM-${stamp}`,gender:"Male",dateOfBirth:"2015-01-01",className:"Class 5",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:1000,academicYear:"2026-2027",dueDate:"2026-05-01"},admin.id);
  const before=await getStudent(admin.institutionId,student.id),options=await demotionOptions(admin.institutionId,student.id);
  expect(options.classes.map(item=>item.name)).toEqual(["Class 4","Class 3","Class 2","Class 1","UKG","LKG"]);
  const target=options.classes.find(item=>item.name==="Class 4")!;
  const input={studentId:student.id,newClassId:target.id,newSectionId:target.sections[0].id,academicYearId:options.years.find(item=>item.name===student.academicYear)!.id,reason:"Academic performance",remarks:"Reviewed by admin"};
  await expect(demoteStudent(other.institutionId,other.id,input)).rejects.toThrow();
  const saved=await demoteStudent(admin.institutionId,admin.id,input);
  expect(await getStudent(admin.institutionId,student.id)).toMatchObject({className:"Class 4",admission:before?.admission,rollNumber:before?.rollNumber,totalFee:before?.totalFee});
  expect(await demotionHistory(admin.institutionId,student.id)).toMatchObject([{id:saved.id,previousClass:"Class 5",newClass:"Class 4",reason:"Academic performance"}]);
  await expect(demoteStudent(admin.institutionId,admin.id,input)).rejects.toThrow("lower");
  await undoStudentDemotion(admin.institutionId,admin.id,saved.id);
  expect(await getStudent(admin.institutionId,student.id)).toMatchObject({className:"Class 5",rollNumber:before?.rollNumber});
  expect((await demotionHistory(admin.institutionId,student.id))[0].undoneAt).toBeTruthy();
  await expect(undoStudentDemotion(admin.institutionId,admin.id,saved.id)).rejects.toThrow();
  expect(await demotionHistory(other.institutionId,student.id)).toEqual([]);
  const lkg=(await demotionOptions(admin.institutionId,student.id)).classes.find(item=>item.name==="LKG")!;
  await demoteStudent(admin.institutionId,admin.id,{...input,newClassId:lkg.id,newSectionId:lkg.sections[0].id,reason:"Administrative correction"});
  expect((await demotionOptions(admin.institutionId,student.id)).classes).toEqual([]);
 });
});
