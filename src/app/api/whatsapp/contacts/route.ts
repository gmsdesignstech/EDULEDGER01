// src/app/api/whatsapp/contacts/route.ts
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getDb, updateWhatsAppConsent } from "@/lib/db";
import { maskWhatsAppNumber, normalizeWhatsAppNumber } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const institutionId = user.institutionId;
  const db = await getDb();
  const url = new URL(request.url);

  const search = url.searchParams.get("search")?.trim() || "";
  const classFilter = url.searchParams.get("class") || "ALL";
  const consentFilter = url.searchParams.get("consent") || "ALL";

  const conditions: string[] = ["s.institution_id = $1", "s.status = 'Active'"];
  const args: unknown[] = [institutionId];

  if (classFilter !== "ALL") {
    args.push(classFilter);
    conditions.push(`s.class_name = $${args.length}`);
  }

  if (consentFilter === "GRANTED") {
    conditions.push("s.whatsapp_consent_status = 'GRANTED'");
  } else if (consentFilter === "OPTED_OUT") {
    conditions.push("s.whatsapp_consent_status = 'OPTED_OUT'");
  } else if (consentFilter === "PENDING") {
    conditions.push("(s.whatsapp_consent_status = 'UNKNOWN' OR s.whatsapp_consent_status IS NULL)");
  }

  if (search) {
    args.push(`%${search}%`);
    const searchIdx = args.length;
    conditions.push(`(s.name ILIKE $${searchIdx} OR s.parent ILIKE $${searchIdx} OR s.admission ILIKE $${searchIdx})`);
  }

  const query = `
    SELECT
      s.id AS "studentId",
      s.name AS "studentName",
      s.admission AS "admissionNumber",
      s.class_name AS "className",
      s.section,
      s.roll_number AS "rollNumber",
      s.parent AS "parentName",
      s.parent_phone AS "parentPhone",
      COALESCE(NULLIF(s.parent_whatsapp, ''), s.parent_phone) AS "rawWhatsApp",
      COALESCE(s.whatsapp_consent_status, 'UNKNOWN') AS "consentStatus",
      s.whatsapp_consent_at AS "consentAt",
      s.whatsapp_opted_out_at AS "optedOutAt",
      s.whatsapp_enabled AS "whatsappEnabled",
      s.whatsapp_attendance AS "whatsappAttendance",
      s.whatsapp_academics AS "whatsappAcademics",
      s.whatsapp_fees AS "whatsappFees",
      s.whatsapp_notices AS "whatsappNotices",
      s.whatsapp_general AS "whatsappGeneral"
    FROM students s
    WHERE ${conditions.join(" AND ")}
    ORDER BY s.class_name, s.section, s.name
  `;

  const students = (await db.unsafe(query, args as never[])) as Array<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    className: string;
    section: string;
    rollNumber: string;
    parentName: string;
    parentPhone: string;
    rawWhatsApp: string;
    consentStatus: string;
    consentAt: string | null;
    optedOutAt: string | null;
    whatsappEnabled: boolean;
    whatsappAttendance: boolean;
    whatsappAcademics: boolean;
    whatsappFees: boolean;
    whatsappNotices: boolean;
    whatsappGeneral: boolean;
  }>;

  const processed = students.map((row) => {
    let normalized = "";
    let isValid = false;
    let formatError = "";
    const raw = String(row.rawWhatsApp || "").trim();

    if (raw) {
      try {
        normalized = normalizeWhatsAppNumber(raw);
        isValid = true;
      } catch (err) {
        formatError = (err as Error).message;
      }
    }

    return {
      studentId: row.studentId,
      studentName: row.studentName,
      admissionNumber: row.admissionNumber,
      className: row.className,
      section: row.section,
      rollNumber: row.rollNumber || "—",
      parentName: row.parentName || "Parent",
      rawPhone: raw,
      normalizedPhone: normalized,
      maskedPhone: normalized ? maskWhatsAppNumber(normalized) : raw ? maskWhatsAppNumber(raw) : "Not Provided",
      countryCode: normalized.startsWith("+91") ? "+91 (India)" : normalized.slice(0, 3) || "+91",
      isValidNumber: isValid,
      formatError,
      consentStatus: row.consentStatus,
      consentDate: row.consentAt,
      optedOutDate: row.optedOutAt,
      isOptedOut: row.consentStatus === "OPTED_OUT",
      hasConsent: row.consentStatus === "GRANTED",
      categories: {
        attendance: row.whatsappAttendance,
        academics: row.whatsappAcademics,
        fees: row.whatsappFees,
        notices: row.whatsappNotices,
        general: row.whatsappGeneral,
      },
    };
  });

  return Response.json({
    ok: true,
    contacts: processed,
    total: processed.length,
  });
}

const updateSchema = z.object({
  studentId: z.string().min(1),
  parentPhone: z.string().optional(),
  consentGranted: z.boolean(),
  attendance: z.boolean().default(true),
  academics: z.boolean().default(true),
  fees: z.boolean().default(true),
  notices: z.boolean().default(true),
  general: z.boolean().default(true),
});

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  const { studentId, parentPhone, consentGranted, attendance, academics, fees, notices, general } = parsed.data;
  const db = await getDb();

  // If phone is provided, update student's parent_whatsapp field first
  if (parentPhone !== undefined) {
    let cleanNumber = parentPhone.trim();
    if (cleanNumber) {
      cleanNumber = normalizeWhatsAppNumber(cleanNumber);
    }
    await db.unsafe(
      `UPDATE students SET parent_whatsapp = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND institution_id = $3`,
      [cleanNumber, studentId, user.institutionId] as never[]
    );
  }

  // Update consent in db
  await updateWhatsAppConsent(user.institutionId, user.id, studentId, {
    whatsappEnabled: consentGranted,
    whatsappAttendance: attendance,
    whatsappAcademics: academics,
    whatsappFees: fees,
    whatsappNotices: notices,
    whatsappGeneral: general,
  });

  return Response.json({ ok: true });
}
