import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { deleteStaffAttendance, getStaffAttendanceRecord, getStaffAttendanceSettings, saveStaffAttendance } from "@/lib/db";
import { staffAttendanceStatuses } from "@/lib/staff-time";
import { isUniqueConstraintError, logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";
const schema = z.object({ staffKey: z.string().max(100), date: z.string(), status: z.enum(staffAttendanceStatuses as [typeof staffAttendanceStatuses[number], ...typeof staffAttendanceStatuses[number][]]), checkInTime: z.string().default(""), checkOutTime: z.string().default(""), overnight: z.boolean().default(false), breakMinutes: z.coerce.number().int().min(0).max(240).optional(), remarks: z.string().trim().max(500).default("") });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const admin = ["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role);
  if (!admin) {
    const settings = await getStaffAttendanceSettings(user.institutionId);
    const existing = await getStaffAttendanceRecord(user.institutionId, (await params).id);
    if (!settings.allowSelfCheckin || settings.correctionRequiresApproval || existing?.staffKey !== `user:${user.id}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid attendance details." }, { status: 400 });
  if (!admin && parsed.data.staffKey !== `user:${user.id}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { return NextResponse.json({ record: await saveStaffAttendance(user.institutionId, user.id, parsed.data, (await params).id) }); }
  catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Attendance already exists for this staff member and date." }, { status: 409 });
    if (error instanceof Error && /^(Select|Enter|This status|Check-in|Checkout|Break must|Attendance record|Staff member)/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    logServerError("staff-attendance.update", error);
    return NextResponse.json({ error: "Could not update staff attendance." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return await deleteStaffAttendance(user.institutionId, user.id, (await params).id)
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
}
