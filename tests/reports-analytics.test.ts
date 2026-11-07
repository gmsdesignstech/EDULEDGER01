import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { addStudent, createAccount, dashboardYears, getInstitution, listClassSummaries, schoolReportAnalytics } from "../src/lib/db";
import { configureSchoolCode } from "./configure-school-code";

async function makeSchool(label:string){
  const stamp=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const admin=await createAccount({name:`${label} Reports Admin`,email:`${label.toLowerCase()}-${stamp}@example.com`,institution:`${label} Reports ${stamp}`,passwordHash:await hash("reports-test-password",4)});
  const year=(await dashboardYears(admin.institutionId))[0];
  if(!year)throw new Error("Test school academic year was not initialized.");
  return {admin,year:year.name};
}

describe("school report analytics",()=>{
  it("returns real empty-state aggregates for an isolated school and respects the requested date range",async()=>{
    const school=await makeSchool("Analytics A"),result=await schoolReportAnalytics(school.admin.institutionId,school.year,"2026-04-01","2026-04-30");
    expect(result.academicYear).toBe(school.year);
    expect(result.from).toBe("2026-04-01");
    expect(result.to).toBe("2026-04-30");
    expect(result.students.total).toBe(0);
    expect(result.attendance.recorded).toBe(0);
    expect(result.attendance.percentage).toBeNull();
    expect(result.academics.averagePercent).toBeNull();
    expect(result.fees).toEqual({total:0,collected:0,outstanding:0});
    expect(result.classes).toEqual([]);
  });

  it("rejects report ranges longer than one year",async()=>{
    const school=await makeSchool("Analytics Range");
    await expect(schoolReportAnalytics(school.admin.institutionId,school.year,"2026-01-01","2027-01-02")).rejects.toThrow("cannot exceed 366 days");
  });

  it("does not share aggregates across school identifiers",async()=>{
    const [schoolA,schoolB]=await Promise.all([makeSchool("Analytics School A"),makeSchool("Analytics School B")]);
    await configureSchoolCode(schoolA.admin.institutionId,schoolA.admin.id);
    await listClassSummaries(schoolA.admin.institutionId,schoolA.year);
    await addStudent(schoolA.admin.institutionId,{name:"School A Report Student",admission:`A-${Date.now()}`,gender:"Female",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Test Parent",parentPhone:"9000000000",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:100,academicYear:schoolA.year,dueDate:"2027-03-31"},schoolA.admin.id);
    const [a,b]=await Promise.all([
      schoolReportAnalytics(schoolA.admin.institutionId,schoolA.year,"2026-04-01","2026-04-30"),
      schoolReportAnalytics(schoolB.admin.institutionId,schoolB.year,"2026-04-01","2026-04-30"),
    ]);
    expect(a.students.total).toBe(1);
    expect(b.students.total).toBe(0);
    expect(a.classes.reduce((sum,item)=>sum+item.students,0)).toBe(1);
    expect(a.admissions.reduce((sum,item)=>sum+item.count,0)).toBe(1);
    expect(b.classes).toEqual([]);
    expect(a.fees.total).toBe(100);
    expect(a.fees.outstanding).toBe(100);
    expect(b.fees.total).toBe(0);
  });
});
