import { NextResponse } from "next/server";
import { privateAdmin } from "@/lib/admin-auth";
import { getTeacherPdfData } from "@/lib/account-provisioning";
import { generateTeacherCredentialsPdf } from "@/lib/credential-pdf";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await privateAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Private admin authorization required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  const department = searchParams.get("department") || undefined;

  if (!schoolId) {
    return NextResponse.json({ error: "schoolId parameter is required" }, { status: 400 });
  }

  try {
    const { school, teachers } = await getTeacherPdfData(schoolId, department);
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
    logServerError("admin.credentials.teacher-pdf", error, { requestId, role: admin.role, httpStatus: 500 });
    return NextResponse.json(
      { error: "Failed to generate teacher credential PDF.", requestId },
      { status: 500 }
    );
  }
}

