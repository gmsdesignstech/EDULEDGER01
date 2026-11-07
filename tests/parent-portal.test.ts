import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import {
  activateParentAccount,
  addModuleRecord,
  addStudent,
  addTimetableEntry,
  createAccount,
  createParentInvitation,
  createManagedExamination,
  expireParentInvitation,
  getCompleteSettings,
  getInstitution,
  linkStudentToParent,
  managedResultDetail,
  parentChildAttendance,
  parentChildFees,
  parentChildHomework,
  parentChildOverview,
  parentChildResults,
  parentChildTimetable,
  parentChildren,
  parentHasChild,
  recordPayment,
  saveCompleteSettings,
  saveStudentAttendance,
  saveManagedMarks,
  transitionManagedExamination,
} from "../src/lib/db";
import { configureSchoolCode } from "./configure-school-code";

async function setupClasses(institutionId: string, adminId: string, classes: Array<{ name: string; sections: string[] }>) {
  const current = await getCompleteSettings(institutionId);
  await saveCompleteSettings(institutionId, adminId, {
    ...current,
    startMonth: 4,
    endMonth: 3,
    academicYears: current.years.map((y) => ({
      name: y.name,
      startMonth: y.startMonth,
      endMonth: y.endMonth,
      status: y.status,
    })),
    classes,
  });
}

describe("EduLedger Parent Portal", () => {
  it("only exposes official published result snapshots and preserves them after a correction reopen", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Results Admin",
      email: `results-admin-${stamp}@school.edu`,
      institution: `Results School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);
    const year = (await getInstitution(admin.institutionId)).academicYear;
    await setupClasses(admin.institutionId, admin.id, [{ name: "Class 7", sections: ["A"] }]);
    const student = await addStudent(admin.institutionId, {
      name: "Published Result Student", admission: `ADM-R-${stamp}`, gender: "Female",
      dateOfBirth: "2013-01-01", className: "Class 7", section: "A", rollNumber: "1",
      parent: "Parent", parentPhone: "9876543210", parentEmail: `parent-${stamp}@example.com`,
      address: "School Road", admissionDate: "2026-04-01", totalFee: 1000,
      dueDate: "2027-03-31", academicYear: year,
    }, admin.id);
    const examination = await createManagedExamination(admin.institutionId, admin.id, {
      name: "Unit Test", academicYear: year, className: "Class 7", section: "A",
      startDate: "2026-10-01", endDate: "2026-10-01", subjects: [
        { name: "Mathematics", maximumMarks: 100, passingMarks: 35, required: true },
      ],
    });
    const subjectId = (await managedResultDetail(admin.institutionId, examination!.id)).subjects[0].id;
    expect(await parentChildResults(admin.institutionId, student.id)).toEqual([]);
    await transitionManagedExamination(admin.institutionId, admin.id, examination!.id, "open");
    await saveManagedMarks(admin.institutionId, admin.id, examination!.id, subjectId, [
      { studentId: student.id, markStatus: "Scored", obtainedMarks: 80, remarks: "Good work" },
    ]);
    await transitionManagedExamination(admin.institutionId, admin.id, examination!.id, "close");
    await transitionManagedExamination(admin.institutionId, admin.id, examination!.id, "verify");
    await transitionManagedExamination(admin.institutionId, admin.id, examination!.id, "approve");
    await transitionManagedExamination(admin.institutionId, admin.id, examination!.id, "publish");
    expect((await parentChildResults(admin.institutionId, student.id))[0]?.marks).toBe(80);
    await transitionManagedExamination(admin.institutionId, admin.id, examination!.id, "reopen");
    await saveManagedMarks(admin.institutionId, admin.id, examination!.id, subjectId, [
      { studentId: student.id, markStatus: "Scored", obtainedMarks: 90, remarks: "Corrected" },
    ]);
    expect((await parentChildResults(admin.institutionId, student.id))[0]?.marks).toBe(80);
  });

  it("activates parent account via school-issued invitation code and links student", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Admin Principal",
      email: `admin-${stamp}@school.edu`,
      institution: `Greenwood High ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);
    const year = (await getInstitution(admin.institutionId)).academicYear;
    await setupClasses(admin.institutionId, admin.id, [{ name: "Class 7", sections: ["A"] }]);

    const student = await addStudent(
      admin.institutionId,
      {
        name: "Aarav Patel",
        admission: `ADM-P1-${stamp}`,
        gender: "Male",
        dateOfBirth: "2012-05-15",
        className: "Class 7",
        section: "A",
        rollNumber: "12",
        parent: "Rajesh Patel",
        parentPhone: "9876543210",
        parentEmail: `rajesh-${stamp}@example.com`,
        address: "123 Maple Street",
        admissionDate: "2024-04-01",
        totalFee: 45000,
        dueDate: "2025-03-31",
        academicYear: year,
      },
      admin.id
    );

    // 1. School Admin issues invitation code
    const invitation = await createParentInvitation(admin.institutionId, admin.id, {
      studentId: student.id,
      parentName: "Rajesh Patel",
      parentEmail: `rajesh-${stamp}@example.com`,
      parentPhone: "9876543210",
      expiresInDays: 7,
    });

    expect(invitation.code).toMatch(/^PRNT-[A-Z0-9]+$/);
    expect(invitation.studentName).toBe("Aarav Patel");

    // 2. Parent activates account using invitation code
    const parentPasswordHash = await hash("ParentSecure123!", 4);
    const activated = await activateParentAccount(undefined, {
      invitationCode: invitation.code,
      name: "Rajesh Patel",
      email: `rajesh-${stamp}@example.com`,
      passwordHash: parentPasswordHash,
    });

    expect(activated.email).toBe(`rajesh-${stamp}@example.com`);
    expect(activated.studentId).toBe(student.id);

    // 3. Verify student is linked to parent account
    const children = await parentChildren(admin.institutionId, activated.userId);
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(student.id);
    expect(children[0].name).toBe("Aarav Patel");
    expect(children[0].className).toBe("Class 7");
    expect(children[0].section).toBe("A");

    // 4. Verify access check passes
    const hasAccess = await parentHasChild(admin.institutionId, activated.userId, student.id);
    expect(hasAccess).toBe(true);

    // 5. Reusing the accepted code should be rejected
    await expect(
      activateParentAccount(undefined, {
        invitationCode: invitation.code,
        name: "Duplicate User",
        email: `dup-${stamp}@example.com`,
        passwordHash: parentPasswordHash,
      })
    ).rejects.toThrow(/already accepted/i);
  });

  it("rejects expired invitation codes", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Admin Principal",
      email: `admin2-${stamp}@school.edu`,
      institution: `Oakridge Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);
    const year = (await getInstitution(admin.institutionId)).academicYear;
    await setupClasses(admin.institutionId, admin.id, [{ name: "Class 6", sections: ["B"] }]);

    const student = await addStudent(
      admin.institutionId,
      {
        name: "Diya Sharma",
        admission: `ADM-P2-${stamp}`,
        gender: "Female",
        dateOfBirth: "2013-08-20",
        className: "Class 6",
        section: "B",
        rollNumber: "5",
        parent: "Sunita Sharma",
        parentPhone: "9123456780",
        parentEmail: `sunita-${stamp}@example.com`,
        address: "45 River View",
        admissionDate: "2024-04-01",
        totalFee: 40000,
        dueDate: "2025-03-31",
        academicYear: year,
      },
      admin.id
    );

    const invitation = await createParentInvitation(admin.institutionId, admin.id, {
      studentId: student.id,
      parentName: "Sunita Sharma",
      parentEmail: `sunita-${stamp}@example.com`,
      expiresInDays: 1,
    });

    // Artificially expire the invitation in database
    await expireParentInvitation(invitation.id);

    await expect(
      activateParentAccount(undefined, {
        invitationCode: invitation.code,
        name: "Sunita Sharma",
        email: `sunita-${stamp}@example.com`,
        passwordHash: await hash("pass12345", 4),
      })
    ).rejects.toThrow(/expired/i);
  });

  it("activates parent account via admission number and registered phone", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Admin Principal",
      email: `admin3-${stamp}@school.edu`,
      institution: `Modern School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);
    const year = (await getInstitution(admin.institutionId)).academicYear;
    await setupClasses(admin.institutionId, admin.id, [{ name: "Class 8", sections: ["C"] }]);

    const student = await addStudent(
      admin.institutionId,
      {
        name: "Kabir Khan",
        admission: `ADM-K1-${stamp}`,
        gender: "Male",
        dateOfBirth: "2011-11-10",
        className: "Class 8",
        section: "C",
        rollNumber: "18",
        parent: "Imran Khan",
        parentPhone: "9988776655",
        parentEmail: `imran-${stamp}@example.com`,
        address: "78 Crescent Road",
        admissionDate: "2024-04-01",
        totalFee: 50000,
        dueDate: "2025-03-31",
        academicYear: year,
      },
      admin.id
    );

    const activated = await activateParentAccount(admin.institutionId, {
      admission: `ADM-K1-${stamp}`,
      parentPhone: "9988776655",
      name: "Imran Khan",
      email: `imran-${stamp}@example.com`,
      passwordHash: await hash("imranPass123", 4),
    });

    expect(activated.email).toBe(`imran-${stamp}@example.com`);
    expect(activated.studentId).toBe(student.id);

    const children = await parentChildren(admin.institutionId, activated.userId);
    expect(children).toHaveLength(1);
    expect(children[0].name).toBe("Kabir Khan");
  });

  it("links multiple children to one parent and supports child switching", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Admin Principal",
      email: `admin4-${stamp}@school.edu`,
      institution: `St. Xavier's ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);
    const year = (await getInstitution(admin.institutionId)).academicYear;
    await setupClasses(admin.institutionId, admin.id, [
      { name: "Class 9", sections: ["A"] },
      { name: "Class 5", sections: ["B"] },
      { name: "Class 8", sections: ["A"] },
    ]);

    // Two sibling students
    const child1 = await addStudent(
      admin.institutionId,
      {
        name: "Rohan Verma",
        admission: `ADM-V1-${stamp}`,
        gender: "Male",
        dateOfBirth: "2010-02-14",
        className: "Class 9",
        section: "A",
        rollNumber: "22",
        parent: "Anil Verma",
        parentPhone: "9811223344",
        parentEmail: `anil-${stamp}@example.com`,
        address: "12 Pine Enclave",
        admissionDate: "2024-04-01",
        totalFee: 60000,
        dueDate: "2025-03-31",
        academicYear: year,
      },
      admin.id
    );

    const child2 = await addStudent(
      admin.institutionId,
      {
        name: "Ananya Verma",
        admission: `ADM-V2-${stamp}`,
        gender: "Female",
        dateOfBirth: "2014-07-22",
        className: "Class 5",
        section: "B",
        rollNumber: "14",
        parent: "Anil Verma",
        parentPhone: "9811223344",
        parentEmail: `anil-${stamp}@example.com`,
        address: "12 Pine Enclave",
        admissionDate: "2024-04-01",
        totalFee: 42000,
        dueDate: "2025-03-31",
        academicYear: year,
      },
      admin.id
    );

    // Unrelated third student
    const strangerStudent = await addStudent(
      admin.institutionId,
      {
        name: "Other Student",
        admission: `ADM-OTHER-${stamp}`,
        gender: "Male",
        dateOfBirth: "2011-01-01",
        className: "Class 8",
        section: "A",
        rollNumber: "9",
        parent: "Other Parent",
        parentPhone: "9000000000",
        parentEmail: `other-${stamp}@example.com`,
        address: "99 Hilltop",
        admissionDate: "2024-04-01",
        totalFee: 30000,
        dueDate: "2025-03-31",
        academicYear: year,
      },
      admin.id
    );

    // Parent activates for Child 1
    const activated = await activateParentAccount(admin.institutionId, {
      admission: `ADM-V1-${stamp}`,
      parentPhone: "9811223344",
      name: "Anil Verma",
      email: `anil-${stamp}@example.com`,
      passwordHash: await hash("vermaPass999", 4),
    });

    // Link Child 2
    await linkStudentToParent(admin.institutionId, activated.userId, child2.id, "Father", false);

    // Verify both children are returned in parentChildren
    const children = await parentChildren(admin.institutionId, activated.userId);
    expect(children).toHaveLength(2);
    const names = children.map((c) => c.name);
    expect(names).toContain("Rohan Verma");
    expect(names).toContain("Ananya Verma");

    // SECURITY CHECK: Parent has access to child1 and child2, but NOT to strangerStudent!
    expect(await parentHasChild(admin.institutionId, activated.userId, child1.id)).toBe(true);
    expect(await parentHasChild(admin.institutionId, activated.userId, child2.id)).toBe(true);
    expect(await parentHasChild(admin.institutionId, activated.userId, strangerStudent.id)).toBe(false);

    // SECURITY CHECK: Accessing overview for stranger student must be rejected
    await expect(
      parentChildOverview(admin.institutionId, activated.userId, strangerStudent.id)
    ).rejects.toThrow(/unauthorized/i);
  });

  it("correctly scopes attendance, fees, homework, results, and timetable to child", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const admin = await createAccount({
      name: "Admin Principal",
      email: `admin5-${stamp}@school.edu`,
      institution: `Delhi Public School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);

    const year = (await getInstitution(admin.institutionId)).academicYear;
    await setupClasses(admin.institutionId, admin.id, [{ name: "Class 10", sections: ["A"] }]);

    const student = await addStudent(
      admin.institutionId,
      {
        name: "Pooja Hegde",
        admission: `ADM-PH-${stamp}`,
        gender: "Female",
        dateOfBirth: "2010-09-18",
        className: "Class 10",
        section: "A",
        rollNumber: "1",
        parent: "Kavita Hegde",
        parentPhone: "9765432109",
        parentEmail: `kavita-${stamp}@example.com`,
        address: "10 Garden View",
        admissionDate: "2024-04-01",
        totalFee: 50000,
        dueDate: "2025-03-31",
        academicYear: year,
      },
      admin.id
    );

    // 1. Mark attendance
    await saveStudentAttendance(admin.institutionId, admin.id, {
      academicYear: year,
      className: "Class 10",
      section: "A",
      date: "2026-10-01",
      records: [{ studentId: student.id, status: "Present", remarks: "On time" }],
    });
    await saveStudentAttendance(admin.institutionId, admin.id, {
      academicYear: year,
      className: "Class 10",
      section: "A",
      date: "2026-10-02",
      records: [{ studentId: student.id, status: "Late", remarks: "Traffic delay" }],
    });

    const att = await parentChildAttendance(admin.institutionId, student.id, "2026-10");
    expect(att.records).toHaveLength(2);
    expect(att.summary.totalDays).toBe(2);
    expect(att.summary.presentCount).toBe(1);
    expect(att.summary.lateCount).toBe(1);
    expect(att.summary.attendancePercentage).toBe(100);

    // 2. Homework in module_records
    await addModuleRecord(admin.institutionId, "teacher_homework", {
      title: "Algebra Exercises Chapter 4",
      description: "Solve problems 1 to 20 on page 84",
      className: "Class 10",
      section: "A",
      subject: "Mathematics",
      dueDate: "2026-10-05",
      status: "Active",
    });

    const hw = await parentChildHomework(admin.institutionId, "Class 10", "A");
    expect(hw).toHaveLength(1);
    expect(hw[0].title).toBe("Algebra Exercises Chapter 4");
    expect(hw[0].subject).toBe("Mathematics");

    // 3. Timetable
    await addTimetableEntry(admin.institutionId, "Class 10", year, {
      section: "A",
      subject: "Mathematics",
      weekday: 1,
      startTime: "09:00",
      endTime: "09:45",
    });
    await addTimetableEntry(admin.institutionId, "Class 10", year, {
      section: "A",
      subject: "Physics",
      weekday: 1,
      startTime: "09:45",
      endTime: "10:30",
    });

    const tt = await parentChildTimetable(admin.institutionId, "Class 10", "A", year);
    expect(tt).toHaveLength(2);
    expect(tt[0].subject).toBe("Mathematics");
    expect(tt[1].subject).toBe("Physics");

    // 4. Fee & Payment
    const fees = await parentChildFees(admin.institutionId, student.id);
    expect(fees.invoices.length).toBeGreaterThan(0);
    const invoice = fees.invoices[0];

    // Parent makes payment
    await recordPayment(admin.institutionId, admin.id, {
      feeId: invoice.id,
      amount: invoice.finalAmount,
      method: "Online",
      transactionId: "pay_test_12345",
      paymentDate: "2026-10-03",
      notes: "Online fee clearance",
    });

    const updatedFees = await parentChildFees(admin.institutionId, student.id);
    expect(updatedFees.summary.pendingFee).toBe(0);
    expect(updatedFees.payments.length).toBeGreaterThan(0);
    expect(updatedFees.payments[0].paymentMethod).toBe("Online");
  });
});
