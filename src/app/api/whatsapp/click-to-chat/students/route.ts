import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { teacherPortalScope } from "@/lib/db";
import { listWhatsAppStudents } from "@/lib/whatsapp-click-to-chat-db";

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
  const className = url.searchParams.get("className") || undefined;
  const section = url.searchParams.get("section") || undefined;
  const hasWhatsApp = (url.searchParams.get("hasWhatsApp") as "all" | "yes" | "no") || "all";
  const search = url.searchParams.get("search") || undefined;
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  try {
    let teacherClasses: string[] | undefined = undefined;
    if (user.role === "TEACHER") {
      const scope = await teacherPortalScope(user.institutionId, user.email);
      teacherClasses = scope.assignments.map((a) => a.className);
    }

    const result = await listWhatsAppStudents(user.institutionId, {
      className,
      section,
      hasWhatsApp,
      search,
      limit,
      offset,
      teacherClasses,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching WhatsApp students:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load students." },
      { status: 500 },
    );
  }
}

