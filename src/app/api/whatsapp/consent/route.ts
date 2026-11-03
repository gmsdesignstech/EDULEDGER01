import { z } from "zod";
import { currentUser } from "@/lib/session";
import { updateWhatsAppConsent, whatsappRecipients } from "@/lib/db";
import { publicWhatsAppRouteError } from "@/lib/whatsapp";

export const runtime = "nodejs";
const roles = ["SCHOOL_ADMIN", "SUPER_ADMIN"];
const schema = z.object({
  studentId: z.string().min(1),
  whatsappEnabled: z.boolean(),
  whatsappAttendance: z.boolean(),
  whatsappAcademics: z.boolean(),
  whatsappFees: z.boolean(),
  whatsappNotices: z.boolean(),
  whatsappGeneral: z.boolean(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (!roles.includes(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json({ recipients: await whatsappRecipients(user.institutionId) });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (!roles.includes(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid consent settings." }, { status: 400 });
  const { studentId, ...settings } = parsed.data;
  try {
    await updateWhatsAppConsent(user.institutionId, user.id, studentId, settings);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: publicWhatsAppRouteError(error, "Could not update consent.") }, { status: 400 });
  }
}
