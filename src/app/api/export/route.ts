import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { currentUser } from "@/lib/session";
import {
  listAttendance,
  listClasses,
  listFees,
  listModuleRecords,
  listPayments,
  listStudents,
  listTeachers,
  logExport,
  getInstitution,
  listPromotionHistory,
  dashboardData,
  dashboardYears,
  getSchoolAsset,
  getCompleteSettings,
  adminSalaryData,
  staffAttendanceData,
} from "@/lib/db";
import { schoolParts } from "@/lib/staff-time";
import { moduleConfigs } from "@/config/modules";
import { createFinancialReportPdf } from "@/lib/financial-report-pdf";
import { brandedExcelFilename, createSchoolExcelReport } from "@/lib/excel-report";
import { spreadsheetSafeValue } from "@/lib/security";
export const runtime = "nodejs";
const exportTypeAliases: Record<string, string> = {
  receipts: "payments",
  "fee-receipts": "payments",
  "payment-history": "payments",
};
const templates: Record<string, Record<string, string>[]> = {
  students: [
    {
      "Student Name": "",
      "Admission Number": "",
      Gender: "Male",
      "Blood Group": "",
      "Mother Name": "",
      "Special Quota": "",
      "Quota Description": "",
      "Date of Birth": "YYYY-MM-DD",
      Class: "",
      Section: "",
      "Roll Number": "",
      "Academic Year": "",
      "Parent Name": "",
      "Parent Phone": "",
      "Parent Email": "",
      Address: "",
      "Admission Date": "YYYY-MM-DD",
      "Total Annual Fee": "",
      "Due Date": "YYYY-MM-DD",
    },
  ],
  teachers: [
    {
      "Teacher Name": "",
      "Employee ID": "",
      Email: "",
      Phone: "",
      Department: "",
      "Primary Subject": "",
      "Assigned Classes": "",
      "Joining Date": "YYYY-MM-DD",
      Salary: "",
      Status: "Active",
    },
  ],
  classes: [
    {
      "Class Name": "",
      Section: "",
      "Class Teacher": "",
      "Academic Year": "2026-2027",
      Capacity: "40",
      Status: "Active",
    },
  ],
  attendance: [
    {
      "Admission Number": "",
      Date: "YYYY-MM-DD",
      Status: "Present",
      Remarks: "",
    },
  ],
  fees: [
    {
      "Admission Number": "",
      "Fee Type": "Annual Fee",
      "Academic Year": "2026-2027",
      "Total Amount": "",
      "Due Date": "YYYY-MM-DD",
    },
  ],
  reports: [
    {
      "Admission Number": "",
      "Fee Type": "Annual Fee",
      "Academic Year": "2026-2027",
      "Total Amount": "",
      "Due Date": "YYYY-MM-DD",
    },
  ],
  payments: [
    {
      "Admission Number": "",
      "Student Name": "",
      Class: "",
      Section: "",
      "Roll Number": "",
      "Fee Type": "Annual Fee",
      "Original Fee": "",
      Discount: "0",
      "Final Amount": "",
      "Amount Paid": "",
      "Remaining Amount": "",
      "Payment Method": "Cash",
      "Payment Date": "YYYY-MM-DD",
      "Transaction ID": "",
      "Receipt Number": "",
      Notes: "",
    },
  ],
  assignments: [
    {
      "Assignment Title": "",
      Class: "",
      "Due Date": "YYYY-MM-DD",
      Status: "Published",
    },
  ],
  messages: [{ Recipient: "", Subject: "", Message: "", Status: "Sent" }],
};
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (
    !["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "STAFF", "TEACHER"].includes(user.role)
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = new URL(request.url).searchParams,
    requestedType = (q.get("type") || "students").trim().toLowerCase(),
    type = exportTypeAliases[requestedType] || requestedType,
    format = q.get("format") === "pdf" ? "pdf" : q.get("format") === "csv" ? "csv" : "xlsx",
    template = q.get("template") === "1";
  const financeTypes=new Set(["fees","reports","payments","salary-management"]),adminOnlyTypes=new Set(["teachers","promotions","settings"]);if(financeTypes.has(type)&&!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});if(adminOnlyTypes.has(type)&&!["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});if(type==="dashboard"&&!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  if(type==="promotions"&&!['SCHOOL_ADMIN','SUPER_ADMIN'].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  if(type==="staff-attendance"&&!['SCHOOL_ADMIN','SUPER_ADMIN','ACCOUNTANT'].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  let rows: unknown[] = [];
  if (template) {
    if (!templates[type])
      return NextResponse.json(
        { error: `Import templates are not available for "${requestedType}".` },
        { status: 400 },
      );
    rows = templates[type];
  }
  else if (type === "students")
    rows = await listStudents(user.institutionId, {
      search: q.get("search") || undefined,
      className: q.get("class") || undefined,
      section: q.get("section") || undefined,
      fee: q.get("status") || undefined,
      academicYear:q.get("year")||undefined,
    });
  else if(type==="staff-attendance"){
    const date=q.get("date")||new Date().toISOString().slice(0,10),month=q.get("month")||date.slice(0,7),data=await staffAttendanceData(user.institutionId,date,month,q.get("staffKey")||undefined),school=await getInstitution(user.institutionId),monthly=q.get("report")==="monthly",search=(q.get("search")||"").toLowerCase(),department=q.get("department")||"",status=q.get("status")||"";
    const peopleFilter=<T extends {name:string;department:string}>(items:T[])=>items.filter(item=>(!search||item.name.toLowerCase().includes(search))&&(!department||item.department===department));
    const hours=(minutes:number|null)=>minutes==null?"Not checked out":`${Math.floor(minutes/60)}h ${minutes%60}m`;
    rows=monthly?peopleFilter(data.monthly).map(item=>({school:school.name,period:month,name:item.name,department:item.department,present:item.present,absent:item.absent,late:item.late,halfDay:item.halfDay,leave:item.leave,totalWorkingHours:hours(item.totalWorkMinutes)})):peopleFilter(data.daily).filter(item=>!status||item.status===status).map(item=>({school:school.name,period:date,name:item.name,department:item.department,date:item.date,status:item.status,checkIn:item.checkInAt?schoolParts(new Date(item.checkInAt),data.settings.timezone).time:"",checkOut:item.checkOutAt?schoolParts(new Date(item.checkOutAt),data.settings.timezone).time:"",workingHours:item.checkInAt?hours(item.totalWorkMinutes):"",remarks:item.remarks}));
  }
  else if (type === "teachers")
    rows = await listTeachers(user.institutionId, q.get("search") || "");
  else if (type === "classes")
    rows = await listClasses(user.institutionId, q.get("year") || undefined);
  else if (type === "attendance")
    rows = await listAttendance(user.institutionId, {
      date: q.get("date") || undefined,
      className: q.get("class") || undefined,
      section: q.get("section") || undefined,
      status: q.get("status") || undefined,
      academicYear:q.get("year")||undefined,
    });
  else if (type === "fees" || type === "reports")
    rows = await listFees(user.institutionId, {
      search: q.get("search") || undefined,
      className: q.get("class") || undefined,
      section: q.get("section") || undefined,
      status: q.get("status") || undefined,
      academicYear: q.get("year") || undefined,
    });
  else if (type === "payments")
    rows = await listPayments(user.institutionId, {
      search: q.get("search") || undefined,
      className: q.get("class") || undefined,
      section: q.get("section") || undefined,
      method: q.get("method") || undefined,
      status: q.get("status") || undefined,
      from: q.get("from") || undefined,
      to: q.get("to") || undefined,
      academicYear: q.get("year") || undefined,
    });
  else if(type==="promotions")rows=await listPromotionHistory(user.institutionId,q.get("search")||"");
  else if(type==="dashboard"){const years=await dashboardYears(user.institutionId),requested=q.get("year");if(requested&&!years.some(y=>y.name===requested))return NextResponse.json({error:"Academic year unavailable"},{status:404});const selected=requested??years.find(y=>y.isActive)?.name??years[0]?.name;if(!selected)return NextResponse.json({error:"No academic year available"},{status:404});const data=await dashboardData(user.institutionId,selected);rows=[{metric:"Academic Year",value:selected},{metric:"Students",value:data.students},{metric:"Teachers",value:data.teachers},{metric:"Present Today",value:data.present},{metric:"Absent Today",value:data.absent},{metric:"Total Fees",value:data.fees.total},{metric:"Collected Fees",value:data.fees.collected},{metric:"Pending Fees",value:data.fees.pending},{metric:"Overdue Fees",value:data.fees.overdue},{metric:"Today's Collection",value:data.collections.today},{metric:"This Month",value:data.collections.month},{metric:"Transactions",value:data.collections.transactions}]}
  else if(type==="settings"){
    const s=await getCompleteSettings(user.institutionId);
    rows=[
      {section:"General",setting:"School Name",value:s.name},{section:"General",setting:"School Type",value:s.schoolType},{section:"General",setting:"Address",value:s.address},{section:"General",setting:"City / State / PIN",value:[s.city,s.state,s.pinCode].filter(Boolean).join(", ")},{section:"General",setting:"DISE / UDISE Code",value:s.diseCode},{section:"General",setting:"Phone",value:s.phone},{section:"General",setting:"Email",value:s.email},{section:"General",setting:"Website",value:s.website},
      {section:"Administration",setting:"Principal",value:s.principalName},{section:"Administration",setting:"Registration Number",value:s.registrationNumber},{section:"Administration",setting:"Affiliation",value:s.affiliation},{section:"Administration",setting:"Motto",value:s.motto},
      {section:"Academic",setting:"Active Academic Year",value:s.academicYear},...s.years.map(y=>({section:"Academic Year",setting:y.name,value:`${y.status}; months ${y.startMonth} to ${y.endMonth}${y.name===s.academicYear?"; currently active":""}`})),...s.classes.filter(c=>c.active).map(c=>({section:"Class",setting:c.name,value:c.sections.length?`Sections: ${c.sections.join(", ")}`:"No sections"})),
      {section:"Templates",setting:"Fee Receipt Title",value:s.feeReceiptTitle},{section:"Templates",setting:"Fee Receipt Sub-header",value:s.feeReceiptSubheader},{section:"Templates",setting:"Pay Slip Title",value:s.payslipTitle},{section:"Templates",setting:"Pay Slip Sub-header",value:s.payslipSubheader},{section:"Templates",setting:"Signature Label",value:s.signatureLabel},{section:"Templates",setting:"Footer Text",value:s.footerText},
      {section:"Assets",setting:"School Logo",value:s.logoUrl?"Uploaded and included in PDFs":"Not uploaded"},{section:"Assets",setting:"Authorized Signature",value:s.signatureUrl?"Uploaded and used on receipts":"Not uploaded"},
    ];
  }
  else if(type==="salary-management"){
    const salary=await adminSalaryData({school:user.institutionId,search:q.get("search")||undefined,status:q.get("status")||undefined,month:Number(q.get("month"))||undefined,year:Number(q.get("year"))||undefined,limit:10000});
    const rupees=(value:unknown)=>Number(value||0)/100;
    rows=salary.items.map(item=>({...item,basic:rupees(item.basicPaise),gross:rupees(item.grossPaise),deductions:rupees(item.totalDeductionsPaise),netSalary:rupees(item.netPaise),paidAmount:rupees(item.paidPaise),pendingAmount:rupees(item.netPaise)-rupees(item.paidPaise)}));
  }
  else if (moduleConfigs[type])
    rows = await listModuleRecords(user.institutionId, type);
  else
    return NextResponse.json(
      { error: `Unsupported export type "${requestedType}".` },
      { status: 400 },
    );
  if (format === "pdf") {
    if (template)
      return NextResponse.json({ error: "PDF is available for saved records, not blank import templates." }, { status: 400 });
    const [school,asset]=await Promise.all([getInstitution(user.institutionId),getSchoolAsset(user.institutionId,"logo")]),model=pdfModel(type==="staff-attendance"&&q.get("report")==="monthly"?"staff-attendance-monthly":type,rows as Record<string,unknown>[]),activeFilters=[q.get("search")&&`Search: ${q.get("search")}`,q.get("class")&&`Class: ${q.get("class")}`,q.get("section")&&`Section: ${q.get("section")}`,q.get("department")&&`Department: ${q.get("department")}`,q.get("status")&&`Status: ${q.get("status")}`,q.get("method")&&`Method: ${q.get("method")}`,q.get("date")&&`Date: ${q.get("date")}`,q.get("month")&&`Month: ${q.get("month")}`,q.get("from")&&`From: ${q.get("from")}`,q.get("to")&&`To: ${q.get("to")}`].filter(Boolean) as string[];
    try {
      const data=await createFinancialReportPdf({title:model.title,academicYear:type==="staff-attendance"?(q.get("month")||q.get("date")||school.academicYear):(q.get("year")||school.academicYear),school:{...school,logo:asset?{mimeType:asset.mimeType,data:new Uint8Array(asset.data)}:undefined},columns:model.columns,rows:model.rows,totals:[{label:"Total Records",value:String(model.rows.length)}],filters:activeFilters});
      await logExport(user.institutionId,user.id,`${type} PDF`,model.rows.length);
      return new Response(Buffer.from(data),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="EduLedger_${safeName(model.title)}_${q.get("year")||school.academicYear}.pdf"`,"Cache-Control":"private, no-store"}});
    } catch {
      return NextResponse.json({error:"Could not generate the PDF export."},{status:500});
    }
  }
  const sheetRows=type==="students"&&!template?(rows as Record<string,unknown>[]).map(item=>({...item,"Roll Number":item.rollNumber??"","Academic Year":item.academicYear??"","Blood Group":item.bloodGroup??"","Mother Name":item.motherName??"","Special Quota":item.specialQuota??"","Quota Description":item.specialQuotaDescription??""})):rows as Record<string,unknown>[];
  const [school,asset]=await Promise.all([getCompleteSettings(user.institutionId),getSchoolAsset(user.institutionId,"logo")]),title=template?`${label(type)} Import Template`:pdfModel(type,sheetRows).title,academicYear=q.get("year")||school.academicYear,activeFilters=[q.get("class")&&`Class: ${q.get("class")}`,q.get("section")&&`Section: ${q.get("section")}`,q.get("date")&&`Date: ${q.get("date")}`,q.get("month")&&`Month: ${q.get("month")}`,q.get("from")&&`From: ${q.get("from")}`,q.get("to")&&`To: ${q.get("to")}`].filter(Boolean) as string[];
  const safeSheetRows=sheetRows.map(item=>Object.fromEntries(Object.entries(item).map(([key,value])=>[key,spreadsheetSafeValue(value)])));
  const data=format==="csv"?XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(safeSheetRows)):
    await createSchoolExcelReport({school,logo:asset?{mimeType:asset.mimeType,data:asset.data}:undefined,title,academicYear,rows:safeSheetRows,filters:activeFilters,sheetName:label(type)});
  if (!template) await logExport(user.institutionId, user.id, type, rows.length);
  const filename = format==="xlsx"?brandedExcelFilename(school.name,title,q.get("from")||undefined,q.get("to")||undefined):`${template ? `${type}-import-template` : type}-${new Date().toISOString().slice(0, 10)}.${format}`;
  return new Response(data, {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const pdfFields:Record<string,[string,string][]>={
 "staff-attendance":[["name","Staff"],["department","Department"],["date","Date"],["status","Status"],["checkIn","Check-in"],["checkOut","Check-out"],["workingHours","Hours"],["remarks","Remarks"]],
 "staff-attendance-monthly":[["name","Staff"],["department","Department"],["present","Present"],["absent","Absent"],["late","Late"],["halfDay","Half Day"],["leave","Leave"],["totalWorkingHours","Hours"]],
 students:[["admission","Admission No."],["name","Student Name"],["className","Class"],["section","Section"],["dateOfBirth","Date of Birth"],["gender","Gender"],["bloodGroup","Blood Group"],["parent","Father / Guardian"],["motherName","Mother Name"],["status","Status"]],
 teachers:[["employeeId","Employee ID"],["name","Teacher Name"],["department","Department"],["subject","Subject"],["classes","Assigned Classes"],["phone","Phone"],["email","Email"],["joiningDate","Joining Date"],["status","Status"]],
 classes:[["name","Class"],["section","Section"],["academicYear","Academic Year"],["teacher","Class Teacher"],["currentStudents","Students"],["capacity","Capacity"],["status","Status"]],
 attendance:[["date","Date"],["studentName","Student Name"],["admission","Admission No."],["className","Class"],["section","Section"],["status","Status"],["remarks","Remarks"]],
 fees:[["studentName","Student Name"],["admission","Admission"],["className","Class"],["section","Section"],["feeType","Fee Type"],["totalAmount","Original Fee"],["discount","Discount"],["finalAmount","Final Payable"],["paidAmount","Paid"],["pendingAmount","Remaining"],["status","Status"]],
 reports:[["studentName","Student Name"],["admission","Admission"],["className","Class"],["feeType","Fee Type"],["totalAmount","Original Fee"],["discount","Discount"],["finalAmount","Final Payable"],["paidAmount","Paid"],["pendingAmount","Remaining"],["status","Status"]],
 payments:[["receiptNumber","Receipt"],["paymentDate","Date"],["studentName","Student Name"],["admission","Admission"],["className","Class"],["section","Section"],["method","Mode"],["transactionId","Transaction ID"],["amount","Amount"],["status","Status"]],
 promotions:[["studentName","Student"],["admission","Admission"],["previousYear","Previous Year"],["previousClass","Previous Class"],["newYear","New Year"],["newClass","New Class"],["promotedBy","Promoted By"],["promotedAt","Promoted Date"]],
 dashboard:[["metric","Dashboard Metric"],["value","Value"]],
 settings:[["section","Section"],["setting","Setting"],["value","Saved Value"]],
 "salary-management":[["payslipNumber","Slip #"],["employeeName","Employee"],["employeeId","Employee ID"],["role","Role"],["month","Month"],["year","Year"],["basic","Basic Salary"],["netSalary","Net Salary"],["paidAmount","Paid"],["paymentStatus","Status"]],
};
function pdfModel(type:string,source:Record<string,unknown>[]){const configured=pdfFields[type],fallbackKeys=source[0]?Object.keys(source[0]).filter(key=>key!=="id").slice(0,10):moduleConfigs[type]?.fields.map(field=>field.key).slice(0,10)||[],fields=(configured||fallbackKeys.map(key=>[key,label(key)] as [string,string])).slice(0,10),columnWidth=519/Math.max(fields.length,1),rows=source.map((item,index)=>Object.fromEntries(fields.map(([key])=>[key,key==="_serial"?index+1:display(item[key])])));return{title:type==="payments"?"Payment History":type==="fees"||type==="reports"?"Fee Structure":type==="dashboard"?"Dashboard Summary":type==="settings"?"Institution Settings Report":`${label(type)} Report`,rows,columns:fields.map(([key,name])=>({key,label:name,width:columnWidth,align:/amount|paid|balance|total|capacity/i.test(key)?"right" as const:"left" as const}))}}
function label(value:string){return value.replace(/[-_]/g," ").replace(/\b\w/g,character=>character.toUpperCase())}
function display(value:unknown){if(value===null||value===undefined||value==="")return "-";if(typeof value==="number")return value.toLocaleString("en-IN");if(typeof value==="object")return JSON.stringify(value);return String(value)}
function safeName(value:string){return value.replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"")}
