import { NextResponse } from "next/server";
import {
  activateVerifiedSubscription,
  activateVerifiedWhatsAppAddon,
  failSubscription,
  failWhatsAppAddon,
  findSubscriptionByOrder,
  findWhatsAppAddonByOrder,
  recordWebhookEvent,
} from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/subscription";
import { WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT, whatsappAddonQuote } from "@/lib/whatsapp-pricing";
import { isValidSubscriptionPricing } from "@/lib/subscription-plans";
export const runtime = "nodejs";
type RazorpayEntity = { id?: string; order_id?: string; status?: string; amount?:number; currency?:string; captured?:boolean };
type Payload = {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
};
export async function POST(request: Request) {
  const body = await request.text(),
    signature = request.headers.get("x-razorpay-signature") || "",
    secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 503 },
    );
  if (!verifyWebhookSignature(body, signature, secret))
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  let event: Payload;
  try {
    event = JSON.parse(body) as Payload;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }
  const payment = event.payload?.payment?.entity,
    orderEntity = event.payload?.order?.entity,
    orderId = payment?.order_id || orderEntity?.id,
    paymentId = payment?.id;
  if (!event.event || !orderId)
    return NextResponse.json({ received: true, ignored: true });
  const eventId =
    request.headers.get("x-razorpay-event-id") ||
    `${event.event}:${paymentId || orderId}:${event.created_at || 0}`;
  const order = await findSubscriptionByOrder(orderId);
  const whatsappAddon = order ? undefined : await findWhatsAppAddonByOrder(orderId);
  if (!order && !whatsappAddon) return NextResponse.json({ received: true, ignored: true });
  if (whatsappAddon) {
    const quote=whatsappAddonQuote(whatsappAddon.studentCount);
    if(
      !quote||
      whatsappAddon.pricePerStudent!==WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT||
      whatsappAddon.amountPaid!==quote.amount
    )return NextResponse.json({error:"WhatsApp add-on pricing validation failed."},{status:409});
    if((event.event==="payment.captured"||event.event==="order.paid")&&paymentId){
      if(payment?.amount!==Math.round(whatsappAddon.amountPaid*100)||payment.currency!=="INR"||(event.event==="payment.captured"&&payment.status!=="captured"))
        return NextResponse.json({error:"Payment details do not match the WhatsApp add-on order."},{status:409});
      await activateVerifiedWhatsAppAddon(orderId,paymentId,`webhook:${signature}`);
      if(!(await recordWebhookEvent(eventId,event.event)))return NextResponse.json({received:true,duplicate:true});
    }else if(event.event==="payment.failed"){
      await failWhatsAppAddon(orderId,"FAILED");
      if(!(await recordWebhookEvent(eventId,event.event)))return NextResponse.json({received:true,duplicate:true});
    }
    return NextResponse.json({received:true});
  }
  if (!order) return NextResponse.json({ received: true, ignored: true });
  if(!isValidSubscriptionPricing(order))return NextResponse.json({error:"Subscription pricing validation failed."},{status:409});
  if (
    (event.event === "payment.captured" || event.event === "order.paid") &&
    paymentId
  ) {
    if(payment?.amount!==Math.round(order.amountPaid*100)||payment.currency!=="INR"||(event.event==="payment.captured"&&payment.status!=="captured"))
      return NextResponse.json({error:"Payment details do not match the subscription order."},{status:409});
    await activateVerifiedSubscription(orderId, paymentId, `webhook:${signature}`);
    if (!(await recordWebhookEvent(eventId, event.event)))
      return NextResponse.json({ received: true, duplicate: true });
  } else if (event.event === "payment.failed") {
    await failSubscription(orderId, "FAILED");
    if (!(await recordWebhookEvent(eventId, event.event)))
      return NextResponse.json({ received: true, duplicate: true });
  }
  return NextResponse.json({ received: true });
}
