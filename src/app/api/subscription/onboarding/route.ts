import { NextResponse } from "next/server";
import { z } from "zod";
import { getSubscription, saveSubscriptionStudentCount } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
const schema = z.object({ studentCount: z.coerce.number().int().min(1).max(100000) });

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  return NextResponse.json({ subscription: await getSubscription(user.institutionId) });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!['SCHOOL_ADMIN','SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a student count between 1 and 100,000." }, { status: 400 });
  try {
    return NextResponse.json({ subscription: await saveSubscriptionStudentCount(user.institutionId,user.id,parsed.data.studentCount) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save student count." }, { status: 409 });
  }
}
