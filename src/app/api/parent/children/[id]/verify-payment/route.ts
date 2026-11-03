import { NextResponse } from "next/server";
import { z } from "zod";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { getParentChildFeeInvoice, recordPayment } from "@/lib/db";
import { verifyRazorpaySignature } from "@/lib/payment";

export const runtime = "nodejs";

const schema = z.object({
  feeId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().optional(),
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

  const { feeId, amount, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  // Validate fee belongs to this student and institution
  const fee = await getParentChildFeeInvoice(context.user.institutionId, id, feeId);
  if (!fee) {
    return NextResponse.json(
      { error: "Fee not found for this student." },
      { status: 404, headers: parentNoStore }
    );
  }

  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (secret && razorpay_signature) {
    const verified = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret);
    if (!verified) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400, headers: parentNoStore }
      );
    }
  }

  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const payment = await recordPayment(context.user.institutionId, context.user.id, {
      feeId,
      amount,
      method: "Online",
      paymentDate: today,
      transactionId: razorpay_payment_id,
      notes: `Parent Portal Razorpay: ${razorpay_order_id}`,
    });

    return NextResponse.json(
      {
        verified: true,
        message: "Payment successfully recorded.",
        payment,
      },
      { headers: parentNoStore }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record payment." },
      { status: 400, headers: parentNoStore }
    );
  }
}
