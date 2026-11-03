"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useParentContext } from "@/components/parent-context";

type Invoice = {
  id: string;
  invoiceNumber: string;
  feeType: string;
  academicYear: string;
  originalAmount: number;
  discount: number;
  lateFee: number;
  finalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: string;
};

type PaymentRecord = {
  id: string;
  receiptNumber: string;
  feeId: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  paymentDate: string;
  status: string;
  notes: string;
};

type ReceiptRecord = {
  id: string;
  receiptNumber: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  issuedDate: string;
  status: string;
};

type FeeSummary = {
  totalFee: number;
  paidFee: number;
  pendingFee: number;
};

export default function ParentFeesPage() {
  const { selectedChild } = useParentContext();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"invoices" | "receipts">("invoices");

  // Payment modal / processing state
  const [payingFee, setPayingFee] = useState<Invoice | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");

  async function loadFees() {
    if (!selectedChild?.id) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/parent/children/${selectedChild.id}/fees`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load fee information.");
      }
      const data = await res.json();
      setInvoices(data.invoices || []);
      setPayments(data.payments || []);
      setReceipts(data.receipts || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading fees.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFees();
  }, [selectedChild?.id]);

  async function handleInitiatePayment(inv: Invoice) {
    if (!selectedChild?.id) return;
    setPayingFee(inv);
    setPaymentError("");
    setPaymentSuccess(null);
    setProcessingPayment(true);

    try {
      const res = await fetch(`/api/parent/children/${selectedChild.id}/pay-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeId: inv.id, amount: inv.pendingAmount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate payment.");
      }

      const { order, isMock } = data;

      // Handle Razorpay checkout if standard gateway or mock fallback
      if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay && !isMock) {
        // Standard Razorpay checkout
        type RazorpayOptions = {
          key: string;
          amount: number;
          currency: string;
          name: string;
          description: string;
          order_id: string;
          handler: (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => Promise<void>;
          prefill?: { name?: string };
        };

        const RazorpayClass = (window as unknown as { Razorpay: new (opts: RazorpayOptions) => { open: () => void } }).Razorpay;
        const rzp = new RazorpayClass({
          key: order.key,
          amount: order.amount,
          currency: order.currency,
          name: "EduLedger Fee Payment",
          description: `Fee Payment for ${inv.invoiceNumber}`,
          order_id: order.id,
          handler: async (response) => {
            await verifyPayment({
              feeId: inv.id,
              amount: inv.pendingAmount,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
          },
        });
        rzp.open();
        setProcessingPayment(false);
      } else {
        // Direct simulation / verification for test environments
        await verifyPayment({
          feeId: inv.id,
          amount: inv.pendingAmount,
          razorpay_order_id: order.id,
          razorpay_payment_id: `pay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        });
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Payment failed.");
      setProcessingPayment(false);
    }
  }

  async function verifyPayment(payload: {
    feeId: string;
    amount: number;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature?: string;
  }) {
    if (!selectedChild?.id) return;
    try {
      const res = await fetch(`/api/parent/children/${selectedChild.id}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed.");
      }

      setPaymentSuccess(`Payment of ₹${Number(payload.amount).toLocaleString("en-IN")} received! Receipt issued.`);
      setPayingFee(null);
      await loadFees();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Payment verification failed.");
    } finally {
      setProcessingPayment(false);
    }
  }

  if (!selectedChild) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        Select a child from the top bar to view fee information.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Fee Center & Online Payments</h1>
          <p className="mt-1 text-xs text-muted">
            Fee structure, invoices, and instant Razorpay settlement for {selectedChild.name}
          </p>
        </div>

        {summary && summary.pendingFee > 0 && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-4" />
            <span>₹{Number(summary.pendingFee).toLocaleString("en-IN")} Pending Clearance</span>
          </div>
        )}
      </div>

      {paymentSuccess && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            <span>{paymentSuccess}</span>
          </div>
          <button
            onClick={() => setPaymentSuccess(null)}
            className="text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {paymentError && (
        <div className="flex items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-bold text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            <span>{paymentError}</span>
          </div>
          <button
            onClick={() => setPaymentError("")}
            className="text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border bg-panel p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Fee Obligation</p>
            <p className="mt-2 text-3xl font-black text-foreground">
              ₹{Number(summary.totalFee).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-muted">All assigned fee heads for the academic session</p>
          </div>

          <div className="rounded-3xl border bg-panel p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Total Paid Fees</p>
            <p className="mt-2 text-3xl font-black text-emerald-600">
              ₹{Number(summary.paidFee).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-muted">Settled and verified receipts</p>
          </div>

          <div className="rounded-3xl border bg-panel p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Pending Dues</p>
            <p className="mt-2 text-3xl font-black text-rose-600">
              ₹{Number(summary.pendingFee).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {summary.pendingFee === 0 ? "All fees are completely paid!" : "Requires online clearance"}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === "invoices"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          Fee Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("receipts")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === "receipts"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Receipt className="size-4" />
          Payment Receipts ({receipts.length})
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      ) : activeTab === "invoices" ? (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="rounded-3xl border bg-panel p-12 text-center text-xs text-muted">
              No fee invoices currently assigned.
            </div>
          ) : (
            invoices.map((inv) => {
              const isPaid = inv.status === "Paid" || inv.pendingAmount <= 0;
              const isOverdue = inv.status === "Overdue";
              return (
                <div
                  key={inv.id}
                  className="flex flex-col gap-4 rounded-3xl border bg-panel p-5 sm:p-6 shadow-sm transition hover:border-blue-400 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {inv.invoiceNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : isOverdue
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground">{inv.feeType}</h3>
                    <div className="flex flex-wrap gap-4 text-xs text-muted pt-1">
                      <span>Total: ₹{Number(inv.finalAmount).toLocaleString("en-IN")}</span>
                      <span>Paid: ₹{Number(inv.paidAmount).toLocaleString("en-IN")}</span>
                      <span>Due: {inv.dueDate || "Standard"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] font-medium text-muted">Remaining Balance</span>
                      <p
                        className={`text-xl font-black ${
                          isPaid ? "text-emerald-600" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        ₹{Number(inv.pendingAmount).toLocaleString("en-IN")}
                      </p>
                    </div>

                    {!isPaid && (
                      <button
                        disabled={processingPayment}
                        onClick={() => handleInitiatePayment(inv)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
                      >
                        {processingPayment && payingFee?.id === inv.id ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="size-3.5" />
                            Pay Now
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {receipts.length === 0 ? (
            <div className="rounded-3xl border bg-panel p-12 text-center text-xs text-muted">
              No payment receipts found.
            </div>
          ) : (
            receipts.map((rec) => (
              <div
                key={rec.id}
                className="flex flex-col gap-4 rounded-3xl border bg-panel p-5 sm:p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {rec.receiptNumber}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {rec.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    Invoice: <span className="font-mono">{rec.invoiceNumber}</span> • Method: {rec.paymentMethod}
                  </p>
                  <p className="text-[11px] text-muted">Date: {rec.issuedDate}</p>
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <span className="text-lg font-black text-foreground">
                    ₹{Number(rec.amount).toLocaleString("en-IN")}
                  </span>
                  <a
                    href={`/api/receipts/${encodeURIComponent(rec.receiptNumber)}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border bg-canvas px-3 py-1.5 text-xs font-bold text-foreground shadow-sm transition hover:border-blue-400"
                  >
                    <Download className="size-3.5 text-blue-600" />
                    Download PDF
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

