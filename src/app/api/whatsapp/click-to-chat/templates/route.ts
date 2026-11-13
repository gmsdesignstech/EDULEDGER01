import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import {
  listWhatsAppTemplates,
  saveWhatsAppCustomTemplate,
  deleteWhatsAppCustomTemplate,
} from "@/lib/whatsapp-click-to-chat-db";
import type { WhatsAppCategory } from "@/lib/whatsapp-click-to-chat";

export const runtime = "nodejs";

const templateSchema = z.object({
  id: z.string().optional(),
  category: z.enum([
    "STUDENT_INFO",
    "ATTENDANCE",
    "FEES",
    "EXAM_RESULTS",
    "HOMEWORK",
    "TIMETABLE",
    "LEAVE",
    "ANNOUNCEMENT",
    "CUSTOM",
  ]),
  title: z.string().trim().min(3).max(100),
  content: z.string().trim().min(10).max(3000),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const templates = await listWhatsAppTemplates(user.institutionId);
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load templates." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Only School Admins can create or modify custom templates
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Only administrators can manage templates." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = templateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid template data." },
      { status: 400 },
    );
  }

  try {
    const saved = await saveWhatsAppCustomTemplate(user.institutionId, user.id, {
      id: parsed.data.id,
      category: parsed.data.category as WhatsAppCategory,
      title: parsed.data.title,
      content: parsed.data.content,
      isDefault: parsed.data.isDefault,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("Error saving template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save template." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Only administrators can delete templates." }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Template ID is required." }, { status: 400 });
  }

  try {
    const deleted = await deleteWhatsAppCustomTemplate(user.institutionId, id);
    return NextResponse.json({ ok: deleted });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete template." },
      { status: 500 },
    );
  }
}

