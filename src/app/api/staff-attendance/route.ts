import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getStaffAttendanceSettings, saveStaffAttendance, staffAttendanceData, staffClockAction } from "@/lib/db";
import { schoolParts, staffAttendanceStatuses, validDate } from "@/lib/staff-time";
import { isUniqueConstraintError, logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";
const admins = new Set(["SCHOOL_ADMIN", "SUPER_ADMIN"]);
const viewers = new Set(["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]);
const markSchema = z.object({
  action: z.literal("mark"), staffKey: z.string().max(100), date: z.string(),
  status: z.enum(staffAttendanceStatuses as [typeof staffAttendanceStatuses[number], ...typeof staffAttendanceStatuses[number][]]),
  checkInTime: z.string().default(""), checkOutTime: z.string().default(""), overnight: z.boolean().default(false),
  breakMinutes: z.coerce.number().int().min(0).max(240).optional(), remarks: z.string().trim().max(500).default(""),
});
const clockSchema = z.object({ action: z.enum(["checkin", "checkout"]), staffKey: z.string().max(100).optional() });

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const settings = await getStaffAttendanceSettings(user.institutionId);
  const isAdmin = admins.has(user.role), canViewAll = viewers.has(user.role);
  if (!canViewAll && !settings.allowSelfCheckin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const q = new URL(request.url).searchParams;
    const date = validDate(q.get("date") || schoolParts(new Date(), settings.timezone).date);
    const month = q.get("month") || date.slice(0, 7);
    const staffKey = canViewAll ? q.get("staffKey") || undefined : `user:${user.id}`;
    const data = await staffAttendanceData(user.institutionId, date, month, staffKey);
    return NextResponse.json({ ...data, people: canViewAll ? data.people : data.people.filter(item => item.key === staffKey), canEdit: isAdmin, canClock: isAdmin || settings.allowSelfCheckin, selfKey: `user:${user.id}` });
  } catch (error) {
    if (error instanceof Error && /^(Select|Enter)/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    logServerError("staff-attendance.list", error);
    return NextResponse.json({ error: "Could not load attendance." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = z.union([markSchema, clockSchema]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid attendance details." }, { status: 400 });
  const isAdmin = admins.has(user.role);
  if (parsed.data.action === "mark" && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await getStaffAttendanceSettings(user.institutionId);
  if (parsed.data.action !== "mark" && !isAdmin && (!settings.allowSelfCheckin || parsed.data.staffKey && parsed.data.staffKey !== `user:${user.id}`)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const record = parsed.data.action === "mark"
      ? await saveStaffAttendance(user.institutionId, user.id, parsed.data)
      : await staffClockAction(user.institutionId, user.id, isAdmin ? parsed.data.staffKey || "" : `user:${user.id}`, parsed.data.action);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Attendance is already marked for this staff member and date." }, { status: 409 });
    if (error instanceof Error && /^(Select|Enter|This status|Check-in|Checkout|No active|Staff member|Attendance is already|Break must|This local time)/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    logServerError("staff-attendance.create", error);
    return NextResponse.json({ error: "Could not save staff attendance." }, { status: 500 });
  }
}
