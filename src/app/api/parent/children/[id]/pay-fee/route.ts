import { NextResponse } from "next/server";
import { z } from "zod";
import { parentApiContext, parentNoStore } from "@/lib/parent-auth";
import { createRazorpayOrder, PaymentServiceError } from "@/lib/payment";
import { getParentChildFeeInvoice } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  feeId: z.string().uuid(),
  amount: z.coerce.number().positive().optional(),
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
      { error: parsed.error.issues[0]?.message || "Invalid payment request." },
      { status: 400, headers: parentNoStore }
    );
  }

  const fee = await getParentChildFeeInvoice(context.user.institutionId, id, parsed.data.feeId);

  if (!fee) {
    return NextResponse.json(
      { error: "Fee invoice not found for this student." },
      { status: 404, headers: parentNoStore }
    );
  }

  if (fee.pendingAmount <= 0 || fee.status === "Paid") {
    return NextResponse.json(
      { error: "This fee invoice is already fully settled." },
      { status: 400, headers: parentNoStore }
    );
  }

  const payAmount = parsed.data.amount
    ? Math.min(parsed.data.amount, fee.pendingAmount)
    : fee.pendingAmount;

  try {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    if (keyId && /^rzp_(test|live)_/.test(keyId)) {
      const order = await createRazorpayOrder({
        amount: Math.round(payAmount * 100),
        receipt: fee.invoiceNumber,
        notes: {
          feeId: fee.id,
          studentId: id,
          parentUserId: context.user.id,
        },
      });
      return NextResponse.json(
        {
          order: {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: order.key,
          },
          feeId: fee.id,
          invoiceNumber: fee.invoiceNumber,
          payAmount,
        },
        { headers: parentNoStore }
      );
    } else {
      // Offline / Test mock order for local testing or unconfigured gateways
      const mockOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return NextResponse.json(
        {
          order: {
            id: mockOrderId,
            amount: Math.round(payAmount * 100),
            currency: "INR",
            key: "rzp_test_placeholder",
          },
          feeId: fee.id,
          invoiceNumber: fee.invoiceNumber,
          payAmount,
          isMock: true,
        },
        { headers: parentNoStore }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PaymentServiceError
            ? error.message
            : "Payment gateway service is currently unavailable. Please try again.",
      },
      { status: 502, headers: parentNoStore }
    );
  }
}
