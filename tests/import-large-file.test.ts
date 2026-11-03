import * as XLSX from "xlsx";
import {describe,expect,it} from "vitest";
import {parseImportMatrix} from "../src/lib/import-schema";

describe("large spreadsheet parsing",()=>{
  it("detects a 19-column header on row 7 and preserves 186 normalized students",()=>{
    const headers=["Student Name","Admission Number","Gender","Blood Group","Mother Name","Date of Birth","Class","Section","Roll Number","Parent Name","Parent Phone","Parent Email","Address","Admission Date","Total Annual Fee","Academic Year","Due Date","Special Quota","Quota Description"];
    const rows=Array.from({length:186},(_,index)=>[`Student ${index+1}`,`ADM2026-${String(index+1).padStart(3,"0")}`,index%2?"Female":"Male","A+","Mother Name",45292,"Class 1","A","","Guardian",9876543210,"",`House, Street ${index+1}`,"01/06/2026",12000,"2026-2027","01/03/2027","General",""]);
    const parsed=parseImportMatrix("students",[["School"],["Student register"],[],[],[],[],headers,...rows]);
    expect(parsed.headerRow).toBe(7);expect(parsed.detectedColumns).toHaveLength(19);expect(parsed.rows).toHaveLength(186);
    expect(parsed.rows[0]).toMatchObject({"Admission Number":"ADM2026-001","Blood Group":"A+","Date of Birth":"2024-01-01",Address:"House, Street 1"});
  });

  it("uses the CSV parser for quoted commas and plain values without JSON parsing",()=>{
    const workbook=XLSX.read('Student Name,Admission Number,Address,Section\n"Mohammed Ibrahim",ADM2026-001,"House 1, Main Road",A',{type:"string"});
    const matrix=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]],{header:1,defval:"",raw:false});
    const parsed=parseImportMatrix("students",matrix);
    expect(parsed.rows[0]).toMatchObject({"Student Name":"Mohammed Ibrahim","Admission Number":"ADM2026-001",Address:"House 1, Main Road",Section:"A"});
  });

  it("normalizes 5,000 rows without dropping numeric values",()=>{
    const matrix:unknown[][]=[["Student Name","Admission Number","Class","Section"],...Array.from({length:5000},(_,index)=>[`Student ${index}`,index+1000,"Class 1","A"] )];
    const parsed=parseImportMatrix("students",matrix);expect(parsed.rows).toHaveLength(5000);expect(parsed.rows[4999]["Admission Number"]).toBe(5999);
  });
});
