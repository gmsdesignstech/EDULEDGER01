// src/app/api/whatsapp/retry/route.ts
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { dispatchDirectWhatsAppMessage } from "@/lib/whatsapp-cloud";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

export const runtime = "nodejs";

const retrySchema = z.object({
  id: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
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
  const parsed = retrySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid retry payload." }, { status: 400 });
  }

  const targetId = parsed.data.id || parsed.data.messageId;
  if (!targetId) {
    return Response.json({ error: "Message ID is required." }, { status: 400 });
  }

  const institutionId = user.institutionId;
  const db = await getDb();

  // Retrieve message with strict school isolation
  const msgRows = (await db.unsafe(
    `SELECT
       m.id,
       m.student_id AS "studentId",
       m.recipient_name AS "recipientName",
       m.recipient_phone AS "recipientPhone",
       m.message_type AS "messageType",
       m.template_name AS "templateName",
       m.language,
       m.parameters,
       m.status,
       m.attempt_count AS "attemptCount",
       s.name AS "studentName",
       s.whatsapp_consent_status AS "consentStatus"
     FROM whatsapp_messages m
     LEFT JOIN students s ON s.id = m.student_id AND s.institution_id = m.institution_id
     WHERE m.id = $1 AND m.institution_id = $2
     LIMIT 1`,
    [targetId, institutionId] as never[]
  )) as Array<{
    id: string;
    studentId: string | null;
    recipientName: string;
    recipientPhone: string;
    messageType: string;
    templateName: string;
    language: string;
    parameters: unknown;
    status: string;
    attemptCount: number;
    studentName: string | null;
    consentStatus: string | null;
  }>;

  if (msgRows.length === 0) {
    return Response.json({ error: "Message not found in this school." }, { status: 404 });
  }

  const msg = msgRows[0];

  // Only failed messages can be retried
  if (msg.status !== "Failed") {
    return Response.json({ error: `Only failed messages can be retried (current status: ${msg.status}).` }, { status: 400 });
  }

  // Check consent status
  if (msg.consentStatus === "OPTED_OUT") {
    return Response.json({ error: "Parent has opted out of WhatsApp communication." }, { status: 400 });
  }

  // Max 5 attempts
  if (msg.attemptCount >= 5) {
    return Response.json({ error: "Maximum retry attempts (5) reached for this message." }, { status: 400 });
  }

  let normalizedPhone = "";
  try {
    normalizedPhone = normalizeWhatsAppNumber(msg.recipientPhone);
  } catch (err) {
    return Response.json({ error: `Cannot retry: invalid phone number (${(err as Error).message})` }, { status: 400 });
  }

  // Parse parameters
  let text = "";
  let templateParameters: string[] = [];
  if (Array.isArray(msg.parameters) && typeof msg.parameters[0] === "string") {
    text = msg.parameters[0];
  } else if (typeof msg.parameters === "string") {
    try {
      const parsedParams = JSON.parse(msg.parameters);
      if (Array.isArray(parsedParams) && typeof parsedParams[0] === "string") {
        text = parsedParams[0];
      }
    } catch {
      text = msg.parameters;
    }
  }

  // Direct dispatch to WhatsApp Business Cloud API
  const dispatchResult = await dispatchDirectWhatsAppMessage({
    to: normalizedPhone,
    text,
    templateName: msg.templateName,
    templateLanguage: msg.language,
    templateParameters,
    schoolId: institutionId,
    studentId: msg.studentId || undefined,
    parentName: msg.recipientName,
  });

  const nextAttempt = (msg.attemptCount || 0) + 1;

  if (dispatchResult.success) {
    await db.unsafe(
      `UPDATE whatsapp_messages
       SET status = 'Sent',
           provider_message_id = $1,
           attempt_count = $2,
           error_code = '',
           error_message = '',
           sent_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [dispatchResult.messageId, nextAttempt, msg.id] as never[]
    );

    return Response.json({
      ok: true,
      messageId: msg.id,
      providerMessageId: dispatchResult.messageId,
      status: "Sent",
      attemptCount: nextAttempt,
    });
  } else {
    await db.unsafe(
      `UPDATE whatsapp_messages
       SET status = 'Failed',
           attempt_count = $1,
           error_message = $2,
           failed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [nextAttempt, dispatchResult.error || "Retry dispatch failed", msg.id] as never[]
    );

    return Response.json(
      {
        ok: false,
        messageId: msg.id,
        status: "Failed",
        attemptCount: nextAttempt,
        error: dispatchResult.error || "Retry failed",
      },
      { status: 502 }
    );
  }
}
