import { describe, expect, it } from "vitest";
import { canonicalImportHeader, normalizeImportRows, parseImportMatrix, uniqueImportAdmission } from "../src/lib/import-schema";

describe("spreadsheet import schema", () => {
  it("creates stable unique admission numbers for duplicate imports", () => {
    const used=new Set(["adm-1","adm-1-dup-2","a".repeat(40)]);
    expect(uniqueImportAdmission("ADM-1",used)).toBe("ADM-1-DUP-3");
    expect(uniqueImportAdmission("A".repeat(40),used)).toBe("A".repeat(34)+"-DUP-2");
  });
  it("maps student header aliases, BOM and whitespace", () => {
    expect(canonicalImportHeader("students", "\uFEFF STUDENT_NAME ")).toBe("Student Name");
    expect(canonicalImportHeader("students", "Father Name")).toBe("Parent Name");
    expect(canonicalImportHeader("students", "parent_mobile")).toBe("Parent Phone");
  });

  it("detects a header below branded report rows and ignores empty rows", () => {
    const parsed=parseImportMatrix("students",[
      ["DAPS JAIPUR"],
      ["STUDENT IMPORT TEMPLATE"],
      [],
      [" Student_Name ","Admission No","Class Name","Section Name","Guardian Name","Parent Mobile"],
      ["  Rahul Kumar  ","STU-1","5","A","Raj Kumar",9876543210],
      ["","","","","",""]
    ]);
    expect(parsed.headerRow).toBe(4);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({"Student Name":"Rahul Kumar","Admission Number":"STU-1",Class:"5",Section:"A","Parent Name":"Raj Kumar","Parent Phone":9876543210});
  });

  it("normalizes server-submitted keys again",()=>{
    expect(normalizeImportRows("payments",[{" paid_amount ":5000,"payment-mode":"UPI","\uFEFFStudent ID":"STU-9"}])).toEqual([{"Amount Paid":5000,"Payment Method":"UPI","Admission Number":"STU-9"}]);
  });

  it("reports a missing recognizable header instead of generating row errors",()=>{
    expect(()=>parseImportMatrix("students",[["Unrelated","Unknown"],["x","y"]])).toThrow("No supported column headers");
  });

  it("normalizes Excel serial and common spreadsheet dates",()=>{
    expect(normalizeImportRows("students", [{"Date of Birth":45292,"Admission Date":"24/09/26"}]))
      .toEqual([{"Date of Birth":"2024-01-01","Admission Date":"2026-09-24"}]);
  });

  it("does not silently repair impossible dates",()=>{
    expect(normalizeImportRows("students", [{"Date of Birth":"31/02/2026"}]))
      .toEqual([{"Date of Birth":"31/02/2026"}]);
  });

  it("rejects duplicate headers that map to the same field",()=>{
    expect(()=>parseImportMatrix("students",[["Student Name","Name","Admission Number"],["A","B","1"]])).toThrow("Duplicate column mapping");
  });
});
