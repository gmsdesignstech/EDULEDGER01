import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { formatTeacherLoginId, getCompleteSettings, getInstitution, listTeachers, queryRun, upsertTeacherAccount } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { generateSecureTemporaryPassword } from "@/lib/account-provisioning";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    const { id } = await params;
    const [teachers, school, settings] = await Promise.all([
      listTeachers(user.institutionId),
      getInstitution(user.institutionId),
      getCompleteSettings(user.institutionId),
    ]);

    const teacher = teachers.find((t) => t.id === id);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher record not found." }, { status: 404 });
    }

    const schoolCode = settings.schoolCode || school.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
    const loginId = teacher.loginId || formatTeacherLoginId(schoolCode, teacher.employeeId);

    const temporaryPassword = generateSecureTemporaryPassword();
    const passwordHash = await hash(temporaryPassword, 10);

    // Ensure teacher record has loginId and is active
    await queryRun(
      "UPDATE teachers SET login_id = ?, status = 'Active', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND institution_id = ?",
      [loginId, id, user.institutionId],
    );

    // Upsert user account with new temporary password and force password change
    await upsertTeacherAccount(user.institutionId, {
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      passwordHash,
      status: "Active",
      teacherId: id,
      loginId,
      mustChangePassword: true,
    });

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "eduledger.co.in";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const loginUrl = `${origin}/teacher/login`;

    return NextResponse.json({
      success: true,
      credentials: {
        teacherId: teacher.id,
        name: teacher.name,
        employeeId: teacher.employeeId,
        loginId,
        temporaryPassword,
        email: teacher.email || undefined,
        phone: teacher.phone,
        schoolName: school.name,
        loginUrl,
        status: "Active",
        mustChangePassword: true,
      },
    });
  } catch (error) {
    logServerError("teachers.resetPassword", error);
    return NextResponse.json(
      { error: "Could not reset teacher password. Please try again." },
      { status: 500 },
    );
  }
}
