import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hash } from "bcryptjs";
import { z } from "zod";
import { activateParentAccount, createSession, recordUserLogin } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";
import { clearRateLimit, consumeRateLimit, rateLimitKey } from "@/lib/security";

export const runtime = "nodejs";

const schema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(128),
    invitationCode: z.string().trim().optional(),
    admission: z.string().trim().optional(),
    parentPhone: z.string().trim().optional(),
  })
  .refine(
    (data) => Boolean(data.invitationCode) || (Boolean(data.admission) && Boolean(data.parentPhone)),
    {
      message: "Please provide either an invitation code or student admission number and registered phone.",
      path: ["invitationCode"],
    }
  );

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid activation details." },
      { status: 400 }
    );
  }

  const limiterKey = rateLimitKey("parent-activate", request, parsed.data.email);
  const limit = consumeRateLimit(limiterKey, 5, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many activation attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const passwordHash = await hash(parsed.data.password, 10);
    const result = await activateParentAccount(undefined, {
      invitationCode: parsed.data.invitationCode,
      admission: parsed.data.admission,
      parentPhone: parsed.data.parentPhone,
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
    });

    const session = await createSession(result.userId);
    await recordUserLogin(result.userId);
    clearRateLimit(limiterKey);

    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expires,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Parent account activated successfully.",
        user: { id: result.userId, name: result.name, email: result.email, role: "PARENT" },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Activation failed. Please check your details." },
      { status: 400 }
    );
  }
}

