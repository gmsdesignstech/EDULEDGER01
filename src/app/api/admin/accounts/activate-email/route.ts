import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { queryRow, queryRows } from "@/lib/db";
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
    if (!body || !body.targetType) {
      return NextResponse.json({ error: "Missing targetType parameter." }, { status: 400 });
    }

    const { targetType, targetId, temporaryPassword } = body;
    const institutionId = user.institutionId;

    const institution = await queryRow<{ name: string }>(
      `SELECT name FROM institutions WHERE id = ?`,
      [institutionId]
    );
    const institutionName = institution?.name || "EduLedger Institution";

    if (targetType === "TEACHER") {
      if (!targetId) {
        return NextResponse.json({ error: "Missing targetId." }, { status: 400 });
      }
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
      if (!targetId) {
        return NextResponse.json({ error: "Missing targetId." }, { status: 400 });
      }
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
    } else if (targetType === "BULK_TEACHERS") {
      const teachers = await queryRows<{
        id: string;
        name: string;
        email: string;
        employee_id: string;
        login_id: string;
      }>(
        `SELECT id, name, email, employee_id, COALESCE(login_id, '') as login_id
         FROM teachers
         WHERE institution_id = ? AND email <> '' AND status <> 'Deleted'`,
        [institutionId]
      );

      let sentCount = 0;
      for (const t of teachers.slice(0, 100)) {
        await sendAccountActivationEmail({
          to: t.email,
          name: t.name,
          role: "TEACHER",
          institutionName,
          loginId: t.login_id || t.employee_id || t.email,
          loginUrl: "https://eduledger.co.in/teacher/login",
        }).catch(() => null);
        sentCount++;
      }

      return NextResponse.json({
        success: true,
        sent: sentCount,
        total: teachers.length,
        message: `Dispatched activation emails to ${sentCount} faculty members.`,
      });
    } else if (targetType === "BULK_STUDENTS") {
      const students = await queryRows<{
        id: string;
        name: string;
        admission: string;
        parent_email: string;
        login_id: string;
      }>(
        `SELECT id, name, admission, parent_email, COALESCE(login_id, '') as login_id
         FROM students
         WHERE institution_id = ? AND parent_email <> '' AND status <> 'Deleted'`,
        [institutionId]
      );

      let sentCount = 0;
      for (const s of students.slice(0, 100)) {
        await sendAccountActivationEmail({
          to: s.parent_email,
          name: s.name,
          role: "STUDENT",
          institutionName,
          loginId: s.login_id || s.admission || s.parent_email,
          loginUrl: "https://eduledger.co.in/student/login",
        }).catch(() => null);
        sentCount++;
      }

      return NextResponse.json({
        success: true,
        sent: sentCount,
        total: students.length,
        message: `Dispatched activation emails to ${sentCount} student/parent contacts.`,
      });
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
