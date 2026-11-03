"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { SubscriptionSummary } from "@/lib/db";
import type { SubscriptionPlan } from "@/lib/subscription-plans";
import {
  ANNUAL_PRICE_PER_STUDENT,
  formatInr,
  STARTER_ANNUAL_PRICE,
  STARTER_PLAN_ID,
  STARTER_STUDENT_LIMIT,
  annualSubscriptionPlan,
} from "@/lib/subscription-plans";
import { parseApiResponse } from "@/lib/api-response";
type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayInstance = {
  open: () => void;
  on: (
    event: string,
    callback: (response: { error?: { description?: string } }) => void,
  ) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}
async function loadRazorpay() {
  if (window.Razorpay) return true;
  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
async function api<T>(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  const data = await parseApiResponse<T & { error?: string }>(
    response,
    "The payment server could not complete this request. Please try again.",
  );
  return { response, data };
}
export function ActivationPanel({
  subscription,
  schoolName,
  compact = false,
  onActivated,
  successHref = "/dashboard",
  initialPlanId,
}: {
  plans: readonly SubscriptionPlan[];
  initialPlanId: string;
  subscription: SubscriptionSummary;
  schoolName: string;
  compact?: boolean;
  onActivated?: () => void;
  successHref?: string;
}) {
  const router = useRouter(),
    busy = useRef(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState<SubscriptionSummary | null>(null),
    count = subscription.billingStudentCount,
    quote = annualSubscriptionPlan(count),
    isStarter = quote?.id === STARTER_PLAN_ID,
    pricePerStudent = quote?.pricePerStudent ?? ANNUAL_PRICE_PER_STUDENT,
    amount = quote?.price ?? 0,
    eligible = Boolean(quote);
  const periodSummary = (
    <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-black text-slate-900">School Subscription Period</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Summary label="School" value={schoolName} />
        <Summary
          label="Subscription Period"
          value={period(subscription.activationDate, subscription.expiryDate)}
        />
        <Summary
          label="Subscription Start"
          value={date(subscription.activationDate)}
        />
        <Summary
          label="Subscription End"
          value={date(subscription.expiryDate)}
        />
        <Summary label="Amount" value={eligible ? formatInr(amount) : "Enrollment required"} />
      </dl>
    </section>
  );
  function finish(text: string) {
    busy.current = false;
    setLoading(false);
    setMessage(text);
  }
  async function cancel(id: string) {
    if (id)
      await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      }).catch(() => undefined);
  }
  async function checkout() {
    if (busy.current || !eligible) return;
    busy.current = true;
    setLoading(true);
    setMessage("");
    let orderId = "";
    try {
      if (!(await loadRazorpay()))
        throw new Error("Secure checkout could not be loaded.");
      const { data: order } = await api<{
        id: string;
        key: string;
        amount: number;
        currency: string;
        verified?: boolean;
      }>("/api/subscription/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      orderId = order.id;
      if(order.verified){
        busy.current=false;
        setLoading(false);
        router.replace(`/payment/success?product=subscription&order=${encodeURIComponent(orderId)}&next=${encodeURIComponent(successHref)}`);
        router.refresh();
        return;
      }
      if (!window.Razorpay) throw new Error("Secure checkout is unavailable.");
      const instance = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "EduLedger",
        description: isStarter
          ? "EduLedger Starter · fixed annual school subscription"
          : `Annual subscription · ${count} students`,
        order_id: order.id,
        prefill: { name: schoolName },
        retry: { enabled: true, max_count: 2 },
        theme: { color: "#059669" },
        modal: {
          confirm_close: true,
          ondismiss: () =>
            finish("Payment was cancelled. You can retry when ready."),
        },
        handler: async (result: RazorpayResult) => {
          try {
            const { response, data } = await api<{
              error?: string;
              subscription?: SubscriptionSummary;
            }>("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            if (response.status === 202)
              return finish(data.error || "Payment is awaiting confirmation.");
            if (data.subscription) {
              busy.current = false;
              setLoading(false);
              onActivated?.();
              router.replace(`/payment/success?product=subscription&order=${encodeURIComponent(orderId)}&next=${encodeURIComponent(successHref)}`);
              router.refresh();
            } else finish("Payment verification is still pending.");
          } catch (error) {
            finish(
              error instanceof Error
                ? error.message
                : "Payment verification failed.",
            );
          }
        },
      });
      instance.on("payment.failed", (response) => {
        void cancel(orderId);
        finish(
          response.error?.description ||
            "Payment was not completed. Please retry.",
        );
      });
      instance.open();
    } catch (error) {
      finish(
        error instanceof Error ? error.message : "Unable to start payment.",
      );
    }
  }
  if (success)
    return (
      <section className="mx-auto my-12 max-w-xl rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-xl">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-8" />
        </span>
        <h1 className="mt-5 text-3xl font-black text-slate-950">
          Payment Successful
        </h1>
        <p className="mt-2 text-slate-600">
          {schoolName}&apos;s EduLedger subscription payment was verified.
        </p>
        <dl className="mt-7 grid grid-cols-2 gap-3 text-left">
          <Summary
            label="Students at purchase"
            value={String(
              success.studentCountAtPurchase || success.studentUsage,
            )}
          />
          <Summary
            label="Pricing"
            value={
              success.pricingModel === "FIXED"
                ? "Fixed annual school fee"
                : `${formatInr(success.pricePerStudent)} / student / year`
            }
          />
          <Summary label="Amount paid" value={formatInr(success.amountPaid)} />
          <Summary
            label="Payment ID"
            value={success.razorpayPaymentId || "Verified"}
          />
          <Summary label="Valid until" value={date(success.expiryDate)} />
        </dl>
        <button
          onClick={() => {
            router.replace(successHref);
            router.refresh();
          }}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 font-extrabold text-white"
        >
          Continue <ArrowRight className="size-4" />
        </button>
      </section>
    );
  const card = (
    <section data-initial-plan={initialPlanId} className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl sm:p-8">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-700">
        <Users className="size-4" />
        {isStarter ? "EduLedger Starter" : "EduLedger annual subscription"}
      </span>
      <h2 className="mt-5 text-3xl font-black text-slate-950">
        {!eligible
          ? "Complete enrollment setup"
          : isStarter
          ? `${formatInr(STARTER_ANNUAL_PRICE)} per academic year`
          : `${formatInr(pricePerStudent)} per student / year`}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        {!eligible
          ? "Checkout unlocks after the school has a persisted expected enrollment or at least one active student."
          : isStarter
          ? "1–100 eligible students: fixed ₹10,000 per academic year. More than 100 eligible students: ₹100 per student per academic year."
          : "₹100 per eligible student per academic year for schools with more than 100 eligible students."}
      </p>
      <dl className="mt-7 grid gap-3 rounded-3xl border bg-slate-50 p-5 sm:grid-cols-2">
        <Summary
          label="Eligible students for billing"
          value={count ? count.toLocaleString("en-IN") : "Not configured"}
        />
        <Summary
          label="Plan limit"
          value={
            isStarter
              ? "Up to 100 eligible students"
              : eligible
                ? `${subscription.studentCapacity || count} students`
                : "Not established"
          }
        />
        <Summary label="Billing interval" value="One academic year" />
        <Summary label="Taxes" value="No separate tax configured" />
        <div className="sm:col-span-2">
          <Summary label="Final payable amount" value={eligible ? formatInr(amount) : "Enrollment required"} />
        </div>
      </dl>
      {isStarter && count >= 90 && eligible && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Your school has {count} of {STARTER_STUDENT_LIMIT} Starter student places in use.
        </p>
      )}
      {!count && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p>Enter the school&apos;s expected enrollment during registration, or add an active student, before starting checkout.</p>
          <Link href="/dashboard/settings" className="mt-3 inline-flex rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white">Complete school setup</Link>
        </div>
      )}
      {count > STARTER_STUDENT_LIMIT && isStarter && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Your school has {count} eligible students and is not eligible for
          Starter. Select an eligible higher-capacity plan. No automatic upgrade
          or additional charge will occur.
        </p>
      )}
      {message && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {message}
        </p>
      )}
      <button
        disabled={loading || !eligible}
        onClick={() => void checkout()}
        className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 font-extrabold text-white disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <LockKeyhole className="size-5" />
        )}
        {loading
          ? "Opening secure checkout…"
          : eligible
            ? isStarter
              ? `Choose Starter · ${formatInr(amount)}`
              : `Continue with existing plan · ${formatInr(amount)}`
            : "Enrollment required"}
      </button>
      <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
        <ShieldCheck className="size-4 text-emerald-600" />
        Eligibility and payment amount are verified by the server before
        Razorpay checkout
      </p>
    </section>
  );
  if (compact)
    return (
      <>
        {periodSummary}
        {card}
      </>
    );
  return (
    <section className="pb-16 pt-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">
          EduLedger Payment
        </p>
        <h1 className="mt-3 text-4xl font-black text-slate-950">
          Annual Subscription Checkout
        </h1>
        <p className="mt-3 text-slate-500">
          Review the school, selected subscription period, student count and
          total before continuing to Razorpay.
        </p>
      </div>
      <div className="mx-auto mt-9 max-w-xl">
        {periodSummary}
        {card}
      </div>
    </section>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-black text-slate-900">{value}</dd>
    </div>
  );
}
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(value),
      )
    : "—";
}
function period(start: string | null, end: string | null) {
  if (!start || !end) return "Not selected";
  const format = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${format.format(new Date(start))} – ${format.format(new Date(end))}`;
}
