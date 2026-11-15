import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { queryRow, queryRows } from "@/lib/db";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: Administrator access required" }, { status: 403 });
  }

  const institutionId = user.institutionId;

  try {
    const institution = await queryRow<{
      name: string;
      institution_type: string;
    }>(
      `SELECT name, COALESCE(institution_type, 'School') as institution_type FROM institutions WHERE id = ?`,
      [institutionId]
    );

    const settings = await queryRow<{
      default_teacher_password: string;
      default_student_password: string;
      teacher_password_mode: string;
      student_password_mode: string;
      accounts_last_synced_at: string | null;
    }>(
      `SELECT
         COALESCE(default_teacher_password, 'EduTeacher@2026') as default_teacher_password,
         COALESCE(default_student_password, 'EduStudent@2026') as default_student_password,
         COALESCE(teacher_password_mode, 'COMMON') as teacher_password_mode,
         COALESCE(student_password_mode, 'COMMON') as student_password_mode,
         accounts_last_synced_at::text as accounts_last_synced_at
       FROM settings
       WHERE institution_id = ?`,
      [institutionId]
    );

    const teacherStats = await queryRow<{
      totalTeachers: number;
      activeTeacherAccounts: number;
      pendingTeachers: number;
      teachersWithSetPassword: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM teachers WHERE institution_id = ? AND status <> 'Deleted') as "totalTeachers",
         (SELECT count(*)::int FROM users WHERE institution_id = ? AND role = 'TEACHER' AND status = 'Active') as "activeTeacherAccounts",
         (SELECT count(*)::int FROM users WHERE institution_id = ? AND role = 'TEACHER' AND must_change_password = TRUE) as "pendingTeachers",
         (SELECT count(*)::int FROM users WHERE institution_id = ? AND role = 'TEACHER' AND must_change_password = FALSE) as "teachersWithSetPassword"`,
      [institutionId, institutionId, institutionId, institutionId]
    );

    const studentStats = await queryRow<{
      totalStudents: number;
      activeStudentAccounts: number;
      pendingStudents: number;
      studentsWithSetPassword: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM students WHERE institution_id = ? AND status <> 'Deleted') as "totalStudents",
         (SELECT count(*)::int FROM users WHERE institution_id = ? AND role IN ('STUDENT', 'PARENT') AND status = 'Active') as "activeStudentAccounts",
         (SELECT count(*)::int FROM users WHERE institution_id = ? AND role IN ('STUDENT', 'PARENT') AND must_change_password = TRUE) as "pendingStudents",
         (SELECT count(*)::int FROM users WHERE institution_id = ? AND role IN ('STUDENT', 'PARENT') AND must_change_password = FALSE) as "studentsWithSetPassword"`,
      [institutionId, institutionId, institutionId, institutionId]
    );

    return NextResponse.json({
      institution: {
        id: institutionId,
        name: institution?.name || "Institution",
        type: institution?.institution_type || "School",
      },
      settings: {
        defaultTeacherPassword: settings?.default_teacher_password || "EduTeacher@2026",
        defaultStudentPassword: settings?.default_student_password || "EduStudent@2026",
        teacherPasswordMode: settings?.teacher_password_mode || "COMMON",
        studentPasswordMode: settings?.student_password_mode || "COMMON",
        accountsLastSyncedAt: settings?.accounts_last_synced_at || null,
      },
      teachers: {
        total: teacherStats?.totalTeachers || 0,
        active: teacherStats?.activeTeacherAccounts || 0,
        pending: teacherStats?.pendingTeachers || 0,
        passwordSet: teacherStats?.teachersWithSetPassword || 0,
      },
      students: {
        total: studentStats?.totalStudents || 0,
        active: studentStats?.activeStudentAccounts || 0,
        pending: studentStats?.pendingStudents || 0,
        passwordSet: studentStats?.studentsWithSetPassword || 0,
      },
    });
  } catch (error) {
    const requestId = crypto.randomUUID();
    logServerError("admin.accounts.overview", error, { requestId });
    return NextResponse.json({ error: "Failed to load account overview." }, { status: 500 });
  }
}
