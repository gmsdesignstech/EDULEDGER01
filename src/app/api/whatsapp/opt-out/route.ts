// src/app/api/whatsapp/opt-out/route.ts
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { randomUUID, createHash } from "node:crypto";

export const runtime = "nodejs";

const optOutSchema = z.object({
  studentId: z.string().min(1),
  reason: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = optOutSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid opt-out request." }, { status: 400 });
  }

  const { studentId, reason } = parsed.data;
  const db = await getDb();

  // Verify student belongs to user's institution
  const studentRows = (await db.unsafe(
    `SELECT id, parent_phone AS "parentPhone", parent_whatsapp AS "parentWhatsapp"
     FROM students
     WHERE id = $1 AND institution_id = $2`,
    [studentId, user.institutionId] as never[]
  )) as Array<{ id: string; parentPhone: string; parentWhatsapp: string }>;

  const student = studentRows[0];
  if (!student) {
    return Response.json({ error: "Student not found in this institution." }, { status: 404 });
  }

  const phone = student.parentWhatsapp || student.parentPhone || "";
  const fingerprint = phone ? createHash("sha256").update(phone).digest("hex") : "missing";

  // 1. Mark student as opted out
  await db.unsafe(
    `UPDATE students
     SET
       whatsapp_enabled = FALSE,
       whatsapp_consent_status = 'OPTED_OUT',
       whatsapp_opted_out_at = CURRENT_TIMESTAMP,
       whatsapp_attendance = FALSE,
       whatsapp_academics = FALSE,
       whatsapp_fees = FALSE,
       whatsapp_notices = FALSE,
       whatsapp_general = FALSE,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND institution_id = $2`,
    [studentId, user.institutionId] as never[]
  );

  // 2. Record audit log
  await db.unsafe(
    `INSERT INTO whatsapp_consent_events (
       id,
       institution_id,
       student_id,
       contact_fingerprint,
       status,
       source,
       changed_by,
       occurred_at
     ) VALUES ($1, $2, $3, $4, 'OPTED_OUT', $5, $6, CURRENT_TIMESTAMP)`,
    [
      randomUUID(),
      user.institutionId,
      studentId,
      fingerprint,
      reason || "PARENT_REQUEST",
      user.id,
    ] as never[]
  );

  return Response.json({ ok: true, message: "Parent has been successfully opted out from WhatsApp communications." });
}
