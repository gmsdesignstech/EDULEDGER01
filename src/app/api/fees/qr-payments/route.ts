import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { listSchoolQrPayments, rejectSchoolQrPayment, refundSchoolQrPayment, verifySchoolQrPayment } from "@/lib/db";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

const noStore = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

const actionSchema = z.object({
  action: z.enum(["VERIFY", "REJECT", "REFUND"]),
  paymentId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers: noStore });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "All";
  const search = searchParams.get("search") || "";
  const studentId = searchParams.get("studentId") || "";
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

  try {
    const data = await listSchoolQrPayments(user.institutionId, {
      status,
      search,
      studentId,
      limit,
      offset,
    });
    return NextResponse.json(data, { headers: noStore });
  } catch (error) {
    logServerError("fees.qr-payments.list", error);
    return NextResponse.json({ error: "Failed to load QR payment requests." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers: noStore });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400, headers: noStore });
  }

  const { action, paymentId, reason, notes } = parsed.data;

  try {
    if (action === "VERIFY") {
      const result = await verifySchoolQrPayment(user.institutionId, user.id, paymentId, { notes });
      return NextResponse.json(result, { headers: noStore });
    }

    if (action === "REJECT") {
      if (!reason) {
        return NextResponse.json({ error: "Please provide a reason for rejecting this payment." }, { status: 400, headers: noStore });
      }
      const result = await rejectSchoolQrPayment(user.institutionId, user.id, paymentId, reason);
      return NextResponse.json(result, { headers: noStore });
    }

    if (action === "REFUND") {
      const result = await refundSchoolQrPayment(user.institutionId, user.id, paymentId, reason || "Payment refunded");
      return NextResponse.json(result, { headers: noStore });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400, headers: noStore });
  } catch (error) {
    logServerError("fees.qr-payments.action", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process QR payment action." },
      { status: 400, headers: noStore }
    );
  }
}
