import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type TeacherCredentialItem = {
  facultyId: string;
  name: string;
  department: string;
  subject: string;
  email: string;
  phone: string;
  status: string;
  temporaryPassword?: string;
  mustChangePassword?: boolean;
  loginId?: string;
};

export type StudentCredentialItem = {
  admissionNo: string;
  studentId: string;
  studentName: string;
  className: string;
  section: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  status: string;
  temporaryPassword?: string;
};

export type SchoolCredentialMeta = {
  id: string;
  name: string;
  academicYear?: string;
  address?: string;
  phone?: string;
  email?: string;
};

// Corporate palette: Deep Navy, Rich Indigo, Pale Gray, Slate Line
const brandNavy = rgb(0.04, 0.07, 0.15); // #091225
const brandIndigo = rgb(0.31, 0.27, 0.9); // #4F46E5
const inkText = rgb(0.09, 0.11, 0.16); // #171C28
const mutedText = rgb(0.41, 0.45, 0.53); // #697387
const tableHeaderBg = rgb(0.12, 0.16, 0.28);
const zebraBg = rgb(0.97, 0.98, 0.99);
const lineBorder = rgb(0.85, 0.87, 0.91);
const white = rgb(1, 1, 1);
const accentGreen = rgb(0.06, 0.58, 0.35);

function truncateToWidth(value: string, font: PDFFont, size: number, maxWidth: number): string {
  let text = String(value || "").trim();
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  while (text.length > 3 && font.widthOfTextAtSize(`${text}...`, size) > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}...`;
}

function drawCell(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  font: PDFFont,
  color = inkText,
  align: "left" | "center" | "right" = "left"
) {
  const fitted = truncateToWidth(text, font, size, width - 4);
  const textWidth = font.widthOfTextAtSize(fitted, size);
  let drawX = x + 2;
  if (align === "center") {
    drawX = x + (width - textWidth) / 2;
  } else if (align === "right") {
    drawX = x + width - textWidth - 2;
  }
  page.drawText(fitted, { x: drawX, y, size, font, color });
}

function drawHeader(
  page: PDFPage,
  school: SchoolCredentialMeta,
  title: string,
  loginUrl: string,
  filters: string[],
  font: PDFFont,
  bold: PDFFont
): number {
  const left = 36;
  const right = 559;
  const contentWidth = right - left;

  // Header Banner
  page.drawRectangle({
    x: left,
    y: 775,
    width: contentWidth,
    height: 38,
    color: brandNavy,
  });

  page.drawText("EDULEDGER PLATFORM", {
    x: left + 12,
    y: 792,
    size: 13,
    font: bold,
    color: white,
  });

  page.drawText("OFFICIAL ACCESS CREDENTIALS", {
    x: right - bold.widthOfTextAtSize("OFFICIAL ACCESS CREDENTIALS", 9) - 12,
    y: 794,
    size: 9,
    font: bold,
    color: rgb(0.8, 0.85, 1),
  });

  // Institution Information
  const instName = school.name.toUpperCase();
  page.drawText(truncateToWidth(instName, bold, 14, contentWidth - 10), {
    x: left,
    y: 752,
    size: 14,
    font: bold,
    color: brandNavy,
  });

  page.drawText(title, {
    x: left,
    y: 736,
    size: 11,
    font: bold,
    color: brandIndigo,
  });

  const nowStr = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const metaRight = `Generated: ${nowStr} (IST)`;
  page.drawText(metaRight, {
    x: right - font.widthOfTextAtSize(metaRight, 8),
    y: 736,
    size: 8,
    font,
    color: mutedText,
  });

  // Portal Notice Box
  page.drawRectangle({
    x: left,
    y: 698,
    width: contentWidth,
    height: 28,
    color: rgb(0.95, 0.96, 1),
    borderColor: rgb(0.8, 0.85, 0.96),
    borderWidth: 0.5,
  });

  page.drawText("OFFICIAL PWA LOGIN PORTAL:", {
    x: left + 8,
    y: 709,
    size: 8,
    font: bold,
    color: brandNavy,
  });

  page.drawText(loginUrl, {
    x: left + 135,
    y: 709,
    size: 8.5,
    font: bold,
    color: brandIndigo,
  });

  const subline = filters.length > 0
    ? `Filter: ${filters.join(" | ")}  •  Academic Year: ${school.academicYear || "Current"}`
    : `Academic Year: ${school.academicYear || "Current"}  •  Confidential Administrative Document`;

  page.drawText(truncateToWidth(subline, font, 7.5, contentWidth - 280), {
    x: right - font.widthOfTextAtSize(truncateToWidth(subline, font, 7.5, contentWidth - 280), 7.5) - 8,
    y: 709,
    size: 7.5,
    font,
    color: mutedText,
  });

  page.drawLine({
    start: { x: left, y: 688 },
    end: { x: right, y: 688 },
    thickness: 0.5,
    color: lineBorder,
  });

  return 678;
}

function drawFooter(page: PDFPage, pageNum: number, totalPages: number, font: PDFFont) {
  const left = 36;
  const right = 559;

  page.drawLine({
    start: { x: left, y: 40 },
    end: { x: right, y: 40 },
    thickness: 0.5,
    color: lineBorder,
  });

  const notice = "CONFIDENTIAL: For Authorized School Personnel & Guardians Only. Do not distribute publicly.";
  page.drawText(notice, {
    x: left,
    y: 28,
    size: 7,
    font,
    color: mutedText,
  });

  const pageStr = `Page ${pageNum} of ${totalPages}`;
  page.drawText(pageStr, {
    x: right - font.widthOfTextAtSize(pageStr, 7.5),
    y: 28,
    size: 7.5,
    font,
    color: mutedText,
  });
}

/**
 * Generates official Teacher Credential PDF for a school or filtered department
 */
export async function generateTeacherCredentialsPdf(params: {
  school: SchoolCredentialMeta;
  teachers: TeacherCredentialItem[];
  departmentFilter?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const left = 36;
  const tableWidth = 523;
  const rowHeight = 22;
  const loginUrl = "https://eduledger.co.in/teacher/login";

  const columns = [
    { key: "sl", label: "#", width: 20, align: "center" as const },
    { key: "facultyId", label: "Faculty ID", width: 56, align: "left" as const },
    { key: "name", label: "Teacher Name", width: 92, align: "left" as const },
    { key: "department", label: "Dept / Subject", width: 75, align: "left" as const },
    { key: "email", label: "Registered Email", width: 96, align: "left" as const },
    { key: "phone", label: "Mobile", width: 60, align: "left" as const },
    { key: "temporaryPassword", label: "Temporary Password", width: 80, align: "center" as const },
    { key: "status", label: "Status", width: 44, align: "center" as const },
  ];

  const filters = params.departmentFilter ? [`Department: ${params.departmentFilter}`] : [];

  let page = doc.addPage([595.28, 841.89]);
  let currentY = drawHeader(
    page,
    params.school,
    "FACULTY & STAFF ACCESS CREDENTIALS",
    loginUrl,
    filters,
    font,
    bold
  );

  const renderTableHeader = (p: PDFPage, y: number) => {
    p.drawRectangle({
      x: left,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: tableHeaderBg,
    });
    let curX = left;
    for (const col of columns) {
      drawCell(p, col.label, curX, y - 15, col.width, 7.5, bold, white, col.align);
      curX += col.width;
    }
    return y - rowHeight;
  };

  currentY = renderTableHeader(page, currentY);

  if (params.teachers.length === 0) {
    page.drawText("No faculty members found for the selected criteria.", {
      x: left + 10,
      y: currentY - 25,
      size: 9,
      font,
      color: mutedText,
    });
  } else {
    for (let i = 0; i < params.teachers.length; i++) {
      const teacher = params.teachers[i];

      // Check if new page is needed
      if (currentY - rowHeight < 55) {
        page = doc.addPage([595.28, 841.89]);
        currentY = drawHeader(
          page,
          params.school,
          "FACULTY & STAFF ACCESS CREDENTIALS",
          loginUrl,
          filters,
          font,
          bold
        );
        currentY = renderTableHeader(page, currentY);
      }

      const isEven = i % 2 === 0;
      page.drawRectangle({
        x: left,
        y: currentY - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: isEven ? white : zebraBg,
        borderColor: lineBorder,
        borderWidth: 0.3,
      });

      let passwordText = "Pending Setup";
      let passwordColor = mutedText;
      let passwordFont = font;
      if (teacher.temporaryPassword) {
        passwordText = teacher.temporaryPassword;
        passwordColor = rgb(0.75, 0.1, 0.1);
        passwordFont = bold;
      } else if (teacher.mustChangePassword === false) {
        passwordText = "Password Set";
        passwordColor = accentGreen;
        passwordFont = bold;
      } else if (teacher.status === "Inactive") {
        passwordText = "Inactive";
        passwordColor = mutedText;
      }

      const statusText = teacher.status || "Active";
      const statusColor = statusText === "Active" ? accentGreen : mutedText;

      const deptSubject = [teacher.department, teacher.subject].filter(Boolean).join(" / ");

      let curX = left;
      drawCell(page, String(i + 1), curX, currentY - 15, columns[0].width, 7.5, font, mutedText, "center");
      curX += columns[0].width;

      drawCell(page, teacher.facultyId || "—", curX, currentY - 15, columns[1].width, 7.5, bold, brandNavy);
      curX += columns[1].width;

      drawCell(page, teacher.name, curX, currentY - 15, columns[2].width, 7.5, bold, inkText);
      curX += columns[2].width;

      drawCell(page, deptSubject || "General", curX, currentY - 15, columns[3].width, 7, font, mutedText);
      curX += columns[3].width;

      drawCell(page, teacher.email || "—", curX, currentY - 15, columns[4].width, 7, font, inkText);
      curX += columns[4].width;

      drawCell(page, teacher.phone || "—", curX, currentY - 15, columns[5].width, 7, font, inkText);
      curX += columns[5].width;

      drawCell(
        page,
        passwordText,
        curX,
        currentY - 15,
        columns[6].width,
        7,
        passwordFont,
        passwordColor,
        "center"
      );
      curX += columns[6].width;

      drawCell(
        page,
        statusText,
        curX,
        currentY - 15,
        columns[7].width,
        7,
        bold,
        statusColor,
        "center"
      );

      currentY -= rowHeight;
    }
  }

  // Number all pages
  const totalPages = doc.getPageCount();
  for (let p = 0; p < totalPages; p++) {
    drawFooter(doc.getPage(p), p + 1, totalPages, font);
  }

  return await doc.save();
}

/**
 * Generates official Student & Parent Credential PDF for a school, class, or section
 */
export async function generateStudentCredentialsPdf(params: {
  school: SchoolCredentialMeta;
  students: StudentCredentialItem[];
  classFilter?: string;
  sectionFilter?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const left = 36;
  const tableWidth = 523;
  const rowHeight = 22;
  const loginUrl = "https://eduledger.co.in/parent/login";

  const columns = [
    { key: "sl", label: "#", width: 22, align: "center" as const },
    { key: "admission", label: "Admission No", width: 68, align: "left" as const },
    { key: "studentName", label: "Student Name", width: 105, align: "left" as const },
    { key: "classSec", label: "Class & Sec", width: 55, align: "center" as const },
    { key: "parentName", label: "Parent / Guardian", width: 88, align: "left" as const },
    { key: "contact", label: "Mobile / Email", width: 117, align: "left" as const },
    { key: "credential", label: "Access Credential", width: 68, align: "center" as const },
  ];

  const filterParts = [];
  if (params.classFilter) filterParts.push(`Class: ${params.classFilter}`);
  if (params.sectionFilter) filterParts.push(`Sec: ${params.sectionFilter}`);

  let page = doc.addPage([595.28, 841.89]);
  let currentY = drawHeader(
    page,
    params.school,
    "STUDENT & PARENT ACCESS CREDENTIALS",
    loginUrl,
    filterParts,
    font,
    bold
  );

  const renderTableHeader = (p: PDFPage, y: number) => {
    p.drawRectangle({
      x: left,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: tableHeaderBg,
    });
    let curX = left;
    for (const col of columns) {
      drawCell(p, col.label, curX, y - 15, col.width, 7.5, bold, white, col.align);
      curX += col.width;
    }
    return y - rowHeight;
  };

  currentY = renderTableHeader(page, currentY);

  if (params.students.length === 0) {
    page.drawText("No student records found for the selected class and section.", {
      x: left + 10,
      y: currentY - 25,
      size: 9,
      font,
      color: mutedText,
    });
  } else {
    for (let i = 0; i < params.students.length; i++) {
      const student = params.students[i];

      if (currentY - rowHeight < 55) {
        page = doc.addPage([595.28, 841.89]);
        currentY = drawHeader(
          page,
          params.school,
          "STUDENT & PARENT ACCESS CREDENTIALS",
          loginUrl,
          filterParts,
          font,
          bold
        );
        currentY = renderTableHeader(page, currentY);
      }

      const isEven = i % 2 === 0;
      page.drawRectangle({
        x: left,
        y: currentY - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: isEven ? white : zebraBg,
        borderColor: lineBorder,
        borderWidth: 0.3,
      });

      const classSec = [student.className, student.section].filter(Boolean).join("-") || "—";
      const contactInfo = [student.parentPhone, student.parentEmail].filter(Boolean).join(" | ");

      const credText = student.temporaryPassword
        ? student.temporaryPassword
        : (student.status === "Active" ? "Active (Use PW)" : "Pending");

      let curX = left;
      drawCell(page, String(i + 1), curX, currentY - 15, columns[0].width, 7.5, font, mutedText, "center");
      curX += columns[0].width;

      drawCell(page, student.admissionNo || "—", curX, currentY - 15, columns[1].width, 7.5, bold, brandNavy);
      curX += columns[1].width;

      drawCell(page, student.studentName, curX, currentY - 15, columns[2].width, 7.5, bold, inkText);
      curX += columns[2].width;

      drawCell(page, classSec, curX, currentY - 15, columns[3].width, 7.5, font, inkText, "center");
      curX += columns[3].width;

      drawCell(page, student.parentName || "Parent", curX, currentY - 15, columns[4].width, 7, font, inkText);
      curX += columns[4].width;

      drawCell(page, contactInfo || "—", curX, currentY - 15, columns[5].width, 6.8, font, mutedText);
      curX += columns[5].width;

      drawCell(
        page,
        credText,
        curX,
        currentY - 15,
        columns[6].width,
        7,
        bold,
        student.temporaryPassword ? accentGreen : brandIndigo,
        "center"
      );

      currentY -= rowHeight;
    }
  }

  const totalPages = doc.getPageCount();
  for (let p = 0; p < totalPages; p++) {
    drawFooter(doc.getPage(p), p + 1, totalPages, font);
  }

  return await doc.save();
}

export type SingleTeacherCredentialPdfParams = {
  school: SchoolCredentialMeta;
  teacher: {
    id: string;
    name: string;
    employeeId: string;
    loginId?: string;
    department?: string;
    subject?: string;
    email?: string;
    phone?: string;
    temporaryPassword?: string;
    status?: string;
  };
  loginUrl: string;
  issuedAt?: string;
};

export async function generateSingleTeacherCredentialPdf(
  params: SingleTeacherCredentialPdfParams
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]); // Standard A4 portrait

  const left = 40;
  const contentWidth = 515;
  const right = left + contentWidth;

  // Header Banner
  page.drawRectangle({
    x: left,
    y: 770,
    width: contentWidth,
    height: 42,
    color: brandNavy,
  });

  page.drawText("EDULEDGER PLATFORM", {
    x: left + 14,
    y: 788,
    size: 14,
    font: bold,
    color: white,
  });

  page.drawText("CONFIDENTIAL FACULTY CREDENTIAL SLIP", {
    x: right - bold.widthOfTextAtSize("CONFIDENTIAL FACULTY CREDENTIAL SLIP", 9) - 14,
    y: 790,
    size: 9,
    font: bold,
    color: rgb(0.8, 0.85, 1),
  });

  // School Information
  let currentY = 740;
  page.drawText(params.school.name.toUpperCase(), {
    x: left,
    y: currentY,
    size: 16,
    font: bold,
    color: inkText,
  });

  currentY -= 16;
  page.drawText("Official Teacher Portal Access & Login Verification Document", {
    x: left,
    y: currentY,
    size: 9,
    font,
    color: mutedText,
  });

  // Divider Line
  currentY -= 14;
  page.drawLine({
    start: { x: left, y: currentY },
    end: { x: right, y: currentY },
    thickness: 1,
    color: lineBorder,
  });

  // 1. Teacher Profile Box
  currentY -= 30;
  page.drawText("FACULTY MEMBER PROFILE", {
    x: left,
    y: currentY,
    size: 11,
    font: bold,
    color: brandNavy,
  });

  currentY -= 10;
  page.drawRectangle({
    x: left,
    y: currentY - 95,
    width: contentWidth,
    height: 95,
    color: zebraBg,
    borderColor: lineBorder,
    borderWidth: 1,
  });

  const col1X = left + 16;
  const col2X = left + 260;
  let profileY = currentY - 22;

  // Row 1
  page.drawText("Full Name:", { x: col1X, y: profileY, size: 9, font: bold, color: mutedText });
  page.drawText(params.teacher.name, { x: col1X + 75, y: profileY, size: 10, font: bold, color: inkText });

  page.drawText("Employee ID:", { x: col2X, y: profileY, size: 9, font: bold, color: mutedText });
  page.drawText(params.teacher.employeeId, { x: col2X + 85, y: profileY, size: 10, font: bold, color: brandNavy });

  // Row 2
  profileY -= 22;
  page.drawText("Department:", { x: col1X, y: profileY, size: 9, font: bold, color: mutedText });
  page.drawText(params.teacher.department || "General", { x: col1X + 75, y: profileY, size: 9, font, color: inkText });

  page.drawText("Primary Subject:", { x: col2X, y: profileY, size: 9, font: bold, color: mutedText });
  page.drawText(params.teacher.subject || "All Subjects", { x: col2X + 85, y: profileY, size: 9, font, color: inkText });

  // Row 3
  profileY -= 22;
  page.drawText("Mobile No:", { x: col1X, y: profileY, size: 9, font: bold, color: mutedText });
  page.drawText(params.teacher.phone || "—", { x: col1X + 75, y: profileY, size: 9, font, color: inkText });

  page.drawText("Email Address:", { x: col2X, y: profileY, size: 9, font: bold, color: mutedText });
  page.drawText(params.teacher.email || "—", { x: col2X + 85, y: profileY, size: 9, font, color: inkText });

  // Row 4
  profileY -= 20;
  page.drawText("Account Status:", { x: col1X, y: profileY, size: 9, font: bold, color: mutedText });
  page.drawText(params.teacher.status || "Active", { x: col1X + 75, y: profileY, size: 9, font: bold, color: accentGreen });

  // 2. Credentials Card
  currentY = profileY - 40;
  page.drawText("LOGIN CREDENTIALS", {
    x: left,
    y: currentY,
    size: 11,
    font: bold,
    color: brandNavy,
  });

  currentY -= 10;
  page.drawRectangle({
    x: left,
    y: currentY - 120,
    width: contentWidth,
    height: 120,
    color: rgb(0.96, 0.97, 1),
    borderColor: brandIndigo,
    borderWidth: 1.5,
  });

  let credY = currentY - 26;

  page.drawText("Portal Login URL:", { x: col1X, y: credY, size: 10, font: bold, color: mutedText });
  page.drawText(params.loginUrl, { x: col1X + 130, y: credY, size: 10, font: bold, color: brandIndigo });

  credY -= 28;
  page.drawText("Unique Login ID:", { x: col1X, y: credY, size: 10, font: bold, color: mutedText });
  const loginIdToDisplay = params.teacher.loginId || params.teacher.employeeId;
  page.drawText(loginIdToDisplay, { x: col1X + 130, y: credY, size: 12, font: bold, color: brandNavy });

  credY -= 28;
  page.drawText("Temporary Password:", { x: col1X, y: credY, size: 10, font: bold, color: mutedText });
  page.drawText(params.teacher.temporaryPassword || "[Confidential — Retain Safe Copy]", {
    x: col1X + 130,
    y: credY,
    size: 12,
    font: bold,
    color: rgb(0.7, 0.15, 0.15),
  });

  credY -= 24;
  page.drawText("Accepted Usernames: Login ID, Registered Mobile Number, or Registered Email Address", {
    x: col1X,
    y: credY,
    size: 8,
    font,
    color: mutedText,
  });

  // 3. Security Instructions Box
  currentY = credY - 45;
  page.drawText("IMPORTANT SECURITY INSTRUCTIONS", {
    x: left,
    y: currentY,
    size: 11,
    font: bold,
    color: brandNavy,
  });

  currentY -= 10;
  page.drawRectangle({
    x: left,
    y: currentY - 125,
    width: contentWidth,
    height: 125,
    color: white,
    borderColor: lineBorder,
    borderWidth: 1,
  });

  let instrY = currentY - 22;
  const instructions = [
    "1. Access the Teacher Portal URL above in your desktop browser or mobile device (Chrome, Safari, Edge).",
    "2. Enter your Unique Login ID (or registered Mobile Number / Email) and your Temporary Password.",
    "3. First-time sign in requires setting a new secure personal password (minimum 8 characters).",
    "4. Keep your password confidential. School administrators will never ask for your private password.",
    "5. If you lose access or suspect unauthorized activity, contact your school administrator immediately.",
  ];

  for (const line of instructions) {
    page.drawText(line, { x: col1X, y: instrY, size: 8.5, font, color: inkText });
    instrY -= 20;
  }

  // 4. Verification and Signatory
  currentY = instrY - 45;
  const sigWidth = 180;

  page.drawText("Date of Issuance:", { x: left + 10, y: currentY, size: 9, font: bold, color: mutedText });
  page.drawText(params.issuedAt || new Date().toISOString().slice(0, 10), {
    x: left + 100,
    y: currentY,
    size: 9,
    font,
    color: inkText,
  });

  const sigX = right - sigWidth - 10;
  page.drawLine({
    start: { x: sigX, y: currentY - 15 },
    end: { x: sigX + sigWidth, y: currentY - 15 },
    thickness: 1,
    color: mutedText,
  });
  page.drawText("Authorized School Signatory / Seal", {
    x: sigX + 15,
    y: currentY - 28,
    size: 8,
    font: bold,
    color: mutedText,
  });

  // Footer
  drawFooter(page, 1, 1, font);

  return await doc.save();
}

