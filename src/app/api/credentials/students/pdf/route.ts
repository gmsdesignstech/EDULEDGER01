import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getStudentPdfData } from "@/lib/account-provisioning";
import { generateStudentCredentialsPdf } from "@/lib/credential-pdf";
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
  const className = searchParams.get("class") || undefined;
  const section = searchParams.get("section") || undefined;

  // Strict tenant isolation: Use institutionId from authenticated session
  const institutionId = user.institutionId;

  try {
    const { school, students } = await getStudentPdfData(institutionId, className, section);
    const pdfBytes = await generateStudentCredentialsPdf({
      school,
      students,
      classFilter: className,
      sectionFilter: section,
    });

    const safeFilename = `student-credentials-${school.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

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
    logServerError("credentials.students.pdf", error, { requestId, role: user.role, httpStatus: 500 });
    return NextResponse.json(
      { error: "Failed to generate student credentials PDF.", requestId },
      { status: 500 }
    );
  }
}

