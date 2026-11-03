import { NextResponse } from "next/server";
import { z } from "zod";
import { acknowledgeNotificationDelivery } from "@/lib/db";

export const runtime = "nodejs";

const ackSchema = z.object({
  deliveryId: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deliveryId" }, { status: 400 });
  }

  try {
    const success = await acknowledgeNotificationDelivery(parsed.data.deliveryId);
    if (!success) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, delivered: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to acknowledge delivery" },
      { status: 500 }
    );
  }
}

