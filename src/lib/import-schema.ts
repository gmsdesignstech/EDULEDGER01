export type ImportValue = string | number | null;
export type ImportRow = Record<string, ImportValue>;

type ImportDefinition = Record<string, readonly string[]>;

const common = {
  "Admission Number": ["admission number", "admission no", "admission", "student id", "student code"],
  "Student Name": ["student name", "student_name", "studentname", "name"],
  Class: ["class", "class name", "standard", "grade"],
  Section: ["section", "section name", "division"],
  "Roll Number": ["roll number", "roll no", "roll", "roll_number"],
  "Parent Name": ["parent name", "father name", "mother name", "guardian name", "parent_name"],
  "Parent Phone": ["parent phone", "parent mobile", "parent contact", "mobile", "phone", "parent_phone"],
} as const;

export const importDefinitions: Record<string, ImportDefinition> = {
  students: {
    ...common,
    Gender: ["gender", "sex"],
    "Blood Group": ["blood group", "blood_group", "bloodgroup"],
    "Mother Name": ["mother name", "mother_name"],
    "Special Quota": ["special quota", "special_quota", "quota"],
    "Quota Description": ["quota description", "special quota description"],
    "Date of Birth": ["date of birth", "dob", "birth date"],
    "Academic Year": ["academic year", "session", "school year"],
    "Parent Email": ["parent email", "guardian email", "email"],
    Address: ["address", "residential address"],
    "Admission Date": ["admission date", "date of admission", "joining date"],
    "Total Annual Fee": ["total annual fee", "annual fee", "total fee"],
    "Due Date": ["due date", "fee due date"],
  },
  teachers: {
    "Teacher Name": ["teacher name", "staff name", "name"],
    "Employee ID": ["employee id", "employee number", "staff id"], Email: ["email", "email address"], Phone: ["phone", "mobile", "contact"],
    Department: ["department", "dept"], "Primary Subject": ["primary subject", "subject"], "Assigned Classes": ["assigned classes", "classes"],
    "Joining Date": ["joining date", "date of joining"], Salary: ["salary", "monthly salary"], Status: ["status"],
  },
  classes: { "Class Name": ["class name", "class", "standard"], Section: common.Section, "Class Teacher": ["class teacher", "teacher"], "Academic Year": ["academic year", "session"], Capacity: ["capacity", "maximum students"], Status: ["status"] },
  attendance: { "Admission Number": common["Admission Number"], Date: ["date", "attendance date"], Status: ["status", "attendance status"], Remarks: ["remarks", "notes"] },
  fees: { "Admission Number": common["Admission Number"], "Fee Type": ["fee type", "fee category"], "Academic Year": ["academic year", "session"], "Total Amount": ["total amount", "original fee", "fee amount"], "Due Date": ["due date"] },
  reports: { "Admission Number": common["Admission Number"], "Fee Type": ["fee type", "fee category"], "Academic Year": ["academic year", "session"], "Total Amount": ["total amount", "original fee", "fee amount"], "Due Date": ["due date"] },
  payments: {
    ...common,
    "Fee Type": ["fee type", "fee category"], "Original Fee": ["original fee", "total fee"], Discount: ["discount", "discount amount"],
    "Final Amount": ["final amount", "final fee", "net fee"], "Amount Paid": ["amount paid", "paid amount", "payment amount", "amount"],
    "Remaining Amount": ["remaining amount", "balance", "pending amount"], "Payment Date": ["payment date", "date paid", "date"],
    "Payment Method": ["payment method", "payment mode", "mode"], "Transaction ID": ["transaction id", "reference number", "payment reference"],
    "Receipt Number": ["receipt number", "receipt no"], "Invoice Number": ["invoice number", "invoice no"], Notes: ["notes", "remarks"],
  },
  assignments: { "Assignment Title": ["assignment title", "title"], Class: common.Class, "Due Date": ["due date"], Status: ["status"] },
  messages: { Recipient: ["recipient", "to"], Subject: ["subject", "title"], Message: ["message", "body"], Status: ["status"] },
};

export function normalizeImportHeader(value: unknown) {
  return String(value ?? "").replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\u2060]/g, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "");
}

export function canonicalImportHeader(type: string, value: unknown) {
  const normalized = normalizeImportHeader(value), definition = importDefinitions[type] || {};
  return Object.keys(definition).find(canonical => normalizeImportHeader(canonical) === normalized)
    || Object.entries(definition).find(([, aliases]) => aliases.some(alias => normalizeImportHeader(alias) === normalized))?.[0];
}

const dateColumns = new Set(["Date of Birth", "Admission Date", "Due Date", "Joining Date", "Date", "Payment Date"]);

function normalizeDate(value: ImportValue) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Excel's 1900 date system includes its historical leap-year bug. This
    // epoch reproduces SheetJS/Excel calendar dates without using local time.
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if(/^\d{4}-\d{2}-\d{2}T/.test(text)){
    const date=new Date(text);
    if(!Number.isNaN(date.valueOf()))return text.slice(0,10);
  }
  const match = /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/.exec(text);
  if (!match) return text;
  const [, first, middle, last] = match;
  let [year, month, day] = first.length === 4 ? [Number(first), Number(middle), Number(last)] : [Number(last), Number(middle), Number(first)];
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return text;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function normalizeImportRows(type: string, source: ImportRow[]) {
  return source.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const header = canonicalImportHeader(type, key) || key.trim();
    const normalized = typeof value === "string" ? value.trim().replace(/\s+/g," ") : value;
    return [header, dateColumns.has(header) ? normalizeDate(normalized) : normalized];
  }))).filter(row => Object.values(row).some(value => String(value ?? "").trim() !== ""));
}

export function uniqueImportAdmission(value: string, used: Set<string>) {
  const original=value.trim();
  let candidate=original,index=2;
  while(used.has(candidate.toLowerCase())){
    const suffix=`-DUP-${index++}`;
    candidate=`${original.slice(0,Math.max(1,40-suffix.length))}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function parseImportMatrix(type: string, matrix: unknown[][]) {
  const candidates = matrix.slice(0, 25).map((row, index) => ({ index, score: row.filter(cell => canonicalImportHeader(type, cell)).length }));
  const best = candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0];
  if (!best || best.score === 0) throw new Error("No supported column headers were found. Download the current template or check the header row.");
  const rawHeaders = matrix[best.index].map(value => String(value ?? "").trim());
  const mappedHeaders = rawHeaders.map(header => canonicalImportHeader(type, header) || header);
  const populated=mappedHeaders.filter(Boolean),duplicates=populated.filter((header,index)=>populated.indexOf(header)!==index);
  if(duplicates.length)throw new Error(`Duplicate column mapping detected: ${Array.from(new Set(duplicates)).join(", ")}. Rename or remove the duplicate columns.`);
  const rows = matrix.slice(best.index + 1).map(values => Object.fromEntries(mappedHeaders.map((header, index) => [header, values[index] == null ? "" : typeof values[index] === "string" ? values[index].trim() : values[index] as number])));
  return {
    rows: normalizeImportRows(type, rows),
    headerRow: best.index + 1,
    detectedColumns: rawHeaders.filter(Boolean),
    mappedColumns: rawHeaders.map((header, index) => ({ source: header, target: canonicalImportHeader(type, header) || "" })).filter(item => item.target),
    unmappedColumns: rawHeaders.filter(header => header && !canonicalImportHeader(type, header)),
  };
}
