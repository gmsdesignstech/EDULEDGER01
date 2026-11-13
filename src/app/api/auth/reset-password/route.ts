import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/db";
import { consumeRateLimit, rateLimitKey } from "@/lib/security";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(16, "Invalid reset token."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .max(128, "Password cannot exceed 128 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Validates a reset token without consuming it (used for page load verification).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || token.trim().length < 16) {
    return NextResponse.json(
      { valid: false, error: "Missing or invalid password reset token." },
      { status: 400 }
    );
  }

  try {
    const tokenHash = createHash("sha256").update(token.trim()).digest("hex");
    const result = await verifyPasswordResetToken(tokenHash);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error || "Invalid or expired reset token." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: result.user?.email,
      name: result.user?.name,
    });
  } catch (error) {
    logServerError("auth.reset-password.verify", error);
    return NextResponse.json(
      { valid: false, error: "Unable to verify reset token at this time." },
      { status: 500 }
    );
  }
}

/**
 * Consumes the reset token and updates the user's password.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  // Rate limit: 10 attempts per 15 minutes per IP
  const limiterKey = rateLimitKey("reset-password", request, token.slice(0, 16));
  const limit = consumeRateLimit(limiterKey, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many password update attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
          "Cache-Control": "private, no-store",
        },
      }
    );
  }

  try {
    const tokenHash = createHash("sha256").update(token.trim()).digest("hex");
    const newPasswordHash = await hash(password, 10);

    const result = await consumePasswordResetToken(tokenHash, newPasswordHash);

    return NextResponse.json(
      {
        success: true,
        message: "Your password has been successfully updated. You can now sign in.",
        user: {
          email: result.user?.email,
          name: result.user?.name,
          role: result.user?.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logServerError("auth.reset-password.consume", error);
    const msg = error instanceof Error ? error.message : "Password reset failed.";
    return NextResponse.json(
      { error: msg },
      { status: 400 }
    );
  }
}

