import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { z } from "zod";
import { createSession, findUserByEmail, recordUserLogin } from "@/lib/db";
import { isPrivateAdmin } from "@/lib/admin-auth";
import { SESSION_COOKIE } from "@/lib/session";
import { logServerError } from "@/lib/server-errors";
import { clearRateLimit, consumeRateLimit, rateLimitKey } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

const DUMMY_PASSWORD_HASH = "$2a$12$8l5KtqvhH0dz5.Xgqt2C5OsW.0qczNmbvweNaNfeeknN0StkH55Wq";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid administrator email and password." },
      { status: 400 },
    );
  }

  const limiterKey = rateLimitKey("admin-login", request, parsed.data.email);
  const limit = consumeRateLimit(limiterKey, 5, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  try {
    const user = await findUserByEmail(parsed.data.email);
    const passwordMatches = await compare(
      parsed.data.password,
      user?.passwordHash || DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }

    if (user.status !== "Active") {
      return NextResponse.json(
        { error: "Your administrator account has been deactivated." },
        { status: 403 },
      );
    }

    // Role and private admin verification: only authorized platform owner can access
    if (user.role !== "SUPER_ADMIN" || !isPrivateAdmin(user)) {
      return NextResponse.json(
        {
          error:
            "Access restricted to authorized EduLedger platform administrator only. School administrators and staff must use the standard Sign In portal.",
        },
        { status: 403 },
      );
    }

    const session = await createSession(user.id);
    await recordUserLogin(user.id);
    clearRateLimit(limiterKey);

    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expires,
    });

    return NextResponse.json({
      ok: true,
      user: { name: user.name, email: user.email, role: user.role },
      redirect: "/admin/dashboard",
    });
  } catch (error) {
    logServerError("admin.auth.login", error);
    return NextResponse.json(
      { error: "The administrator sign-in service is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}

