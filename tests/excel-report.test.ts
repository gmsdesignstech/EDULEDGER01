import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createSchoolExcelReport } from "../src/lib/excel-report";

describe("school branded Excel reports",()=>{
  it("creates a valid styled workbook with merged branding and frozen table headings",async()=>{
    const bytes=await createSchoolExcelReport({school:{name:"DAPS Jaipur",address:"Main Road",phone:"9999999999",email:"school@example.com"},title:"Student Report",academicYear:"2026-2027",rows:[{"Student Name":"Rahul",Class:"5",Section:"A"}],filters:["Class: 5","Section: A"]});
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);const sheet=workbook.worksheets[0];
    expect(sheet.getCell("A1").value).toBe("DAPS Jaipur");
    expect(sheet.getCell("A5").value).toBe("STUDENT REPORT");
    expect(sheet.getCell("A1").fill).toMatchObject({fgColor:{argb:"FFF2CC"}});
    expect(sheet.getCell("C3").fill).toMatchObject({fgColor:{argb:"FFF2CC"}});
    expect(sheet.getCell("A5").fill).toMatchObject({fgColor:{argb:"FFD966"}});
    expect(sheet.getCell("A1").font).toMatchObject({name:"Times New Roman",bold:true,size:18});
    expect(sheet.getCell("A1").alignment).toMatchObject({horizontal:"center",vertical:"middle",shrinkToFit:true});
    expect(sheet.getCell("A1").alignment?.wrapText).not.toBe(true);
    expect(sheet.getRow(1).height).toBe(27);
    expect(sheet.getRow(5).height).toBe(24);
    expect(sheet.getCell("A5").font).toMatchObject({name:"Times New Roman",bold:true,size:14});
    expect(sheet.getCell("A8").font.bold).toBe(true);
    expect(sheet.getCell("A8").fill).toMatchObject({type:"pattern",pattern:"solid"});
    expect(sheet.getCell("A8").fill).toMatchObject({fgColor:{argb:"4472C4"}});
    expect(sheet.getCell("A8").font.color).toMatchObject({argb:"FFFFFF"});
    expect(sheet.views[0]).toMatchObject({state:"frozen",ySplit:8});
    expect(sheet.getCell("A9").value).toBe("Rahul");
    expect(sheet.getCell("A9").font.name).toBe("Times New Roman");
  });

  it("keeps fixed branding rows for long school information",async()=>{
    const bytes=await createSchoolExcelReport({school:{name:"A Very Long School Name That Must Stay Centered Without Increasing The Header Height",address:"A long school address that should shrink to fit instead of wrapping into another line",phone:"+91 99999 99999",email:"administration.department@example-school.edu.in"},title:"Students Import Template",academicYear:"2026-2027",rows:[{"Student Name":""}]});
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);const sheet=workbook.worksheets[0];
    expect([1,2,3,4,5,6].map(row=>sheet.getRow(row).height)).toEqual([27,20,20,20,24,18]);
    for(let row=1;row<=6;row++)expect(sheet.getCell(`A${row}`).alignment?.wrapText).not.toBe(true);
  });
});
