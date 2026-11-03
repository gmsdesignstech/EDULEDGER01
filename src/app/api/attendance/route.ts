import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addSchoolHoliday,
  classAttendanceAnalytics,
  deleteSchoolHoliday,
  listAttendanceAuditHistory,
  listSchoolHolidays,
  saveStudentAttendance,
  studentAttendanceMonthlyReport,
  studentAttendanceSheet,
  studentAttendanceSummary,
} from "@/lib/db";
import { cachedCompleteSettings, cachedTimetableSettings } from "@/lib/cached-school";
import { currentUser } from "@/lib/session";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";
const roles = ["SCHOOL_ADMIN", "SUPER_ADMIN"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const statusEnum = z.enum(["Present", "Absent", "Late", "Excused", "Half-day", "Half Day", "Leave"]);

const saveSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  className: z.string().trim().min(1),
  section: z.string().trim().min(1),
  date: z.string().regex(datePattern),
  records: z.array(z.object({
    studentId: z.string().min(1),
    status: statusEnum,
    remarks: z.string().trim().max(300).default(""),
  })).max(500),
  isCorrection: z.boolean().optional(),
  correctionReason: z.string().max(200).optional(),
  allowOverwrite: z.boolean().optional(),
});

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!roles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [settings, timetableSettings] = await Promise.all([
    cachedCompleteSettings(user.institutionId),
    cachedTimetableSettings(user.institutionId),
  ]);
  const q = new URL(request.url).searchParams;
  const view = q.get("view") || "";
  const academicYear = q.get("academicYear") || settings.academicYear;
  const className = q.get("className") || "";
  const section = q.get("section") || "";
  const date = q.get("date") || "";

  try {
    // 1. Audit History view
    if (view === "audit") {
      const history = await listAttendanceAuditHistory(user.institutionId, {
        academicYear: academicYear || undefined,
        className: className || undefined,
        section: section || undefined,
        date: date || undefined,
        studentId: q.get("studentId") || undefined,
        limit: 100,
      });
      return NextResponse.json({ history });
    }

    // 2. School Holidays view
    if (view === "holidays") {
      const holidays = await listSchoolHolidays(user.institutionId, academicYear);
      return NextResponse.json({ holidays });
    }

    // 3. Monthly Report view
    if (view === "monthly") {
      const yearMonth = q.get("yearMonth") || (date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7));
      if (!className || !section) {
        return NextResponse.json({ error: "Choose a class and section for the monthly report." }, { status: 400 });
      }
      const monthly = await studentAttendanceMonthlyReport(user.institutionId, {
        academicYear,
        className,
        section,
        yearMonth,
      });
      return NextResponse.json({
        monthly,
        years: settings.years.filter((item) => item.status === "Active").map((item) => item.name),
        classes: settings.classes.filter((item) => item.active).map((item) => ({ name: item.name, sections: item.sections })),
      });
    }

    // 4. Class Analytics view
    if (view === "analytics") {
      const from = q.get("from") || `${date.slice(0, 7)}-01`;
      const to = q.get("to") || date;
      const analytics = await classAttendanceAnalytics(user.institutionId, {
        academicYear,
        className: className || undefined,
        section: section || undefined,
        from,
        to,
      });
      return NextResponse.json({ analytics });
    }

    // 5. Date range summary view
    const from = q.get("from");
    const to = q.get("to");
    if (from && to) {
      if (!validDate(from) || !validDate(to) || from > to) {
        return NextResponse.json({ error: "Choose a valid attendance date range." }, { status: 400 });
      }
      const summary = await studentAttendanceSummary(user.institutionId, {
        academicYear,
        from,
        to,
        className: className || undefined,
        section: section || undefined,
      });
      return NextResponse.json({
        academicYear,
        timezone: timetableSettings.timezone,
        years: settings.years.filter((item) => item.status === "Active").map((item) => item.name),
        classes: settings.classes.filter((item) => item.active).map((item) => ({ name: item.name, sections: item.sections })),
        summary,
        canEdit: roles.includes(user.role),
      });
    }

    // 6. Day-wise attendance sheet view
    if (date && !validDate(date)) {
      return NextResponse.json({ error: "Choose a valid attendance date." }, { status: 400 });
    }
    const [students, holidays] = await Promise.all([
      className && section && date ? studentAttendanceSheet(user.institutionId, academicYear, className, section, date) : [],
      date ? listSchoolHolidays(user.institutionId, academicYear) : [],
    ]);
    const holidayForDate = holidays.find((h) => h.date === date);

    return NextResponse.json({
      academicYear,
      timezone: timetableSettings.timezone,
      years: settings.years.filter((item) => item.status === "Active").map((item) => item.name),
      classes: settings.classes.filter((item) => item.active).map((item) => ({ name: item.name, sections: item.sections })),
      students,
      recorded: students.some((item) => item.recorded),
      holiday: holidayForDate ? { name: holidayForDate.name, type: holidayForDate.type } : null,
      correctionWindowHours: (settings as any).attendanceCorrectionWindowHours || 24,
      canEdit: roles.includes(user.role),
    });
  } catch (error) {
    logServerError("attendance.get", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load attendance." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!roles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid attendance data." }, { status: 400 });
  }
  if (!validDate(parsed.data.date)) {
    return NextResponse.json({ error: "Choose a valid attendance date." }, { status: 400 });
  }

  try {
    const saved = await saveStudentAttendance(
      user.institutionId,
      user.id,
      parsed.data,
      {
        allowOverwrite: parsed.data.allowOverwrite,
        isCorrection: parsed.data.isCorrection,
        correctionReason: parsed.data.correctionReason,
        userRole: user.role,
      }
    );
    return NextResponse.json({ saved });
  } catch (error) {
    logServerError("attendance.save", error);
    const msg = error instanceof Error ? error.message : "Unable to save attendance.";
    const status = msg.includes("already submitted") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!roles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || body.action !== "add_holiday") {
    return NextResponse.json({ error: "Invalid attendance action." }, { status: 400 });
  }

  const holidaySchema = z.object({
    academicYear: z.string().min(4),
    date: z.string().regex(datePattern),
    name: z.string().trim().min(1).max(100),
    type: z.enum(["Public Holiday", "School Holiday", "Vacation", "Weather Emergency", "Administrative"]).optional(),
    description: z.string().trim().max(300).optional(),
  });
  const parsed = holidaySchema.safeParse(body.holiday);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid holiday data." }, { status: 400 });
  }

  try {
    const created = await addSchoolHoliday(user.institutionId, user.id, parsed.data);
    return NextResponse.json({ holiday: created }, { status: 201 });
  } catch (error) {
    logServerError("attendance.holiday.add", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save holiday." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!roles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(request.url).searchParams;
  const holidayId = q.get("holidayId");
  if (!holidayId) return NextResponse.json({ error: "Missing holidayId parameter." }, { status: 400 });

  try {
    await deleteSchoolHoliday(user.institutionId, user.id, holidayId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("attendance.holiday.delete", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete holiday." }, { status: 400 });
  }
}
