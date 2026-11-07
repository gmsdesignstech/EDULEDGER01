"use client";

import { readApiJson } from "@/lib/api-response";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  IndianRupee,
  Loader2,
  Printer,
  QrCode,
  Search,
  X,
} from "lucide-react";
import { DeleteRecordButton } from "./delete-record-button";
import { useEduCache } from "./edu-cache-provider";

type Fee = {
  id: string;
  studentId: string;
  studentName: string;
  admission: string;
  rollNumber: string;
  parent: string;
  className: string;
  section: string;
  invoiceNumber: string;
  feeType: string;
  academicYear: string;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: string;
  latestReceipt: string | null;
};

type Payment = {
  id: string;
  feeId: string;
  studentId: string;
  studentName: string;
  admission: string;
  className: string;
  section: string;
  academicYear: string;
  invoiceNumber: string;
  receiptNumber: string;
  amount: number;
  method: string;
  paymentFrequency: string;
  originalAmount: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  discountReason: string;
  lateFee: number;
  netPayable: number;
  transactionId: string;
  paymentDate: string;
  status: string;
  notes: string;
  previouslyPaid: number;
  remainingBalance: number;
};

type QrPayment = {
  id: string;
  studentId: string;
  studentName: string;
  admission: string;
  rollNumber: string;
  className: string;
  section: string;
  photoPath: string | null;
  feeId: string;
  invoiceNumber: string;
  feeType: string;
  feeTotalAmount: number;
  feePaidAmount: number;
  feePendingAmount: number;
  amount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotAssetId: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "REFUNDED";
  rejectionReason: string;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  paymentId: string | null;
  receiptNumber: string | null;
  notes: string;
  createdAt: string;
};

type Options = {
  currentYear: string;
  years: string[];
  classes: { name: string; sections: string[] }[];
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

const selectClass = "rounded-xl border bg-panel px-3 py-2.5 text-sm";
const paymentMethods = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Online", "Other"];
const frequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly", "Custom"];
const feeStatuses = ["Paid", "Partially Paid", "Pending", "Overdue"];
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function Payments({ history = false }: { history?: boolean }) {
  const { invalidate } = useEduCache();
  const [tab, setTab] = useState<"fees" | "history" | "qr">(history ? "history" : "fees");
  const [options, setOptions] = useState<Options | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [qrPayments, setQrPayments] = useState<QrPayment[]>([]);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [year, setYear] = useState("");
  const [feeStatus, setFeeStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("All");
  const [qrStatus, setQrStatus] = useState("All");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [recentPeriod, setRecentPeriod] = useState("");
  const [studentId, setStudentId] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState("");
  const [paidStudentId, setPaidStudentId] = useState("");
  const [selected, setSelected] = useState<Fee | null>(null);
  const [chooseFee, setChooseFee] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // QR Review Modal
  const [reviewingQr, setReviewingQr] = useState<QrPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("tab") === "history") setTab("history");
    if (params.get("tab") === "qr") setTab("qr");
    if (params.get("search")) setQuery(params.get("search") || "");
    if (params.get("studentId")) setStudentId(params.get("studentId") || "");
    const period = params.get("period");
    if (["day", "week", "month", "year"].includes(period || "")) {
      const end = new Date();
      const start = new Date(end);
      if (period === "week") start.setDate(end.getDate() - 6);
      if (period === "month") start.setMonth(end.getMonth(), 1);
      if (period === "year") start.setMonth(0, 1);
      setFrom(iso(start));
      setTo(iso(end));
      setRecentPeriod(period || "");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void fetch("/api/finance/options", { cache: "no-store" })
      .then(async (response) => {
        const body = await readApiJson(response);
        if (!response.ok) throw new Error(body.error || "Could not load finance filters.");
        setOptions(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load finance filters."));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const common = new URLSearchParams();
      if (search) common.set("search", search);
      if (className) common.set("class", className);
      if (section) common.set("section", section);
      if (year) common.set("year", year);

      const feeParams = new URLSearchParams(common);
      if (feeStatus) feeParams.set("status", feeStatus);

      const paymentParams = new URLSearchParams(common);
      paymentParams.set("status", paymentStatus);
      if (studentId) paymentParams.set("studentId", studentId);
      if (method) paymentParams.set("method", method);
      if (from) paymentParams.set("from", from);
      if (to) paymentParams.set("to", to);

      const qrParams = new URLSearchParams();
      if (search) qrParams.set("search", search);
      if (qrStatus) qrParams.set("status", qrStatus);
      if (studentId) qrParams.set("studentId", studentId);

      const [feeResponse, paymentResponse, qrResponse] = await Promise.all([
        fetch(`/api/fees?${feeParams}`, { cache: "no-store" }),
        fetch(`/api/student-payments?${paymentParams}`, { cache: "no-store" }),
        fetch(`/api/fees/qr-payments?${qrParams}`, { cache: "no-store" }),
      ]);

      const [feeBody, paymentBody, qrBody] = await Promise.all([
        readApiJson(feeResponse),
        readApiJson(paymentResponse),
        readApiJson(qrResponse),
      ]);

      if (!feeResponse.ok || !paymentResponse.ok) {
        throw new Error(feeBody.error || paymentBody.error || "Could not load finance records.");
      }

      setFees(feeBody.fees || []);
      setPayments(paymentBody.payments || []);
      setQrPayments(qrBody.items || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load finance records.");
    } finally {
      setLoading(false);
    }
  }, [search, className, section, year, feeStatus, paymentStatus, qrStatus, studentId, method, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, className, section, year, feeStatus, paymentStatus, qrStatus, method, from, to, studentId]);

  const sections = useMemo(
    () =>
      className
        ? options?.classes.find((item) => item.name === className)?.sections || []
        : [...new Set(options?.classes.flatMap((item) => item.sections) || [])].sort(),
    [options, className]
  );

  const feeRows = useMemo(
    () =>
      [...fees].sort((a, b) =>
        sort === "student"
          ? a.studentName.localeCompare(b.studentName)
          : sort === "balance"
          ? b.pendingAmount - a.pendingAmount
          : a.dueDate.localeCompare(b.dueDate)
      ),
    [fees, sort]
  );

  const paymentRows = useMemo(
    () =>
      [...payments].sort((a, b) =>
        sort === "student"
          ? a.studentName.localeCompare(b.studentName)
          : sort === "amount"
          ? b.amount - a.amount
          : b.paymentDate.localeCompare(a.paymentDate)
      ),
    [payments, sort]
  );

  const qrRows = useMemo(
    () =>
      [...qrPayments].sort((a, b) =>
        sort === "student"
          ? a.studentName.localeCompare(b.studentName)
          : sort === "amount"
          ? b.amount - a.amount
          : b.createdAt.localeCompare(a.createdAt)
      ),
    [qrPayments, sort]
  );

  const rows = tab === "fees" ? feeRows : tab === "history" ? paymentRows : qrRows;
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const visible = rows.slice((page - 1) * 10, page * 10);
  const successPayments = payments.filter((item) => item.status === "Success");
  const today = new Date().toISOString().slice(0, 10);

  const totals = {
    invoiced: fees.reduce((sum, item) => sum + Number(item.finalAmount), 0),
    paid: fees.reduce((sum, item) => sum + Number(item.paidAmount), 0),
    balance: fees.reduce((sum, item) => sum + Number(item.pendingAmount), 0),
    today: successPayments.filter((item) => item.paymentDate.slice(0, 10) === today).reduce((sum, item) => sum + Number(item.amount), 0),
    month: successPayments.filter((item) => item.paymentDate.slice(0, 7) === today.slice(0, 7)).reduce((sum, item) => sum + Number(item.amount), 0),
  };

  const pendingQrCount = qrPayments.filter((item) => item.status === "PENDING").length;

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (className) exportParams.set("class", className);
  if (section) exportParams.set("section", section);
  if (year) exportParams.set("year", year);
  if (tab === "fees" && feeStatus) exportParams.set("status", feeStatus);
  if (tab === "history") {
    exportParams.set("status", paymentStatus);
    if (method) exportParams.set("method", method);
    if (from) exportParams.set("from", from);
    if (to) exportParams.set("to", to);
  }

  function reset() {
    setQuery("");
    setSearch("");
    setClassName("");
    setSection("");
    setYear("");
    setFeeStatus("");
    setPaymentStatus("All");
    setQrStatus("All");
    setMethod("");
    setFrom("");
    setTo("");
    setRecentPeriod("");
    setStudentId("");
  }

  function choose(fee: Fee) {
    setSelected(fee);
    setChooseFee(false);
    setError("");
    setNotice("");
  }

  async function pay(form: HTMLFormElement) {
    if (!selected || saving) return;
    const fields = new FormData(form);
    const amount = Number(fields.get("amount"));
    const paymentMethod = String(fields.get("method"));

    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(selected.pendingAmount)) {
      setError("Enter an amount within the outstanding balance.");
      return;
    }

    if (
      !window.confirm(
        `Confirm payment?\n\nStudent: ${selected.studentName}\nFee: ${selected.feeType}\nAmount: ${money(
          amount
        )}\nMethod: ${paymentMethod}\nRemaining balance: ${money(Number(selected.pendingAmount) - amount)}`
      )
    )
      return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/student-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId: selected.id,
          amount,
          method: paymentMethod,
          frequency: String(fields.get("frequency")),
          discountType: String(fields.get("discountType")),
          discountValue: Number(fields.get("discountValue") || 0),
          discountReason: String(fields.get("discountReason") || ""),
          lateFee: Number(fields.get("lateFee") || 0),
          paymentDate: String(fields.get("paymentDate")),
          transactionId: String(fields.get("transactionId") || ""),
          notes: String(fields.get("notes") || ""),
          requestId: String(fields.get("requestId")),
        }),
      });

      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error || "Unable to complete payment. Please try again.");

      setReceipt(body.payment.receiptNumber);
      setPaidStudentId(body.payment.studentId);
      setNotice(`Payment completed successfully. Receipt ${body.payment.receiptNumber} is ready.`);
      setSelected(null);
      await load();
      await invalidate("/api/students", "/api/classes", "/api/accounts", "/api/cash-book", "/api/salaries", "/api/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete payment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyQr(qrItem: QrPayment) {
    if (actionLoading) return;
    if (
      !window.confirm(
        `Verify QR Payment of ${money(qrItem.amount)} for ${qrItem.studentName} (UTR: ${qrItem.utrNumber})?\n\nThis will record the payment, generate official receipt, and record exactly one income entry in the Cash Book.`
      )
    )
      return;

    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fees/qr-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY", paymentId: qrItem.id }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Verification failed.");

      setNotice(`QR Payment verified successfully! Official receipt ${data.receiptNumber || ""} generated.`);
      if (data.receiptNumber) setReceipt(data.receiptNumber);
      setReviewingQr(null);
      await load();
      await invalidate("/api/students", "/api/classes", "/api/accounts", "/api/cash-book", "/api/salaries", "/api/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to verify QR payment.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectQr(qrItem: QrPayment) {
    if (actionLoading) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Please enter a reason for rejecting this payment.");
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fees/qr-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", paymentId: qrItem.id, reason }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Rejection failed.");

      setNotice(`Payment UTR ${qrItem.utrNumber} rejected. No financial or cash book impact.`);
      setReviewingQr(null);
      setRejectReason("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to reject QR payment.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Finance</p>
          <h1 className="mt-2 text-3xl font-black">
            {tab === "fees" ? "Fee Collection" : tab === "history" ? "Payments & History" : "QR Payment Verification"}
          </h1>
          <p className="mt-1 text-muted">
            Manage student fees, collections, QR verification queue, and automated accounting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "fees" && (
            <button className="btn-primary" onClick={() => setChooseFee(true)}>
              <IndianRupee className="size-4" />
              Collect Fee
            </button>
          )}
          {tab !== "qr" && (
            <>
              <a className="btn-secondary" href={`/api/export?type=${tab === "fees" ? "fees" : "payments"}&format=xlsx&${exportParams}`}>
                <Download className="size-4" />
                Export Excel
              </a>
              <a className="btn-secondary" href={`/api/export?type=${tab === "fees" ? "fees" : "payments"}&format=csv&${exportParams}`}>
                Export CSV
              </a>
            </>
          )}
        </div>
      </header>

      <div role="tablist" aria-label="Finance records" className="flex flex-wrap gap-2">
        <button
          role="tab"
          aria-selected={tab === "fees"}
          className={tab === "fees" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("fees")}
        >
          Fee Collection
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          className={tab === "history" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("history")}
        >
          Payments & History
        </button>
        <button
          role="tab"
          aria-selected={tab === "qr"}
          className={tab === "qr" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("qr")}
        >
          <QrCode className="size-4" />
          QR Payment Verification
          {pendingQrCount > 0 && (
            <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {pendingQrCount}
            </span>
          )}
        </button>
        <Link className="btn-secondary" href="/dashboard/import?type=payments">
          <FileText className="size-4" />
          Import Fee Data
        </Link>
        <a className="btn-secondary" href="/api/export?type=payments&format=xlsx&template=1">
          <Download className="size-4" />
          Sample Excel Template
        </a>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          {receipt && (
            <>
              <Link href={`/dashboard/receipts/${encodeURIComponent(receipt)}`} className="font-bold underline">
                View receipt
              </Link>
              <a href={`/api/receipts/${encodeURIComponent(receipt)}/pdf`} className="font-bold underline">
                Download PDF
              </a>
            </>
          )}
          {paidStudentId && (
            <Link
              href={`/dashboard/students/${paidStudentId}/id-card`}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 font-bold text-white"
            >
              View Student ID Card
            </Link>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total fees", money(totals.invoiced)],
          ["Amount paid", money(totals.paid)],
          ["Outstanding", money(totals.balance)],
          ["Pending QR Verifications", pendingQrCount],
          ["Fully paid", fees.filter((item) => item.status === "Paid").length],
          ["Partially paid", fees.filter((item) => item.status === "Partially Paid").length],
          ["Today collections", money(totals.today)],
          ["This month collections", money(totals.month)],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-muted">{label}</p>
            <b className="mt-1 block text-xl">{value}</b>
          </div>
        ))}
      </section>

      {/* Filter Bar & Data Table */}
      <section className="card overflow-hidden">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border px-3 xl:col-span-2">
            <Search className="size-4 text-muted" />
            <input
              aria-label="Search finance records"
              className="w-full bg-transparent py-2.5 text-sm outline-none"
              placeholder={
                tab === "qr"
                  ? "Student, admission no, UTR, or invoice"
                  : "Student, admission, roll, invoice or receipt number"
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {tab !== "qr" ? (
            <>
              <select
                aria-label="Class"
                className={selectClass}
                value={className}
                onChange={(event) => {
                  setClassName(event.target.value);
                  setSection("");
                }}
              >
                <option value="">All classes</option>
                {options?.classes.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </select>

              <select
                aria-label="Section"
                className={selectClass}
                value={section}
                onChange={(event) => setSection(event.target.value)}
              >
                <option value="">All sections</option>
                {sections.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                aria-label="Academic year"
                className={selectClass}
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="">All academic years</option>
                {options?.years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                    {item === options.currentYear ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              aria-label="Verification status"
              className={selectClass}
              value={qrStatus}
              onChange={(event) => setQrStatus(event.target.value)}
            >
              <option value="All">All verification statuses</option>
              <option value="PENDING">Pending Verification</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          )}

          {tab === "fees" ? (
            <select
              aria-label="Fee status"
              className={selectClass}
              value={feeStatus}
              onChange={(event) => setFeeStatus(event.target.value)}
            >
              <option value="">All fee statuses</option>
              {feeStatuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          ) : tab === "history" ? (
            <>
              <select
                aria-label="Payment status"
                className={selectClass}
                value={paymentStatus}
                onChange={(event) => setPaymentStatus(event.target.value)}
              >
                <option value="All">All payment statuses</option>
                <option value="Success">Success</option>
                <option value="Voided">Voided</option>
              </select>
              <select
                aria-label="Payment method"
                className={selectClass}
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option value="">All methods</option>
                {paymentMethods.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <input
                aria-label="From date"
                type="date"
                className={selectClass}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <input
                aria-label="To date"
                type="date"
                className={selectClass}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </>
          ) : null}

          <select
            aria-label="Sort records"
            className={selectClass}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="date">{tab === "fees" ? "Due date" : "Newest date"}</option>
            <option value="student">Student name</option>
            <option value={tab === "fees" ? "balance" : "amount"}>
              {tab === "fees" ? "Largest balance" : "Largest amount"}
            </option>
          </select>

          <button className="btn-secondary" onClick={reset}>
            Clear filters
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : tab === "fees" ? (
          <FeeTable rows={visible as Fee[]} onCollect={choose} onChanged={load} onError={setError} />
        ) : tab === "history" ? (
          <PaymentTable rows={visible as Payment[]} onView={setSelectedPayment} onChanged={load} onError={setError} />
        ) : (
          <QrVerificationTable rows={visible as QrPayment[]} onReview={(item) => setReviewingQr(item)} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-sm text-muted">
          <span>
            Showing {visible.length} of {rows.length} records
          </span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary !px-3 !py-1" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
              Previous
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              className="btn-secondary !px-3 !py-1"
              disabled={page >= pages}
              onClick={() => setPage((v) => v + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Collect Fee Modal */}
      {chooseFee && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose outstanding fee"
            className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">Collect Fee</h2>
              <button aria-label="Close" onClick={() => setChooseFee(false)}>
                <X />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">Select an outstanding fee to record a payment and create a receipt.</p>
            <div className="mt-4 space-y-2">
              {fees
                .filter((item) => Number(item.pendingAmount) > 0)
                .map((item) => (
                  <button
                    key={item.id}
                    className="w-full rounded-xl border p-3 text-left hover:border-brand"
                    onClick={() => choose(item)}
                  >
                    <b>{item.studentName}</b>
                    <span className="block text-sm text-muted">
                      {item.feeType} · Balance {money(item.pendingAmount)}
                    </span>
                  </button>
                ))}
              {!fees.some((item) => Number(item.pendingAmount) > 0) && (
                <p className="text-sm text-muted">No outstanding fees match the current filters.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {selected && <PaymentModal key={selected.id} fee={selected} close={() => setSelected(null)} save={pay} saving={saving} />}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
          <div role="dialog" aria-modal="true" aria-label="Payment details" className="card w-full max-w-lg p-6">
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">Payment details</h2>
              <button aria-label="Close" onClick={() => setSelectedPayment(null)}>
                <X />
              </button>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Student", selectedPayment.studentName],
                ["Admission", selectedPayment.admission],
                ["Class", `${selectedPayment.className}-${selectedPayment.section}`],
                ["Academic year", selectedPayment.academicYear],
                ["Receipt number", selectedPayment.receiptNumber],
                ["Original fee", money(selectedPayment.originalAmount)],
                ["Discount", money(selectedPayment.discountAmount)],
                ["Amount paid", money(selectedPayment.amount)],
                ["Method", selectedPayment.method],
                ["Date", selectedPayment.paymentDate],
                ["Status", selectedPayment.status],
                ["Reference", selectedPayment.transactionId || "-"],
                ["Remaining balance", money(selectedPayment.remainingBalance)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedPayment.status === "Success" && (
                <Link className="btn-primary" href={`/dashboard/receipts/${encodeURIComponent(selectedPayment.receiptNumber)}`}>
                  View receipt
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Payment Review Modal */}
      {reviewingQr && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Review QR Payment"
            className="card my-8 max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <p className="label">Verification Review</p>
                <h2 className="mt-1 text-xl font-bold">Review QR Payment Submission</h2>
                <p className="text-xs text-muted">Verify payment with your school bank statement before approval.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setReviewingQr(null);
                  setRejectReason("");
                }}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center gap-3 rounded-2xl bg-canvas p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  {reviewingQr.studentName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{reviewingQr.studentName}</h3>
                  <p className="text-xs text-muted">
                    {reviewingQr.admission} • {reviewingQr.className}-{reviewingQr.section || "A"} • Roll{" "}
                    {reviewingQr.rollNumber || "-"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border p-4">
                <div>
                  <span className="text-xs text-muted">Amount Submitted</span>
                  <p className="text-xl font-black text-violet-700 dark:text-violet-400">
                    {money(reviewingQr.amount)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted">Status</span>
                  <p>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        reviewingQr.status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : reviewingQr.status === "REJECTED"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {reviewingQr.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted">UPI / UTR Reference</span>
                  <p className="font-mono font-bold text-foreground">{reviewingQr.utrNumber}</p>
                </div>
                <div>
                  <span className="text-xs text-muted">Payment Date</span>
                  <p className="font-semibold">{reviewingQr.paymentDate}</p>
                </div>
                <div>
                  <span className="text-xs text-muted">Invoice Associated</span>
                  <p className="font-mono text-xs">{reviewingQr.invoiceNumber} ({reviewingQr.feeType})</p>
                </div>
                <div>
                  <span className="text-xs text-muted">Current Invoice Balance</span>
                  <p className="font-semibold text-rose-600">{money(reviewingQr.feePendingAmount)}</p>
                </div>
              </div>

              {reviewingQr.notes && (
                <div className="rounded-xl bg-canvas p-3 text-xs">
                  <span className="text-muted">Parent Remarks:</span> {reviewingQr.notes}
                </div>
              )}

              {/* Payment Screenshot */}
              {reviewingQr.screenshotAssetId && (
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted">Attached Payment Screenshot</span>
                    <a
                      href={`/api/fees/qr-payments/${reviewingQr.id}/screenshot`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      Open Full Screen
                    </a>
                  </div>
                  <div className="relative flex justify-center rounded-xl bg-black/5 p-2 dark:bg-black/40">
                    <Image
                      unoptimized
                      src={`/api/fees/qr-payments/${reviewingQr.id}/screenshot`}
                      alt="Payment screenshot proof"
                      width={300}
                      height={200}
                      className="max-h-60 rounded object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Verified Details */}
              {reviewingQr.status === "VERIFIED" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <p className="font-bold">Verified & Recorded into Cash Book</p>
                  <p className="mt-1">
                    Receipt: <span className="font-mono font-bold">{reviewingQr.receiptNumber}</span> • Verified By:{" "}
                    {reviewingQr.verifiedByName || "Administrator"} • Date: {reviewingQr.verifiedAt?.slice(0, 10)}
                  </p>
                  {reviewingQr.receiptNumber && (
                    <div className="mt-3 flex gap-2">
                      <Link
                        className="btn-primary !px-3 !py-1 text-xs"
                        href={`/dashboard/receipts/${encodeURIComponent(reviewingQr.receiptNumber)}`}
                      >
                        View Official Receipt
                      </Link>
                      <a
                        className="btn-secondary !px-3 !py-1 text-xs"
                        href={`/api/receipts/${encodeURIComponent(reviewingQr.receiptNumber)}/pdf`}
                      >
                        <Download className="size-3" />
                        Download PDF
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Rejected Details */}
              {reviewingQr.status === "REJECTED" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <p className="font-bold">Payment Rejected</p>
                  <p className="mt-1">Reason: {reviewingQr.rejectionReason || "UTR not found in bank account."}</p>
                </div>
              )}

              {/* Actions for PENDING */}
              {reviewingQr.status === "PENDING" && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleVerifyQr(reviewingQr)}
                      className="btn-primary !bg-emerald-600 hover:!bg-emerald-500"
                    >
                      {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Verify & Add to Cash Book
                    </button>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                    <label className="block text-xs font-bold text-rose-800 dark:text-rose-300">
                      Reject Payment (Reason required)
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          maxLength={300}
                          placeholder="e.g. UTR not matching statement, amount incorrect"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full rounded-xl border bg-white p-2 text-xs text-foreground dark:bg-panel"
                        />
                        <button
                          type="button"
                          disabled={actionLoading || !rejectReason.trim()}
                          onClick={() => handleRejectQr(reviewingQr)}
                          className="btn-secondary !border-rose-300 !text-rose-700 hover:!bg-rose-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeeTable({
  rows,
  onCollect,
  onChanged,
  onError,
}: {
  rows: Fee[];
  onCollect: (fee: Fee) => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-canvas text-xs uppercase text-muted">
          <tr>
            {["Student", "Admission no.", "Class", "Section", "Original fee", "Discount", "Final payable", "Paid", "Balance", "Status", "Actions"].map(
              (item) => (
                <th className="whitespace-nowrap px-4 py-3" key={item}>
                  {item}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-bold">
                {item.studentName}
                <span className="block text-xs font-normal text-muted">Roll {item.rollNumber || "-"}</span>
              </td>
              <td className="px-4">{item.admission}</td>
              <td className="px-4">{item.className}</td>
              <td className="px-4">{item.section || "-"}</td>
              <td className="px-4">{money(item.totalAmount)}</td>
              <td className="px-4">{money(item.discount)}</td>
              <td className="px-4">{money(item.finalAmount)}</td>
              <td className="px-4 text-emerald-700">{money(item.paidAmount)}</td>
              <td className="px-4 font-semibold">{money(item.pendingAmount)}</td>
              <td className="px-4">{item.status}</td>
              <td className="px-4">
                <div className="flex flex-wrap gap-2">
                  {item.latestReceipt && (
                    <Link className="btn-secondary !px-3 !py-1.5 text-xs" href={`/dashboard/receipts/${encodeURIComponent(item.latestReceipt)}`}>
                      View receipt
                    </Link>
                  )}
                  <button
                    className="btn-primary !px-3 !py-1.5 text-xs"
                    disabled={Number(item.pendingAmount) <= 0}
                    onClick={() => onCollect(item)}
                  >
                    Collect
                  </button>
                  <DeleteRecordButton
                    label={`fee record for ${item.studentName}`}
                    url={`/api/records/fee/${item.id}`}
                    onComplete={onChanged}
                    onError={onError}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty message="No fee records match these filters." />}
    </div>
  );
}

function PaymentTable({
  rows,
  onView,
  onChanged,
  onError,
}: {
  rows: Payment[];
  onView: (payment: Payment) => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-canvas text-xs uppercase text-muted">
          <tr>
            {["Receipt number", "Student", "Class", "Amount paid", "Method", "Date", "Status", "Actions"].map((item) => (
              <th className="whitespace-nowrap px-4 py-3" key={item}>
                {item}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-bold text-brand">{item.receiptNumber}</td>
              <td className="px-4 font-semibold">{item.studentName}</td>
              <td className="px-4">
                {item.className}-{item.section}
              </td>
              <td className="px-4 font-bold">{money(item.amount)}</td>
              <td className="px-4">{item.method}</td>
              <td className="px-4">{item.paymentDate}</td>
              <td className="px-4">{item.status}</td>
              <td className="px-4">
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => onView(item)}>
                    <Eye className="size-3" />
                    View
                  </button>
                  {item.status === "Success" && (
                    <>
                      <Link className="btn-secondary !px-3 !py-1.5 text-xs" href={`/dashboard/receipts/${encodeURIComponent(item.receiptNumber)}`}>
                        Receipt
                      </Link>
                      <a className="btn-primary !px-3 !py-1.5 text-xs" href={`/api/receipts/${encodeURIComponent(item.receiptNumber)}/pdf`}>
                        <Download className="size-3" />
                        PDF
                      </a>
                      <Link
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        href={`/dashboard/receipts/${encodeURIComponent(item.receiptNumber)}?print=1`}
                      >
                        <Printer className="size-3" />
                        Print
                      </Link>
                      <DeleteRecordButton
                        label={`payment ${item.receiptNumber}`}
                        url={`/api/records/payment/${item.id}`}
                        action="Void"
                        reasonRequired
                        onComplete={onChanged}
                        onError={onError}
                      />
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty message="No payments match these filters." />}
    </div>
  );
}

function QrVerificationTable({
  rows,
  onReview,
}: {
  rows: QrPayment[];
  onReview: (payment: QrPayment) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px] text-left text-sm">
        <thead className="bg-canvas text-xs uppercase text-muted">
          <tr>
            {["Student", "Class", "Invoice", "Amount", "UTR Reference", "Payment Date", "Status", "Actions"].map((item) => (
              <th className="whitespace-nowrap px-4 py-3" key={item}>
                {item}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-semibold">
                {item.studentName}
                <span className="block text-xs font-normal text-muted">{item.admission}</span>
              </td>
              <td className="px-4">
                {item.className}-{item.section || "A"}
              </td>
              <td className="px-4 font-mono text-xs">{item.invoiceNumber}</td>
              <td className="px-4 font-bold text-foreground">{money(item.amount)}</td>
              <td className="px-4 font-mono font-bold text-violet-700 dark:text-violet-300">
                {item.utrNumber}
              </td>
              <td className="px-4">{item.paymentDate}</td>
              <td className="px-4">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    item.status === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : item.status === "REJECTED"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      : item.status === "REFUNDED"
                      ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {item.status === "PENDING" ? "Pending Verification" : item.status}
                </span>
              </td>
              <td className="px-4">
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-1.5 text-xs font-bold"
                  onClick={() => onReview(item)}
                >
                  <Eye className="size-3" />
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty message="No QR payment verification requests match these filters." />}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="p-12 text-center text-sm text-muted">{message}</div>;
}

function PaymentModal({
  fee,
  close,
  save,
  saving,
}: {
  fee: Fee;
  close: () => void;
  save: (form: HTMLFormElement) => Promise<void>;
  saving: boolean;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [discountType, setDiscountType] = useState("Fixed");
  const [discount, setDiscount] = useState(0);
  const [lateFee, setLateFee] = useState(0);

  const discountAmount =
    discountType === "Percentage" ? (fee.pendingAmount * Math.min(discount, 100)) / 100 : discount;
  const net = Math.max(0, fee.pendingAmount - discountAmount + lateFee);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Collect fee payment"
        className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save(event.currentTarget);
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="label">Collect Fee</p>
            <h2 className="mt-1 text-xl font-bold">{fee.studentName}</h2>
            <p className="text-sm text-muted">
              {fee.admission} · Roll {fee.rollNumber || "-"} · {fee.className}-{fee.section} · {fee.academicYear}
            </p>
            <p className="mt-1 text-xs text-muted">Parent / guardian: {fee.parent || "-"}</p>
          </div>
          <button aria-label="Close" type="button" onClick={close}>
            <X />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-canvas p-4 text-sm">
          <b>Invoice {fee.invoiceNumber}</b>
          <p>
            {fee.feeType} · Total {money(fee.finalAmount)} · Paid {money(fee.paidAmount)} · Balance {money(fee.pendingAmount)}
          </p>
        </div>

        <input type="hidden" name="requestId" value={requestId} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Payment frequency
            <select name="frequency" className="mt-1 w-full rounded-xl border p-2.5">
              {frequencies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Discount type
            <select
              name="discountType"
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5"
            >
              <option>Fixed</option>
              <option>Percentage</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Discount {discountType === "Percentage" ? "(%)" : "(₹)"}
            <input
              name="discountValue"
              type="number"
              min="0"
              max={discountType === "Percentage" ? 100 : fee.pendingAmount}
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(Number(event.target.value))}
              className="mt-1 w-full rounded-xl border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold">
            Late fee (₹)
            <input
              name="lateFee"
              type="number"
              min="0"
              step="0.01"
              value={lateFee}
              onChange={(event) => setLateFee(Number(event.target.value))}
              className="mt-1 w-full rounded-xl border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Discount reason
            <input name="discountReason" maxLength={250} className="mt-1 w-full rounded-xl border p-2.5" />
          </label>
          <div className="rounded-xl bg-canvas p-3 text-sm sm:col-span-2">
            <span>
              Original {money(fee.pendingAmount)} · Discount {money(discountAmount)} · Late fee {money(lateFee)}
            </span>
            <b className="mt-1 block">Net payable {money(net)}</b>
          </div>
          <label className="text-sm font-semibold">
            Amount to pay
            <input
              required
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={net}
              className="mt-1 w-full rounded-xl border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold">
            Payment method
            <select name="method" className="mt-1 w-full rounded-xl border p-2.5">
              {paymentMethods.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Payment date
            <input
              required
              name="paymentDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-1 w-full rounded-xl border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold">
            Reference number
            <input name="transactionId" maxLength={100} className="mt-1 w-full rounded-xl border p-2.5" />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Remarks
            <textarea name="notes" maxLength={500} className="mt-1 w-full rounded-xl border p-2.5" />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving || net <= 0} type="submit">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save payment
          </button>
        </div>
      </form>
    </div>
  );
}
