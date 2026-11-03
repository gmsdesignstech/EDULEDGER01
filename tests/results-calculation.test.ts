import { describe, expect, it } from "vitest";
import { calculateStudentResult, defaultResultSettings, type SubjectOutcome } from "../src/lib/results";

const subject=(subjectId:string,obtainedCent:number|null,markStatus:SubjectOutcome["markStatus"]="Scored"):SubjectOutcome=>({subjectId,subject:subjectId,maximumCent:10000,passingCent:3500,required:true,obtainedCent,markStatus,remarks:""});

describe("result calculations",()=>{
  it("includes absent subjects in the maximum total",()=>{
    const result=calculateStudentResult([subject("English",8500),subject("Maths",null,"Absent")],defaultResultSettings);
    expect(result.totalCent).toBe(8500);
    expect(result.maximumCent).toBe(20000);
    expect(result.percentage).toBe(42.5);
    expect(result.status).toBe("Absent");
  });

  it("does not count exempt subjects in the denominator",()=>{
    const result=calculateStudentResult([subject("English",8500),subject("Activity",null,"Exempt")],defaultResultSettings);
    expect(result.maximumCent).toBe(10000);
    expect(result.status).toBe("Pass");
  });
});
