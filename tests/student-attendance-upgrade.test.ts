import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import {
  addSchoolHoliday,
  addStudent,
  classAttendanceAnalytics,
  createAccount,
  getCompleteSettings,
  getInstitution,
  listAttendanceAuditHistory,
  listSchoolHolidays,
  saveCompleteSettings,
  saveStudentAttendance,
  saveTeacher,
  studentAttendanceMonthlyReport,
  studentAttendanceSheet,
  studentAttendanceSummary,
  teacherHasAssignment,
  teacherPortalScope,
  upsertTeacherAccount,
} from "../src/lib/db";
import { configureSchoolCode } from "./configure-school-code";

describe("upgraded student attendance system", () => {
  it("supports Present, Absent, Late, Excused, and Half-day statuses with accurate percentage calculations", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Attendance Principal",
      email: `principal-${stamp}@example.com`,
      institution: `Attendance Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);

    const year = (await getInstitution(admin.institutionId)).academicYear;
    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      startMonth: 4,
      endMonth: 3,
      academicYears: current.years.map((y) => ({ name: y.name, startMonth: y.startMonth, endMonth: y.endMonth, status: y.status })),
      classes: [{ name: "Class 10", sections: ["A"] }],
    });

    // Enroll 5 students
    const students = await Promise.all([
      addStudent(admin.institutionId, {
        name: "Aarav Sharma",
        admission: `ADM-101-${stamp}`,
        gender: "Male",
        dateOfBirth: "2010-01-01",
        className: "Class 10",
        section: "A",
        parent: "Mr Sharma",
        parentPhone: "9876543211",
        parentEmail: "",
        address: "City",
        admissionDate: "2026-04-01",
        totalFee: 0,
        dueDate: "2027-03-01",
        academicYear: year,
      }, admin.id),
      addStudent(admin.institutionId, {
        name: "Bhavna Patel",
        admission: `ADM-102-${stamp}`,
        gender: "Female",
        dateOfBirth: "2010-02-02",
        className: "Class 10",
        section: "A",
        parent: "Mr Patel",
        parentPhone: "9876543212",
        parentEmail: "",
        address: "City",
        admissionDate: "2026-04-01",
        totalFee: 0,
        dueDate: "2027-03-01",
        academicYear: year,
      }, admin.id),
      addStudent(admin.institutionId, {
        name: "Chetan Kumar",
        admission: `ADM-103-${stamp}`,
        gender: "Male",
        dateOfBirth: "2010-03-03",
        className: "Class 10",
        section: "A",
        parent: "Mr Kumar",
        parentPhone: "9876543213",
        parentEmail: "",
        address: "City",
        admissionDate: "2026-04-01",
        totalFee: 0,
        dueDate: "2027-03-01",
        academicYear: year,
      }, admin.id),
      addStudent(admin.institutionId, {
        name: "Divya Nair",
        admission: `ADM-104-${stamp}`,
        gender: "Female",
        dateOfBirth: "2010-04-04",
        className: "Class 10",
        section: "A",
        parent: "Mr Nair",
        parentPhone: "9876543214",
        parentEmail: "",
        address: "City",
        admissionDate: "2026-04-01",
        totalFee: 0,
        dueDate: "2027-03-01",
        academicYear: year,
      }, admin.id),
      addStudent(admin.institutionId, {
        name: "Eshwar Rao",
        admission: `ADM-105-${stamp}`,
        gender: "Male",
        dateOfBirth: "2010-05-05",
        className: "Class 10",
        section: "A",
        parent: "Mr Rao",
        parentPhone: "9876543215",
        parentEmail: "",
        address: "City",
        admissionDate: "2026-04-01",
        totalFee: 0,
        dueDate: "2027-03-01",
        academicYear: year,
      }, admin.id),
    ]);

    // Save attendance covering all 5 statuses
    const saved = await saveStudentAttendance(
      admin.institutionId,
      admin.id,
      {
        academicYear: year,
        className: "Class 10",
        section: "A",
        date: "2026-05-02",
        records: [
          { studentId: students[0].id, status: "Present", remarks: "On time" },
          { studentId: students[1].id, status: "Absent", remarks: "Unexcused" },
          { studentId: students[2].id, status: "Late", remarks: "Traffic delay 10 mins" },
          { studentId: students[3].id, status: "Excused", remarks: "Inter-school tournament" },
          { studentId: students[4].id, status: "Half-day", remarks: "Doctor appointment after lunch" },
        ],
      }
    );
    expect(saved).toBe(5);

    // Verify sheet
    const sheet = await studentAttendanceSheet(admin.institutionId, year, "Class 10", "A", "2026-05-02");
    expect(sheet.find((s) => s.studentId === students[0].id)?.status).toBe("Present");
    expect(sheet.find((s) => s.studentId === students[1].id)?.status).toBe("Absent");
    expect(sheet.find((s) => s.studentId === students[2].id)?.status).toBe("Late");
    expect(sheet.find((s) => s.studentId === students[3].id)?.status).toBe("Excused");
    expect(sheet.find((s) => s.studentId === students[4].id)?.status).toBe("Half-day");

    // Summary calculation
    const summary = await studentAttendanceSummary(admin.institutionId, {
      academicYear: year,
      from: "2026-05-01",
      to: "2026-05-02",
      className: "Class 10",
      section: "A",
    });
    expect(summary.present).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.late).toBe(1);
    expect(summary.excused).toBe(1);
    expect(summary.halfDay).toBe(1);
    expect(summary.total).toBe(5);

    // Rate: (Present: 1 + Late: 1 + Half-day: 0.5) / (Total: 5 - Excused: 1) = 2.5 / 4 = 62.5%
    expect(summary.rate).toBe(62.5);
  });

  it("prevents duplicate submissions without confirmation and enforces correction window for teachers", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Security Principal",
      email: `security-${stamp}@example.com`,
      institution: `Security Public ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);

    const year = (await getInstitution(admin.institutionId)).academicYear;
    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      startMonth: 4,
      endMonth: 3,
      academicYears: current.years.map((y) => ({ name: y.name, startMonth: y.startMonth, endMonth: y.endMonth, status: y.status })),
      classes: [{ name: "Class 9", sections: ["B"] }],
    });

    const student = await addStudent(admin.institutionId, {
      name: "Karan Johar",
      admission: `ADM-901-${stamp}`,
      gender: "Male",
      dateOfBirth: "2011-01-01",
      className: "Class 9",
      section: "B",
      parent: "Yash Johar",
      parentPhone: "9876543220",
      parentEmail: "",
      address: "Bandra",
      admissionDate: "2026-04-01",
      totalFee: 0,
      dueDate: "2027-03-01",
      academicYear: year,
    }, admin.id);

    // Initial submission
    await saveStudentAttendance(admin.institutionId, admin.id, {
      academicYear: year,
      className: "Class 9",
      section: "B",
      date: "2026-06-01",
      records: [{ studentId: student.id, status: "Present", remarks: "" }],
    });

    // 1. Duplicate submission without isCorrection and with allowOverwrite=false must throw
    await expect(
      saveStudentAttendance(
        admin.institutionId,
        admin.id,
        {
          academicYear: year,
          className: "Class 9",
          section: "B",
          date: "2026-06-01",
          records: [{ studentId: student.id, status: "Absent", remarks: "" }],
        },
        { allowOverwrite: false, isCorrection: false }
      )
    ).rejects.toThrow(/already submitted/i);

    // 2. Teacher attempting to correct an expired date beyond window must be rejected
    await expect(
      saveStudentAttendance(
        admin.institutionId,
        admin.id,
        {
          academicYear: year,
          className: "Class 9",
          section: "B",
          date: "2025-01-01", // Past date far beyond 24h
          records: [{ studentId: student.id, status: "Late", remarks: "" }],
        },
        { isCorrection: true, userRole: "TEACHER" }
      )
    ).rejects.toThrow(/correction window.*expired/i);

    // 3. Admin can correct with isCorrection: true
    await saveStudentAttendance(
      admin.institutionId,
      admin.id,
      {
        academicYear: year,
        className: "Class 9",
        section: "B",
        date: "2026-06-01",
        records: [{ studentId: student.id, status: "Late", remarks: "Bus breakdown" }],
      },
      { isCorrection: true, correctionReason: "Bus breakdown verified" }
    );

    const sheet = await studentAttendanceSheet(admin.institutionId, year, "Class 9", "B", "2026-06-01");
    expect(sheet[0].status).toBe("Late");
    expect(sheet[0].remarks).toBe("Bus breakdown");
  });

  it("records full audit history on initial submission and subsequent corrections", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Audit Principal",
      email: `audit-${stamp}@example.com`,
      institution: `Audit Model School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);

    const year = (await getInstitution(admin.institutionId)).academicYear;
    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      startMonth: 4,
      endMonth: 3,
      academicYears: current.years.map((y) => ({ name: y.name, startMonth: y.startMonth, endMonth: y.endMonth, status: y.status })),
      classes: [{ name: "Class 7", sections: ["C"] }],
    });

    const student = await addStudent(admin.institutionId, {
      name: "Manish Malhotra",
      admission: `ADM-701-${stamp}`,
      gender: "Male",
      dateOfBirth: "2013-05-05",
      className: "Class 7",
      section: "C",
      parent: "Suraj Malhotra",
      parentPhone: "9876543230",
      parentEmail: "",
      address: "Colaba",
      admissionDate: "2026-04-01",
      totalFee: 0,
      dueDate: "2027-03-01",
      academicYear: year,
    }, admin.id);

    // Initial submission
    await saveStudentAttendance(admin.institutionId, admin.id, {
      academicYear: year,
      className: "Class 7",
      section: "C",
      date: "2026-07-15",
      records: [{ studentId: student.id, status: "Absent", remarks: "Unwell" }],
    });

    // Correction 1: Absent -> Excused
    await saveStudentAttendance(
      admin.institutionId,
      admin.id,
      {
        academicYear: year,
        className: "Class 7",
        section: "C",
        date: "2026-07-15",
        records: [{ studentId: student.id, status: "Excused", remarks: "Medical certificate submitted" }],
      },
      { isCorrection: true, correctionReason: "Doctor note received" }
    );

    // Query audit history
    const logs = await listAttendanceAuditHistory(admin.institutionId, {
      academicYear: year,
      className: "Class 7",
      section: "C",
      date: "2026-07-15",
    });

    expect(logs.length).toBeGreaterThanOrEqual(2);
    // Most recent is the correction
    expect(logs[0].previousStatus).toBe("Absent");
    expect(logs[0].newStatus).toBe("Excused");
    expect(logs[0].reason).toBe("Doctor note received");
    expect(logs[0].studentName).toBe("Manish Malhotra");

    // Earliest was the initial submission
    expect(logs[1].previousStatus).toBeNull();
    expect(logs[1].newStatus).toBe("Absent");
  });

  it("handles school holidays and generates holiday-aware monthly reports and class analytics", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Analytics Principal",
      email: `analytics-${stamp}@example.com`,
      institution: `Analytics International ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);

    const year = (await getInstitution(admin.institutionId)).academicYear;
    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      startMonth: 4,
      endMonth: 3,
      academicYears: current.years.map((y) => ({ name: y.name, startMonth: y.startMonth, endMonth: y.endMonth, status: y.status })),
      classes: [{ name: "Class 6", sections: ["A"] }],
    });

    const student = await addStudent(admin.institutionId, {
      name: "Tanya Sen",
      admission: `ADM-601-${stamp}`,
      gender: "Female",
      dateOfBirth: "2014-06-06",
      className: "Class 6",
      section: "A",
      parent: "Alok Sen",
      parentPhone: "9876543240",
      parentEmail: "",
      address: "Salt Lake",
      admissionDate: "2026-04-01",
      totalFee: 0,
      dueDate: "2027-03-01",
      academicYear: year,
    }, admin.id);

    // Declare school holiday
    await addSchoolHoliday(admin.institutionId, admin.id, {
      academicYear: year,
      date: "2026-08-15",
      name: "Independence Day",
      type: "Public Holiday",
      description: "National Holiday",
    });

    const holidays = await listSchoolHolidays(admin.institutionId, year);
    expect(holidays.some((h) => h.date === "2026-08-15" && h.name === "Independence Day")).toBe(true);

    // Save attendance for a working day
    await saveStudentAttendance(admin.institutionId, admin.id, {
      academicYear: year,
      className: "Class 6",
      section: "A",
      date: "2026-08-14",
      records: [{ studentId: student.id, status: "Present", remarks: "" }],
    });

    // Generate monthly report for August 2026
    const report = await studentAttendanceMonthlyReport(admin.institutionId, {
      academicYear: year,
      className: "Class 6",
      section: "A",
      yearMonth: "2026-08",
    });

    expect(report.yearMonth).toBe("2026-08");
    expect(report.students).toHaveLength(1);
    expect(report.students[0].name).toBe("Tanya Sen");
    expect(report.students[0].present).toBe(1);
    expect(report.students[0].rate).toBe(100);

    // Verify holiday is flagged in calendar days
    const aug15 = report.days.find((d) => d.date === "2026-08-15");
    expect(aug15?.holiday).toBe("Independence Day");

    // Class Analytics
    const analytics = await classAttendanceAnalytics(admin.institutionId, {
      academicYear: year,
      className: "Class 6",
      section: "A",
      from: "2026-08-01",
      to: "2026-08-31",
    });

    expect(analytics.present).toBe(1);
    expect(analytics.overallRate).toBe(100);
    expect(analytics.trend.length).toBeGreaterThanOrEqual(1);
  });

  it("prevents unauthorized teachers from accessing or modifying unassigned classes", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Role Principal",
      email: `role-${stamp}@example.com`,
      institution: `Boundary School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);

    const year = (await getInstitution(admin.institutionId)).academicYear;
    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      startMonth: 4,
      endMonth: 3,
      academicYears: current.years.map((y) => ({ name: y.name, startMonth: y.startMonth, endMonth: y.endMonth, status: y.status })),
      classes: [
        { name: "Class 11", sections: ["A"] },
        { name: "Class 12", sections: ["B"] },
      ],
    });

    // Teacher assigned ONLY to Class 11 - Section A
    const teacherEmail = `assigned-${stamp}@example.com`;
    await saveTeacher(admin.institutionId, {
      name: "Sunil Gavaskar",
      employeeId: `TCH-${stamp}`,
      email: teacherEmail,
      phone: "9876543250",
      department: "Sports",
      subject: "Physical Education",
      classes: "Class 11",
      joiningDate: "2026-04-01",
      salary: 40000,
      status: "Active",
    });
    await upsertTeacherAccount(admin.institutionId, {
      email: teacherEmail,
      name: "Sunil Gavaskar",
      passwordHash: await hash("TeacherPass1", 4),
    });

    const scope = await teacherPortalScope(admin.institutionId, teacherEmail);

    // Teacher has assignment for Class 11 Section A
    expect(teacherHasAssignment(scope.assignments, { academicYear: year, className: "Class 11", section: "A" })).toBe(true);

    // Teacher DOES NOT have assignment for Class 12 Section B
    expect(teacherHasAssignment(scope.assignments, { academicYear: year, className: "Class 12", section: "B" })).toBe(false);
  });
});
