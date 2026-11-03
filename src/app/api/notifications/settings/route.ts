import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getSchoolNotificationSettings, updateSchoolNotificationSettings } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user || !user.institutionId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const settings = await getSchoolNotificationSettings(user.institutionId);
    return NextResponse.json({ settings, canEdit: ["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load notification settings" },
      { status: 500 }
    );
  }
}

const updateSettingsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  studentAbsent: z.boolean().optional(),
  attendanceCorrection: z.boolean().optional(),
  feePayment: z.boolean().optional(),
  feeReminders: z.boolean().optional(),
  homework: z.boolean().optional(),
  examResults: z.boolean().optional(),
  announcements: z.boolean().optional(),
  teacherLeave: z.boolean().optional(),
});

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || !user.institutionId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification settings payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const updated = await updateSchoolNotificationSettings(user.institutionId, parsed.data);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notification settings" },
      { status: 500 }
    );
  }
}

