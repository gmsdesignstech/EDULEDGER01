import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { registerDeviceToken, revokeDeviceToken } from "@/lib/db";

export const runtime = "nodejs";

const registerSchema = z.object({
  token: z.string().trim().min(10).max(4096),
  deviceType: z.string().trim().max(50).default("web"),
  userAgent: z.string().trim().max(300).default(""),
});

const revokeSchema = z.object({
  token: z.string().trim().min(10).max(4096),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !user.institutionId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid token payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await registerDeviceToken(
      user.institutionId,
      user.id,
      parsed.data.token,
      parsed.data.deviceType,
      parsed.data.userAgent || request.headers.get("user-agent") || ""
    );
    return NextResponse.json({ ok: true, deviceToken: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to register device token" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
  }

  try {
    const success = await revokeDeviceToken(parsed.data.token, user.id);
    return NextResponse.json({ ok: true, revoked: success });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke device token" },
      { status: 500 }
    );
  }
}

