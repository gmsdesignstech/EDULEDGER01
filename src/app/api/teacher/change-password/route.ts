import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { queryRow, queryRun } from "@/lib/db";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .max(128, "Password must not exceed 128 characters."),
  confirmPassword: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const sessionUser = await currentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    if (sessionUser.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden: Teacher access required." }, { status: 403 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input." },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword, confirmPassword } = parsed.data;

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation password do not match." },
        { status: 400 },
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "Your new password must be different from your temporary password." },
        { status: 400 },
      );
    }

    const userRecord = await queryRow<{ id: string; passwordHash: string }>(
      'SELECT id, password_hash AS "passwordHash" FROM users WHERE id = ?',
      [sessionUser.id],
    );

    if (!userRecord) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const passwordMatches = await compare(currentPassword, userRecord.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: "The temporary or current password you entered is incorrect." },
        { status: 400 },
      );
    }

    const newHash = await hash(newPassword, 10);
    await queryRun(
      "UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?",
      [newHash, sessionUser.id],
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. You can now use your new password.",
    });
  } catch (error) {
    logServerError("teacher.changePassword", error);
    return NextResponse.json(
      { error: "Could not change password. Please try again." },
      { status: 500 },
    );
  }
}
