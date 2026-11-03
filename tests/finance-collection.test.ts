import { describe,expect,it } from "vitest";
import { hash } from "bcryptjs";
import { configureSchoolCode } from "./configure-school-code";
import { addStudent,createAccount,dailyFeeCollections,getFeeInvoice,getReceipt,listAccountTransactions,listFees,listPayments,recordPayment } from "../src/lib/db";

describe("finance collection",()=>{
 it("keeps unique invoice and receipt IDs, filters real records and deduplicates retries",async()=>{
  const stamp=Date.now(),admin=await createAccount({name:"Finance Admin",email:`finance-${stamp}@example.com`,institution:`Finance School ${stamp}`,passwordHash:await hash("password123",4)});
  const outsider=await createAccount({name:"Other Finance Admin",email:`finance-other-${stamp}@example.com`,institution:`Other Finance School ${stamp}`,passwordHash:await hash("password123",4)});
  await configureSchoolCode(admin.institutionId,admin.id);
  const student=await addStudent(admin.institutionId,{name:"Finance Test Student",admission:`FIN-${stamp}`,gender:"Female",dateOfBirth:"2016-01-01",className:"Class 2",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:1000,academicYear:"2026-2027",dueDate:"2027-03-01"},admin.id);
  const fee=(await listFees(admin.institutionId,{academicYear:"2026-2027"}))[0];
  expect(String(fee.invoiceNumber)).toMatch(/^INV-2026-\d{6}$/);
  await addStudent(admin.institutionId,{name:"Second Finance Student",admission:`FIN2-${stamp}`,gender:"Male",dateOfBirth:"2016-02-01",className:"Class 2",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:750,academicYear:"2026-2027",dueDate:"2027-03-01"},admin.id);
  expect(new Set((await listFees(admin.institutionId,{academicYear:"2026-2027"})).map(item=>item.invoiceNumber)).size).toBe(2);
  await configureSchoolCode(outsider.institutionId,outsider.id);
  await addStudent(outsider.institutionId,{name:"Other School Student",admission:`OTHER-${stamp}`,gender:"Male",dateOfBirth:"2016-03-01",className:"Class 2",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:500,academicYear:"2026-2027",dueDate:"2027-03-01"},outsider.id);
  expect((await listFees(outsider.institutionId,{academicYear:"2026-2027"}))[0].invoiceNumber).not.toBe(fee.invoiceNumber);
  expect((await listFees(admin.institutionId,{search:student.rollNumber})).map(item=>item.id)).toContain(fee.id);
  expect(await getFeeInvoice(outsider.institutionId,String(fee.id))).toBeUndefined();
  const input={feeId:String(fee.id),amount:400,method:"UPI",paymentDate:"2026-09-18",transactionId:`UPI-${stamp}`,notes:"First payment",requestId:crypto.randomUUID()};
  const first=await recordPayment(admin.institutionId,admin.id,input),again=await recordPayment(admin.institutionId,admin.id,input);
  expect(first.id).toBe(again.id);
  expect(first.receiptNumber).toMatch(/^REC-2026-\d{6}$/);
  expect((await listPayments(admin.institutionId,{search:first.receiptNumber}))).toHaveLength(1);
  expect((await listFees(admin.institutionId,{search:first.receiptNumber}))[0].paidAmount).toBe(400);
  expect((await listFees(admin.institutionId,{search:first.receiptNumber}))[0].latestReceipt).toBe(first.receiptNumber);
  const daily=await dailyFeeCollections(admin.institutionId,"2026-2027","2026-09-17","2026-09-19");
  expect(daily.data).toEqual([{date:"2026-09-17",amount:0},{date:"2026-09-18",amount:400},{date:"2026-09-19",amount:0}]);
  expect(daily.total).toBe(400);
  expect((await dailyFeeCollections(outsider.institutionId,"2026-2027","2026-09-17","2026-09-19")).total).toBe(0);
  expect((await listFees(admin.institutionId,{academicYear:"2026-2027"}))[0].pendingAmount).toBe(600);
  expect((await getReceipt(admin.institutionId,first.receiptNumber))?.invoiceNumber).toBe(fee.invoiceNumber);
  expect((await listAccountTransactions(admin.institutionId,{academicYear:"2026-2027"})).items.some(item=>item.sourceId===first.id)).toBe(true);
  expect(await getReceipt(outsider.institutionId,first.receiptNumber)).toBeUndefined();
  await expect(recordPayment(admin.institutionId,admin.id,{...input,requestId:crypto.randomUUID(),amount:600.001})).rejects.toThrow("two decimal places");
 });
 it("validates and stores discounts, late fees and payment frequency",async()=>{
  const stamp=Date.now(),admin=await createAccount({name:"Discount Admin",email:`discount-${stamp}@example.com`,institution:`Discount School ${stamp}`,passwordHash:await hash("password123",4)});
  await configureSchoolCode(admin.institutionId,admin.id);
  await addStudent(admin.institutionId,{name:"Discount Student",admission:`DISC-${stamp}`,gender:"Female",dateOfBirth:"2016-01-01",className:"Class 3",section:"B",parent:"Guardian",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:1000,academicYear:"2026-2027",dueDate:"2027-03-01"},admin.id);
  const fee=(await listFees(admin.institutionId,{academicYear:"2026-2027"}))[0];
  const payment=await recordPayment(admin.institutionId,admin.id,{feeId:String(fee.id),amount:920,method:"Cheque",paymentDate:"2026-09-19",transactionId:"CHQ-1",notes:"",requestId:crypto.randomUUID(),frequency:"Quarterly",discountType:"Percentage",discountValue:10,discountReason:"Sibling concession",lateFee:20});
  expect(payment).toMatchObject({paymentFrequency:"Quarterly",discountAmount:100,lateFee:20,netPayable:920,amount:920});
  expect((await listFees(admin.institutionId,{academicYear:"2026-2027"}))[0]).toMatchObject({discount:100,finalAmount:920,pendingAmount:0,status:"Paid"});
 });
});
