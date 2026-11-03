import { beforeEach, describe, expect, it, vi } from "vitest";

const testContext = vi.hoisted(() => ({
  user: {
    id: "user-teacher-1",
    email: "teacher@school.test",
    name: "Pooja Sharma",
    role: "TEACHER",
    institutionId: "inst-school-1",
  } as { id: string; email: string; name: string; role: string; institutionId: string } | null,
  scope: {
    teacher: {
      id: "tch-1",
      name: "Pooja Sharma",
      employeeId: "TCH-001",
      email: "teacher@school.test",
      phone: "9876543210",
      department: "Science",
      subject: "Physics",
      classes: "Class 10",
      joiningDate: "2026-04-01",
      salary: 35000,
      status: "Active",
      createdAt: "2026-04-01T00:00:00Z",
    },
    timetable: [
      {
        id: "tt-1",
        academicYear: "2026-2027",
        className: "Class 10",
        section: "A",
        subject: "Physics",
        weekday: 1,
        startTime: "09:00",
        endTime: "09:45",
      },
    ],
    assignments: [
      {
        academicYear: "2026-2027",
        className: "Class 10",
        section: "A",
        subject: "Physics",
      },
    ],
  },
}));

vi.mock("../src/lib/session", () => ({
  currentUser: vi.fn(async () => testContext.user),
}));

vi.mock("../src/lib/db", () => ({
  teacherPortalScope: vi.fn(async (instId: string, email: string) => {
    if (instId !== "inst-school-1" || email !== "teacher@school.test") {
      throw new Error("Teacher account is not linked to an active staff record.");
    }
    return testContext.scope;
  }),
  teacherHasAssignment: vi.fn((assignments, target) => {
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    return assignments.some(
      (item: any) =>
        same(item.academicYear, target.academicYear) &&
        same(item.className, target.className) &&
        same(item.section, target.section) &&
        (!target.subject || same(item.subject, target.subject)),
    );
  }),
  teacherAssignedStudents: vi.fn(async () => [
    {
      id: "std-1",
      name: "Rohan Verma",
      admission: "ADM-001",
      rollNumber: "ROLL-001",
      academicYear: "2026-2027",
      className: "Class 10",
      section: "A",
    },
  ]),
  getInstitution: vi.fn(async () => ({ name: "Springfield Academy", academicYear: "2026-2027" })),
  listTeacherModuleRecords: vi.fn(async () => []),
  addTeacherModuleRecord: vi.fn(async (_instId, _mod, _uid, data) => ({ id: "mod-1", ...data })),
  updateTeacherHomeworkStatus: vi.fn(async (_instId, _uid, id, status) => ({ id, status })),
  actOnSingleRecord: vi.fn(async () => "Deleted"),
  studentAttendanceSheet: vi.fn(async () => [
    { studentId: "std-1", name: "Rohan Verma", admission: "ADM-001", rollNumber: "1", status: null, remarks: "", recorded: false },
  ]),
  listSchoolHolidays: vi.fn(async () => []),
  saveStudentAttendance: vi.fn(async () => 1),
  listManagedExaminations: vi.fn(async () => []),
  managedResultDetail: vi.fn(async () => ({
    exam: { id: "exam-1", academicYear: "2026-2027", className: "Class 10", section: "A", name: "Midterm" },
    subjects: [
      { id: "sub-phys", subject: "Physics", maximumMarks: 100, passingMarks: 35, required: true },
      { id: "sub-chem", subject: "Chemistry", maximumMarks: 100, passingMarks: 35, required: true },
    ],
    students: [
      { id: "std-1", name: "Rohan", subjects: [{ subjectId: "sub-phys" }, { subjectId: "sub-chem" }] },
    ],
  })),
  saveManagedMarks: vi.fn(async () => ({
    exam: { id: "exam-1", academicYear: "2026-2027", className: "Class 10", section: "A", name: "Midterm" },
    subjects: [{ id: "sub-phys", subject: "Physics" }],
    students: [],
  })),
  listUserNotifications: vi.fn(async () => ({ items: [], unread: 0 })),
  markUserNotificationRead: vi.fn(async () => true),
}));

import { GET as getDashboard } from "../src/app/api/teacher/dashboard/route";
import { GET as getAttendance, PUT as putAttendance } from "../src/app/api/teacher/attendance/route";
import { GET as getHomework, POST as postHomework } from "../src/app/api/teacher/homework/route";
import { GET as getExams, POST as postExams } from "../src/app/api/teacher/exams/route";
import { POST as postLeave } from "../src/app/api/teacher/leave/route";
import { GET as getStudents } from "../src/app/api/teacher/students/route";

describe("teacher portal API route authorization boundaries", () => {
  beforeEach(() => {
    testContext.user = {
      id: "user-teacher-1",
      email: "teacher@school.test",
      name: "Pooja Sharma",
      role: "TEACHER",
      institutionId: "inst-school-1",
    };
  });

  it("rejects unauthenticated requests with 401", async () => {
    testContext.user = null;
    const res = await getDashboard();
    expect(res?.status).toBe(401);
  });

  it("rejects non-teacher roles with 403", async () => {
    testContext.user = {
      id: "user-admin-1",
      email: "admin@school.test",
      name: "Admin User",
      role: "SCHOOL_ADMIN",
      institutionId: "inst-school-1",
    };
    const res = await getDashboard();
    expect(res?.status).toBe(403);
  });

  it("returns complete dashboard data for authenticated teacher", async () => {
    const res = await getDashboard();
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.user.name).toBe("Pooja Sharma");
    expect(body.teacher.subject).toBe("Physics");
    expect(body.assignments).toHaveLength(1);
    expect(body.timetable).toHaveLength(1);
  });

  it("enforces class and section assignment check on attendance read and write", async () => {
    // 1. Authorized class: Class 10 - Section A
    const validUrl = "http://localhost/api/teacher/attendance?academicYear=2026-2027&className=Class%2010&section=A&date=2026-05-10";
    const okRes = await getAttendance(new Request(validUrl));
    expect(okRes?.status).toBe(200);

    // 2. Unauthorized class: Class 12 - Section B -> 403 Forbidden
    const invalidUrl = "http://localhost/api/teacher/attendance?academicYear=2026-2027&className=Class%2012&section=B&date=2026-05-10";
    const forbidRes = await getAttendance(new Request(invalidUrl));
    expect(forbidRes?.status).toBe(403);

    // 3. Authorized submission
    const validPut = new Request("http://localhost/api/teacher/attendance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear: "2026-2027",
        className: "Class 10",
        section: "A",
        date: "2026-05-10",
        records: [{ studentId: "std-1", status: "Present", remarks: "" }],
      }),
    });
    expect((await putAttendance(validPut))?.status).toBe(200);

    // 4. Unauthorized submission for unassigned class -> 403 Forbidden
    const invalidPut = new Request("http://localhost/api/teacher/attendance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear: "2026-2027",
        className: "Class 12",
        section: "B",
        date: "2026-05-10",
        records: [{ studentId: "std-1", status: "Present", remarks: "" }],
      }),
    });
    expect((await putAttendance(invalidPut))?.status).toBe(403);
  });

  it("enforces subject and class assignment on homework creation", async () => {
    // 1. Valid homework for assigned Class 10 Physics
    const validReq = new Request("http://localhost/api/teacher/homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear: "2026-2027",
        className: "Class 10",
        section: "A",
        subject: "Physics",
        title: "Thermodynamics Problems",
        description: "Solve problems 1 through 10 from Chapter 3.",
        dueDate: "2026-05-20",
      }),
    });
    expect((await postHomework(validReq))?.status).toBe(201);

    // 2. Invalid subject: Chemistry (teacher is not assigned Chemistry) -> 403 Forbidden
    const invalidSubReq = new Request("http://localhost/api/teacher/homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear: "2026-2027",
        className: "Class 10",
        section: "A",
        subject: "Chemistry",
        title: "Organic Chemistry Reactions",
        description: "Memorize naming conventions.",
        dueDate: "2026-05-20",
      }),
    });
    expect((await postHomework(invalidSubReq))?.status).toBe(403);
  });

  it("scopes examination details and rejects unauthorized marks entry", async () => {
    // 1. Teacher views exam: Chemistry should be stripped out from detail because teacher is assigned Physics only
    const detailReq = new Request("http://localhost/api/teacher/exams?examId=exam-1");
    const detailRes = await getExams(detailReq);
    expect(detailRes?.status).toBe(200);
    const body = await detailRes!.json();
    const subjects = body.detail.subjects.map((s: any) => s.subject);
    expect(subjects).toContain("Physics");
    expect(subjects).not.toContain("Chemistry");

    // 2. Entering marks for assigned Physics succeeds
    const validMarks = new Request("http://localhost/api/teacher/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId: "exam-1",
        subjectId: "sub-phys",
        items: [{ studentId: "std-1", markStatus: "Scored", obtainedMarks: 92, remarks: "" }],
      }),
    });
    expect((await postExams(validMarks))?.status).toBe(200);

    // 3. Entering marks for unassigned Chemistry is rejected with 403 Forbidden
    const invalidMarks = new Request("http://localhost/api/teacher/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId: "exam-1",
        subjectId: "sub-chem",
        items: [{ studentId: "std-1", markStatus: "Scored", obtainedMarks: 92, remarks: "" }],
      }),
    });
    expect((await postExams(invalidMarks))?.status).toBe(403);
  });

  it("validates leave request constraints and student filtering", async () => {
    // 1. Invalid date range (end date before start date) -> 400 Bad Request
    const badLeave = new Request("http://localhost/api/teacher/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDate: "2026-06-15",
        toDate: "2026-06-10",
        reason: "Vacation trip",
      }),
    });
    expect((await postLeave(badLeave))?.status).toBe(400);

    // 2. Valid leave request -> 201 Created
    const goodLeave = new Request("http://localhost/api/teacher/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDate: "2026-06-15",
        toDate: "2026-06-18",
        reason: "Family function in hometown.",
      }),
    });
    expect((await postLeave(goodLeave))?.status).toBe(201);

    // 3. Students list
    const stdRes = await getStudents(new Request("http://localhost/api/teacher/students"));
    expect(stdRes?.status).toBe(200);
    const stdBody = await stdRes!.json();
    expect(stdBody.students).toHaveLength(1);
    expect(stdBody.students[0].name).toBe("Rohan Verma");
  });
});

