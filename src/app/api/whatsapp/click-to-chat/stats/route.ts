import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { teacherPortalScope } from "@/lib/db";
import { getWhatsAppCommunicationStats } from "@/lib/whatsapp-click-to-chat-db";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Allowed roles: SCHOOL_ADMIN, SUPER_ADMIN, TEACHER, ACCOUNTANT
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    let teacherClasses: string[] | undefined = undefined;
    if (user.role === "TEACHER") {
      const scope = await teacherPortalScope(user.institutionId, user.email);
      teacherClasses = scope.assignments.map((a) => a.className);
    }

    const stats = await getWhatsAppCommunicationStats(user.institutionId, teacherClasses);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching WhatsApp stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load WhatsApp statistics." },
      { status: 500 },
    );
  }
}

