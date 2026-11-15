import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { formatStudentLoginId, getCompleteSettings, getInstitution, getStudent, queryRun, queryRow } from "@/lib/db";
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
    const [student, school, settings] = await Promise.all([
      getStudent(user.institutionId, id),
      getInstitution(user.institutionId),
      getCompleteSettings(user.institutionId),
    ]);

    if (!student) {
      return NextResponse.json({ error: "Student record not found." }, { status: 404 });
    }

    const raw = await request.json().catch(() => null);
    const mode = raw?.mode || school.studentPasswordMode;
    const temporaryPassword = mode === "UNIQUE"
      ? generateSecureTemporaryPassword()
      : (school.defaultStudentPassword || "EduStudent@2026");

    const schoolCode = settings.schoolCode || school.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
    const loginId = student.loginId || formatStudentLoginId(schoolCode, student.admission || student.id);

    const passwordHash = await hash(temporaryPassword, 10);

    // Update student login_id
    await queryRun(
      "UPDATE students SET login_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND institution_id = ?",
      [loginId, id, user.institutionId]
    );

    const cleanEmail = (student.parentEmail || "").trim().toLowerCase();
    const syntheticEmail = `student_${(student.admission || student.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")}@${user.institutionId.toLowerCase()}.internal`;
    const effectiveEmail = cleanEmail || syntheticEmail;

    // Check if user exists
    let existingUser = await queryRow<{ id: string }>(
      "SELECT id FROM users WHERE institution_id = ? AND (LOWER(email) = ? OR LOWER(login_id) = ?)",
      [user.institutionId, effectiveEmail, loginId.toLowerCase()]
    );

    let studentUserId = existingUser?.id;
    if (studentUserId) {
      await queryRun(
        "UPDATE users SET password_hash = ?, must_change_password = TRUE, status = 'Active', login_id = ? WHERE id = ? AND institution_id = ?",
        [passwordHash, loginId, studentUserId, user.institutionId]
      );
    } else {
      studentUserId = crypto.randomUUID();
      await queryRun(
        "INSERT INTO users(id, email, name, password_hash, role, status, institution_id, login_id, must_change_password) VALUES (?, ?, ?, ?, 'STUDENT', 'Active', ?, ?, TRUE)",
        [studentUserId, effectiveEmail, student.name, passwordHash, user.institutionId, loginId]
      );
    }

    await queryRun(
      "INSERT INTO parent_students(id, institution_id, parent_user_id, student_id, relationship, is_primary) VALUES (?, ?, ?, ?, 'Student', TRUE) ON CONFLICT (parent_user_id, student_id) DO NOTHING",
      [crypto.randomUUID(), user.institutionId, studentUserId, student.id]
    );

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "eduledger.co.in";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const loginUrl = `${origin}/student/login`;

    return NextResponse.json({
      success: true,
      credentials: {
        studentId: student.id,
        name: student.name,
        admission: student.admission,
        loginId,
        temporaryPassword,
        parentEmail: student.parentEmail || undefined,
        parentPhone: student.parentPhone,
        schoolName: school.name,
        loginUrl,
        status: "Active",
        mustChangePassword: true,
      },
    });
  } catch (error) {
    logServerError("students.resetPassword", error);
    return NextResponse.json(
      { error: "Could not reset student password. Please try again." },
      { status: 500 }
    );
  }
}
