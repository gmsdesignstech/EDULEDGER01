// src/app/api/whatsapp/status/route.ts
/**
 * Direct WhatsApp Cloud API status and metrics endpoint for EduLedger.
 * Single Direct WhatsApp Cloud API — n8n and alternative providers removed.
 */
import { currentUser } from "@/lib/session";
import { getDb, getWhatsAppConfiguration } from "@/lib/db";
import { getWhatsAppIntegrationStatus } from "@/lib/whatsapp-config";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const institutionId = user.institutionId;
  const db = await getDb();

  // 1. Direct WhatsApp Cloud API environment readiness
  const envStatus = getWhatsAppIntegrationStatus();

  // 2. School-specific WhatsApp configuration
  const schoolConfig = await getWhatsAppConfiguration(institutionId).catch(() => null);

  // 3. Aggregate metrics for the institution
  const countsRows = (await db.unsafe(
    `SELECT
      COUNT(*)::int AS "totalStudents",
      COUNT(*) FILTER (
        WHERE NULLIF(parent_whatsapp, '') IS NOT NULL OR NULLIF(parent_phone, '') IS NOT NULL
      )::int AS "totalContacts",
      COUNT(*) FILTER (
        WHERE whatsapp_consent_status = 'GRANTED'
      )::int AS "consentsGranted",
      COUNT(*) FILTER (
        WHERE whatsapp_consent_status = 'OPTED_OUT'
      )::int AS "optedOut",
      COUNT(*) FILTER (
        WHERE whatsapp_consent_status = 'UNKNOWN' OR whatsapp_consent_status IS NULL
      )::int AS "consentsPending"
    FROM students
    WHERE institution_id = $1 AND status = 'Active'`,
    [institutionId] as never[]
  )) as Array<{
    totalStudents: number;
    totalContacts: number;
    consentsGranted: number;
    optedOut: number;
    consentsPending: number;
  }>;

  const counts = countsRows[0];

  // 4. Message delivery stats
  const msgStatsRows = (await db.unsafe(
    `SELECT
      COUNT(*)::int AS "totalMessages",
      COUNT(*) FILTER (WHERE status = 'Queued')::int AS "queued",
      COUNT(*) FILTER (WHERE status = 'Sending')::int AS "sending",
      COUNT(*) FILTER (WHERE status = 'Sent')::int AS "sent",
      COUNT(*) FILTER (WHERE status = 'Delivered')::int AS "delivered",
      COUNT(*) FILTER (WHERE status = 'Read')::int AS "read",
      COUNT(*) FILTER (WHERE status = 'Failed')::int AS "failed"
    FROM whatsapp_messages
    WHERE institution_id = $1`,
    [institutionId] as never[]
  )) as Array<{
    totalMessages: number;
    queued: number;
    sending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  }>;

  const messageStats = msgStatsRows[0];

  return Response.json({
    ok: true,
    provider: "Direct WhatsApp Cloud API (Meta)",
    environment: envStatus,
    schoolConfig,
    metrics: {
      totalStudents: counts?.totalStudents || 0,
      totalContacts: counts?.totalContacts || 0,
      consentsGranted: counts?.consentsGranted || 0,
      consentsPending: counts?.consentsPending || 0,
      optedOut: counts?.optedOut || 0,
      messagesInitiated: messageStats?.totalMessages || 0,
      messagesSent: messageStats?.sent || 0,
      messagesDelivered: (messageStats?.delivered || 0) + (messageStats?.read || 0),
      messagesRead: messageStats?.read || 0,
      messagesFailed: messageStats?.failed || 0,
      messagesQueued: messageStats?.queued || 0,
    },
    communicationModules: [
      { id: "attendance", name: "Attendance & Absence Alert", trigger: "attendance.marked", active: true },
      { id: "fee_reminder", name: "Fee Overdue Reminder", trigger: "fee.reminder", active: true },
      { id: "fee_payment", name: "Fee Payment Confirmation Receipt", trigger: "fee.payment_received", active: true },
      { id: "exam_announcement", name: "Examination Schedule Announcement", trigger: "examination.published", active: true },
      { id: "exam_results", name: "Examination Results & Report Card", trigger: "examination.results", active: true },
      { id: "homework", name: "Homework & Class Assignments", trigger: "homework.published", active: true },
      { id: "announcements", name: "School Notices & Holiday Circulars", trigger: "announcement.published", active: true },
      { id: "leave", name: "Student Leave Status Decision", trigger: "leave.status_updated", active: true },
      { id: "timetable", name: "Class Timetable Updates", trigger: "timetable.updated", active: true },
      { id: "custom", name: "General Authorized Communication", trigger: "manual.custom_message", active: true },
    ],
  });
}
