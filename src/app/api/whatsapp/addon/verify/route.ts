import { paymentSignatureSchema } from "@/lib/validation";
import { activateVerifiedWhatsAppAddon, findWhatsAppAddonByOrder } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getRazorpayPayment, PaymentServiceError, paymentErrorMessage, verifyRazorpaySignature } from "@/lib/payment";
import { WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT, whatsappAddonQuote } from "@/lib/whatsapp-pricing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "SCHOOL_ADMIN" || !user.institutionId)
    return Response.json({ error: "Only a school administrator can verify this purchase." }, { status: 403 });
  const parsed = paymentSignatureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid payment payload" }, { status: 400 });
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return Response.json({ error: "Payment service unavailable" }, { status: 503 });
  const orderId = parsed.data.razorpay_order_id;
  const paymentId = parsed.data.razorpay_payment_id;
  const order = await findWhatsAppAddonByOrder(orderId);
  if (!order || order.institutionId !== user.institutionId)
    return Response.json({ error: "Payment order not found" }, { status: 404 });
  if (!verifyRazorpaySignature(orderId, paymentId, parsed.data.razorpay_signature, secret))
    return Response.json({ error: "Signature verification failed" }, { status: 401 });
  const quote = whatsappAddonQuote(order.studentCount);
  if (
    !quote ||
    order.pricePerStudent !== WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT ||
    order.amountPaid !== quote.amount
  )
    return Response.json({ error: "WhatsApp add-on pricing validation failed." }, { status: 409 });

  try {
    const payment = await getRazorpayPayment(paymentId);
    if (payment.order_id !== orderId || payment.amount !== Math.round(order.amountPaid * 100) || payment.currency !== "INR")
      return Response.json({ error: "Payment details do not match this order." }, { status: 409 });
    if (payment.status !== "captured" && !payment.captured)
      return Response.json({ error: "Payment is verified but awaiting capture." }, { status: 202 });
    return Response.json({
      verified: true,
      addon: await activateVerifiedWhatsAppAddon(orderId, paymentId, parsed.data.razorpay_signature),
    });
  } catch (error) {
    if (error instanceof PaymentServiceError && (error.code === "UNREACHABLE" || error.status >= 500))
      return Response.json({ error: "Payment was received and is awaiting confirmation from Razorpay." }, { status: 202 });
    return Response.json({ error: paymentErrorMessage(error) }, { status: 502 });
  }
}
