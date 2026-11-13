// src/app/api/whatsapp/history/route.ts
import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { maskWhatsAppNumber } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const institutionId = user.institutionId;
  const db = await getDb();
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  const statusFilter = url.searchParams.get("status") || "ALL";
  const search = url.searchParams.get("search")?.trim() || "";

  const conditions: string[] = ["m.institution_id = $1"];
  const args: unknown[] = [institutionId];

  if (statusFilter !== "ALL") {
    args.push(statusFilter);
    conditions.push(`m.status = $${args.length}`);
  }

  if (search) {
    args.push(`%${search}%`);
    const searchIdx = args.length;
    conditions.push(`(s.name ILIKE $${searchIdx} OR m.recipient_name ILIKE $${searchIdx})`);
  }

  args.push(limit);
  const limitIdx = args.length;
  args.push(offset);
  const offsetIdx = args.length;

  const query = `
    SELECT
      m.id,
      m.student_id AS "studentId",
      s.name AS "studentName",
      s.class_name AS "className",
      s.section,
      m.recipient_name AS "recipientName",
      m.recipient_phone AS "recipientPhone",
      m.message_type AS "messageType",
      m.template_name AS "templateName",
      m.language,
      m.status,
      m.error_code AS "errorCode",
      m.error_message AS "errorMessage",
      m.provider_message_id AS "providerMessageId",
      u.name AS "sentBy",
      m.sent_at AS "sentAt",
      m.delivered_at AS "deliveredAt",
      m.read_at AS "readAt",
      m.failed_at AS "failedAt",
      m.created_at AS "createdAt"
    FROM whatsapp_messages m
    LEFT JOIN students s ON s.id = m.student_id AND s.institution_id = m.institution_id
    LEFT JOIN users u ON u.id = m.sent_by
    WHERE ${conditions.join(" AND ")}
    ORDER BY m.created_at DESC
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
  `;

  const messages = (await db.unsafe(query, args as never[])) as Array<{
    id: string;
    studentId: string | null;
    studentName: string | null;
    className: string | null;
    section: string | null;
    recipientName: string;
    recipientPhone: string;
    messageType: string;
    templateName: string;
    language: string;
    status: string;
    errorCode: string;
    errorMessage: string;
    providerMessageId: string | null;
    sentBy: string | null;
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    failedAt: string | null;
    createdAt: string;
  }>;

  const countConditions = [...conditions];
  const countArgs = args.slice(0, limitIdx - 1);
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM whatsapp_messages m
    LEFT JOIN students s ON s.id = m.student_id AND s.institution_id = m.institution_id
    WHERE ${countConditions.join(" AND ")}
  `;

  const countResult = (await db.unsafe(countQuery, countArgs as never[])) as Array<{ total: number }>;
  const total = countResult[0]?.total || 0;

  // Mask recipient phone numbers for privacy & security compliance
  const maskedItems = messages.map((m) => ({
    ...m,
    recipientPhone: maskWhatsAppNumber(String(m.recipientPhone || "")),
  }));

  return Response.json({
    ok: true,
    items: maskedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
