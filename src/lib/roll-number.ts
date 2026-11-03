export function normalizeSchoolCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("School code must contain exactly 3 letters.");
  return code;
}

export function admissionYear(academicYear: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(academicYear.trim());
  if (!match || Number(match[2]) !== Number(match[1]) + 1)
    throw new Error("Select a valid academic year before adding a student.");
  return match[1];
}

export function formatRollNumber(code: string, year: string, serial: number) {
  if (!Number.isSafeInteger(serial) || serial < 1)
    throw new Error("Student ID serial must be a positive integer.");
  return `${normalizeSchoolCode(code)}-${year}-${String(serial).padStart(4, "0")}`;
}

export function parseStudentId(value: string) {
  const match = /^([A-Z]{3})-(\d{4})-(\d{4,})$/.exec(value.trim().toUpperCase());
  if (!match) return null;
  const serial = Number(match[3]);
  if (!Number.isSafeInteger(serial) || serial < 1) return null;
  return { code: match[1], year: match[2], serial };
}

export function isValidStudentId(value: string, expectedYear?: string) {
  const parsed = parseStudentId(value);
  return Boolean(parsed && (!expectedYear || parsed.year === expectedYear));
}
