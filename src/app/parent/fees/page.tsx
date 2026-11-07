"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  Receipt,
  Upload,
  X,
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

type SchoolPaymentSettings = {
  institutionName: string;
  upiEnabled: boolean;
  upiId: string;
  payeeName: string;
  paymentMethodName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  paymentInstructions: string;
  qrCodeUrl: string;
};

type QrPaymentRecord = {
  id: string;
  feeId: string;
  amount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotAssetId: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "REFUNDED";
  rejectionReason: string;
  notes: string;
  createdAt: string;
  verifiedAt: string | null;
};

export default function ParentFeesPage() {
  const { selectedChild } = useParentContext();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<SchoolPaymentSettings | null>(null);
  const [qrPayments, setQrPayments] = useState<QrPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"invoices" | "receipts" | "qr_requests">("invoices");

  // Payment modal / processing state for Razorpay
  const [payingFee, setPayingFee] = useState<Invoice | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");

  // School QR Payment Modal state
  const [qrModalInvoice, setQrModalInvoice] = useState<Invoice | null>(null);
  const [qrAmount, setQrAmount] = useState<number>(0);
  const [qrUtr, setQrUtr] = useState<string>("");
  const [qrDate, setQrDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [qrNotes, setQrNotes] = useState<string>("");
  const [qrScreenshot, setQrScreenshot] = useState<File | null>(null);
  const [submittingQr, setSubmittingQr] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  async function loadFees() {
    if (!selectedChild?.id) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/parent/children/${selectedChild.id}/fees`);
      if (!res.ok) {
        const err = await readApiJson(res).catch(() => ({}));
        throw new Error(err.error || "Failed to load fee information.");
      }
      const data = await readApiJson(res);
      setInvoices(data.invoices || []);
      setPayments(data.payments || []);
      setReceipts(data.receipts || []);
      setSummary(data.summary || null);
      setPaymentSettings(data.paymentSettings || null);
      setQrPayments(data.qrPayments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading fees.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFees();
  }, [selectedChild?.id]);

  function openQrModal(inv: Invoice) {
    setQrModalInvoice(inv);
    setQrAmount(inv.pendingAmount);
    setQrUtr("");
    setQrDate(new Date().toISOString().slice(0, 10));
    setQrNotes("");
    setQrScreenshot(null);
    setPaymentError("");
  }

  async function handleCopyUpi() {
    if (!paymentSettings?.upiId) return;
    try {
      await navigator.clipboard.writeText(paymentSettings.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleQrSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChild?.id || !qrModalInvoice || submittingQr) return;

    const cleanUtr = qrUtr.trim();
    if (!cleanUtr || cleanUtr.length < 4) {
      setPaymentError("Please enter a valid UPI / UTR transaction reference number.");
      return;
    }
    if (!qrAmount || qrAmount <= 0 || qrAmount > qrModalInvoice.pendingAmount) {
      setPaymentError(`Please enter an amount between ₹1 and ₹${qrModalInvoice.pendingAmount}.`);
      return;
    }

    setSubmittingQr(true);
    setPaymentError("");

    try {
      const formData = new FormData();
      formData.set("feeId", qrModalInvoice.id);
      formData.set("amount", String(qrAmount));
      formData.set("utrNumber", cleanUtr);
      formData.set("paymentDate", qrDate);
      formData.set("notes", qrNotes);
      if (qrScreenshot) {
        formData.set("screenshot", qrScreenshot);
      }

      const res = await fetch(`/api/parent/children/${selectedChild.id}/qr-payment`, {
        method: "POST",
        body: formData,
      });

      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit QR payment verification.");
      }

      setPaymentSuccess(
        `Payment reference (UTR: ${cleanUtr}) submitted successfully! Your payment is awaiting school office verification.`
      );
      setQrModalInvoice(null);
      await loadFees();
      setActiveTab("qr_requests");
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to submit QR payment.");
    } finally {
      setSubmittingQr(false);
    }
  }

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

      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate payment.");
      }

      const { order } = data;

      if (typeof window !== "undefined" && typeof (window as unknown as { Razorpay?: unknown }).Razorpay === "function") {
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
          name: paymentSettings?.institutionName || "EduLedger Fee Payment",
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
        throw new Error("Secure payment checkout is unavailable. Please try again later.");
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
    razorpay_signature: string;
  }) {
    if (!selectedChild?.id) return;
    setProcessingPayment(true);
    try {
      const res = await fetch(`/api/parent/children/${selectedChild.id}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed.");
      }

      setPaymentSuccess(`Payment successful! Receipt ${data.receiptNumber || ""} generated.`);
      await loadFees();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Payment verification failed.");
    } finally {
      setProcessingPayment(false);
      setPayingFee(null);
    }
  }

  if (!selectedChild) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        Select a child from the top bar to view fee information.
      </div>
    );
  }

  const pendingQrCount = qrPayments.filter((p) => p.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Fee Center & Online Payments</h1>
          <p className="mt-1 text-xs text-muted">
            Fee structure, invoices, school QR payments, and instant settlement for {selectedChild.name}
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
              {summary.pendingFee === 0 ? "All fees are completely paid!" : "Requires payment clearance"}
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
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
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
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Receipt className="size-4" />
          Payment Receipts ({receipts.length})
        </button>
        <button
          onClick={() => setActiveTab("qr_requests")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === "qr_requests"
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <QrCode className="size-4" />
          QR Submissions ({qrPayments.length})
          {pendingQrCount > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
              {pendingQrCount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-violet-600" />
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
                  className="flex flex-col gap-4 rounded-3xl border bg-panel p-5 sm:p-6 shadow-sm transition hover:border-violet-400 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">
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
                      <div className="flex flex-wrap items-center gap-2">
                        {paymentSettings?.upiEnabled && (
                          <button
                            type="button"
                            onClick={() => openQrModal(inv)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500 bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-700 shadow-sm transition hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300"
                          >
                            <QrCode className="size-3.5" />
                            Pay via School QR
                          </button>
                        )}
                        <button
                          disabled={processingPayment}
                          onClick={() => handleInitiatePayment(inv)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50"
                        >
                          {processingPayment && payingFee?.id === inv.id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="size-3.5" />
                              Razorpay
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === "receipts" ? (
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
                    className="inline-flex items-center gap-1.5 rounded-xl border bg-canvas px-3 py-1.5 text-xs font-bold text-foreground shadow-sm transition hover:border-violet-400"
                  >
                    <Download className="size-3.5 text-violet-600" />
                    Download PDF
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {qrPayments.length === 0 ? (
            <div className="rounded-3xl border bg-panel p-12 text-center text-xs text-muted">
              No QR payment verification requests submitted yet.
            </div>
          ) : (
            qrPayments.map((qp) => (
              <div
                key={qp.id}
                className="flex flex-col gap-4 rounded-3xl border bg-panel p-5 sm:p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      UTR: {qp.utrNumber}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        qp.status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : qp.status === "REJECTED"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          : qp.status === "REFUNDED"
                          ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {qp.status === "PENDING" ? "Pending Verification" : qp.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted">Payment Date: {qp.paymentDate} • Submitted: {qp.createdAt.slice(0, 10)}</p>
                  {qp.status === "PENDING" && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      Payment submitted. The school accounts office will verify against bank statement and clear your fee.
                    </p>
                  )}
                  {qp.status === "VERIFIED" && (
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Verified by school! Receipt is available under Payment Receipts tab.
                    </p>
                  )}
                  {qp.status === "REJECTED" && (
                    <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                      Rejected reason: {qp.rejectionReason || "Please verify UTR and amount with school office."}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <span className="text-lg font-black text-foreground">
                    ₹{Number(qp.amount).toLocaleString("en-IN")}
                  </span>
                  {qp.screenshotAssetId && (
                    <a
                      href={`/api/fees/qr-payments/${qp.id}/screenshot`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      View Screenshot
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* QR Payment Modal */}
      {qrModalInvoice && paymentSettings && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pay via School QR Code"
            className="card my-8 max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 sm:p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <p className="label">School Payment Gateway</p>
                <h2 className="mt-1 text-xl font-bold">Pay Using School QR Code</h2>
                <p className="text-xs text-muted">
                  Official UPI fee collection for {paymentSettings.institutionName}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setQrModalInvoice(null)}
                className="rounded-lg p-1 text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* QR Code & UPI Details Box */}
              <div className="flex flex-col items-center rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-5 text-center dark:border-violet-900/50 dark:bg-violet-950/20">
                {paymentSettings.qrCodeUrl ? (
                  <div className="relative mb-3 flex flex-col items-center">
                    <div className="rounded-xl border bg-white p-2 shadow-sm">
                      <Image
                        unoptimized
                        src={paymentSettings.qrCodeUrl}
                        alt="School Official UPI QR Code"
                        width={180}
                        height={180}
                        className="size-44 object-contain"
                      />
                    </div>
                    <a
                      href={paymentSettings.qrCodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      download="school-payment-qr.png"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
                    >
                      <Download className="size-3.5" />
                      Download / Enlarge QR Code
                    </a>
                  </div>
                ) : (
                  <div className="mb-3 flex size-32 flex-col items-center justify-center rounded-xl border border-dashed text-muted">
                    <QrCode className="size-12 text-slate-400" />
                    <span className="mt-1 text-[11px]">QR Preview</span>
                  </div>
                )}

                <div className="w-full space-y-1">
                  <p className="text-xs font-bold text-muted">School UPI ID</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-sm font-black text-foreground">
                      {paymentSettings.upiId || "Not configured"}
                    </span>
                    {paymentSettings.upiId && (
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1 text-[11px] font-bold text-violet-700 shadow-sm hover:bg-violet-100 dark:bg-panel dark:text-violet-300"
                      >
                        {copiedUpi ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                        {copiedUpi ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted">Payee: <b className="text-foreground">{paymentSettings.payeeName}</b></p>
                </div>

                {/* Optional Bank Info */}
                {paymentSettings.accountNumber && (
                  <div className="mt-3 w-full border-t border-violet-200/60 pt-3 text-left text-xs text-muted dark:border-violet-900/40">
                    <p><b>Bank:</b> {paymentSettings.bankName || "Official School Account"}</p>
                    <p><b>A/C No:</b> {paymentSettings.accountNumber} • <b>IFSC:</b> {paymentSettings.ifscCode}</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              {paymentSettings.paymentInstructions && (
                <div className="rounded-2xl border bg-canvas/60 p-4 text-xs">
                  <b className="block text-foreground mb-1">Instructions for Parents:</b>
                  <p className="text-muted whitespace-pre-wrap">{paymentSettings.paymentInstructions}</p>
                </div>
              )}

              {/* Submission Form */}
              <form onSubmit={handleQrSubmission} className="space-y-4 border-t pt-4">
                <div className="rounded-xl bg-canvas p-3 text-xs">
                  <span className="text-muted">Student:</span> <b>{selectedChild.name}</b> ({selectedChild.className || selectedChild.grade})
                  <span className="block text-muted mt-0.5">
                    Invoice: <span className="font-mono">{qrModalInvoice.invoiceNumber}</span> • Balance: ₹{Number(qrModalInvoice.pendingAmount).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-foreground">
                    Amount Paid (₹) *
                    <input
                      type="number"
                      required
                      min={1}
                      max={qrModalInvoice.pendingAmount}
                      step="0.01"
                      value={qrAmount}
                      onChange={(e) => setQrAmount(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border p-2.5 text-sm font-semibold"
                    />
                  </label>

                  <label className="block text-xs font-bold text-foreground">
                    Payment Date *
                    <input
                      type="date"
                      required
                      value={qrDate}
                      onChange={(e) => setQrDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border p-2.5 text-sm"
                    />
                  </label>
                </div>

                <label className="block text-xs font-bold text-foreground">
                  UPI Reference / UTR Number (12 digits) *
                  <input
                    type="text"
                    required
                    maxLength={50}
                    placeholder="e.g. 402812345678 or UPI reference number"
                    value={qrUtr}
                    onChange={(e) => setQrUtr(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-2.5 font-mono text-sm uppercase"
                  />
                  <small className="mt-1 block text-[11px] font-normal text-muted">
                    Found in your Google Pay, PhonePe, or Paytm transaction details.
                  </small>
                </label>

                <label className="block text-xs font-bold text-foreground">
                  Upload Payment Screenshot (Optional)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setQrScreenshot(e.target.files?.[0] || null)}
                    className="mt-1 w-full rounded-xl border p-2 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-violet-100 file:px-2 file:py-1 file:text-xs file:font-bold file:text-violet-700"
                  />
                  {qrScreenshot && (
                    <small className="mt-1 block text-[11px] text-emerald-600 font-semibold">
                      Attached: {qrScreenshot.name} ({(qrScreenshot.size / 1024).toFixed(0)} KB)
                    </small>
                  )}
                </label>

                <label className="block text-xs font-bold text-foreground">
                  Remarks / Notes (Optional)
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="e.g. Paid via PhonePe by Father"
                    value={qrNotes}
                    onChange={(e) => setQrNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-2.5 text-sm"
                  />
                </label>

                <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setQrModalInvoice(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingQr}
                    className="btn-primary"
                  >
                    {submittingQr ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        Submit for Verification
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
