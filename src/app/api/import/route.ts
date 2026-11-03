import { NextResponse } from "next/server";
import { z } from "zod";
import { bloodGroupSchema, motherNameSchema, studentImportValue } from "@/lib/student-fields";
import { quotaDescriptionSchema, quotaPairError, specialQuotaSchema } from "@/lib/student-quota";
import { admissionYear, normalizeSchoolCode, parseStudentId } from "@/lib/roll-number";
import {
  addModuleRecord,
  addStudentsAtomic,
  assertStudentCapacity,
  createFee,
  findStudentByAdmission,
  getInstitution,
  getCompleteSettings,
  listFees,
  studentImportKeys,
  logImport,
  markAttendance,
  recordPayment,
  paymentRequestExists,
  saveClass,
  saveTeacher,
  type StudentInput,
} from "@/lib/db";
import { currentUser } from "@/lib/session";
import { explainCapacityError } from "@/lib/subscription-access";
import { importDefinitions, normalizeImportRows, uniqueImportAdmission, type ImportRow } from "@/lib/import-schema";
import { logServerError } from "@/lib/server-errors";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
export const runtime = "nodejs";
export const maxDuration = 60;
const requestSchema = z.object({
  type: z.enum([
    "students",
    "teachers",
    "classes",
    "attendance",
    "fees",
    "reports",
    "payments",
    "assignments",
    "messages",
  ]),
  rows: z
    .array(z.record(z.union([z.string(), z.number(), z.null()])))
    .min(1)
    .max(100),
  rowOffset:z.number().int().min(0).max(5000).default(0),
  headerRow:z.number().int().min(1).max(25).default(1),
});
type Row = ImportRow;
const s = (row: Row, key: string) => String(row[key] ?? "").trim(),
  n = (row: Row, key: string) => Number(row[key] ?? 0);
function validIsoDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function requiredFor(type: string) {
  if (type === "students")
    return [
      "Student Name",
      "Admission Number",
      "Gender",
      "Date of Birth",
      "Class",
      "Section",
      "Parent Name",
      "Admission Date",
      "Due Date",
    ];
  if (type === "teachers")
    return [
      "Teacher Name",
      "Employee ID",
      "Phone",
      "Department",
      "Primary Subject",
      "Joining Date",
    ];
  if (type === "classes") return ["Class Name", "Section", "Academic Year"];
  if (type === "attendance") return ["Admission Number", "Date", "Status"];
  if (type === "payments")
    return [
      "Admission Number",
      "Amount Paid",
      "Payment Method",
      "Payment Date",
    ];
  if (type === "assignments")
    return ["Assignment Title", "Class", "Due Date", "Status"];
  if (type === "messages") return ["Recipient", "Subject", "Message", "Status"];
  return ["Admission Number", "Total Amount", "Due Date"];
}
function studentInput(row:Row,defaultAcademicYear:string):StudentInput{return{
  name:s(row,"Student Name"),admission:s(row,"Admission Number"),gender:s(row,"Gender"),
  bloodGroup:studentImportValue(row,["Blood Group","blood_group","bloodGroup"]),motherName:studentImportValue(row,["Mother Name","mother_name","motherName"]),
  specialQuota:specialQuotaSchema.parse(studentImportValue(row,["Special Quota","special_quota","specialQuota","Quota"])),specialQuotaDescription:studentImportValue(row,["Quota Description","special_quota_description","specialQuotaDescription"]),
  dateOfBirth:s(row,"Date of Birth"),className:s(row,"Class"),section:s(row,"Section"),rollNumber:s(row,"Roll Number"),parent:s(row,"Parent Name"),parentPhone:s(row,"Parent Phone"),parentEmail:s(row,"Parent Email"),address:s(row,"Address"),admissionDate:s(row,"Admission Date"),totalFee:n(row,"Total Annual Fee"),academicYear:s(row,"Academic Year")||defaultAcademicYear,dueDate:s(row,"Due Date"),
}}
async function importRecords(request: Request) {
  const startedAt=Date.now(),requestId=crypto.randomUUID();
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ success:false, message:"Please sign in and try again.", error:"Unauthenticated", imported:0, skipped:0, failed:0, errors:[] }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role))
    return NextResponse.json({ success:false, message:"You do not have permission to import these records.", error:"Forbidden", imported:0, skipped:0, failed:0, errors:[] }, { status: 403 });
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        success:false,
        message:"Student import validation failed",
        error:"Invalid import. Use a supported template with no more than 5,000 rows.",
        imported:0, skipped:0, failed:0, errors:[],
      },
      { status: 400 },
    );
  const type=parsed.data.type,rows=normalizeImportRows(type,parsed.data.rows),rowOffset=parsed.data.rowOffset,headerRow=parsed.data.headerRow,
    errors: { row: number; message: string }[] = [],
    valid: Row[] = [];
  if(type==="students"&&!["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role))return NextResponse.json({success:false,message:"You do not have permission to import students.",error:"Forbidden",imported:0,skipped:rows.length,failed:rows.length,errors:[]},{status:403});
  const required=requiredFor(type),available=new Set(rows.flatMap(row=>Object.keys(row)));
  const missingColumn=required.find(column=>!available.has(column));
  if(missingColumn){const message=`${missingColumn} column could not be mapped. Check the column mapping or download the current template.`;return NextResponse.json({success:false,message,error:`Detected supported columns: ${Object.keys(importDefinitions[type]||{}).join(", ")}.`,imported:0,skipped:rows.length,failed:rows.length,errors:[]},{status:400})}
  const defaultAcademicYear=(await getInstitution(user.institutionId)).academicYear;
  const studentSettings=type==="students"?await getCompleteSettings(user.institutionId):null;
  const existingStudents=type==="students"?await studentImportKeys(user.institutionId):[];
  const seenAdmissions=new Set(existingStudents.map(student=>student.admission.trim().toLowerCase()));
  const seenRollNumbers=new Set(existingStudents.map(student=>student.rollNumber.trim().toLowerCase()).filter(Boolean));
  console.info("[import]",{event:"start",requestId,institutionId:user.institutionId,userId:user.id,type,rows:rows.length,rowOffset});
  const rowNumber=(index:number)=>rowOffset+headerRow+index+1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i],
      missing = requiredFor(type).find((key) => !s(row, key));
    if (missing) {
      errors.push({ row: rowNumber(i), message: `${missing} is required.` });
      continue;
    }
    if(type==="students"){
      const admission=uniqueImportAdmission(s(row,"Admission Number"),seenAdmissions);
      row["Admission Number"]=admission;
      const gender=s(row,"Gender").toLowerCase();
      if(!["male","female","other"].includes(gender)){errors.push({row:rowNumber(i),message:"Gender must be Male, Female or Other."});continue;}
      row.Gender=gender[0].toUpperCase()+gender.slice(1);
      if(s(row,"Student Name").length<2||s(row,"Student Name").length>100){errors.push({row:rowNumber(i),message:"Student Name must contain 2 to 100 characters."});continue;}
      if(s(row,"Admission Number").length<2||s(row,"Admission Number").length>40){errors.push({row:rowNumber(i),message:"Admission Number must contain 2 to 40 characters."});continue;}
      if(s(row,"Parent Name").length<2||s(row,"Parent Name").length>100){errors.push({row:rowNumber(i),message:"Parent Name must contain 2 to 100 characters."});continue;}
      try{row["Parent Phone"]=normalizeWhatsAppNumber(s(row,"Parent Phone"))}catch(error){errors.push({row:rowNumber(i),message:error instanceof Error?error.message:"Parent Phone is invalid."});continue;}
      const email=s(row,"Parent Email");if(email&&!z.string().email().safeParse(email).success){errors.push({row:rowNumber(i),message:"Parent Email must be a valid email address."});continue;}
      const fee=n(row,"Total Annual Fee");if(!Number.isFinite(fee)||fee<0||fee>100000000){errors.push({row:rowNumber(i),message:"Total Annual Fee must be a number from 0 to 100,000,000."});continue;}
      for(const field of ["Date of Birth","Admission Date","Due Date"]){if(!validIsoDate(s(row,field))){errors.push({row:rowNumber(i),message:`${field} must be a valid date in YYYY-MM-DD format.`});break;}}
      if(errors.at(-1)?.row===rowNumber(i))continue;
      try {
        const schoolCode=normalizeSchoolCode(studentSettings?.schoolCode||"");
        const importedYear=s(row,"Academic Year")||defaultAcademicYear;
        const importedStartYear=admissionYear(importedYear),suppliedRoll=s(row,"Roll Number").toUpperCase(),parsedRoll=parseStudentId(suppliedRoll);
        if(!studentSettings?.years.some(year=>year.name===importedYear&&year.status==="Active"))throw new Error("Academic year is unavailable for this school.");
        if(suppliedRoll&&parsedRoll&&parsedRoll.code===schoolCode&&parsedRoll.year===importedStartYear&&!seenRollNumbers.has(suppliedRoll.toLowerCase()))seenRollNumbers.add(suppliedRoll.toLowerCase());
        else row["Roll Number"]="";
      } catch(error) { errors.push({row:rowNumber(i),message:error instanceof Error?error.message:"Invalid school code or academic year."});continue; }
      const bloodGroup=studentImportValue(row,["Blood Group","blood_group","bloodGroup"]);
      const motherName=studentImportValue(row,["Mother Name","mother_name","motherName"]);
      const bloodCheck=bloodGroupSchema.safeParse(bloodGroup),motherCheck=motherNameSchema.safeParse(motherName);
      if(!bloodCheck.success){errors.push({row:rowNumber(i),message:"Blood Group must use one of the supported values."});continue;}
      if(!motherCheck.success){errors.push({row:rowNumber(i),message:motherCheck.error.issues[0]?.message||"Mother Name is invalid."});continue;}
      const quota=studentImportValue(row,["Special Quota","special_quota","specialQuota","Quota"]);
      const description=studentImportValue(row,["Quota Description","special_quota_description","specialQuotaDescription"]);
      const quotaCheck=specialQuotaSchema.safeParse(quota),descriptionCheck=quotaDescriptionSchema.safeParse(description);
      if(!quotaCheck.success){errors.push({row:rowNumber(i),message:"Special Quota must use one of the supported values."});continue;}
      if(!descriptionCheck.success){errors.push({row:rowNumber(i),message:descriptionCheck.error.issues[0]?.message||"Quota Description is invalid."});continue;}
      const pairError=quotaPairError(quotaCheck.data,descriptionCheck.data);
      if(pairError){errors.push({row:rowNumber(i),message:pairError});continue;}
      const configuredClass=studentSettings?.classes.find(item=>item.active&&item.name.toLowerCase()===s(row,"Class").toLowerCase());
      if(!configuredClass){errors.push({row:rowNumber(i),message:`Class "${s(row,"Class")}" does not exist or is inactive.`});continue;}
      if(!configuredClass.sections.some(section=>section.toLowerCase()===s(row,"Section").toLowerCase())){errors.push({row:rowNumber(i),message:`Section "${s(row,"Section")}" does not exist in ${configuredClass.name}.`});continue;}
      row.Class=configuredClass.name;
      row.Section=configuredClass.sections.find(section=>section.toLowerCase()===s(row,"Section").toLowerCase())!;
    }
    if (
      ["fees", "reports", "attendance", "payments"].includes(type) &&
      !(await findStudentByAdmission(user.institutionId, s(row, "Admission Number")))
    ) {
      errors.push({ row: i + 2, message: "Admission number was not found." });
      continue;
    }
    if (
      type === "attendance" &&
      !["Present", "Absent", "Late", "Leave"].includes(s(row, "Status"))
    ) {
      errors.push({
        row: i + 2,
        message: "Status must be Present, Absent, Late or Leave.",
      });
      continue;
    }
    if (
      type === "payments" &&
      !["Cash", "UPI", "Card", "Bank Transfer", "Online", "Other"].includes(
        s(row, "Payment Method"),
      )
    ) {
      errors.push({ row: i + 2, message: "Unsupported payment method." });
      continue;
    }
    if(type==="payments"){
      const original=n(row,"Original Fee"),discount=n(row,"Discount"),final=n(row,"Final Amount"),paid=n(row,"Amount Paid"),remaining=n(row,"Remaining Amount");
      if(!Number.isFinite(paid)||paid<=0){errors.push({row:i+2,message:"Amount Paid must be a positive number."});continue}
      if(discount<0||original<0||final<0||remaining<0){errors.push({row:i+2,message:"Fee and discount amounts cannot be negative."});continue}
      if(original&&Math.abs((original-discount)-(final||original-discount))>0.01){errors.push({row:i+2,message:"Final Amount must equal Original Fee minus Discount."});continue}
      if(final&&Math.abs((final-paid)-remaining)>0.01&&s(row,"Remaining Amount")){errors.push({row:i+2,message:"Remaining Amount must equal Final Amount minus Amount Paid."});continue}
      if(s(row,"Payment Date")&&!/^\d{4}-\d{2}-\d{2}$/.test(s(row,"Payment Date"))){errors.push({row:i+2,message:"Payment Date must use YYYY-MM-DD."});continue}
    }
    valid.push(row);
  }
  if(type==="students"&&valid.length){
    try{await assertStudentCapacity(user.institutionId,valid.length)}catch(error){const message=explainCapacityError(error)||"Student capacity check failed.";return NextResponse.json({success:false,message,error:"Student capacity check failed.",imported:0,skipped:rows.length,failed:rows.length,errors},{status:409})}
  }
  let imported = 0;
  if(type==="students"&&valid.length){
    try{await addStudentsAtomic(user.institutionId,valid.map(row=>studentInput(row,defaultAcademicYear)),user.id,{allowImportedRoll:true,enforceCapacity:true});imported=valid.length}
    catch(batchError){
      logServerError("import.student-batch",batchError,{requestId,institutionId:user.institutionId,rowOffset,rows:valid.length});
      const duplicate=batchError instanceof Error&&/unique|duplicate|already exists/i.test(batchError.message);
      for(const row of valid)errors.push({row:rowNumber(rows.indexOf(row)),message:duplicate?`Admission number ${s(row,"Admission Number")} or Student ID already exists.`:"This batch could not be saved safely. No records in this batch were imported; retry is safe."});
    }
  }
  for (const row of type==="students"?[]:valid) {
    try {
      if (type === "teachers")
        await saveTeacher(
          user.institutionId,
          {
            name: s(row, "Teacher Name"),
            employeeId: s(row, "Employee ID"),
            email: s(row, "Email"),
            phone: s(row, "Phone"),
            department: s(row, "Department"),
            subject: s(row, "Primary Subject"),
            classes: s(row, "Assigned Classes"),
            joiningDate: s(row, "Joining Date"),
            salary: n(row, "Salary"),
            status: s(row, "Status") || "Active",
          },
          user.id,
        );
      else if (type === "classes")
        await saveClass(
          user.institutionId,
          {
            name: s(row, "Class Name"),
            section: s(row, "Section"),
            teacher: s(row, "Class Teacher"),
            academicYear: s(row, "Academic Year"),
            capacity: n(row, "Capacity") || 40,
            status: s(row, "Status") || "Active",
          },
          user.id,
        );
      else if (type === "fees" || type === "reports") {
        const student = await findStudentByAdmission(
          user.institutionId,
          s(row, "Admission Number"),
        )!;
        await createFee(
          user.institutionId,
          student.id,
          {
            feeType: s(row, "Fee Type") || "Annual Fee",
            academicYear: s(row, "Academic Year") || defaultAcademicYear,
            totalAmount: n(row, "Total Amount"),
            dueDate: s(row, "Due Date"),
          },
          user.id,
        );
      } else if (type === "attendance") {
        const student = await findStudentByAdmission(
          user.institutionId,
          s(row, "Admission Number"),
        )!;
        await markAttendance(
          user.institutionId,
          s(row, "Date"),
          [
            {
              studentId: student.id,
              status: s(row, "Status"),
              remarks: s(row, "Remarks"),
            },
          ],
          user.name,
          user.id,
        );
      } else if (type === "payments") {
        const admission=s(row,"Admission Number"),invoice=s(row,"Invoice Number"),fees=await listFees(user.institutionId,{search:invoice||admission}),fee=fees.find(item=>item.admission===admission&&(!invoice||item.invoiceNumber===invoice)&&Number(item.pendingAmount)>0);
        if (!fee) throw new Error("No payable fee record was found for this student.");
        const transaction=s(row,"Transaction ID"),receipt=s(row,"Receipt Number"),requestId=`fee-import:${transaction||receipt||[admission,s(row,"Payment Date"),s(row,"Amount Paid")].join(":")}`;
        if(await paymentRequestExists(user.institutionId,requestId))throw new Error("Duplicate payment record.");
        await recordPayment(user.institutionId, user.id, {
          feeId: String(fee.id),
          amount: n(row, "Amount Paid"),
          method: s(row, "Payment Method"),
          paymentDate: s(row, "Payment Date"),
          transactionId: transaction,
          notes: s(row, "Notes"),
          requestId,
          receiptNumber:receipt||undefined,
          discountType:"Fixed",
          discountValue:n(row,"Discount"),
          discountReason:n(row,"Discount")>0?"Imported fee discount":"",
        });
      } else if (type === "assignments")
        await addModuleRecord(user.institutionId, "assignments", {
          title: s(row, "Assignment Title"),
          class: s(row, "Class"),
          due: s(row, "Due Date"),
          status: s(row, "Status"),
        });
      else
        await addModuleRecord(user.institutionId, "messages", {
          recipient: s(row, "Recipient"),
          subject: s(row, "Subject"),
          message: s(row, "Message"),
          status: s(row, "Status"),
        });
      imported++;
    } catch (error) {
      errors.push({
        row: rowNumber(rows.indexOf(row)),
        message:
          error instanceof Error && /unique|duplicate key/i.test(error.message)
            ? "Duplicate record."
            : type === "students" && error instanceof Error && /^(Roll Number must|Roll number already|School code must|Select a valid academic year)/.test(error.message)
              ? error.message
              : type === "students" ? "Could not import this student row." : error instanceof Error ? error.message : "Could not import this row.",
      });
    }
  }
  if(imported){try{await logImport(user.institutionId,user.id,type,imported)}catch(error){logServerError("import.audit",error,{userId:user.id,institutionId:user.institutionId,imported})}}
  console.info("[import]",{event:"complete",requestId,institutionId:user.institutionId,type,total:rows.length,imported,failed:errors.length,durationMs:Date.now()-startedAt});
  const duplicateCount=errors.filter(item=>/duplicate|already exists/i.test(item.message)).length;
  const summary={total:rows.length,imported,skipped:duplicateCount,failed:errors.length-duplicateCount};
  return NextResponse.json({
    success: imported > 0,
    message: imported > 0 ? `${imported} record${imported===1?"":"s"} imported successfully.` : "Student import validation failed",
    total: rows.length,
    valid: valid.length,
    invalid: errors.length,
    imported,
    skipped: rows.length - imported,
    failed: errors.length,
    duplicates: errors.filter(item=>/duplicate|already exists/i.test(item.message)).length,
    errors,
    summary,
    requestId,
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    return await importRecords(request);
  } catch (error) {
    logServerError("import.POST", error, { requestId, httpStatus: 500 });
    return NextResponse.json(
      {
        success: false,
        message: "Unable to import students. Please try again.",
        error: "The import could not be completed.",
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        summary: { total: 0, imported: 0, skipped: 0, failed: 0 },
        requestId,
      },
      { status: 500 },
    );
  }
}
