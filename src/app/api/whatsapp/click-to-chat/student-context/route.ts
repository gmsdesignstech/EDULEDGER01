import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getWhatsAppStudentContext } from "@/lib/whatsapp-click-to-chat-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
  }

  try {
    const context = await getWhatsAppStudentContext(user.institutionId, studentId, {
      id: user.id,
      role: user.role,
      email: user.email,
    });
    return NextResponse.json(context);
  } catch (error) {
    console.error("Error fetching student communication context:", error);
    const msg = error instanceof Error ? error.message : "Failed to load student context.";
    const status = msg.includes("Access denied") ? 403 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

