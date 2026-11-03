import { z } from "zod";
import { currentUser } from "@/lib/session";
import { createRazorpayOrder, PaymentServiceError, paymentErrorMessage, razorpayPublicKey } from "@/lib/payment";
import { createPendingWhatsAppAddon, findReusablePendingWhatsAppAddon, getActiveStudentCount, getSubscription, getWhatsAppAddonSubscription } from "@/lib/db";
import { isSubscriptionActive } from "@/lib/subscription";
import { whatsappAddonQuote } from "@/lib/whatsapp-pricing";

export const runtime = "nodejs";
const schema = z.object({}).strict();

export async function GET() {
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Your session has expired. Sign in again to continue.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  if (!user.institutionId)
    return Response.json(
      { error: "Your school account could not be identified. Sign in again or contact support.", code: "TENANT_CONTEXT_MISSING" },
      { status: 403 },
    );
  if (user.role === "SUPER_ADMIN")
    return Response.json(
      { error: "Super Admin is not a school tenant. Sign in with the school administrator account that owns the students to purchase this add-on.", code: "SCHOOL_TENANT_REQUIRED" },
      { status: 403 },
    );
  if (user.role !== "SCHOOL_ADMIN")
    return Response.json(
      { error: "Only a school administrator can purchase this add-on.", code: "FORBIDDEN" },
      { status: 403 },
    );

  let subscription: Awaited<ReturnType<typeof getSubscription>>;
  let activeStudentCount: number;
  let addon: Awaited<ReturnType<typeof getWhatsAppAddonSubscription>>;
  try {
    [subscription, activeStudentCount, addon] = await Promise.all([
      getSubscription(user.institutionId),
      getActiveStudentCount(user.institutionId),
      getWhatsAppAddonSubscription(user.institutionId),
    ]);
  } catch {
    console.error("WhatsApp add-on student-count lookup failed");
    return Response.json(
      { error: "The active-student count is temporarily unavailable. Please retry.", code: "STUDENT_COUNT_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const subscriptionActive = isSubscriptionActive(subscription?.status);
  const addonActive = addon?.status === "ACTIVE";

  if (!subscriptionActive) {
    return Response.json(
      {
        error: "An active EduLedger subscription is required before purchasing this add-on.",
        code: "SUBSCRIPTION_REQUIRED",
        eligible: false,
        subscriptionActive: false,
        verifiedStudentCount: activeStudentCount,
      },
      { status: 409 },
    );
  }

  if (addonActive) {
    return Response.json(
      {
        error: "The WhatsApp Communication add-on is already active for this school.",
        code: "ADDON_ALREADY_ACTIVE",
        eligible: false,
        addonActive: true,
        addon,
        verifiedStudentCount: activeStudentCount,
      },
      { status: 409 },
    );
  }

  const quote = whatsappAddonQuote(activeStudentCount);
  if (!quote || activeStudentCount < 1) {
    return Response.json({
      eligible: false,
      verifiedStudentCount: 0,
      error: "Your school currently has no eligible active students. Add or reactivate a student before checkout.",
      code: "NO_ACTIVE_STUDENTS",
    });
  }

  return Response.json({
    eligible: true,
    verifiedStudentCount: quote.studentCount,
    amount: quote.amount,
    pricePerStudent: quote.pricePerStudent,
    pricingMethod: quote.pricingMethod,
    billingPeriod: quote.billingPeriod,
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Your session has expired. Sign in again to continue.", code: "UNAUTHENTICATED" }, { status: 401 });
  if (!user.institutionId)
    return Response.json({ error: "Your school account could not be identified. Sign in again or contact support.", code: "TENANT_CONTEXT_MISSING" }, { status: 403 });
  if (user.role === "SUPER_ADMIN")
    return Response.json(
      { error: "Super Admin is not a school tenant. Sign in with the school administrator account that owns the students to purchase this add-on.", code: "SCHOOL_TENANT_REQUIRED" },
      { status: 403 },
    );
  if (user.role !== "SCHOOL_ADMIN")
    return Response.json({ error: "Only a school administrator can purchase this add-on." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Enter a valid whole number of students." }, { status: 400 });

  let subscription: Awaited<ReturnType<typeof getSubscription>>;
  let activeStudentCount: number;
  let addon: Awaited<ReturnType<typeof getWhatsAppAddonSubscription>>;
  try {
    [subscription, activeStudentCount, addon] = await Promise.all([
      getSubscription(user.institutionId),
      getActiveStudentCount(user.institutionId),
      getWhatsAppAddonSubscription(user.institutionId),
    ]);
  } catch {
    console.error("WhatsApp add-on student-count lookup failed");
    return Response.json({ error: "The active-student count is temporarily unavailable. Please retry.", code: "STUDENT_COUNT_UNAVAILABLE" }, { status: 503 });
  }
  if (!isSubscriptionActive(subscription.status))
    return Response.json({ error: "An active EduLedger subscription is required before purchasing this add-on." }, { status: 409 });
  if (addon?.status === "ACTIVE")
    return Response.json(
      { error: "The WhatsApp Communication add-on is already active for this school.", code: "ADDON_ALREADY_ACTIVE" },
      { status: 409 },
    );
  const quote = whatsappAddonQuote(activeStudentCount);
  if (!quote)
    return Response.json({ error: "Your school currently has no eligible active students. Add or reactivate a student before checkout.", code: "NO_ACTIVE_STUDENTS", verifiedStudentCount: activeStudentCount }, { status: 409 });
  try {
    const reusable = await findReusablePendingWhatsAppAddon(user.institutionId, quote.studentCount, quote.amount);
    if (reusable)
      return Response.json({ id: reusable.orderId, key: razorpayPublicKey(), amount: quote.amount * 100, currency: "INR", studentCount: quote.studentCount, pricePerStudent: quote.pricePerStudent, reused: true });
    const order = await createRazorpayOrder({
      amount: quote.amount * 100,
      receipt: `wa_${Date.now()}`,
      notes: {
        institutionId: user.institutionId,
        product: "whatsapp-addon",
        studentCount: String(quote.studentCount),
        pricePerStudent: String(quote.pricePerStudent),
      },
    });
    await createPendingWhatsAppAddon(user.institutionId, order.id, quote.studentCount, quote.amount);
    return Response.json({ ...order, studentCount: quote.studentCount, pricePerStudent: quote.pricePerStudent });
  } catch (error) {
    if (error instanceof Error && /eligible student count|price changed/i.test(error.message)) {
      const verifiedStudentCount = await getActiveStudentCount(user.institutionId);
      const updatedQuote = whatsappAddonQuote(verifiedStudentCount);
      return Response.json(
        {
          error: "The active student count changed before checkout. Review the updated total and try again.",
          code: "STUDENT_COUNT_CHANGED",
          verifiedStudentCount,
          amount: updatedQuote?.amount ?? 0,
          pricePerStudent: updatedQuote?.pricePerStudent ?? 0,
        },
        { status: 409 },
      );
    }
    if (error instanceof Error && /already active/i.test(error.message))
      return Response.json({ error: error.message, code: "ADDON_ALREADY_ACTIVE" }, { status: 409 });
    return Response.json(
      { error: paymentErrorMessage(error), code: error instanceof PaymentServiceError ? error.code : "ORDER_CREATION_FAILED" },
      { status: error instanceof PaymentServiceError ? error.status : 503 },
    );
  }
}
