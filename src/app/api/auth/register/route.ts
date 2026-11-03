import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hash } from "bcryptjs";
import { z } from "zod";
import { registrationSchema } from "@/lib/registration-schema";
import { createAccountWithSession, findUserByEmail } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";
import { isUniqueConstraintError, logServerError, serverErrorCategory } from "@/lib/server-errors";
import { parseSubscriptionPeriod } from "@/lib/subscription";
import { consumeRateLimit, rateLimitKey } from "@/lib/security";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit=consumeRateLimit(rateLimitKey("register",request),10,60*60_000);
  if(!limit.allowed)return NextResponse.json(
    {error:"Too many registration attempts. Please try again later."},
    {status:429,headers:{"Retry-After":String(limit.retryAfterSeconds),"Cache-Control":"private, no-store"}},
  );
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid account details" },
      { status: 400 },
    );
  try {
    const period=parseSubscriptionPeriod(parsed.data.subscriptionStartMonth,parsed.data.subscriptionEndMonth);
    if (await findUserByEmail(parsed.data.email))
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
      const { user, session } = await createAccountWithSession({
        ...parsed.data,
        subscriptionStartDate:period.startDate,
        subscriptionEndDate:period.endDate,
        passwordHash: await hash(parsed.data.password, 12),
      });
    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expires,
    });
    return NextResponse.json(
      { user: { name: user.name, email: user.email, role: user.role } },
      { status: 201 },
    );
  } catch (error) {
    if(error instanceof Error&&error.message==="Please select a valid subscription period.")return NextResponse.json({error:error.message},{status:400});
    if (isUniqueConstraintError(error, "email"))
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    const category = serverErrorCategory(error);
    logServerError("auth.register", error);
    return NextResponse.json(
      {
        error:
          category === "database_unavailable" || category === "database_configuration"
            ? "The registration service is temporarily unavailable. Please try again."
            : "Registration could not be completed. Please try again.",
      },
      { status: category === "database_unavailable" || category === "database_configuration" ? 503 : 500 },
    );
  }
}
