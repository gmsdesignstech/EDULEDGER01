import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { queryRow } from "@/lib/db";
import { sendAccountActivationEmail } from "@/lib/email";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.targetType || !body.targetId) {
      return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
    }

    const { targetType, targetId, temporaryPassword } = body;
    const institutionId = user.institutionId;

    const institution = await queryRow<{ name: string }>(
      `SELECT name FROM institutions WHERE id = ?`,
      [institutionId]
    );
    const institutionName = institution?.name || "EduLedger Institution";

    if (targetType === "TEACHER") {
      const teacher = await queryRow<{
        id: string;
        name: string;
        email: string;
        employee_id: string;
        login_id: string;
      }>(
        `SELECT id, name, email, employee_id, COALESCE(login_id, '') as login_id
         FROM teachers
         WHERE id = ? AND institution_id = ?`,
        [targetId, institutionId]
      );

      if (!teacher || !teacher.email) {
        return NextResponse.json(
          { error: "Teacher record or registered email not found." },
          { status: 404 }
        );
      }

      const loginId = teacher.login_id || teacher.employee_id || teacher.email;
      const loginUrl = "https://eduledger.co.in/teacher/login";

      const emailResult = await sendAccountActivationEmail({
        to: teacher.email,
        name: teacher.name,
        role: "TEACHER",
        institutionName,
        loginId,
        temporaryPassword,
        loginUrl,
      });

      return NextResponse.json({ success: true, emailResult });
    } else if (targetType === "STUDENT") {
      const student = await queryRow<{
        id: string;
        name: string;
        admission: string;
        parent_email: string;
        login_id: string;
      }>(
        `SELECT id, name, admission, parent_email, COALESCE(login_id, '') as login_id
         FROM students
         WHERE id = ? AND institution_id = ?`,
        [targetId, institutionId]
      );

      if (!student || !student.parent_email) {
        return NextResponse.json(
          { error: "Student record or registered contact email not found." },
          { status: 404 }
        );
      }

      const loginId = student.login_id || student.admission || student.parent_email;
      const loginUrl = "https://eduledger.co.in/student/login";

      const emailResult = await sendAccountActivationEmail({
        to: student.parent_email,
        name: student.name,
        role: "STUDENT",
        institutionName,
        loginId,
        temporaryPassword,
        loginUrl,
      });

      return NextResponse.json({ success: true, emailResult });
    }

    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  } catch (error) {
    const requestId = crypto.randomUUID();
    logServerError("admin.accounts.activate-email", error, { requestId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch activation email." },
      { status: 500 }
    );
  }
}
