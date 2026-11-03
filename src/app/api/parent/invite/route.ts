import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { createParentInvitation } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  studentId: z.string().uuid("Valid student ID required."),
  parentName: z.string().trim().min(2, "Parent name required."),
  parentEmail: z.string().trim().toLowerCase().email("Valid email required."),
  parentPhone: z.string().trim().optional(),
  expiresInDays: z.coerce.number().min(1).max(90).default(14),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid invitation payload." },
      { status: 400 }
    );
  }

  try {
    const invitation = await createParentInvitation(user.institutionId, user.id, parsed.data);
    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate parent invitation." },
      { status: 400 }
    );
  }
}

