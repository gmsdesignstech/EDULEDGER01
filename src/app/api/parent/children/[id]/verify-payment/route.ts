import { NextResponse } from "next/server";
import { z } from "zod";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { getParentChildFeeInvoice, recordPayment } from "@/lib/db";
import { getRazorpayOrder, getRazorpayPayment, verifyRazorpaySignature } from "@/lib/payment";

export const runtime = "nodejs";

const schema = z.object({
  feeId: z.string().trim().min(1).max(100),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await parentApiContext(id);
  if ("response" in context) return context.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payment verification data." },
      { status: 400, headers: parentNoStore }
    );
  }

  const { feeId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  // Validate fee belongs to this student and institution
  const fee = await getParentChildFeeInvoice(context.user.institutionId, id, feeId);
  if (!fee) {
    return NextResponse.json(
      { error: "Fee not found for this student." },
      { status: 404, headers: parentNoStore }
    );
  }

  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Payment service is not configured." },
      { status: 503, headers: parentNoStore },
    );
  }
  if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret)) {
    return NextResponse.json(
      { error: "Payment signature verification failed." },
      { status: 400, headers: parentNoStore },
    );
  }

  try {
    const [order, providerPayment] = await Promise.all([
      getRazorpayOrder(razorpay_order_id),
      getRazorpayPayment(razorpay_payment_id),
    ]);
    const notes = order.notes || {};
    if (
      order.id !== razorpay_order_id ||
      order.currency !== "INR" ||
      notes.feeId !== fee.id ||
      notes.studentId !== id ||
      notes.institutionId !== context.user.institutionId ||
      notes.parentUserId !== context.user.id ||
      providerPayment.id !== razorpay_payment_id ||
      providerPayment.order_id !== razorpay_order_id ||
      providerPayment.currency !== "INR" ||
      providerPayment.status !== "captured" ||
      !providerPayment.captured ||
      providerPayment.amount !== order.amount ||
      providerPayment.amount <= 0 ||
      providerPayment.amount > Math.round(fee.pendingAmount * 100)
    ) {
      return NextResponse.json(
        { error: "Captured payment details do not match this fee invoice." },
        { status: 409, headers: parentNoStore },
      );
    }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const payment = await recordPayment(context.user.institutionId, context.user.id, {
      feeId,
      amount: providerPayment.amount / 100,
      method: "Online",
      paymentDate: today,
      transactionId: razorpay_payment_id,
      notes: `Parent Portal Razorpay: ${razorpay_order_id}`,
      requestId: `razorpay:${razorpay_payment_id}`,
    });

    return NextResponse.json(
      {
        verified: true,
        message: "Payment successfully recorded.",
        payment,
      },
      { headers: parentNoStore }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not verify or record the captured payment. Please contact the school before retrying." },
      { status: 502, headers: parentNoStore }
    );
  }
}
