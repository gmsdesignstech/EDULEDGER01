import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { teacherPortalScope } from "@/lib/db";
import { listWhatsAppShareLogs } from "@/lib/whatsapp-click-to-chat-db";

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
  const studentId = url.searchParams.get("studentId") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  try {
    let teacherClasses: string[] | undefined = undefined;
    if (user.role === "TEACHER") {
      const scope = await teacherPortalScope(user.institutionId, user.email);
      teacherClasses = scope.assignments.map((a) => a.className);
    }

    const result = await listWhatsAppShareLogs(user.institutionId, {
      studentId,
      category,
      limit,
      offset,
      teacherClasses,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching share history:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load history." },
      { status: 500 },
    );
  }
}

