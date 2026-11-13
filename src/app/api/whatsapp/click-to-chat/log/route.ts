import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { teacherPortalScope, getStudent } from "@/lib/db";
import { logWhatsAppShareInitiation } from "@/lib/whatsapp-click-to-chat-db";

export const runtime = "nodejs";

const logSchema = z.object({
  studentId: z.string().optional(),
  recipientPhone: z.string().min(6).max(25),
  recipientName: z.string().max(100).optional(),
  category: z.string().min(1).max(50),
  messagePreview: z.string().max(1000),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = logSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload." },
      { status: 400 },
    );
  }

  const { studentId, recipientPhone, recipientName, category, messagePreview } = parsed.data;

  // Strict role check:
  // 1. Teachers cannot log or share FEE category
  if (user.role === "TEACHER" && category.toUpperCase().includes("FEE")) {
    return NextResponse.json(
      { error: "Forbidden: Teachers are not authorized to share fee information." },
      { status: 403 },
    );
  }

  // 2. If studentId is supplied, verify student belongs to user's school and teacher's class
  if (studentId) {
    const student = await getStudent(user.institutionId, studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found or unauthorized." }, { status: 404 });
    }

    if (user.role === "TEACHER") {
      const scope = await teacherPortalScope(user.institutionId, user.email);
      const assigned = scope.assignments.map((a) => a.className.toLowerCase().trim());
      if (!assigned.includes(student.className.toLowerCase().trim())) {
        return NextResponse.json(
          { error: "Access denied: Student is not in your assigned class." },
          { status: 403 },
        );
      }
    }
  }

  try {
    const entry = await logWhatsAppShareInitiation({
      institutionId: user.institutionId,
      studentId,
      userId: user.id,
      userName: user.name || "Staff Member",
      recipientPhone,
      recipientName,
      category,
      messagePreview,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error logging WhatsApp share:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record share event." },
      { status: 500 },
    );
  }
}

