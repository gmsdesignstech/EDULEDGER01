import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { findUserByEmail, createPasswordResetToken } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { getSiteOrigin } from "@/lib/site-url";
import { consumeRateLimit, rateLimitKey } from "@/lib/security";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Enter a valid email address." },
      { status: 400 }
    );
  }

  const email = parsed.data.email;

  // Rate limit: 5 requests per 15 minutes per IP + email
  const limiterKey = rateLimitKey("forgot-password", request, email);
  const limit = consumeRateLimit(limiterKey, 5, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many reset attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
          "Cache-Control": "private, no-store",
        },
      }
    );
  }

  const genericSuccessMessage =
    "If an account is associated with this email address, a secure password reset link has been sent. Please check your inbox and spam folder.";

  try {
    const user = await findUserByEmail(email);

    // If user exists and is active, issue token and send email
    if (user && user.status !== "Inactive") {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await createPasswordResetToken(user.id, tokenHash, expiresAt);

      const origin = getSiteOrigin();
      const resetUrl = `${origin}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: 30,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: genericSuccessMessage,
      },
      { status: 200 }
    );
  } catch (error) {
    logServerError("auth.forgot-password", error);

    // If email delivery specifically failed, report user-friendly error without leaking internal details
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Outbound email service is not configured")) {
      return NextResponse.json(
        {
          error:
            "Email service is not configured on this server. Please contact your administrator.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to process password reset request at this time. Please try again later.",
      },
      { status: 500 }
    );
  }
}

