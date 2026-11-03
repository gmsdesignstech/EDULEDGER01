import { configureSchoolCode } from "./configure-school-code";
import {describe,expect,it} from "vitest";
import {hash} from "bcryptjs";
import {actOnSingleRecord,addStudent,createAccount,dashboardData,deleteStudent,getCompleteSettings,getReceipt,listAttendance,listClassSummaries,listFees,listPayments,listStudents,markAttendance,recordPayment,setClassArchived} from "../src/lib/db";

describe("single record deletion",()=>{
  it("scopes deletion to a school and protects paid fee history through voiding",async()=>{
    const stamp=Date.now();
    const owner=await createAccount({name:"Delete Owner",email:`delete-${stamp}@example.com`,institution:`Delete School ${stamp}`,passwordHash:await hash("password123",4)});
    const outsider=await createAccount({name:"Other Owner",email:`delete-other-${stamp}@example.com`,institution:`Other Delete School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(owner.institutionId,owner.id);
    const student=await addStudent(owner.institutionId,{name:"Delete Test Student",admission:`DEL-${stamp}`,gender:"Male",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",rollNumber:"7",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:1000,academicYear:"2026-2027",dueDate:"2027-03-01"},owner.id);
    const fee=(await listFees(owner.institutionId,{academicYear:"2026-2027"}))[0];
    await expect(actOnSingleRecord(outsider.institutionId,outsider.id,"fee",String(fee.id),"")).rejects.toThrow("not found");
    const payment=await recordPayment(owner.institutionId,owner.id,{feeId:String(fee.id),amount:400,method:"Cash",paymentDate:"2026-09-16",transactionId:"",notes:""});
    await expect(actOnSingleRecord(owner.institutionId,owner.id,"fee",String(fee.id),"")).rejects.toThrow("history");
    await actOnSingleRecord(owner.institutionId,owner.id,"payment",payment.id,"Duplicate payment entry");
    expect(await listPayments(owner.institutionId,{studentId:student.id})).toHaveLength(0);
    expect(await getReceipt(owner.institutionId,payment.receiptNumber)).toBeUndefined();
    expect((await listFees(owner.institutionId,{academicYear:"2026-2027"}))[0].paidAmount).toBe(0);
    expect((await dashboardData(owner.institutionId,"2026-2027")).fees.collected).toBe(0);
    await markAttendance(owner.institutionId,"2026-09-16",[{studentId:student.id,status:"Absent"}],owner.id,owner.id);
    const attendance=(await listAttendance(owner.institutionId,{date:"2026-09-16"}))[0] as {id:string};
    await actOnSingleRecord(owner.institutionId,owner.id,"attendance",attendance.id,"");
    expect(await listAttendance(owner.institutionId,{date:"2026-09-16"})).toHaveLength(0);
    expect((await listStudents(owner.institutionId,{academicYear:"2026-2027"}))[0].attendance).toBe(100);
    expect(await deleteStudent(owner.institutionId,student.id,owner.id)).toBe(true);
    expect(await listStudents(owner.institutionId,{academicYear:"2026-2027"})).toHaveLength(0);
  });
  it("archives and restores a single class for its academic year",async()=>{
    const stamp=Date.now(),owner=await createAccount({name:"Class Owner",email:`class-delete-${stamp}@example.com`,institution:`Class Delete School ${stamp}`,passwordHash:await hash("password123",4)});
    await getCompleteSettings(owner.institutionId);await configureSchoolCode(owner.institutionId,owner.id);
    await listClassSummaries(owner.institutionId,"2026-2027");
    const student=await addStudent(owner.institutionId,{name:"Archived Class Student",admission:`CLASS-${stamp}`,gender:"Female",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Parent",parentPhone:"",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:"2026-2027",dueDate:"2027-03-01"},owner.id);
    await actOnSingleRecord(owner.institutionId,owner.id,"class","class-1","",undefined,"2026-2027");
    expect((await listClassSummaries(owner.institutionId,"2026-2027")).find(item=>item.slug==="class-1")?.status).toBe("Inactive");
    expect((await listStudents(owner.institutionId,{academicYear:"2026-2027"})).find(item=>item.id===student.id)?.status).toBe("Left Out");
    await setClassArchived(owner.institutionId,owner.id,"class-1","2026-2027",false);
    expect((await listClassSummaries(owner.institutionId,"2026-2027")).find(item=>item.slug==="class-1")?.status).toBe("Active");
    expect((await listStudents(owner.institutionId,{academicYear:"2026-2027"})).find(item=>item.id===student.id)?.status).toBe("Active");
  });
});
