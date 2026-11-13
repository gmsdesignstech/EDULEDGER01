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
    { key: "sl", label: "#", width: 22, align: "center" as const },
    { key: "facultyId", label: "Faculty ID", width: 62, align: "left" as const },
    { key: "name", label: "Teacher Name", width: 105, align: "left" as const },
    { key: "department", label: "Dept / Subject", width: 85, align: "left" as const },
    { key: "email", label: "Registered Gmail", width: 115, align: "left" as const },
    { key: "phone", label: "Mobile", width: 66, align: "left" as const },
    { key: "credential", label: "Access Credential", width: 68, align: "center" as const },
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

      const credText = teacher.temporaryPassword
        ? teacher.temporaryPassword
        : (teacher.status === "Active" ? "Active (Use PW)" : "Pending");

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
        credText,
        curX,
        currentY - 15,
        columns[6].width,
        7,
        bold,
        teacher.temporaryPassword ? accentGreen : brandIndigo,
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

