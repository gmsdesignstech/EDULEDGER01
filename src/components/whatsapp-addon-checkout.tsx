"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, LockKeyhole, Minus, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { formatInr } from "@/lib/subscription-plans";
import {
  WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT,
  WHATSAPP_ADDON_MAX_STUDENTS,
  whatsappAddonQuote,
  type WhatsAppAddonQuote,
} from "@/lib/whatsapp-pricing";

type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

async function loadRazorpay() {
  if (typeof window === "undefined") return false;
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

type VerificationState =
  | { status: "loading"; verifiedCount: null; error: null }
  | { status: "error"; verifiedCount: null; error: string; code?: string }
  | { status: "zero_students"; verifiedCount: 0; error: string }
  | { status: "verified"; verifiedCount: number; quote: WhatsAppAddonQuote; error: null };

export function WhatsAppAddonCheckout({
  schoolName,
  initialStudentCount,
  minimumStudentCount = 1,
  urlRequestedStudentCount,
}: {
  schoolName: string;
  initialStudentCount?: number;
  minimumStudentCount?: number;
  urlRequestedStudentCount?: number;
}) {
  const router = useRouter();
  const [verification, setVerification] = useState<VerificationState>({
    status: "loading",
    verifiedCount: null,
    error: null,
  });

  // Manual calculator state (for simulation / what-if analysis)
  const [calculatorCount, setCalculatorCount] = useState<number>(() => {
    return Math.min(
      WHATSAPP_ADDON_MAX_STUDENTS,
      Math.max(1, urlRequestedStudentCount ?? initialStudentCount ?? minimumStudentCount ?? 1),
    );
  });

  const [message, setMessage] = useState("");
  const [paying, setPaying] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [success, setSuccess] = useState<null | {
    studentCount: number;
    pricePerStudent: number;
    amountPaid: number;
    expiryDate: string;
  }>(null);
  const busy = useRef(false);

  const fetchAuthoritativeCount = useCallback(async () => {
    setVerification({ status: "loading", verifiedCount: null, error: null });
    setMessage("");
    try {
      const response = await fetch("/api/whatsapp/addon/order", {
        method: "GET",
        credentials: "same-origin",
      });
      const data = await response.json();

      if (!response.ok) {
        const errMessage = data.error || "The active-student count is temporarily unavailable. Please retry.";
        setVerification({ status: "error", verifiedCount: null, error: errMessage, code: data.code });
        return;
      }

      if (data.code === "NO_ACTIVE_STUDENTS" || data.verifiedStudentCount === 0 || !data.eligible) {
        setVerification({
          status: "zero_students",
          verifiedCount: 0,
          error: data.error || "Your school currently has no eligible active students. Add or reactivate a student before checkout.",
        });
        return;
      }

      const verified = Number(data.verifiedStudentCount);
      const quote = whatsappAddonQuote(verified);
      if (!quote) {
        setVerification({
          status: "zero_students",
          verifiedCount: 0,
          error: "Your school currently has no eligible active students. Add or reactivate a student before checkout.",
        });
        return;
      }

      setVerification({
        status: "verified",
        verifiedCount: verified,
        quote,
        error: null,
      });

      setCalculatorCount(verified);
    } catch {
      setVerification({
        status: "error",
        verifiedCount: null,
        error: "The active-student count is temporarily unavailable. Please retry.",
      });
    }
  }, []);

  useEffect(() => {
    void fetchAuthoritativeCount();
  }, [fetchAuthoritativeCount]);

  function handleCalculatorChange(value: number) {
    const next = Math.trunc(value);
    setCalculatorCount(Math.min(WHATSAPP_ADDON_MAX_STUDENTS, Math.max(1, next || 1)));
  }

  function finish(text: string) {
    busy.current = false;
    setPaying(false);
    setMessage(text);
  }

  async function continueAsSchoolAdministrator() {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    setMessage("");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      const destination = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(destination)}`);
      router.refresh();
    }
  }

  async function checkout() {
    if (busy.current || paying || verification.status !== "verified") return;
    const authoritativeCount = verification.verifiedCount;
    if (!authoritativeCount || authoritativeCount < 1) return;

    busy.current = true;
    setPaying(true);
    setMessage("");
    let orderId = "";
    try {
      if (!(await loadRazorpay())) throw new Error("Secure checkout could not be loaded.");

      const orderResponse = await fetch("/api/whatsapp/addon/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const order = (await orderResponse.json()) as {
        id?: string;
        key?: string;
        amount?: number;
        currency?: string;
        error?: string;
        code?: string;
        verifiedStudentCount?: number;
        studentCount?: number;
        pricePerStudent?: number;
      };

      if (!orderResponse.ok || !order.id || !order.key) {
        if (order.code === "STUDENT_COUNT_CHANGED" && typeof order.verifiedStudentCount === "number") {
          const newCount = order.verifiedStudentCount;
          const newQuote = whatsappAddonQuote(newCount);
          if (newQuote && newCount > 0) {
            setVerification({
              status: "verified",
              verifiedCount: newCount,
              quote: newQuote,
              error: null,
            });
            setCalculatorCount(newCount);
          } else {
            setVerification({
              status: "zero_students",
              verifiedCount: 0,
              error: "Your school currently has no eligible active students. Add or reactivate a student before checkout.",
            });
          }
        } else if (order.code === "NO_ACTIVE_STUDENTS") {
          setVerification({
            status: "zero_students",
            verifiedCount: 0,
            error: "Your school currently has no eligible active students. Add or reactivate a student before checkout.",
          });
        }
        throw new Error(order.error || "Unable to create the WhatsApp add-on order.");
      }

      if (order.studentCount !== authoritativeCount) {
        const updatedQuote = whatsappAddonQuote(Number(order.studentCount));
        if (!updatedQuote) throw new Error("The updated active-student count is not eligible for checkout.");
        setVerification({
          status: "verified",
          verifiedCount: updatedQuote.studentCount,
          quote: updatedQuote,
          error: null,
        });
        setCalculatorCount(updatedQuote.studentCount);
        return finish("Your active-student count changed. Review the updated annual total, then select Pay again. You will not be charged twice.");
      }

      orderId = order.id;
      if (!window.Razorpay) throw new Error("Secure checkout is unavailable.");

      const instance = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "EduLedger",
        description: `WhatsApp Communication Add-on · ${authoritativeCount} students`,
        order_id: order.id,
        prefill: { name: schoolName },
        retry: { enabled: true, max_count: 2 },
        theme: { color: "#059669" },
        modal: {
          confirm_close: true,
          ondismiss: () => finish("Payment was cancelled. You can retry when ready."),
        },
        handler: async (result: RazorpayResult) => {
          try {
            const response = await fetch("/api/whatsapp/addon/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const body = (await response.json()) as {
              error?: string;
              addon?: {
                studentCount: number;
                pricePerStudent: number;
                amountPaid: number;
                expiryDate: string;
              };
            };
            if (response.status === 202) return finish(body.error || "Payment is awaiting confirmation.");
            if (!response.ok || !body.addon) throw new Error(body.error || "Payment verification failed.");
            busy.current = false;
            setPaying(false);
            router.replace(`/payment/success?product=whatsapp&order=${encodeURIComponent(orderId)}&next=${encodeURIComponent("/dashboard")}`);
            router.refresh();
          } catch (error) {
            finish(error instanceof Error ? error.message : "Payment verification failed.");
          }
        },
      });

      instance.on("payment.failed", (response) => {
        if (orderId) {
          void fetch("/api/whatsapp/addon/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
        }
        finish(response.error?.description || "Payment was not completed. Please retry.");
      });

      instance.open();
    } catch (error) {
      finish(error instanceof Error ? error.message : "Unable to start payment.");
    }
  }

  if (success) {
    return (
      <section className="rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-xl">
        <Check className="mx-auto size-14 rounded-full bg-emerald-100 p-3 text-emerald-700" />
        <h1 className="mt-5 text-3xl font-black">WhatsApp add-on activated</h1>
        <p className="mt-2 text-slate-600">
          {success.studentCount.toLocaleString("en-IN")} students · {success.studentCount <= 100 ? "fixed annual price" : `${formatInr(success.pricePerStudent)} per student per year`}
        </p>
        <p className="mt-2 font-black text-emerald-700">{formatInr(success.amountPaid)} paid</p>
      </section>
    );
  }

  const previewQuote = whatsappAddonQuote(calculatorCount);
  const verifiedCount = verification.verifiedCount;
  const verifiedQuote = verification.status === "verified" ? verification.quote : null;
  const billedAmount = verifiedQuote ? verifiedQuote.amount : null;

  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">WhatsApp Communication Add-on</p>
        {verification.status === "verified" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
            <Check className="size-3.5" /> Verified Enrollment: {verifiedCount?.toLocaleString("en-IN")} Active Students
          </span>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-black">WhatsApp annual pricing</h1>
      <p className="mt-2 text-slate-500">
        Checkout uses your school&apos;s authoritative database enrollment. The server re-validates the active student count before creating the payment order.
      </p>

      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
        Schools with 1–100 active students pay a fixed ₹10,000 per academic year. Schools with more than 100 active students pay ₹100 per active student per academic year.
      </div>

      {/* Loading state */}
      {verification.status === "loading" && (
        <div role="status" aria-live="polite" className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-8 text-center">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
          <p className="mt-3 font-bold text-slate-700">Verifying school active enrollment and eligibility…</p>
          <p className="mt-1 text-xs text-slate-500">Checking your school&apos;s authoritative database student records.</p>
        </div>
      )}

      {/* Recoverable query failure */}
      {verification.status === "error" && (
        <div role="alert" className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold">
                {verification.code === "SCHOOL_TENANT_REQUIRED"
                  ? "School administrator account required"
                  : "Active student count temporarily unavailable"}
              </h3>
              <p className="mt-1 text-sm text-amber-900">{verification.error}</p>
              {verification.code === "SCHOOL_TENANT_REQUIRED" ? (
                <button
                  type="button"
                  onClick={() => void continueAsSchoolAdministrator()}
                  disabled={switchingAccount}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-70"
                >
                  {switchingAccount ? <Loader2 className="size-3.5 animate-spin" /> : <LockKeyhole className="size-3.5" />}
                  {switchingAccount ? "Switching account…" : "Continue with a school administrator account"}
                </button>
              ) : <button
                type="button"
                id="retry-verification-button"
                onClick={() => void fetchAuthoritativeCount()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-800 transition"
              >
                <RefreshCw className="size-3.5" /> Retry verification
              </button>}
            </div>
          </div>
        </div>
      )}

      {/* Verified zero active students (Ineligible) */}
      {verification.status === "zero_students" && (
        <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-6 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <h3 className="font-bold">No eligible active students found</h3>
              <p className="mt-1 text-sm text-rose-800">{verification.error}</p>
              <p className="mt-3 text-xs text-rose-700 font-medium">
                EduLedger requires at least 1 verified active student to purchase the WhatsApp communication add-on. Please add or reactivate students in your school dashboard first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive pricing view (shown when verified) */}
      {verification.status === "verified" && verifiedQuote && (
        <>
          {/* Distinct Authoritative Enrollment Card */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-black uppercase text-slate-500">Verified Database Enrollment</span>
                <p className="text-2xl font-black text-slate-900">
                  {verifiedCount?.toLocaleString("en-IN")} Active {verifiedCount === 1 ? "Student" : "Students"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs font-black uppercase text-slate-500">Billed Annual Total</span>
                <p className="text-2xl font-black text-emerald-700">{formatInr(verifiedQuote.amount)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              {verifiedQuote.pricingMethod === "fixed"
                ? `1–100 students: Fixed annual rate of ₹10,000/year covers your ${verifiedCount} enrolled active student${verifiedCount === 1 ? "" : "s"}.`
                : `${verifiedCount} active students × ${formatInr(WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT)}/student/year = ${formatInr(verifiedQuote.amount)}/year.`}
            </p>
          </div>

          {/* Optional manual preview calculator for what-if scenarios */}
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <label htmlFor="whatsapp-addon-students" className="text-xs font-black uppercase text-slate-500">
                Calculator Preview (What-if simulation)
              </label>
              {calculatorCount !== verifiedCount && (
                <button
                  type="button"
                  onClick={() => setCalculatorCount(verifiedCount!)}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  Reset to verified ({verifiedCount})
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCalculatorChange(calculatorCount - 1)}
                disabled={calculatorCount <= 1}
                aria-label="Remove one student"
                className="grid size-11 place-items-center rounded-xl border bg-white disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <input
                id="whatsapp-addon-students"
                type="number"
                min={1}
                max={WHATSAPP_ADDON_MAX_STUDENTS}
                step={1}
                value={calculatorCount}
                onChange={(event) => handleCalculatorChange(Number(event.target.value))}
                className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-center text-lg font-black"
              />
              <button
                type="button"
                onClick={() => handleCalculatorChange(calculatorCount + 1)}
                disabled={calculatorCount >= WHATSAPP_ADDON_MAX_STUDENTS}
                aria-label="Add one student"
                className="grid size-11 place-items-center rounded-xl border bg-white disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>
            {previewQuote && (
              <p className="mt-2 text-right text-xs text-slate-500">
                Simulation: {calculatorCount.toLocaleString("en-IN")} students = {formatInr(previewQuote.amount)}/yr
                {calculatorCount !== verifiedCount && (
                  <span className="block text-amber-700 font-medium">
                    Note: Your school will be billed {formatInr(verifiedQuote.amount)} based on your {verifiedCount} verified active students.
                  </span>
                )}
              </p>
            )}
          </div>
        </>
      )}

      {message && (
        <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </p>
      )}

      {/* Pay button */}
      <button
        type="button"
        id="pay-whatsapp-addon-button"
        onClick={() => void checkout()}
        disabled={paying || verification.status !== "verified"}
        className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 font-extrabold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {paying ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Opening secure checkout…
          </>
        ) : verification.status === "loading" ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Verifying eligibility…
          </>
        ) : verification.status === "verified" && billedAmount !== null ? (
          <>
            <LockKeyhole className="size-5" />
            Pay {formatInr(billedAmount)} for {verifiedCount} verified student{verifiedCount === 1 ? "" : "s"}
          </>
        ) : (
          <>
            <LockKeyhole className="size-5" />
            Checkout unavailable
          </>
        )}
      </button>
    </section>
  );
}
