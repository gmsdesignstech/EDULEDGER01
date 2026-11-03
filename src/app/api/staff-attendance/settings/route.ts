import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getStaffAttendanceSettings, saveStaffAttendanceSettings } from "@/lib/db";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";
const schema = z.object({ workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), lateAfterTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), breakMinutes: z.number().int().min(0).max(240), workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7), timezone: z.string().min(1).max(100), allowSelfCheckin: z.boolean(), correctionRequiresApproval: z.boolean() });

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ settings: await getStaffAttendanceSettings(user.institutionId) });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings." }, { status: 400 });
  try { return NextResponse.json({ settings: await saveStaffAttendanceSettings(user.institutionId, user.id, parsed.data) }); }
  catch (error) { logServerError("staff-attendance.settings", error); return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Select a valid") ? error.message : "Could not save attendance settings." }, { status: 400 }); }
}
