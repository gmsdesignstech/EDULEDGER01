import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { queryRow, queryRun } from "@/lib/db";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await queryRow<{
    default_teacher_password: string;
    default_student_password: string;
    teacher_password_mode: string;
    student_password_mode: string;
  }>(
    `SELECT
       COALESCE(default_teacher_password, 'EduTeacher@2026') as default_teacher_password,
       COALESCE(default_student_password, 'EduStudent@2026') as default_student_password,
       COALESCE(teacher_password_mode, 'COMMON') as teacher_password_mode,
       COALESCE(student_password_mode, 'COMMON') as student_password_mode
     FROM settings
     WHERE institution_id = ?`,
    [user.institutionId]
  );

  return NextResponse.json({
    defaultTeacherPassword: settings?.default_teacher_password || "EduTeacher@2026",
    defaultStudentPassword: settings?.default_student_password || "EduStudent@2026",
    teacherPasswordMode: settings?.teacher_password_mode || "COMMON",
    studentPasswordMode: settings?.student_password_mode || "COMMON",
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const {
      defaultTeacherPassword,
      defaultStudentPassword,
      teacherPasswordMode,
      studentPasswordMode,
    } = body;

    const teacherMode = teacherPasswordMode === "UNIQUE" ? "UNIQUE" : "COMMON";
    const studentMode = studentPasswordMode === "UNIQUE" ? "UNIQUE" : "COMMON";

    const cleanTeacherPassword = (defaultTeacherPassword || "EduTeacher@2026").trim();
    const cleanStudentPassword = (defaultStudentPassword || "EduStudent@2026").trim();

    if (cleanTeacherPassword.length < 8 || cleanStudentPassword.length < 8) {
      return NextResponse.json(
        { error: "Default temporary passwords must be at least 8 characters long." },
        { status: 400 }
      );
    }

    await queryRun(
      `UPDATE settings
       SET default_teacher_password = ?,
           default_student_password = ?,
           teacher_password_mode = ?,
           student_password_mode = ?
       WHERE institution_id = ?`,
      [cleanTeacherPassword, cleanStudentPassword, teacherMode, studentMode, user.institutionId]
    );

    return NextResponse.json({
      success: true,
      defaultTeacherPassword: cleanTeacherPassword,
      defaultStudentPassword: cleanStudentPassword,
      teacherPasswordMode: teacherMode,
      studentPasswordMode: studentMode,
    });
  } catch (error) {
    const requestId = crypto.randomUUID();
    logServerError("admin.accounts.settings", error, { requestId });
    return NextResponse.json({ error: "Failed to update account settings." }, { status: 500 });
  }
}
