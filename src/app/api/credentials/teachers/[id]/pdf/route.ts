import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getInstitution, listTeachers } from "@/lib/db";
import { generateSingleTeacherCredentialPdf } from "@/lib/credential-pdf";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Multi-tenant check: Only School Admin or Super Admin
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: Administrator access required" }, { status: 403 });
  }

  const { id } = await params;
  const institutionId = user.institutionId;

  try {
    const [school, teachers] = await Promise.all([
      getInstitution(institutionId),
      listTeachers(institutionId),
    ]);

    const teacher = teachers.find((t) => t.id === id);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher record not found." }, { status: 404 });
    }

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "eduledger.co.in";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const loginUrl = `${origin}/teacher/login`;

    const pdfBytes = await generateSingleTeacherCredentialPdf({
      school: {
        id: school.id,
        name: school.name,
        academicYear: school.academicYear,
      },
      teacher: {
        id: teacher.id,
        name: teacher.name,
        employeeId: teacher.employeeId,
        loginId: teacher.loginId || teacher.employeeId,
        department: teacher.department,
        subject: teacher.subject,
        email: teacher.email,
        phone: teacher.phone,
        status: teacher.status,
      },
      loginUrl,
    });

    const safeFilename = `teacher-credential-${(teacher.employeeId || teacher.name).replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

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
    logServerError("credentials.teachers.single.pdf", error, { requestId, role: user.role, httpStatus: 500 });
    return NextResponse.json(
      { error: "Failed to generate faculty credential slip PDF.", requestId },
      { status: 500 },
    );
  }
}
