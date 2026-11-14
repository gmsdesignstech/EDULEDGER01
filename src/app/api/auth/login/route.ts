import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { z } from "zod";
import { createSession, findUserByEmailOrPhone, getSubscription, recordUserLogin } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";
import { logServerError, serverErrorCategory } from "@/lib/server-errors";
import { clearRateLimit, consumeRateLimit, rateLimitKey } from "@/lib/security";
export const runtime = "nodejs";
const schema = z.object({
  email: z.string().trim().min(3).max(128),
  password: z.string().min(8).max(128),
});
const DUMMY_PASSWORD_HASH="$2a$12$8l5KtqvhH0dz5.Xgqt2C5OsW.0qczNmbvweNaNfeeknN0StkH55Wq";
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  const limiterKey=rateLimitKey("login",request,parsed.data.email),limit=consumeRateLimit(limiterKey,5,15*60_000);
  if(!limit.allowed)return NextResponse.json(
    {error:"Too many sign-in attempts. Please try again later."},
    {status:429,headers:{"Retry-After":String(limit.retryAfterSeconds),"Cache-Control":"private, no-store"}},
  );
  try {
    const user = await findUserByEmailOrPhone(parsed.data.email);
    const passwordMatches=await compare(parsed.data.password,user?.passwordHash||DUMMY_PASSWORD_HASH);
    if (!user || user.status!=="Active" || !passwordMatches)
      return NextResponse.json(
        { error: "Email, mobile number or password is incorrect." },
        { status: 401 },
      );
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
    let subscription;
    if (user.role === "SCHOOL_ADMIN") {
      try {
        subscription = await getSubscription(user.institutionId);
      } catch (subErr) {
        logServerError("auth.login.subscription", subErr);
      }
    }
    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: Boolean(user.mustChangePassword),
        loginId: user.loginId || undefined,
      },
      subscription: subscription ? {
        status: subscription.status,
        paymentStatus: subscription.paymentStatus,
        orderId: subscription.razorpayOrderId,
      } : undefined,
    });
  } catch (error) {
    logServerError("auth.login", error);
    const category = serverErrorCategory(error);
    if (category === "database_configuration") {
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "production"
              ? "The sign-in service is temporarily unavailable. Please try again shortly."
              : "Database connection is not configured. Set DATABASE_URL in environment or .env.local.",
        },
        { status: 503 },
      );
    }
    if (category === "database_unavailable") {
      return NextResponse.json(
        {
          error: "The database service is temporarily unreachable. Please wait a moment and try again.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "The sign-in service is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}
