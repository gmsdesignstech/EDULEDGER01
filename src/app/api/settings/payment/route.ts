import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { getSchoolPaymentSettings, saveSchoolPaymentSettings } from "@/lib/db";
import { invalidateSchoolCache } from "@/lib/cached-school";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

const schema = z.object({
  upiEnabled: z.boolean().optional(),
  upiId: z.string().trim().max(100).optional(),
  payeeName: z.string().trim().max(120).optional(),
  paymentMethodName: z.string().trim().max(100).optional(),
  bankName: z.string().trim().max(100).optional(),
  accountNumber: z.string().trim().max(50).optional(),
  ifscCode: z.string().trim().max(30).optional(),
  paymentInstructions: z.string().trim().max(1000).optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (["STUDENT", "PARENT"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const settings = await getSchoolPaymentSettings(user.institutionId);
    return NextResponse.json({ settings, canEdit: ["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role) });
  } catch (error) {
    logServerError("settings.payment.get", error);
    return NextResponse.json({ error: "Failed to load payment settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payment settings" }, { status: 400 });
  }

  try {
    const settings = await saveSchoolPaymentSettings(user.institutionId, user.id, parsed.data);
    invalidateSchoolCache(user.institutionId, "settings");
    return NextResponse.json({ settings });
  } catch (error) {
    logServerError("settings.payment.save", error);
    return NextResponse.json({ error: "Failed to save payment settings." }, { status: 500 });
  }
}

