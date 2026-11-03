import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import {
  acknowledgeNotificationDelivery,
  activateParentAccount,
  addStudent,
  createAccount,
  createParentInvitation,
  getCompleteSettings,
  getInstitution,
  getNotificationEventByKey,
  getSchoolNotificationSettings,
  getUserActiveDeviceTokens,
  getUserNotificationDeliveries,
  linkStudentToParent,
  listUserNotifications,
  markUserNotificationRead,
  recordPayment,
  registerDeviceToken,
  revokeDeviceToken,
  saveCompleteSettings,
  saveStudentAttendance,
  saveTeacher,
  updateSchoolNotificationSettings,
  upsertTeacherAccount,
} from "../src/lib/db";
import {
  dispatchNotificationEvent,
  notifyAttendanceCorrection,
  notifyExamResultsPublished,
  notifyFeePayment,
  notifyFeeReminder,
  notifyHomeworkAssigned,
  notifySchoolAnnouncement,
  notifyStudentAbsent,
  notifyTeacherLeaveDecision,
  retryPendingDeliveries,
} from "../src/lib/notifications";
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

describe("EduLedger Notification Engine", () => {
  it("registers, updates, queries, and revokes multiple device tokens per user", async () => {
    const stamp = `${Date.now()}_tokens`;
    const admin = await createAccount({
      name: "Token User",
      email: `tokens_${stamp}@school.test`,
      institution: `Token Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    const token1 = `fcm_tok_phone_${stamp}`;
    const token2 = `fcm_tok_laptop_${stamp}`;

    // Register phone token
    const reg1 = await registerDeviceToken(admin.institutionId, admin.id, token1, "mobile_android", "Pixel 8");
    expect(reg1.token).toBe(token1);
    expect(reg1.status).toBe("ACTIVE");

    // Register laptop token
    const reg2 = await registerDeviceToken(admin.institutionId, admin.id, token2, "desktop_web", "Chrome on Mac");
    expect(reg2.token).toBe(token2);
    expect(reg2.status).toBe("ACTIVE");

    // Query active tokens
    const activeTokens = await getUserActiveDeviceTokens(admin.id);
    expect(activeTokens.length).toBe(2);
    expect(activeTokens.map((t) => t.token)).toContain(token1);
    expect(activeTokens.map((t) => t.token)).toContain(token2);

    // Re-registering token1 should update metadata and stay ACTIVE
    await registerDeviceToken(admin.institutionId, admin.id, token1, "mobile_android", "Pixel 8 Pro Updated");
    const activeAfterRefresh = await getUserActiveDeviceTokens(admin.id);
    expect(activeAfterRefresh.length).toBe(2);

    // Revoke token1
    const revoked = await revokeDeviceToken(token1, admin.id);
    expect(revoked).toBe(true);

    // Only token2 should now be active
    const activeAfterRevoke = await getUserActiveDeviceTokens(admin.id);
    expect(activeAfterRevoke.length).toBe(1);
    expect(activeAfterRevoke[0]?.token).toBe(token2);
  });

  it("prevents duplicate event notifications via eventKey deduplication", async () => {
    const stamp = `${Date.now()}_dedup`;
    const admin = await createAccount({
      name: "Dedup Admin",
      email: `dedup_${stamp}@school.test`,
      institution: `Dedup Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    const eventKey = `test:event:${stamp}`;

    // First dispatch
    const res1 = await dispatchNotificationEvent({
      institutionId: admin.institutionId,
      eventKey,
      eventType: "announcements",
      title: "Test Notice",
      body: "First attempt",
      recipientUserIds: [admin.id],
    });

    expect(res1.skipped).toBe(false);
    expect(res1.inAppCount).toBe(1);

    // Duplicate dispatch with exact same eventKey
    const res2 = await dispatchNotificationEvent({
      institutionId: admin.institutionId,
      eventKey,
      eventType: "announcements",
      title: "Test Notice Duplicate",
      body: "Second attempt",
      recipientUserIds: [admin.id],
    });

    expect(res2.skipped).toBe(true);
    expect(res2.reason).toBe("DUPLICATE_EVENT");
    expect(res2.inAppCount).toBe(0);
    expect(res2.pushSentCount).toBe(0);

    // Confirm only 1 in-app notification exists for user
    const inbox = await listUserNotifications(admin.id);
    expect(inbox.unread).toBe(1);
    expect(inbox.items[0]?.title).toBe("Test Notice");
  });

  it("respects school-level notification preferences for event categories and push disabling", async () => {
    const stamp = `${Date.now()}_prefs`;
    const admin = await createAccount({
      name: "Prefs Admin",
      email: `prefs_${stamp}@school.test`,
      institution: `Prefs Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    // Default settings: all enabled
    const defaults = await getSchoolNotificationSettings(admin.institutionId);
    expect(defaults.pushEnabled).toBe(true);
    expect(defaults.studentAbsent).toBe(true);
    expect(defaults.feePayment).toBe(true);

    // Disable student absent notifications at school level
    await updateSchoolNotificationSettings(admin.institutionId, {
      studentAbsent: false,
    });

    const updated = await getSchoolNotificationSettings(admin.institutionId);
    expect(updated.studentAbsent).toBe(false);

    // Attempting to dispatch student absent event should be skipped
    const resDisabled = await dispatchNotificationEvent({
      institutionId: admin.institutionId,
      eventKey: `absent:event:${stamp}`,
      eventType: "student_absent",
      title: "Student Absent",
      body: "Student was absent",
      recipientUserIds: [admin.id],
    });

    expect(resDisabled.skipped).toBe(true);
    expect(resDisabled.reason).toBe("DISABLED_BY_SCHOOL_PREFERENCE");
    expect(resDisabled.inAppCount).toBe(0);

    // Re-enable student absent notifications
    await updateSchoolNotificationSettings(admin.institutionId, {
      studentAbsent: true,
    });

    const resEnabled = await dispatchNotificationEvent({
      institutionId: admin.institutionId,
      eventKey: `absent:event2:${stamp}`,
      eventType: "student_absent",
      title: "Student Absent",
      body: "Student was absent",
      recipientUserIds: [admin.id],
    });

    expect(resEnabled.skipped).toBe(false);
    expect(resEnabled.inAppCount).toBe(1);

    // Disable push notifications only
    await updateSchoolNotificationSettings(admin.institutionId, {
      pushEnabled: false,
    });

    // Register device token
    await registerDeviceToken(admin.institutionId, admin.id, `tok_push_test_${stamp}`);

    const resPushDisabled = await dispatchNotificationEvent({
      institutionId: admin.institutionId,
      eventKey: `fee:event:${stamp}`,
      eventType: "fee_payment",
      title: "Fee Paid",
      body: "Fee paid",
      recipientUserIds: [admin.id],
    });

    // In-app is created, but push is skipped because pushEnabled is false
    expect(resPushDisabled.skipped).toBe(false);
    expect(resPushDisabled.inAppCount).toBe(1);
    expect(resPushDisabled.pushSentCount).toBe(0);
  });

  it("strictly enforces delivery invariant: SENT until receipt acknowledgment confirms DELIVERED", async () => {
    const stamp = `${Date.now()}_ack`;
    const admin = await createAccount({
      name: "Delivery Admin",
      email: `deliv_${stamp}@school.test`,
      institution: `Delivery Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    // Register active device token
    const token = `device_token_${stamp}`;
    await registerDeviceToken(admin.institutionId, admin.id, token);

    // Dispatch event
    const eventKey = `delivery:test:${stamp}`;
    const result = await dispatchNotificationEvent({
      institutionId: admin.institutionId,
      eventKey,
      eventType: "fee_payment",
      title: "Fee Payment Received",
      body: "Payment of ₹5,000 received.",
      recipientUserIds: [admin.id],
    });

    expect(result.skipped).toBe(false);
    expect(result.pushSentCount).toBe(1);

    // Verify in database: delivery state is SENT (never DELIVERED initially)
    const inbox = await listUserNotifications(admin.id);
    expect(inbox.items.length).toBeGreaterThan(0);
    const notification = inbox.items[0];
    expect(notification.deliveryStatus).toBe("SENT");

    // Retrieve the delivery record ID from notification_deliveries
    const deliveries = await getUserNotificationDeliveries(admin.id);
    const fcmDelivery = deliveries.find((d) => d.channel === "FCM");

    expect(fcmDelivery).toBeDefined();
    expect(fcmDelivery!.status).toBe("SENT");
    expect(fcmDelivery!.deliveredAt).toBeNull();

    // Client / service worker confirms receipt via deliveryId
    const ackSuccess = await acknowledgeNotificationDelivery(fcmDelivery!.id);
    expect(ackSuccess).toBe(true);

    // Verify delivery status transitioned to DELIVERED with delivered_at timestamp
    const updatedDeliveries = await getUserNotificationDeliveries(admin.id);
    const updatedFcm = updatedDeliveries.find((d) => d.id === fcmDelivery!.id);
    expect(updatedFcm?.status).toBe("DELIVERED");
    expect(updatedFcm?.deliveredAt).not.toBeNull();

    // Verify in-app notification also shows DELIVERED
    const updatedInbox = await listUserNotifications(admin.id);
    expect(updatedInbox.items[0].deliveryStatus).toBe("DELIVERED");
  });

  it("automatically revokes device token when FCM indicates token is unregistered", async () => {
    const stamp = `${Date.now()}_unreg`;
    const admin = await createAccount({
      name: "Unreg User",
      email: `unreg_${stamp}@school.test`,
      institution: `Unreg Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    // Register token that triggers simulated UNREGISTERED response
    const invalidToken = `unregistered_device_token_${stamp}`;
    await registerDeviceToken(admin.institutionId, admin.id, invalidToken);

    // Verify token was initially active
    const initialTokens = await getUserActiveDeviceTokens(admin.id);
    expect(initialTokens.some((t) => t.token === invalidToken)).toBe(true);

    // Dispatch event
    await dispatchNotificationEvent({
      institutionId: admin.institutionId,
      eventKey: `unreg:test:${stamp}`,
      eventType: "homework",
      title: "Homework Assigned",
      body: "Math homework assigned",
      recipientUserIds: [admin.id],
    });

    // Token should now be automatically revoked!
    const activeTokens = await getUserActiveDeviceTokens(admin.id);
    expect(activeTokens.some((t) => t.token === invalidToken)).toBe(false);

    // Delivery record should be marked REVOKED
    const deliveries = await getUserNotificationDeliveries(admin.id);
    const fcmDelivery = deliveries.find((d) => d.channel === "FCM");
    expect(fcmDelivery?.status).toBe("REVOKED");
    expect(fcmDelivery?.errorCode).toBe("UNREGISTERED");
  });

  it("successfully triggers all 8 required notification event dispatchers", async () => {
    const stamp = `${Date.now()}_all8`;
    const admin = await createAccount({
      name: "Principal Sharma",
      email: `admin8_${stamp}@school.test`,
      institution: `Comprehensive Academy ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);
    const activeYear = (await getInstitution(admin.institutionId)).academicYear;
    await setupClasses(admin.institutionId, admin.id, [{ name: "Class 8", sections: ["A"] }]);

    // Create a student
    const student = await addStudent(admin.institutionId, {
      name: "Rohan Sunita",
      admission: `ADM-${stamp}`,
      parent: "Parent Sunita",
      parentEmail: `parent8_${stamp}@school.test`,
      parentPhone: "9876543210",
      className: "Class 8",
      section: "A",
      gender: "Male",
      dateOfBirth: "2012-01-01",
      admissionDate: "2026-04-01",
      address: "123 Main St",
      totalFee: 30000,
      dueDate: "2026-03-31",
      academicYear: activeYear,
    });

    // Invite and activate parent account
    const invitation = await createParentInvitation(admin.institutionId, admin.id, {
      studentId: student.id,
      parentName: "Parent Sunita",
      parentEmail: `parent8_${stamp}@school.test`,
      parentPhone: "9876543210",
    });
    const parentAuth = await activateParentAccount(admin.institutionId, {
      invitationCode: invitation.code,
      email: `parent8_${stamp}@school.test`,
      name: "Parent Sunita",
      passwordHash: await hash("password123", 4),
    });
    const parentId = parentAuth.userId;

    // Create teacher record using canonical methods
    const teacherEmail = `teacher8_${stamp}@school.test`;
    const teacher = await saveTeacher(
      admin.institutionId,
      {
        name: "Teacher Verma",
        employeeId: `TCH-${stamp}`,
        email: teacherEmail,
        phone: "9123456780",
        department: "Science",
        subject: "Physics",
        classes: "Class 8",
        joiningDate: "2026-04-01",
        salary: 35000,
        status: "Active",
      },
      admin.id
    );

    const teacherUser = await upsertTeacherAccount(admin.institutionId, {
      name: "Teacher Verma",
      email: teacherEmail,
      passwordHash: await hash("password123", 4),
      phone: "9123456780",
    });

    // 1. Student Absent Event
    const resAbsent = await notifyStudentAbsent({
      institutionId: admin.institutionId,
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      section: student.section,
      date: "2026-11-03",
    });
    expect(resAbsent?.skipped).toBe(false);
    expect(resAbsent?.eventType).toBe("student_absent");

    // 2. Attendance Correction Event
    const resCorr = await notifyAttendanceCorrection({
      institutionId: admin.institutionId,
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      section: student.section,
      date: "2026-11-03",
      previousStatus: "Absent",
      newStatus: "Present",
      reason: "Medical certificate provided",
    });
    expect(resCorr?.skipped).toBe(false);
    expect(resCorr?.eventType).toBe("attendance_correction");

    // 3. Fee Payment Event
    const resFeePay = await notifyFeePayment({
      institutionId: admin.institutionId,
      studentId: student.id,
      studentName: student.name,
      amountPaise: 1500000,
      paymentId: `pay_${stamp}`,
      receiptNumber: `REC-${stamp}`,
      title: "Term 1 Tuition",
    });
    expect(resFeePay?.skipped).toBe(false);
    expect(resFeePay?.eventType).toBe("fee_payment");

    // 4. Fee Reminder Event
    const resFeeRem = await notifyFeeReminder({
      institutionId: admin.institutionId,
      studentId: student.id,
      studentName: student.name,
      balancePaise: 1500000,
      dueDate: "2026-12-15",
      feeId: `fee_${stamp}`,
      reminderMilestone: "due_in_7_days",
    });
    expect(resFeeRem?.skipped).toBe(false);
    expect(resFeeRem?.eventType).toBe("fee_reminders");

    // 5. Homework Assigned Event
    const resHw = await notifyHomeworkAssigned({
      institutionId: admin.institutionId,
      homeworkId: `hw_${stamp}`,
      className: "Class 8",
      section: "A",
      subject: "Science",
      title: "Cell Structure Diagrams",
      dueDate: "2026-11-07",
    });
    expect(resHw?.skipped).toBe(false);
    expect(resHw?.eventType).toBe("homework");

    // 6. Examination Results Published Event
    const resExam = await notifyExamResultsPublished({
      institutionId: admin.institutionId,
      examId: `exam_${stamp}`,
      examName: "Midterm Assessment",
      className: "Class 8",
      section: "A",
      subject: "Science",
      studentId: student.id,
      studentName: student.name,
      grade: "A1",
      marks: 94,
      maxMarks: 100,
    });
    expect(resExam?.skipped).toBe(false);
    expect(resExam?.eventType).toBe("exam_results");

    // 7. School Announcement Event
    const resNotice = await notifySchoolAnnouncement({
      institutionId: admin.institutionId,
      announcementId: `notice_${stamp}`,
      title: "Annual Sports Day Scheduled",
      content: "Annual sports day will be held on December 10th. All students are invited.",
    });
    expect(resNotice?.skipped).toBe(false);
    expect(resNotice?.eventType).toBe("announcements");

    // 8. Teacher Leave Decision Event
    const resLeave = await notifyTeacherLeaveDecision({
      institutionId: admin.institutionId,
      leaveId: `leave_${stamp}`,
      teacherId: teacher.id,
      status: "Approved",
      startDate: "2026-11-10",
      endDate: "2026-11-12",
      remarks: "Approved by Principal",
    });
    expect(resLeave?.skipped).toBe(false);
    expect(resLeave?.eventType).toBe("teacher_leave");

    // Parent inbox check: 7 notifications (all except teacher leave)
    const parentInbox = await listUserNotifications(parentId);
    expect(parentInbox.items.length).toBe(7);
    expect(parentInbox.unread).toBe(7);

    // Teacher inbox check: 2 notifications (announcement + teacher leave)
    const teacherInbox = await listUserNotifications(teacherUser.id);
    expect(teacherInbox.items.length).toBe(2);
    expect(teacherInbox.unread).toBe(2);

    // Mark 1 as read
    await markUserNotificationRead(parentId, String(parentInbox.items[0]?.id || ""));
    const parentInboxAfterRead = await listUserNotifications(parentId);
    expect(parentInboxAfterRead.unread).toBe(6);
  });
});
