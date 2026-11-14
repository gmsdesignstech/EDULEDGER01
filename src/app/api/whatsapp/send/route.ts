// src/app/api/whatsapp/send/route.ts
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getDb, getInstitution, getStudent, teacherPortalScope, teacherHasAssignment } from "@/lib/db";
import { normalizeWhatsAppNumber, maskWhatsAppNumber } from "@/lib/whatsapp";
import { dispatchDirectWhatsAppMessage } from "@/lib/whatsapp-cloud";
import { SYSTEM_TEMPLATES, interpolateTemplate } from "@/lib/whatsapp-templates";
import { evaluateWhatsAppDispatchRateLimit } from "@/lib/whatsapp-rate-limit";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const sendSchema = z.object({
  studentId: z.string().min(1),
  category: z.enum([
    "STUDENT_INFO",
    "ATTENDANCE",
    "FEES",
    "EXAMINATIONS",
    "HOMEWORK",
    "TIMETABLE",
    "LEAVE",
    "ANNOUNCEMENTS",
    "CUSTOM",
  ]),
  templateId: z.string().optional(),
  language: z.enum(["en", "kn", "custom"]).default("en"),
  customTitle: z.string().max(100).optional(),
  customMessage: z.string().max(2000).optional(),
  overridePhone: z.string().optional(),
  eventData: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Invalid payload." }, { status: 400 });
  }

  const { studentId, category, templateId, language, customMessage, overridePhone, eventData } = parsed.data;

  // Teachers cannot send fee messages
  if (user.role === "TEACHER" && category === "FEES") {
    return Response.json({ error: "Teachers are not authorized to share fee information." }, { status: 403 });
  }

  const institutionId = user.institutionId;
  const db = await getDb();

  const institution = await getInstitution(institutionId);
  if (!institution) {
    return Response.json({ error: "Institution not found." }, { status: 404 });
  }

  const student = await getStudent(institutionId, studentId);
  if (!student) {
    return Response.json({ error: "Student not found in this institution." }, { status: 404 });
  }

  if (student.status !== "Active") {
    return Response.json({ error: "Messages can only be sent for active students." }, { status: 400 });
  }

  // Teacher class assignment verification
  if (user.role === "TEACHER") {
    try {
      const scope = await teacherPortalScope(institutionId, user.email);
      if (
        !teacherHasAssignment(scope.assignments, {
          academicYear: student.academicYear,
          className: student.className,
          section: student.section,
        })
      ) {
        return Response.json(
          { error: "Teachers can only send communications to students in their assigned classes." },
          { status: 403 }
        );
      }
    } catch {
      return Response.json({ error: "Failed to verify teacher class scope." }, { status: 403 });
    }
  }

  const rawPhone =
    overridePhone?.trim() ||
    (student as unknown as { parentWhatsapp?: string }).parentWhatsapp?.trim() ||
    student.parentPhone?.trim() ||
    "";
  if (!rawPhone) {
    return Response.json({ error: "Parent WhatsApp mobile number is not available." }, { status: 400 });
  }

  let normalizedPhone = "";
  try {
    normalizedPhone = normalizeWhatsAppNumber(rawPhone);
  } catch (err) {
    return Response.json({ error: `Invalid parent WhatsApp phone number: ${(err as Error).message}` }, { status: 400 });
  }

  // Rate limiting check (20 sends/min per school, 3 sends/min per recipient)
  const rateRows = (await db.unsafe(
    `SELECT 
      COUNT(*)::int AS "institutionCount",
      COUNT(*) FILTER (WHERE recipient_phone = $2)::int AS "recipientCount"
     FROM whatsapp_messages
     WHERE institution_id = $1 AND sent_at >= NOW() - INTERVAL '1 minute'`,
    [institutionId, normalizedPhone] as never[]
  )) as Array<{ institutionCount: number; recipientCount: number }>;

  const rateDecision = evaluateWhatsAppDispatchRateLimit({
    institutionDispatchesLastMinute: Number(rateRows[0]?.institutionCount || 0),
    recipientDispatchesLastMinute: Number(rateRows[0]?.recipientCount || 0),
  });

  if (!rateDecision.allowed) {
    return Response.json(
      {
        error:
          rateDecision.reason === "institution_rate_limit"
            ? "School WhatsApp dispatch rate limit reached (20/min). Please try again shortly."
            : "Recipient WhatsApp rate limit reached (3/min). Please try again shortly.",
        retryAfterMs: rateDecision.retryAfterMs,
      },
      { status: 429 }
    );
  }

  const consentStatus = (student as unknown as { whatsappConsentStatus?: string }).whatsappConsentStatus || "UNKNOWN";
  if (consentStatus === "OPTED_OUT") {
    return Response.json({ error: "Parent has opted out of WhatsApp communications." }, { status: 400 });
  }

  const matchedTemplate =
    SYSTEM_TEMPLATES.find((t) => t.id === templateId || (t.category.toUpperCase() === category && t.language === language)) ||
    SYSTEM_TEMPLATES[0];

  const templateVars: Record<string, string | number | null | undefined> = {
    school_name: institution.name,
    student_name: student.name,
    admission_number: student.admission,
    class_name: student.className,
    section: student.section,
    roll_number: student.rollNumber || "—",
    parent_name: student.parent || "Parent",
    attendance_date: (eventData.attendanceDate as string) || new Date().toLocaleDateString("en-IN"),
    attendance_status: (eventData.attendanceStatus as string) || "Present",
    total_fee: String(student.totalFee || 0),
    paid_fee: String(student.paidFee || 0),
    pending_fee: String(student.pendingFee || 0),
    due_date: (eventData.dueDate as string) || "As per notice",
    receipt_number: (eventData.receiptNumber as string) || "REC-" + Date.now().toString().slice(-6),
    amount_paid: String(eventData.amountPaid || eventData.amount || 0),
    payment_date: (eventData.paymentDate as string) || new Date().toLocaleDateString("en-IN"),
    remaining_balance: String(student.pendingFee || 0),
    exam_name: (eventData.examName as string) || "Term Examination",
    total_marks: (eventData.totalMarks as number) ?? 0,
    max_marks: (eventData.maxMarks as number) ?? 100,
    percentage: (eventData.percentage as number) ?? 0,
    grade: (eventData.grade as string) || "A",
    result_status: (eventData.resultStatus as string) || "Pass",
    subject: (eventData.subject as string) || "General",
    homework_title: (eventData.homeworkTitle as string) || "Classwork Assignment",
    instructions: (eventData.instructions as string) || "Complete assigned questions in notebook.",
    effective_date: (eventData.effectiveDate as string) || new Date().toLocaleDateString("en-IN"),
    timetable_notes: (eventData.notes as string) || "Updated timetable schedule.",
    leave_dates: (eventData.leaveDates as string) || "Current Session",
    leave_status: (eventData.leaveStatus as string) || "Approved",
    decision_notes: (eventData.decisionNotes as string) || "Approved by school authority.",
    announcement_title: (eventData.announcementTitle as string) || "School Notice",
    announcement_date: (eventData.announcementDate as string) || new Date().toLocaleDateString("en-IN"),
    announcement_content: (eventData.announcementContent as string) || customMessage || "",
  };

  const renderedBody = customMessage?.trim()
    ? customMessage.trim()
    : interpolateTemplate(matchedTemplate.body, templateVars);

  const dbMessageId = randomUUID();
  const idempotencyKey = `manual:${dbMessageId}`;

  // Record in whatsapp_messages table
  await db.unsafe(
    `INSERT INTO whatsapp_messages (
      id,
      institution_id,
      student_id,
      recipient_name,
      recipient_phone,
      message_type,
      template_name,
      language,
      parameters,
      idempotency_key,
      status,
      sent_by,
      sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Queued', $11, CURRENT_TIMESTAMP)`,
    [
      dbMessageId,
      institutionId,
      student.id,
      student.parent || "Parent",
      normalizedPhone,
      category,
      matchedTemplate.name,
      language,
      JSON.stringify([renderedBody]),
      idempotencyKey,
      user.id,
    ] as never[]
  );

  // Direct dispatch to WhatsApp Business Cloud API
  const dispatchResult = await dispatchDirectWhatsAppMessage({
    to: normalizedPhone,
    text: renderedBody,
    templateName: matchedTemplate.name,
    templateLanguage: language,
    schoolId: institution.id,
    schoolName: institution.name,
    studentId: student.id,
    parentName: student.parent || "Parent",
  });

  if (dispatchResult.success) {
    await db.unsafe(
      `UPDATE whatsapp_messages
       SET status = 'Sent',
           provider_message_id = $1,
           sent_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [dispatchResult.messageId, dbMessageId] as never[]
    );
  } else {
    await db.unsafe(
      `UPDATE whatsapp_messages
       SET status = 'Failed',
           error_message = $1,
           failed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [dispatchResult.error || "Direct dispatch failed", dbMessageId] as never[]
    );
  }

  return Response.json({
    ok: dispatchResult.success,
    messageId: dbMessageId,
    providerMessageId: dispatchResult.messageId,
    status: dispatchResult.success ? "Sent" : "Failed",
    provider: "whatsapp_cloud",
    error: dispatchResult.error,
    recipient: maskWhatsAppNumber(normalizedPhone),
  });
}
