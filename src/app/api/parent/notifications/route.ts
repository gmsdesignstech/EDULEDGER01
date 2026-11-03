import { NextResponse } from "next/server";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { listUserNotifications, markUserNotificationRead } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  const context = await parentApiContext();
  if ("response" in context) return context.response;

  const data = await listUserNotifications(context.user.id, 50);
  return NextResponse.json(
    { notifications: data.items, unread: data.unread },
    { headers: parentNoStore }
  );
}

const markSchema = z.object({
  id: z.string().optional(),
});

export async function POST(request: Request) {
  const context = await parentApiContext();
  if ("response" in context) return context.response;

  const body = await request.json().catch(() => ({}));
  const parsed = markSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await markUserNotificationRead(context.user.id, parsed.data.id);
  const updated = await listUserNotifications(context.user.id, 50);
  return NextResponse.json(
    { success: true, unread: updated.unread },
    { headers: parentNoStore }
  );
}

