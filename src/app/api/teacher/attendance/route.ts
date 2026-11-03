import { NextResponse } from "next/server";
import { z } from "zod";
import {
  classAttendanceAnalytics,
  listSchoolHolidays,
  saveStudentAttendance,
  studentAttendanceMonthlyReport,
  studentAttendanceSheet,
  teacherHasAssignment,
} from "@/lib/db";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const statusEnum = z.enum(["Present", "Absent", "Late", "Excused", "Half-day", "Half Day", "Leave"]);

const target = z.object({
  academicYear: z.string().trim().min(4).max(20),
  className: z.string().trim().min(1).max(100),
  section: z.string().trim().min(1).max(50),
  date: z.string().regex(datePattern),
});

const submission = target.extend({
  records: z.array(z.object({
    studentId: z.string().trim().min(1).max(100),
    status: statusEnum,
    remarks: z.string().trim().max(300).default(""),
  })).min(1).max(500),
  isCorrection: z.boolean().optional(),
  correctionReason: z.string().max(200).optional(),
  allowOverwrite: z.boolean().optional(),
});

export async function GET(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;

  const q = new URL(request.url).searchParams;
  const view = q.get("view") || "";
  const parsed = target.safeParse(Object.fromEntries(q));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose an assigned class, section, and valid date." }, { status: 400, headers: teacherNoStore });
  }

  // Authorize teacher assignment
  if (!teacherHasAssignment(context.scope.assignments, parsed.data)) {
    return NextResponse.json({ error: "You are not assigned to this class and section." }, { status: 403, headers: teacherNoStore });
  }

  try {
    if (view === "monthly") {
      const yearMonth = q.get("yearMonth") || parsed.data.date.slice(0, 7);
      const monthly = await studentAttendanceMonthlyReport(context.user.institutionId, {
        academicYear: parsed.data.academicYear,
        className: parsed.data.className,
        section: parsed.data.section,
        yearMonth,
      });
      return NextResponse.json({ monthly }, { headers: teacherNoStore });
    }

    if (view === "analytics") {
      const from = q.get("from") || `${parsed.data.date.slice(0, 7)}-01`;
      const to = q.get("to") || parsed.data.date;
      const analytics = await classAttendanceAnalytics(context.user.institutionId, {
        academicYear: parsed.data.academicYear,
        className: parsed.data.className,
        section: parsed.data.section,
        from,
        to,
      });
      return NextResponse.json({ analytics }, { headers: teacherNoStore });
    }

    const [students, holidays] = await Promise.all([
      studentAttendanceSheet(
        context.user.institutionId,
        parsed.data.academicYear,
        parsed.data.className,
        parsed.data.section,
        parsed.data.date
      ),
      typeof listSchoolHolidays === "function"
        ? listSchoolHolidays(context.user.institutionId, parsed.data.academicYear).catch(() => [])
        : Promise.resolve([]),
    ]);

    const holiday = holidays.find((h) => h.date === parsed.data.date);

    return NextResponse.json({
      students,
      recorded: students.some((s) => s.recorded),
      holiday: holiday ? { name: holiday.name, type: holiday.type } : null,
    }, { headers: teacherNoStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load attendance." }, { status: 400, headers: teacherNoStore });
  }
}

export async function PUT(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;

  const parsed = submission.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid attendance submission." }, { status: 400, headers: teacherNoStore });
  }

  // Prevent unauthorized teachers from modifying unassigned classes
  if (!teacherHasAssignment(context.scope.assignments, parsed.data)) {
    return NextResponse.json({ error: "You are not assigned to this class and section." }, { status: 403, headers: teacherNoStore });
  }

  try {
    const saved = await saveStudentAttendance(
      context.user.institutionId,
      context.user.id,
      parsed.data,
      {
        allowOverwrite: parsed.data.allowOverwrite ?? true,
        isCorrection: parsed.data.isCorrection ?? true,
        correctionReason: parsed.data.correctionReason,
        userRole: "TEACHER",
      }
    );
    return NextResponse.json({ saved }, { headers: teacherNoStore });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not submit attendance.";
    const status = msg.includes("window of") ? 403 : msg.includes("already submitted") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status, headers: teacherNoStore });
  }
}
