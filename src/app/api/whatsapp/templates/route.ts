// src/app/api/whatsapp/templates/route.ts
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { saveWhatsAppTemplate, whatsappTemplates } from "@/lib/db";
import { SYSTEM_TEMPLATES } from "@/lib/whatsapp-templates";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  category: z.enum(["Attendance", "Fees", "Academics", "School", "Timetable", "Leave", "Notices"]),
  language: z.string().trim().min(2).max(12),
  providerTemplateName: z.string().trim().regex(/^[a-z0-9_]+$/).max(512),
  enabled: z.boolean(),
  variables: z.array(z.string().regex(/^[a-z_]+$/)).max(30),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const customTemplates = await whatsappTemplates(user.institutionId).catch(() => []);

  return Response.json({
    ok: true,
    systemTemplates: SYSTEM_TEMPLATES,
    customTemplates,
  });
}

export async function POST(request: Request) {
  return handleSave(request);
}

export async function PUT(request: Request) {
  return handleSave(request);
}

async function handleSave(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Invalid template." }, { status: 400 });
  }

  try {
    const updated = await saveWhatsAppTemplate(user.institutionId, user.id, parsed.data);
    return Response.json({ ok: true, templates: updated });
  } catch (err) {
    return Response.json({ error: (err as Error).message || "Could not save template." }, { status: 400 });
  }
}
