import { NextResponse } from "next/server";
import { z } from "zod";
import { listUserNotifications, markUserNotificationRead } from "@/lib/db";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";

export async function GET() {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const result = await listUserNotifications(context.user.id);
  return NextResponse.json(result, { headers: teacherNoStore });
}

const patchSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  all: z.boolean().optional(),
}).refine(x => Boolean(x.id || x.all), { message: "Provide id or all: true" });

export async function PATCH(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification update" }, { status: 400, headers: teacherNoStore });
  }
  const updated = await markUserNotificationRead(context.user.id, parsed.data.all ? undefined : parsed.data.id);
  return NextResponse.json({ ok: true, updated }, { headers: teacherNoStore });
}

