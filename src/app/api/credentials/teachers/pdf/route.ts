import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getTeacherPdfData } from "@/lib/account-provisioning";
import { generateTeacherCredentialsPdf } from "@/lib/credential-pdf";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Multi-tenant security check: Only School Admin or Super Admin
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: Administrator access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department") || undefined;
  const regenerateParam = searchParams.get("regenerate");
  const regenerate = regenerateParam === "all" ? "all" : regenerateParam === "missing" ? "missing" : undefined;

  // Strict tenant isolation: Use institutionId from validated session, NEVER client query param
  const institutionId = user.institutionId;

  try {
    const { school, teachers } = await getTeacherPdfData(institutionId, department, { regenerate });
    const pdfBytes = await generateTeacherCredentialsPdf({
      school,
      teachers,
      departmentFilter: department,
    });

    const safeFilename = `teacher-credentials-${school.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const requestId = crypto.randomUUID();
    logServerError("credentials.teachers.pdf", error, { requestId, role: user.role, httpStatus: 500 });
    return NextResponse.json(
      { error: "Failed to generate faculty credentials PDF.", requestId },
      { status: 500 }
    );
  }
}

