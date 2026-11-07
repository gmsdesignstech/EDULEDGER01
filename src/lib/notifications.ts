import { createSign } from "node:crypto";
import {
  acknowledgeNotificationDelivery,
  createInAppNotification,
  createNotificationEvent,
  failNotificationDelivery,
  getAllInstitutionUserIds,
  getNotificationEventByKey,
  getParentsForClass,
  getParentsForStudent,
  getPendingDeliveriesForRetry,
  getSchoolNotificationSettings,
  getTeacherUserId,
  getUserActiveDeviceTokens,
  recordNotificationDelivery,
  revokeDeviceToken,
  type SchoolNotificationSettings,
  updateNotificationDeliveryStatus,
} from "./db";

export type NotificationEventType =
  | "student_absent"
  | "attendance_correction"
  | "fee_payment"
  | "fee_reminders"
  | "homework"
  | "exam_results"
  | "announcements"
  | "teacher_leave";

interface FirebaseCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getFirebaseCredentials(): FirebaseCredentials | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      // malformed JSON fallback
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

/**
 * Mint Google OAuth2 access token using RS256 JWT assertion with node:crypto
 */
async function getGoogleAccessToken(creds: FirebaseCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: creds.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedClaim = Buffer.from(JSON.stringify(claimSet)).toString("base64url");
  const signInput = `${encodedHeader}.${encodedClaim}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signInput);
  signer.end();
  const signature = signer.sign(creds.privateKey, "base64url");
  const assertion = `${signInput}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Google access token: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  };
  return cachedAccessToken.token;
}

export interface FcmSendResult {
  success: boolean;
  providerMessageId?: string;
  unregistered?: boolean;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

/**
 * Dispatch single FCM v1 Web Push message
 */
export async function sendFcmMessage(
  token: string,
  payload: {
    title: string;
    body: string;
    deepLink?: string;
    deliveryId: string;
    notificationId?: string;
    eventKey?: string;
    eventType?: string;
    data?: Record<string, string>;
  }
): Promise<FcmSendResult> {
  // Test/offline simulated response for invalid/unregistered token test hooks
  if (token.startsWith("invalid_") || token.startsWith("unregistered_")) {
    return {
      success: false,
      unregistered: true,
      errorCode: "UNREGISTERED",
      errorMessage: "Device token is no longer registered or invalid.",
      retryable: false,
    };
  }

  const credentials = getFirebaseCredentials();
  if (!credentials) {
    return {
      success: false,
      errorCode: "FCM_NOT_CONFIGURED",
      errorMessage: "Firebase Cloud Messaging is not configured.",
      retryable: false,
    };
  }

  try {
    const accessToken = await getGoogleAccessToken(credentials);
    const url = `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`;

    const requestBody = {
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          deliveryId: payload.deliveryId,
          notificationId: payload.notificationId || "",
          eventKey: payload.eventKey || "",
          eventType: payload.eventType || "",
          url: payload.deepLink || "/",
          timestamp: String(Date.now()),
          ...(payload.data || {}),
        },
        webpush: {
          fcm_options: {
            link: payload.deepLink || "/",
          },
          notification: {
            icon: "/eduledger-logo.jpeg",
            badge: "/eduledger-logo.jpeg",
          },
        },
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (res.ok) {
      const data = (await res.json()) as { name?: string };
      return {
        success: true,
        providerMessageId: data.name || `projects/${credentials.projectId}/messages/${Date.now()}`,
      };
    }

    const errorBody = await res.json().catch(() => ({}));
    const errDetails = errorBody?.error?.details || [];
    const statusStr = errorBody?.error?.status || "";
    const msg = errorBody?.error?.message || res.statusText;

    const isUnregistered =
      res.status === 404 ||
      statusStr === "NOT_FOUND" ||
      msg.includes("UNREGISTERED") ||
      msg.includes("registration-token-not-registered") ||
      errDetails.some((d: { errorCode?: string }) => d.errorCode === "UNREGISTERED");

    const isRetryable = res.status === 429 || res.status >= 500;

    return {
      success: false,
      unregistered: isUnregistered,
      errorCode: statusStr || String(res.status),
      errorMessage: msg,
      retryable: isRetryable,
    };
  } catch (err) {
    return {
      success: false,
      unregistered: false,
      errorCode: "NETWORK_ERROR",
      errorMessage: err instanceof Error ? err.message : "FCM request failed",
      retryable: true,
    };
  }
}

export interface DispatchNotificationInput {
  institutionId: string;
  eventKey: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  deepLink?: string;
  data?: Record<string, string>;
  recipientUserIds: string[];
}

export interface DispatchNotificationResult {
  eventId?: string;
  eventKey: string;
  eventType: NotificationEventType;
  skipped: boolean;
  reason?: string;
  inAppCount: number;
  pushSentCount: number;
  pushPendingCount: number;
  recipientCount: number;
}

function isEventEnabledInSettings(
  settings: SchoolNotificationSettings,
  eventType: NotificationEventType
): boolean {
  switch (eventType) {
    case "student_absent":
      return settings.studentAbsent;
    case "attendance_correction":
      return settings.attendanceCorrection;
    case "fee_payment":
      return settings.feePayment;
    case "fee_reminders":
      return settings.feeReminders;
    case "homework":
      return settings.homework;
    case "exam_results":
      return settings.examResults;
    case "announcements":
      return settings.announcements;
    case "teacher_leave":
      return settings.teacherLeave;
    default:
      return true;
  }
}

/**
 * Central Notification Engine Dispatcher
 * - Deduplication via unique eventKey
 * - School-level preference enforcement
 * - Multi-device FCM Push dispatch
 * - In-app notification creation
 * - Invariant: Never claim DELIVERED until confirmed by ACK
 */
export async function dispatchNotificationEvent(
  input: DispatchNotificationInput
): Promise<DispatchNotificationResult> {
  const { institutionId, eventKey, eventType, title, body, deepLink = "", data = {}, recipientUserIds } = input;

  // 1. Duplicate Event Prevention
  const existingEvent = await getNotificationEventByKey(eventKey);
  if (existingEvent) {
    return {
      eventId: existingEvent.id,
      eventKey,
      eventType,
      skipped: true,
      reason: "DUPLICATE_EVENT",
      inAppCount: 0,
      pushSentCount: 0,
      pushPendingCount: 0,
      recipientCount: recipientUserIds.length,
    };
  }

  // 2. School-Level Notification Preferences Check
  const settings = await getSchoolNotificationSettings(institutionId);
  const eventCategoryEnabled = isEventEnabledInSettings(settings, eventType);
  if (!eventCategoryEnabled) {
    await createNotificationEvent({
      institutionId,
      eventKey,
      eventType,
      title,
      body,
      deepLink,
      data,
      recipientUserIds,
      status: "PROCESSED",
    });
    return {
      eventKey,
      eventType,
      skipped: true,
      reason: "DISABLED_BY_SCHOOL_PREFERENCE",
      inAppCount: 0,
      pushSentCount: 0,
      pushPendingCount: 0,
      recipientCount: recipientUserIds.length,
    };
  }

  // 3. Persist Event
  const event = await createNotificationEvent({
    institutionId,
    eventKey,
    eventType,
    title,
    body,
    deepLink,
    data,
    recipientUserIds,
    status: "PROCESSED",
  });
  const eventId = event?.id;

  let inAppCount = 0;
  let pushSentCount = 0;
  let pushPendingCount = 0;

  // 4. Distribute to recipients
  for (const userId of recipientUserIds) {
    // 4a. Create In-App Notification (Status: SENT)
    const notificationId = await createInAppNotification({
      institutionId,
      userId,
      type: eventType,
      title,
      description: body,
      link: deepLink,
      deliveryStatus: "SENT",
    });
    inAppCount++;

    // Record In-App delivery
    await recordNotificationDelivery({
      institutionId,
      eventId,
      notificationId,
      userId,
      channel: "IN_APP",
      status: "DELIVERED", // In-app is directly placed in user's inbox
      deliveredAt: new Date().toISOString(),
    });

    // 4b. Web Push Notifications (if school push is enabled)
    if (settings.pushEnabled) {
      const tokens = await getUserActiveDeviceTokens(userId);
      for (const device of tokens) {
        // Record pending delivery attempt
        const deliveryId = await recordNotificationDelivery({
          institutionId,
          eventId,
          notificationId,
          userId,
          deviceTokenId: device.id,
          channel: "FCM",
          status: "PENDING",
        });

        // Dispatch FCM Push
        const fcmResult = await sendFcmMessage(device.token, {
          title,
          body,
          deepLink,
          deliveryId,
          notificationId,
          eventKey,
          eventType,
          data,
        });

        if (fcmResult.success) {
          // Status becomes SENT upon FCM server acceptance. (INVARIANT: NOT DELIVERED YET!)
          await updateNotificationDeliveryStatus(deliveryId, {
            status: "SENT",
            providerMessageId: fcmResult.providerMessageId,
            sentAt: new Date().toISOString(),
          });
          pushSentCount++;
        } else if (fcmResult.unregistered) {
          // Automatic token revocation & delivery marked REVOKED
          await revokeDeviceToken(device.token, userId);
          await updateNotificationDeliveryStatus(deliveryId, {
            status: "REVOKED",
            errorCode: fcmResult.errorCode || "UNREGISTERED",
            errorMessage: fcmResult.errorMessage || "Device token expired or unregistered",
          });
        } else {
          // Failure handling with retry backoff
          await failNotificationDelivery(deliveryId, {
            code: fcmResult.errorCode || "UNKNOWN_ERROR",
            message: fcmResult.errorMessage || "Delivery failed",
            retryable: Boolean(fcmResult.retryable),
            nextRetryDelaySeconds: 60,
          });
          if (fcmResult.retryable) {
            pushPendingCount++;
          }
        }
      }
    }
  }

  return {
    eventId,
    eventKey,
    eventType,
    skipped: false,
    inAppCount,
    pushSentCount,
    pushPendingCount,
    recipientCount: recipientUserIds.length,
  };
}

/**
 * Client / Service Worker Acknowledgment
 * Confirms receipt and updates delivery status to DELIVERED
 */
export async function confirmNotificationDelivery(
  institutionId: string,
  userId: string,
  deliveryId: string,
): Promise<boolean> {
  return acknowledgeNotificationDelivery(institutionId, userId, deliveryId);
}

/**
 * Retry processor for transient failures with exponential backoff
 */
export async function retryPendingDeliveries(limit: number = 20): Promise<{ retried: number; succeeded: number }> {
  const pending = await getPendingDeliveriesForRetry(limit);
  let succeeded = 0;

  for (const item of pending) {
    if (!item.token) {
      await failNotificationDelivery(item.id, {
        code: "NO_TOKEN",
        message: "Device token no longer associated",
        retryable: false,
      });
      continue;
    }

    const fcmResult = await sendFcmMessage(item.token, {
      title: item.title,
      body: item.body,
      deepLink: item.deepLink,
      deliveryId: item.id,
      notificationId: item.notificationId,
      eventKey: item.eventId,
    });

    if (fcmResult.success) {
      await updateNotificationDeliveryStatus(item.id, {
        status: "SENT",
        providerMessageId: fcmResult.providerMessageId,
        sentAt: new Date().toISOString(),
      });
      succeeded++;
    } else if (fcmResult.unregistered) {
      await revokeDeviceToken(item.token);
      await failNotificationDelivery(item.id, {
        code: "UNREGISTERED",
        message: "Token unregistered",
        retryable: false,
      });
    } else {
      await failNotificationDelivery(item.id, {
        code: fcmResult.errorCode || "RETRY_FAILED",
        message: fcmResult.errorMessage || "Retry failed",
        retryable: Boolean(fcmResult.retryable),
        nextRetryDelaySeconds: 120 * Math.pow(2, item.attemptCount),
      });
    }
  }

  return { retried: pending.length, succeeded };
}

// ==========================================
// 8 Specific Notification Event Dispatchers
// ==========================================

export async function notifyStudentAbsent(input: {
  institutionId: string;
  studentId: string;
  studentName: string;
  className: string;
  section: string;
  date: string;
  status?: string;
  remarks?: string;
}) {
  const parentUserIds = await getParentsForStudent(input.institutionId, input.studentId);
  if (parentUserIds.length === 0) return null;

  const statusLabel = input.status || "Absent";
  const title = `Student Attendance Alert`;
  const body = `${input.studentName} (${input.className}-${input.section}) was marked ${statusLabel} on ${input.date}.${input.remarks ? ` Note: ${input.remarks}` : ""}`;
  const eventKey = `attendance:${input.studentId}:${input.date}:${statusLabel.toLowerCase()}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "student_absent",
    title,
    body,
    deepLink: `/parent/attendance?child=${input.studentId}`,
    data: {
      studentId: input.studentId,
      date: input.date,
      status: statusLabel,
    },
    recipientUserIds: parentUserIds,
  });
}

export async function notifyAttendanceCorrection(input: {
  institutionId: string;
  studentId: string;
  studentName: string;
  className: string;
  section: string;
  date: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
}) {
  const parentUserIds = await getParentsForStudent(input.institutionId, input.studentId);
  if (parentUserIds.length === 0) return null;

  const title = `Attendance Corrected`;
  const body = `Attendance for ${input.studentName} on ${input.date} was updated from ${input.previousStatus} to ${input.newStatus}.${input.reason ? ` Reason: ${input.reason}` : ""}`;
  const eventKey = `attendance-corr:${input.studentId}:${input.date}:${input.newStatus.toLowerCase()}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "attendance_correction",
    title,
    body,
    deepLink: `/parent/attendance?child=${input.studentId}`,
    data: {
      studentId: input.studentId,
      date: input.date,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
    },
    recipientUserIds: parentUserIds,
  });
}

export async function notifyFeePayment(input: {
  institutionId: string;
  studentId: string;
  studentName: string;
  amountPaise: number;
  paymentId: string;
  receiptNumber?: string;
  title?: string;
}) {
  const parentUserIds = await getParentsForStudent(input.institutionId, input.studentId);
  if (parentUserIds.length === 0) return null;

  const amountRupees = (input.amountPaise / 100).toFixed(2);
  const title = `Fee Payment Received`;
  const body = `Payment of ₹${amountRupees} for ${input.studentName} (${input.title || "School Fees"}) has been recorded successfully.${input.receiptNumber ? ` Receipt #${input.receiptNumber}` : ""}`;
  const eventKey = `fee-payment:${input.paymentId}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "fee_payment",
    title,
    body,
    deepLink: `/parent/fees?child=${input.studentId}`,
    data: {
      studentId: input.studentId,
      paymentId: input.paymentId,
      amountPaise: String(input.amountPaise),
    },
    recipientUserIds: parentUserIds,
  });
}

export async function notifyFeeReminder(input: {
  institutionId: string;
  studentId: string;
  studentName: string;
  balancePaise: number;
  dueDate: string;
  feeId: string;
  reminderMilestone: string;
}) {
  const parentUserIds = await getParentsForStudent(input.institutionId, input.studentId);
  if (parentUserIds.length === 0) return null;

  const balanceRupees = (input.balancePaise / 100).toFixed(2);
  const title = `Fee Payment Reminder`;
  const body = `Fee balance of ₹${balanceRupees} for ${input.studentName} is due on ${input.dueDate}. Please make payment to avoid late fees.`;
  const eventKey = `fee-reminder:${input.feeId}:${input.reminderMilestone}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "fee_reminders",
    title,
    body,
    deepLink: `/parent/fees?child=${input.studentId}`,
    data: {
      studentId: input.studentId,
      feeId: input.feeId,
      dueDate: input.dueDate,
    },
    recipientUserIds: parentUserIds,
  });
}

export async function notifyHomeworkAssigned(input: {
  institutionId: string;
  homeworkId: string;
  className: string;
  section: string;
  subject: string;
  title: string;
  dueDate: string;
}) {
  const parentUserIds = await getParentsForClass(input.institutionId, input.className, input.section);
  if (parentUserIds.length === 0) return null;

  const notifTitle = `New Homework: ${input.subject}`;
  const body = `${input.title} (${input.className}-${input.section}) - Due by ${input.dueDate}.`;
  const eventKey = `homework:${input.homeworkId}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "homework",
    title: notifTitle,
    body,
    deepLink: `/parent/homework`,
    data: {
      homeworkId: input.homeworkId,
      className: input.className,
      section: input.section,
      subject: input.subject,
    },
    recipientUserIds: parentUserIds,
  });
}

export async function notifyExamResultsPublished(input: {
  institutionId: string;
  examId: string;
  examName: string;
  className: string;
  section: string;
  subject: string;
  studentId: string;
  studentName: string;
  grade: string;
  marks: number;
  maxMarks: number;
}) {
  const parentUserIds = await getParentsForStudent(input.institutionId, input.studentId);
  if (parentUserIds.length === 0) return null;

  const title = `Exam Result Published`;
  const body = `Results for ${input.examName} (${input.subject}) are out. ${input.studentName} scored ${input.marks}/${input.maxMarks} (Grade: ${input.grade}).`;
  const eventKey = `exam-result:${input.examId}:${input.studentId}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "exam_results",
    title,
    body,
    deepLink: `/parent/results?child=${input.studentId}`,
    data: {
      examId: input.examId,
      studentId: input.studentId,
      grade: input.grade,
    },
    recipientUserIds: parentUserIds,
  });
}

export async function notifySchoolAnnouncement(input: {
  institutionId: string;
  announcementId: string;
  title: string;
  content: string;
  targetAudience?: string;
}) {
  const allUserIds = await getAllInstitutionUserIds(input.institutionId);
  if (allUserIds.length === 0) return null;

  const cleanPreview = input.content.replace(/<[^>]*>?/gm, "").slice(0, 150);
  const title = `Notice: ${input.title}`;
  const body = cleanPreview.length > 0 ? cleanPreview : input.title;
  const eventKey = `announcement:${input.announcementId}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "announcements",
    title,
    body,
    deepLink: `/parent/announcements`,
    data: {
      announcementId: input.announcementId,
    },
    recipientUserIds: allUserIds,
  });
}

export async function notifyTeacherLeaveDecision(input: {
  institutionId: string;
  leaveId: string;
  teacherId: string;
  status: "Approved" | "Rejected" | "Cancelled";
  startDate: string;
  endDate: string;
  remarks?: string;
}) {
  const teacherUserId = await getTeacherUserId(input.institutionId, input.teacherId);
  if (!teacherUserId) return null;

  const title = `Leave Request ${input.status}`;
  const body = `Your leave application from ${input.startDate} to ${input.endDate} has been ${input.status.toLowerCase()}.${input.remarks ? ` Remarks: ${input.remarks}` : ""}`;
  const eventKey = `teacher-leave:${input.leaveId}:${input.status.toLowerCase()}`;

  return dispatchNotificationEvent({
    institutionId: input.institutionId,
    eventKey,
    eventType: "teacher_leave",
    title,
    body,
    deepLink: `/teacher/leave`,
    data: {
      leaveId: input.leaveId,
      status: input.status,
    },
    recipientUserIds: [teacherUserId],
  });
}

