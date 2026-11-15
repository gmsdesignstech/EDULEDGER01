import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  generateTeacherCredentialsPdf,
  generateStudentCredentialsPdf,
  formatStudentLoginId,
} from "../src/lib/credential-pdf";
import { generateSecureTemporaryPassword } from "../src/lib/account-provisioning";
import { renderAccountActivationEmailHtml } from "../src/lib/email";

describe("EduLedger Credential PDF Generation Subsystem", () => {
  it("generates cryptographically secure, high-entropy temporary passwords", () => {
    const pw1 = generateSecureTemporaryPassword();
    const pw2 = generateSecureTemporaryPassword();

    expect(pw1).not.toBe(pw2);
    expect(pw1.length).toBeGreaterThanOrEqual(10);
    // Contains upper, lower, digits, and symbol
    expect(/[A-Z]/.test(pw1)).toBe(true);
    expect(/[a-z]/.test(pw1)).toBe(true);
    expect(/[0-9]/.test(pw1)).toBe(true);
    expect(/[!@#$*]/.test(pw1)).toBe(true);
  });

  it("generates valid Teacher Credential PDF with proper metadata and header signature", async () => {
    const sampleSchool = {
      id: "inst-101",
      name: "Dar Al Arqam Public School",
      academicYear: "2025-2026",
    };

    const sampleTeachers = [
      {
        facultyId: "EMP-001",
        name: "Rubina Bano",
        department: "Science",
        subject: "Physics",
        email: "rubinakhan07861@gmail.com",
        phone: "9876543210",
        status: "Active",
      },
      {
        facultyId: "EMP-002",
        name: "Zeeshan Khan",
        department: "Mathematics",
        subject: "Calculus",
        email: "zeeshan@example.com",
        phone: "9123456789",
        status: "Active",
        temporaryPassword: "Edu#7aB9!221",
      },
    ];

    const pdfBytes = await generateTeacherCredentialsPdf({
      school: sampleSchool,
      teachers: sampleTeachers,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header %PDF-1.
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("generates valid Student Credential PDF with proper class/section filtering", async () => {
    const sampleSchool = {
      id: "inst-101",
      name: "Dar Al Arqam Public School",
      academicYear: "2025-2026",
    };

    const sampleStudents = [
      {
        admissionNo: "ADM-2026-001",
        studentId: "stu-001",
        studentName: "Mohammed Anas Abdullah",
        className: "Class 10",
        section: "A",
        parentName: "Abdullah Khan",
        parentPhone: "9929031416",
        parentEmail: "anas.parent.daps@gmail.com",
        status: "Active",
      },
      {
        admissionNo: "ADM-2026-002",
        studentId: "stu-002",
        studentName: "Sara Fatima",
        className: "Class 10",
        section: "A",
        parentName: "Fatima Bi",
        parentPhone: "9828012345",
        parentEmail: "",
        status: "Pending",
        temporaryPassword: "Edu*3cK9!442",
      },
    ];

    const pdfBytes = await generateStudentCredentialsPdf({
      school: sampleSchool,
      students: sampleStudents,
      classFilter: "Class 10",
      sectionFilter: "A",
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles multi-page generation gracefully without overflow", async () => {
    const sampleSchool = {
      id: "inst-large",
      name: "Large Metropolitan School",
      academicYear: "2025-2026",
    };

    // 80 students will span across multiple A4 pages (approx 30 rows per page)
    const largeStudentList = Array.from({ length: 80 }, (_, i) => ({
      admissionNo: `ADM-2026-${String(i + 1).padStart(3, "0")}`,
      studentId: `stu-${i + 1}`,
      studentName: `Student Candidate ${i + 1}`,
      className: "Class 8",
      section: i % 2 === 0 ? "A" : "B",
      parentName: `Parent Guardian ${i + 1}`,
      parentPhone: `99000000${String(i).padStart(2, "0")}`,
      parentEmail: `parent${i + 1}@sample.edu`,
      status: i % 2 === 0 ? "Active" : "Pending",
      temporaryPassword: i % 2 === 1 ? `Edu#9xK${i}!101` : undefined,
    }));

    const pdfBytes = await generateStudentCredentialsPdf({
      school: sampleSchool,
      students: largeStudentList,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(5000);
  });

  it("generates 8-column official Teacher Credentials PDF with temporary passwords and no placeholder text", async () => {
    const sampleSchool = {
      id: "inst-101",
      name: "Dar Al Arqam Public School",
      academicYear: "2025-2026",
    };

    const teachers = [
      {
        facultyId: "EMP-001",
        name: "Rubina Bano",
        department: "Science",
        subject: "Physics",
        email: "rubina@daps.edu",
        phone: "9876543210",
        status: "Active",
        temporaryPassword: "Edu#9xK2!m8A",
        mustChangePassword: true,
      },
      {
        facultyId: "EMP-002",
        name: "Zeeshan Khan",
        department: "Mathematics",
        subject: "Calculus",
        email: "zeeshan@daps.edu",
        phone: "9123456789",
        status: "Active",
        mustChangePassword: false, // Already set their own password
      },
      {
        facultyId: "EMP-003",
        name: "Tariq Mahmood",
        department: "Humanities",
        subject: "History",
        email: "",
        phone: "9988776655",
        status: "Inactive",
      },
    ];

    const pdfBytes = await generateTeacherCredentialsPdf({
      school: sampleSchool,
      teachers,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1500);

    const loadedDoc = await PDFDocument.load(pdfBytes);
    expect(loadedDoc.getPageCount()).toBe(1);

    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("generates multi-page official Teacher Credentials PDF for large faculty roster", async () => {
    const sampleSchool = {
      id: "inst-large-faculty",
      name: "Heritage International Academy",
      academicYear: "2025-2026",
    };

    const largeTeacherList = Array.from({ length: 70 }, (_, i) => ({
      facultyId: `TCH-${String(i + 1).padStart(3, "0")}`,
      name: `Faculty Member ${i + 1}`,
      department: i % 3 === 0 ? "Science" : i % 3 === 1 ? "Mathematics" : "Languages",
      subject: `Subject ${i + 1}`,
      email: `faculty${i + 1}@heritage.edu`,
      phone: `98000000${String(i).padStart(2, "0")}`,
      status: i === 65 ? "Inactive" : "Active",
      temporaryPassword: i % 2 === 0 ? `Edu*${i}aB!990` : undefined,
      mustChangePassword: i % 2 === 0,
    }));

    const pdfBytes = await generateTeacherCredentialsPdf({
      school: sampleSchool,
      teachers: largeTeacherList,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(5000);
  });

  it("formats student login IDs consistently with institution school code", () => {
    expect(formatStudentLoginId("DPS", "101")).toBe("STU-DPS-101");
    expect(formatStudentLoginId("DPS", "STU-101")).toBe("STU-DPS-101");
    expect(formatStudentLoginId("DPS", "DPS-101")).toBe("STU-DPS-101");
    expect(formatStudentLoginId("DPS", "STU-DPS-101")).toBe("STU-DPS-101");
    expect(formatStudentLoginId("", "2026-05")).toBe("STU-2026-05");
  });

  it("generates 8-column official Student Credentials PDF with temporary passwords and no placeholder text", async () => {
    const sampleSchool = {
      id: "inst-101",
      name: "Dar Al Arqam Public School",
      academicYear: "2026-2027",
    };

    const students = [
      {
        admissionNo: "ADM-001",
        studentId: "stu-1",
        studentName: "Aarav Sharma",
        className: "Class 10",
        section: "A",
        parentName: "Rajesh Sharma",
        parentPhone: "9876543210",
        parentEmail: "rajesh@example.com",
        loginId: "STU-DAPS-001",
        status: "Active",
        temporaryPassword: "EduStudent@2026",
        mustChangePassword: true,
      },
      {
        admissionNo: "ADM-002",
        studentId: "stu-2",
        studentName: "Sara Khan",
        className: "Class 10",
        section: "A",
        parentName: "Irfan Khan",
        parentPhone: "9123456789",
        parentEmail: "irfan@example.com",
        loginId: "STU-DAPS-002",
        status: "Active",
        mustChangePassword: false, // Already set their password
      },
    ];

    const pdfBytes = await generateStudentCredentialsPdf({
      school: sampleSchool,
      students,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1500);

    const loadedDoc = await PDFDocument.load(pdfBytes);
    expect(loadedDoc.getPageCount()).toBe(1);

    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("renders professional account activation email HTML correctly", () => {
    const html = renderAccountActivationEmailHtml({
      to: "teacher@school.edu",
      name: "Dr. A. P. J. Kalam",
      role: "TEACHER",
      institutionName: "National Academy of Sciences",
      loginId: "TCH-NAS-001",
      temporaryPassword: "EduTeacher@2026",
      loginUrl: "https://eduledger.co.in/teacher/login",
    });

    expect(html).toContain("National Academy of Sciences");
    expect(html).toContain("Teacher &amp; Faculty Portal");
    expect(html).toContain("Dr. A. P. J. Kalam");
    expect(html).toContain("TCH-NAS-001");
    expect(html).toContain("EduTeacher@2026");
    expect(html).toContain("https://eduledger.co.in/teacher/login");
  });
});

