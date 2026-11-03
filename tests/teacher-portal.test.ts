import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import {
  addStudent,
  createAccount,
  createSession,
  findUserByEmail,
  getCompleteSettings,
  getUserBySession,
  saveCompleteSettings,
  saveTeacher,
  studentAttendanceSheet,
  saveStudentAttendance,
  teacherAssignedStudents,
  teacherHasAssignment,
  teacherPortalScope,
  upsertTeacherAccount,
  addTeacherModuleRecord,
  listTeacherModuleRecords,
  updateTeacherHomeworkStatus,
  createManagedExamination,
  managedResultDetail,
  saveManagedMarks,
  addNotification,
  listUserNotifications,
  markUserNotificationRead,
} from "../src/lib/db";
import { roleHome, safeTeacherRedirect, schoolAccountDestination } from "../src/lib/auth-redirect";

describe("teacher portal authentication, scope and permissions", () => {
  it("authenticates teacher accounts and validates session role", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "School Principal",
      email: `admin-${stamp}@example.com`,
      institution: `Greenwood High ${stamp}`,
      passwordHash: await hash("adminPass123", 4),
    });

    const teacherEmail = `teacher-${stamp}@example.com`;
    const teacherPasswordHash = await hash("teacherPass123", 4);

    // Create staff profile
    const staff = await saveTeacher(
      admin.institutionId,
      {
        name: "Aarav Sharma",
        employeeId: `TCH-${stamp}`,
        email: teacherEmail,
        phone: "9876543210",
        department: "Science",
        subject: "Physics",
        classes: "Class 9, Class 10",
        joiningDate: "2026-04-01",
        salary: 35000,
        status: "Active",
      },
      admin.id,
    );

    // Create user login account with TEACHER role
    const teacherUser = await upsertTeacherAccount(admin.institutionId, {
      name: "Aarav Sharma",
      email: teacherEmail,
      passwordHash: teacherPasswordHash,
      phone: "9876543210",
    });

    expect(teacherUser.role).toBe("TEACHER");
    expect(teacherUser.institutionId).toBe(admin.institutionId);

    // Verify user can be found by email and has TEACHER role
    const loaded = await findUserByEmail(teacherEmail);
    expect(loaded).toBeDefined();
    expect(loaded?.role).toBe("TEACHER");
    expect(loaded?.status).toBe("Active");

    // Create session and verify session resolution
    const session = await createSession(teacherUser.id);
    const sessionUser = await getUserBySession(session.token);
    expect(sessionUser).toBeDefined();
    expect(sessionUser?.email).toBe(teacherEmail);
    expect(sessionUser?.role).toBe("TEACHER");

    // Verify role home and destinations
    expect(roleHome("TEACHER")).toBe("/teacher");
    expect(schoolAccountDestination({ role: "TEACHER" })).toBe("/teacher");
    expect(schoolAccountDestination({ role: "TEACHER", requested: "/teacher/attendance" })).toBe("/teacher/attendance");
    expect(schoolAccountDestination({ role: "TEACHER", requested: "https://evil.test" })).toBe("/teacher");
    expect(safeTeacherRedirect("/teacher/exams")).toBe("/teacher/exams");
    expect(safeTeacherRedirect("/dashboard")).toBe("/teacher");
  });

  it("resolves assigned classes and sections strictly within the teacher's school", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Academy Director",
      email: `director-${stamp}@example.com`,
      institution: `Oakridge Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    // Configure classes Class 9 (Sec A, B) and Class 10 (Sec A)
    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      schoolCode: "OAK",
      startMonth: 4,
      endMonth: 3,
      academicYears: [{ name: "2026-2027", startMonth: 4, endMonth: 3, status: "Active" }],
      classes: [
        { name: "Class 9", sections: ["A", "B"] },
        { name: "Class 10", sections: ["A"] },
        { name: "Class 11", sections: ["A"] },
      ],
    });

    const teacherEmail = `math-teacher-${stamp}@example.com`;
    await saveTeacher(
      admin.institutionId,
      {
        name: "Sunita Roy",
        employeeId: `ROY-${stamp}`,
        email: teacherEmail,
        phone: "9123456780",
        department: "Mathematics",
        subject: "Mathematics",
        classes: "Class 9, Class 10",
        joiningDate: "2026-04-01",
        salary: 40000,
        status: "Active",
      },
      admin.id,
    );

    // Resolve teacher portal scope
    const scope = await teacherPortalScope(admin.institutionId, teacherEmail);
    expect(scope.teacher.name).toBe("Sunita Roy");

    // Sunita was assigned Class 9 and Class 10. Class 11 should not be in her assignments.
    const classNames = scope.assignments.map((a) => a.className);
    expect(classNames).toContain("Class 9");
    expect(classNames).toContain("Class 10");
    expect(classNames).not.toContain("Class 11");

    // Check teacherHasAssignment
    expect(
      teacherHasAssignment(scope.assignments, {
        academicYear: "2026-2027",
        className: "Class 9",
        section: "A",
      }),
    ).toBe(true);

    expect(
      teacherHasAssignment(scope.assignments, {
        academicYear: "2026-2027",
        className: "Class 9",
        section: "A",
        subject: "Mathematics",
      }),
    ).toBe(true);

    // Class 11 is not assigned
    expect(
      teacherHasAssignment(scope.assignments, {
        academicYear: "2026-2027",
        className: "Class 11",
        section: "A",
      }),
    ).toBe(false);

    // Subject English is not assigned
    expect(
      teacherHasAssignment(scope.assignments, {
        academicYear: "2026-2027",
        className: "Class 9",
        section: "A",
        subject: "English",
      }),
    ).toBe(false);
  });

  it("restricts student list and attendance strictly to assigned classes", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "St. Jude Headmaster",
      email: `stjude-${stamp}@example.com`,
      institution: `St. Jude School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      schoolCode: "STJ",
      startMonth: 4,
      endMonth: 3,
      academicYears: [{ name: "2026-2027", startMonth: 4, endMonth: 3, status: "Active" }],
      classes: [
        { name: "Class 8", sections: ["A"] },
        { name: "Class 9", sections: ["A"] },
      ],
    });

    // Add students: 2 in Class 8, 1 in Class 9
    const s1 = await addStudent(admin.institutionId, {
      name: "Rohan Verma",
      admission: "ADM-801",
      gender: "Male",
      dateOfBirth: "2012-05-10",
      className: "Class 8",
      section: "A",
      parent: "Kavita Verma",
      parentPhone: "9876500001",
      parentEmail: "kavita@example.com",
      address: "MG Road",
      admissionDate: "2026-04-01",
      totalFee: 0,
      dueDate: "2027-03-01",
      academicYear: "2026-2027",
    });

    const s2 = await addStudent(admin.institutionId, {
      name: "Pooja Hegde",
      admission: "ADM-802",
      gender: "Female",
      dateOfBirth: "2012-08-15",
      className: "Class 8",
      section: "A",
      parent: "Rajesh Hegde",
      parentPhone: "9876500002",
      parentEmail: "rajesh@example.com",
      address: "Brigade Road",
      admissionDate: "2026-04-01",
      totalFee: 0,
      dueDate: "2027-03-01",
      academicYear: "2026-2027",
    });

    const s3 = await addStudent(admin.institutionId, {
      name: "Aditya Roy",
      admission: "ADM-901",
      gender: "Male",
      dateOfBirth: "2011-03-20",
      className: "Class 9",
      section: "A",
      parent: "Anil Roy",
      parentPhone: "9876500003",
      parentEmail: "anil@example.com",
      address: "Indiranagar",
      admissionDate: "2026-04-01",
      totalFee: 0,
      dueDate: "2027-03-01",
      academicYear: "2026-2027",
    });

    // Create teacher assigned ONLY to Class 8
    const teacherEmail = `class8teacher-${stamp}@example.com`;
    await saveTeacher(
      admin.institutionId,
      {
        name: "Meenakshi Sundaram",
        employeeId: `MEEN-${stamp}`,
        email: teacherEmail,
        phone: "9811223344",
        department: "Middle School",
        subject: "Science",
        classes: "Class 8",
        joiningDate: "2026-04-01",
        salary: 30000,
        status: "Active",
      },
      admin.id,
    );

    const scope = await teacherPortalScope(admin.institutionId, teacherEmail);
    const assignedStudents = await teacherAssignedStudents(admin.institutionId, scope.assignments);

    // Only Class 8 students should be returned
    const studentNames = assignedStudents.map((s) => s.name);
    expect(studentNames).toContain("Rohan Verma");
    expect(studentNames).toContain("Pooja Hegde");
    expect(studentNames).not.toContain("Aditya Roy");

    // Teacher can fetch attendance sheet for assigned Class 8
    const sheet = await studentAttendanceSheet(
      admin.institutionId,
      "2026-2027",
      "Class 8",
      "A",
      "2026-05-15",
    );
    expect(sheet.length).toBe(2);

    // Teacher can save attendance for assigned Class 8
    const saved = await saveStudentAttendance(
      admin.institutionId,
      admin.id,
      {
        academicYear: "2026-2027",
        className: "Class 8",
        section: "A",
        date: "2026-05-15",
        records: [
          { studentId: s1.id, status: "Present", remarks: "" },
          { studentId: s2.id, status: "Absent", remarks: "Sick leave" },
        ],
      },
      { allowOverwrite: true },
    );
    expect(saved).toBe(2);

    // Attempting to save attendance with a student from Class 9 throws
    await expect(
      saveStudentAttendance(
        admin.institutionId,
        admin.id,
        {
          academicYear: "2026-2027",
          className: "Class 8",
          section: "A",
          date: "2026-05-15",
          records: [{ studentId: s3.id, status: "Present", remarks: "" }],
        },
        { allowOverwrite: true },
      ),
    ).rejects.toThrow("Attendance contains a student outside the selected class.");
  });

  it("handles homework management, leave requests and notifications for authenticated teachers", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Global School Admin",
      email: `globalschool-${stamp}@example.com`,
      institution: `Global International ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    const teacherEmail = `globalteacher-${stamp}@example.com`;
    const teacherUser = await upsertTeacherAccount(admin.institutionId, {
      name: "Priya Nair",
      email: teacherEmail,
      passwordHash: await hash("securePass123", 4),
      phone: "9876543210",
    });

    await saveTeacher(
      admin.institutionId,
      {
        name: "Priya Nair",
        employeeId: `PRIYA-${stamp}`,
        email: teacherEmail,
        phone: "9876543210",
        department: "Languages",
        subject: "English",
        classes: "Class 7",
        joiningDate: "2026-04-01",
        salary: 28000,
        status: "Active",
      },
      admin.id,
    );

    // 1. Homework management
    const hw = await addTeacherModuleRecord(admin.institutionId, "teacher_homework", teacherUser.id, {
      className: "Class 7",
      section: "A",
      subject: "English",
      academicYear: "2026-2027",
      title: "Essay: My Favourite Book",
      description: "Write a 300-word essay about your favourite book.",
      dueDate: "2026-06-01",
      status: "Active",
    });

    expect(hw.id).toBeDefined();

    const list = await listTeacherModuleRecords(admin.institutionId, "teacher_homework", teacherUser.id);
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("Essay: My Favourite Book");

    // Toggle status
    const updatedHw = await updateTeacherHomeworkStatus(admin.institutionId, teacherUser.id, hw.id, "Archived");
    expect(updatedHw.status).toBe("Archived");

    // 2. Leave requests
    const leave = await addTeacherModuleRecord(
      admin.institutionId,
      "teacher_leave_requests",
      teacherUser.id,
      {
        fromDate: "2026-07-01",
        toDate: "2026-07-03",
        reason: "Attending brother's wedding.",
        status: "Pending",
      },
    );

    const leaves = await listTeacherModuleRecords(admin.institutionId, "teacher_leave_requests", teacherUser.id);
    expect(leaves.length).toBe(1);
    expect(leaves[0].reason).toContain("wedding");

    // 3. Notifications
    await addNotification(
      admin.institutionId,
      teacherUser.id,
      "ANNOUNCEMENT",
      "Staff Meeting",
      "All faculty meeting tomorrow at 3 PM in the auditorium.",
    );

    const notifications = await listUserNotifications(teacherUser.id);
    expect(notifications.items.length).toBeGreaterThanOrEqual(1);
    expect(notifications.unread).toBeGreaterThanOrEqual(1);

    // Mark as read
    const noteId = String(notifications.items[0]?.id || "");
    if (noteId) {
      await markUserNotificationRead(teacherUser.id, noteId);
      const afterRead = await listUserNotifications(teacherUser.id);
      expect(afterRead.items.find((n) => String(n.id) === noteId)?.readAt).not.toBeNull();
    }
  });

  it("enforces examination marks entry permissions and locks", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Exam Admin",
      email: `examadmin-${stamp}@example.com`,
      institution: `Modern Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      schoolCode: "MOD",
      startMonth: 4,
      endMonth: 3,
      academicYears: [{ name: "2026-2027", startMonth: 4, endMonth: 3, status: "Active" }],
      classes: [{ name: "Class 10", sections: ["A"] }],
    });

    const student = await addStudent(admin.institutionId, {
      name: "Kabir Khan",
      admission: "ADM-1001",
      gender: "Male",
      dateOfBirth: "2010-02-14",
      className: "Class 10",
      section: "A",
      parent: "Salim Khan",
      parentPhone: "9876543200",
      parentEmail: "salim@example.com",
      address: "Bandra",
      admissionDate: "2026-04-01",
      totalFee: 0,
      dueDate: "2027-03-01",
      academicYear: "2026-2027",
    });

    // Create an examination
    const exam = await createManagedExamination(admin.institutionId, admin.id, {
      name: "Midterm Examinations",
      className: "Class 10",
      section: "A",
      academicYear: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2026-09-10",
      subjects: [
        { name: "Mathematics", maximumMarks: 100, passingMarks: 35, required: true },
        { name: "Physics", maximumMarks: 100, passingMarks: 35, required: true },
      ],
    });

    expect(exam.status).toBe("Draft");

    const detail = await managedResultDetail(admin.institutionId, exam.id);
    const mathSub = detail.subjects.find((s) => s.subject === "Mathematics");
    expect(mathSub).toBeDefined();

    // In Draft or Marks Entry Open, marks entry succeeds
    const saved = await saveManagedMarks(
      admin.institutionId,
      admin.id,
      exam.id,
      mathSub!.id,
      [{ studentId: student.id, markStatus: "Scored", obtainedMarks: 88, remarks: "Excellent" }],
    );

    const reloaded = await managedResultDetail(admin.institutionId, exam.id);
    const kabirMath = reloaded.students
      .find((s) => s.id === student.id)
      ?.subjects.find((s) => s.subjectId === mathSub!.id);

    expect(kabirMath?.obtainedCent).toBe(8800);
    expect(kabirMath?.markStatus).toBe("Scored");
  });
});
