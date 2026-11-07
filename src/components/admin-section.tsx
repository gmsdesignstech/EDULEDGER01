"use client";

import { readApiJson } from "@/lib/api-response";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HeartPulse,
  Info,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminOverview } from "./admin-overview";
import { DeleteRecordButton } from "./delete-record-button";

type Data = Record<string, unknown>;
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Data) : {});
const arr = (v: unknown) => (Array.isArray(v) ? (v as Data[]) : []);
const txt = (v: unknown) => (v == null || v === "" ? "—" : String(v));
const money = (v: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);
const number = (v: unknown) =>
  new Intl.NumberFormat("en-IN").format(Number(v) || 0);
const date = (v: unknown) =>
  v
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: String(v).includes("T") ? "short" : undefined,
      }).format(new Date(String(v)))
    : "—";

const titles: Record<string, [string, string]> = {
  overview: [
    "Platform Overview",
    "Real-time operational and financial state of the entire EduLedger SaaS platform.",
  ],
  schools: [
    "School Management",
    "Monitor, activate, suspend, or renew registered schools across the platform.",
  ],
  subscriptions: [
    "Subscription Management",
    "Track student licenses, pricing tiers, renewal cycles, and expiring subscriptions.",
  ],
  finance: [
    "Payments & Platform Revenue",
    "EduLedger platform subscription collections, Razorpay transactions, and financial trends.",
  ],
  transactions: [
    "Payment Transactions",
    "Reconcile platform-wide Razorpay transactions, gateway IDs, and payment statuses.",
  ],
  refunds: [
    "Refunds & Reversals",
    "Review confirmed platform subscription refunds and charge reversals.",
  ],
  users: [
    "Platform User Management",
    "Oversee school administrators, teachers, and staff across all client institutions.",
  ],
  accounts: [
    "Platform Accounts",
    "Multi-school user access, authentication status, and security states.",
  ],
  analytics: [
    "Analytics & Visual Reports",
    "Platform-wide school registration growth, active subscriptions, and revenue trends.",
  ],
  notifications: [
    "Admin Notifications",
    "Critical platform notifications and system events requiring attention.",
  ],
  audit: [
    "Activity Logs & Audit Trail",
    "Append-only immutable record of all administrative actions taken on EduLedger.",
  ],
  health: [
    "System Health & Telemetry",
    "Database connectivity, API latency, payment gateway status, and server metrics.",
  ],
  settings: [
    "Platform Configuration",
    "Global SaaS preferences, notification milestones, and subscription policies.",
  ],
  security: [
    "Security & Access Controls",
    "Private admin authentication, session invalidation, and credential policies.",
  ],
  profile: [
    "Super Admin Profile",
    "Platform owner credentials, identity verification, and active security sessions.",
  ],
};

function presetDates(preset: string) {
  const end = new Date(),
    start = new Date(end);
  if (preset === "today") {
  } else if (preset === "7d") start.setDate(start.getDate() - 6);
  else if (preset === "30d") start.setDate(start.getDate() - 29);
  else if (preset === "3m") start.setMonth(start.getMonth() - 3);
  else if (preset === "6m") start.setMonth(start.getMonth() - 6);
  else start.setMonth(start.getMonth() - 12);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function AdminSection({ section }: { section: string }) {
  const initial = presetDates("30d"),
    [data, setData] = useState<Data>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(initial.from),
    [to, setTo] = useState(initial.to),
    [preset, setPreset] = useState("30d"),
    [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    void version;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ section, search, status, from, to });
      const response = await fetch(`/api/admin?${q}`, { cache: "no-store" }),
        body = await readApiJson(response);
      if (!response.ok)
        throw new Error(body.error || "Unable to load Super Admin data.");
      setData(body);
    } catch {
      setError("Unable to load Super Admin data. Please verify database connectivity.");
    } finally {
      setLoading(false);
    }
  }, [section, search, status, from, to, version]);

  useEffect(() => {
    void load();
  }, [load]);

  function changePreset(value: string) {
    setPreset(value);
    if (value !== "custom") {
      const range = presetDates(value);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  const heading = titles[section] || titles.overview,
    isPayments = ["finance", "transactions", "refunds"].includes(section),
    isSchools = section === "schools";

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {section !== "overview" && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400">
              <ShieldCheck className="size-3.5" />
              <span>Platform Owner Control</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {heading[0]}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              {heading[1]}
            </p>
          </div>

          <button
            disabled={loading}
            onClick={() => setVersion((x) => x + 1)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Refreshing…" : "Refresh Data"}</span>
          </button>
        </div>
      )}

      {/* Filter Bar for List Views */}
      {["users", "accounts", "schools", "finance", "transactions", "refunds"].includes(
        section,
      ) && (
        <Filters
          isSchools={isSchools}
          search={search}
          status={status}
          from={from}
          to={to}
          showDates={isPayments}
          onSearch={setSearch}
          onStatus={setStatus}
          onFrom={setFrom}
          onTo={setTo}
        />
      )}

      {loading ? (
        <Loading dashboard={section === "overview"} />
      ) : error ? (
        <ErrorState error={error} retry={() => setVersion((x) => x + 1)} />
      ) : section === "overview" ? (
        <AdminOverview
          data={data}
          from={from}
          to={to}
          preset={preset}
          onPreset={changePreset}
          onFrom={(value) => {
            setPreset("custom");
            setFrom(value);
          }}
          onTo={(value) => {
            setPreset("custom");
            setTo(value);
          }}
        />
      ) : section === "schools" ? (
        <SchoolsTable data={data} refresh={() => setVersion((x) => x + 1)} />
      ) : section === "subscriptions" ? (
        <SubscriptionsTable data={data} refresh={() => setVersion((x) => x + 1)} />
      ) : section === "finance" || section === "transactions" || section === "refunds" ? (
        <FinanceTable data={data} />
      ) : section === "analytics" ? (
        <Analytics
          data={data}
          from={from}
          to={to}
          preset={preset}
          onPreset={changePreset}
          onFrom={(value) => {
            setPreset("custom");
            setFrom(value);
          }}
          onTo={(value) => {
            setPreset("custom");
            setTo(value);
          }}
        />
      ) : section === "users" || section === "accounts" ? (
        <UsersTable data={data} refresh={() => setVersion((x) => x + 1)} />
      ) : section === "audit" ? (
        <Audit data={data} />
      ) : section === "notifications" ? (
        <Notifications data={data} />
      ) : section === "health" ? (
        <Health data={data} />
      ) : section === "profile" ? (
        <Profile data={data} />
      ) : (
        <AdminSettings data={data} />
      )}
    </div>
  );
}

function Filters({
  isSchools,
  search,
  status,
  from,
  to,
  showDates,
  onSearch,
  onStatus,
  onFrom,
  onTo,
}: {
  isSchools: boolean;
  search: string;
  status: string;
  from: string;
  to: string;
  showDates: boolean;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const schoolStatuses = [
    "Active",
    "Inactive",
    "Trial",
    "Expired",
    "Suspended",
  ];
  const generalStatuses = [
    "Active",
    "Inactive",
    "Suspended",
    "SUCCESS",
    "PENDING",
    "FAILED",
    "REFUNDED",
  ];

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:grid-cols-2 xl:grid-cols-[1fr_13rem_10rem_10rem]">
      <label className="relative">
        <Search className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={
            isSchools
              ? "Search by school name, ID, or email…"
              : "Search by keyword, ID, or email…"
          }
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-slate-800 dark:text-white"
        />
      </label>

      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => onStatus(e.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="">All Statuses</option>
        {(isSchools ? schoolStatuses : generalStatuses).map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>

      {showDates && (
        <>
          <input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => onFrom(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          />
          <input
            aria-label="To date"
            type="date"
            value={to}
            min={from}
            onChange={(e) => onTo(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          />
        </>
      )}
    </div>
  );
}

function Loading({ dashboard = false }: { dashboard?: boolean }) {
  if (dashboard)
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 rounded-2xl bg-slate-200 dark:bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="h-32 rounded-2xl bg-slate-200 dark:bg-white/10"
            />
          ))}
        </div>
      </div>
    );
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
      <div className="text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-violet-600" />
        <p className="mt-3 text-xs font-bold text-slate-500">
          Loading platform data from database…
        </p>
      </div>
    </div>
  );
}

function ErrorState({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800 dark:border-rose-950/50 dark:bg-rose-950/30 dark:text-rose-300">
      <AlertCircle className="mx-auto size-7 text-rose-500" />
      <p className="mt-3 text-sm font-bold">{error}</p>
      <button
        onClick={retry}
        className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
      >
        Retry Query
      </button>
    </div>
  );
}

function Wrap({
  children,
  count,
  onExportCsv,
}: {
  children: React.ReactNode;
  count?: unknown;
  onExportCsv?: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <b className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {txt(count)} records loaded
          </b>
        </div>
        <div className="flex items-center gap-2">
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="size-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th =
  "px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap bg-slate-50/70 dark:bg-slate-800/50";
const td = "px-4 py-3.5 text-xs text-slate-700 dark:text-slate-200";

async function statusUpdate(
  type: "user-status" | "school-status",
  id: unknown,
  status: string,
  refresh: () => void,
) {
  let reason: string | undefined;
  if (type === "school-status") {
    if (!window.confirm(`Change this school's status to ${status}?`)) return;
    reason = window.prompt("Enter the reason for this school status change (5–500 characters):")?.trim();
    if (!reason || reason.length < 5 || reason.length > 500) {
      alert("A reason of 5–500 characters is required. No change was made.");
      return;
    }
  }
  const response = await fetch("/api/admin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, id, status, ...(reason ? { reason } : {}) }),
  });
  if (response.ok) {
    refresh();
  } else {
    alert((await readApiJson(response)).error || "Status update failed.");
  }
}

// ==========================================
// 4. SCHOOL MANAGEMENT TABLE & ACTIONS
// ==========================================
function SchoolsTable({
  data,
  refresh,
}: {
  data: Data;
  refresh: () => void;
}) {
  const items = arr(data.items);
  const [selectedSchool, setSelectedSchool] = useState<Data | null>(null);
  const [modalMode, setModalMode] = useState<
    "details" | "statistics" | "subscription" | "renew" | null
  >(null);
  const [renewDays, setRenewDays] = useState(365);
  const [actionLoading, setActionLoading] = useState(false);

  function openModal(
    school: Data,
    mode: "details" | "statistics" | "subscription" | "renew",
  ) {
    setSelectedSchool(school);
    setModalMode(mode);
  }

  function closeModal() {
    setSelectedSchool(null);
    setModalMode(null);
  }

  async function handleRenewSubmit() {
    if (!selectedSchool) return;
    const subId = selectedSchool.subscriptionId;
    if (!subId) {
      alert("This school does not have an active subscription record to renew.");
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extend", days: Number(renewDays) }),
      });
      const res = await readApiJson(response).catch(() => null);
      if (!response.ok) throw new Error(res?.error || "Renewal failed.");
      alert(`Subscription extended successfully by ${renewDays} days.`);
      closeModal();
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Renewal failed.");
    } finally {
      setActionLoading(false);
    }
  }

  function exportSchoolsCsv() {
    if (!items.length) return;
    const headers = [
      "School Name",
      "School ID",
      "School Email",
      "Contact Number",
      "Registration Date",
      "Subscription Plan",
      "Students",
      "Amount Paid",
      "Start Date",
      "Expiry Date",
      "Status",
    ];
    const rows = items.map((x) => [
      `"${txt(x.name).replace(/"/g, '""')}"`,
      `"${txt(x.id)}"`,
      `"${txt(x.email)}"`,
      `"${txt(x.contactNumber)}"`,
      `"${txt(x.createdAt)}"`,
      `"${txt(x.planName)}"`,
      txt(x.students),
      txt(x.subscriptionAmount),
      `"${txt(x.subscriptionStart)}"`,
      `"${txt(x.subscriptionEnd)}"`,
      `"${txt(x.status)}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `eduledger-schools-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <Wrap count={data.total} onExportCsv={exportSchoolsCsv}>
        <table className="min-w-full divide-y divide-slate-100 dark:divide-white/10">
          <thead>
            <tr>
              {[
                "School Name",
                "School ID",
                "School Email",
                "Contact Number",
                "Registration Date",
                "Subscription Plan",
                "Students",
                "Subscription Amount",
                "Start Date",
                "Expiry Date",
                "School Status",
                "Actions",
              ].map((x) => (
                <th className={th} key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((x) => (
              <tr
                className="transition hover:bg-slate-50/70 dark:hover:bg-white/5"
                key={txt(x.id)}
              >
                <td className={`${td} font-bold text-slate-900 dark:text-white`}>
                  {txt(x.name)}
                </td>
                <td className={td}>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono dark:bg-slate-800">
                    {txt(x.id)}
                  </code>
                </td>
                <td className={td}>{txt(x.email)}</td>
                <td className={td}>{txt(x.contactNumber)}</td>
                <td className={td}>{date(x.createdAt)}</td>
                <td className={td}>
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    {txt(x.planName)}
                  </span>
                </td>
                <td className={`${td} font-bold`}>{number(x.students)}</td>
                <td className={`${td} font-bold`}>{money(x.subscriptionAmount)}</td>
                <td className={td}>{date(x.subscriptionStart)}</td>
                <td className={td}>{date(x.subscriptionEnd)}</td>
                <td className={td}>
                  <Badge value={x.status} />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openModal(x, "details")}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                      title="View Details"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => openModal(x, "statistics")}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-indigo-600 shadow-sm transition hover:bg-indigo-50 dark:border-white/10 dark:bg-slate-800 dark:text-indigo-400"
                      title="View Statistics"
                    >
                      Stats
                    </button>
                    <button
                      onClick={() => openModal(x, "subscription")}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-violet-600 shadow-sm transition hover:bg-violet-50 dark:border-white/10 dark:bg-slate-800 dark:text-violet-400"
                      title="View Subscription"
                    >
                      Plan
                    </button>
                    <button
                      onClick={() => openModal(x, "renew")}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
                      title="Renew / Extend Subscription"
                    >
                      Renew
                    </button>
                    <select
                      aria-label={`Change status for ${txt(x.name)}`}
                      value={txt(x.status)}
                      onChange={(e) =>
                        void statusUpdate(
                          "school-status",
                          x.id,
                          e.target.value,
                          refresh,
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white p-1 text-[11px] font-bold outline-none dark:border-white/10 dark:bg-slate-800"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <Empty message="No registered schools found matching the filter." />}
      </Wrap>

      {/* School Action Modal */}
      {selectedSchool && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white">
                  <Building2 className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {modalMode === "details"
                      ? "School Profile & Details"
                      : modalMode === "statistics"
                      ? "Live School Statistics"
                      : modalMode === "subscription"
                      ? "Subscription Breakdown"
                      : "Renew School Subscription"}
                  </h3>
                  <p className="text-xs text-slate-500">{txt(selectedSchool.name)}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              {modalMode === "details" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                      <span className="text-slate-400">School ID:</span>
                      <b className="mt-1 block font-mono text-slate-800 dark:text-white">
                        {txt(selectedSchool.id)}
                      </b>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                      <span className="text-slate-400">School Status:</span>
                      <div className="mt-1">
                        <Badge value={selectedSchool.status} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <span className="text-slate-400">Contact Email:</span>
                    <b className="mt-1 block text-slate-800 dark:text-white">
                      {txt(selectedSchool.email)}
                    </b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <span className="text-slate-400">Contact Phone:</span>
                    <b className="mt-1 block text-slate-800 dark:text-white">
                      {txt(selectedSchool.contactNumber)}
                    </b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <span className="text-slate-400">School Address:</span>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">
                      {txt(selectedSchool.schoolAddress)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <span className="text-slate-400">Primary Administrator:</span>
                    <b className="mt-1 block text-slate-800 dark:text-white">
                      {txt(selectedSchool.adminName)} ({txt(selectedSchool.email)})
                    </b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <span className="text-slate-400">Platform Registration Date:</span>
                    <b className="mt-1 block text-slate-800 dark:text-white">
                      {date(selectedSchool.createdAt)}
                    </b>
                  </div>
                </div>
              )}

              {modalMode === "statistics" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50/60 p-4 text-center dark:bg-blue-950/30">
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      Total Active Students
                    </span>
                    <strong className="mt-2 block text-2xl font-black text-slate-900 dark:text-white">
                      {number(selectedSchool.students)}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-indigo-50/60 p-4 text-center dark:bg-indigo-950/30">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      Teaching Faculty
                    </span>
                    <strong className="mt-2 block text-2xl font-black text-slate-900 dark:text-white">
                      {number(selectedSchool.teachers)}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-violet-50/60 p-4 text-center dark:bg-violet-950/30">
                    <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">
                      Active Classes
                    </span>
                    <strong className="mt-2 block text-2xl font-black text-slate-900 dark:text-white">
                      {number(selectedSchool.classes)}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 p-4 text-center dark:bg-emerald-950/30">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      EduLedger Revenue
                    </span>
                    <strong className="mt-2 block text-2xl font-black text-slate-900 dark:text-white">
                      {money(selectedSchool.revenue)}
                    </strong>
                  </div>
                </div>
              )}

              {modalMode === "subscription" && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <span className="text-slate-400">Subscription Plan:</span>
                    <b className="mt-1 block text-base font-black text-violet-600">
                      {txt(selectedSchool.planName)}
                    </b>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                      <span className="text-slate-400">License Start:</span>
                      <b className="mt-1 block">{date(selectedSchool.subscriptionStart)}</b>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                      <span className="text-slate-400">License Expiry:</span>
                      <b className="mt-1 block">{date(selectedSchool.subscriptionEnd)}</b>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <span className="text-slate-400">Amount Paid:</span>
                    <b className="mt-1 block text-lg font-black text-emerald-600">
                      {money(selectedSchool.subscriptionAmount)}
                    </b>
                  </div>
                </div>
              )}

              {modalMode === "renew" && (
                <div className="space-y-4">
                  <p className="text-slate-500">
                    Extending this subscription updates the school’s expiry date and marks the subscription as active in the database.
                  </p>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Extension Period (Days)
                    </label>
                    <select
                      value={renewDays}
                      onChange={(e) => setRenewDays(Number(e.target.value))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold dark:border-white/10 dark:bg-slate-800"
                    >
                      <option value={30}>30 Days (1 Month)</option>
                      <option value={90}>90 Days (Quarterly)</option>
                      <option value={180}>180 Days (Half Year)</option>
                      <option value={365}>365 Days (1 Full Year)</option>
                      <option value={730}>730 Days (2 Years)</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={closeModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={handleRenewSubmit}
                      className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionLoading ? "Processing…" : "Confirm Renewal"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 5. SUBSCRIPTION MANAGEMENT TABLE
// ==========================================
function SubscriptionsTable({
  data,
  refresh,
}: {
  data: Data;
  refresh: () => void;
}) {
  const items = arr(data.items);
  const [selectedSub, setSelectedSub] = useState<Data | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [subLoading, setSubLoading] = useState(false);

  async function manage(
    id: unknown,
    action: "extend" | "activate" | "cancel" | "suspend",
    days?: number,
  ) {
    if (
      (action === "cancel" || action === "suspend") &&
      !confirm(
        `Are you sure you want to ${action} this subscription? This action is recorded in the platform audit log.`,
      )
    )
      return;

    setSubLoading(true);
    try {
      const response = await fetch(`/api/admin/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, days }),
      });
      const body = await readApiJson(response).catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Subscription update failed.");
      alert(`Subscription successfully updated.`);
      setSelectedSub(null);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSubLoading(false);
    }
  }

  return (
    <>
      <Wrap count={items.length}>
        <table className="min-w-full divide-y divide-slate-100 dark:divide-white/10">
          <thead>
            <tr>
              {[
                "School Name",
                "Subscription Plan",
                "Licensed Capacity",
                "Active Students",
                "Rate / Student",
                "Total Amount",
                "Payment Status",
                "Subscription Status",
                "Expiry Window",
                "Start Date",
                "Expiry Date",
                "Actions",
              ].map((x) => (
                <th className={th} key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((x) => {
              const window = txt(x.expiryWindow);
              const daysLeft = Number(x.daysUntilExpiry) || 0;

              return (
                <tr
                  className="transition hover:bg-slate-50/70 dark:hover:bg-white/5"
                  key={txt(x.id)}
                >
                  <td className={`${td} font-bold text-slate-900 dark:text-white`}>
                    {txt(x.schoolName)}
                  </td>
                  <td className={td}>
                    <span className="font-semibold text-violet-600 dark:text-violet-400">
                      {txt(x.planName)}
                    </span>
                  </td>
                  <td className={`${td} font-bold`}>{number(x.studentCapacity)}</td>
                  <td className={td}>{number(x.activeStudents)}</td>
                  <td className={td}>
                    {Number(x.pricePerStudent)
                      ? money(x.pricePerStudent)
                      : "Standard"}
                  </td>
                  <td className={`${td} font-bold text-emerald-600`}>
                    {money(x.amountPaid)}
                  </td>
                  <td className={td}>
                    <Badge value={x.paymentStatus} />
                  </td>
                  <td className={td}>
                    <Badge value={x.status} />
                  </td>
                  <td className={td}>
                    {window === "expiring_7d" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        <AlertTriangle className="size-3" />
                        Expiring in {daysLeft}d (7D)
                      </span>
                    ) : window === "expiring_15d" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        <AlertCircle className="size-3" />
                        Expiring in {daysLeft}d (15D)
                      </span>
                    ) : window === "expiring_30d" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <Clock className="size-3" />
                        Expiring in {daysLeft}d (30D)
                      </span>
                    ) : window === "expired" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        <ShieldX className="size-3 text-rose-500" />
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="size-3" />
                        Healthy ({daysLeft}d left)
                      </span>
                    )}
                  </td>
                  <td className={td}>{date(x.activationDate)}</td>
                  <td className={td}>{date(x.expiryDate)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedSub(x)}
                        className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-violet-700"
                      >
                        Renew / Extend
                      </button>
                      <button
                        onClick={() => void manage(x.id, "suspend")}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        Suspend
                      </button>
                      <button
                        onClick={() => void manage(x.id, "cancel")}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!items.length && <Empty message="No subscription records found." />}
      </Wrap>

      {/* Manual Renewal Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Extend / Activate Subscription
              </h3>
              <button
                onClick={() => setSelectedSub(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-400">School:</span>
                <b className="mt-0.5 block text-sm font-bold text-slate-800 dark:text-white">
                  {txt(selectedSub.schoolName)}
                </b>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <div>
                  <span className="text-slate-400">Current Expiry:</span>
                  <b className="mt-0.5 block font-semibold">{date(selectedSub.expiryDate)}</b>
                </div>
                <div>
                  <span className="text-slate-400">Capacity:</span>
                  <b className="mt-0.5 block font-semibold">
                    {number(selectedSub.studentCapacity)} students
                  </b>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Extension Duration
                </label>
                <select
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold dark:border-white/10 dark:bg-slate-800"
                >
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={60}>60 Days (2 Months)</option>
                  <option value={90}>90 Days (Quarterly)</option>
                  <option value={180}>180 Days (Half Year)</option>
                  <option value={365}>365 Days (1 Full Year)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedSub(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  disabled={subLoading}
                  onClick={() => void manage(selectedSub.id, "extend", extendDays)}
                  className="rounded-xl bg-violet-600 px-5 py-2 font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {subLoading ? "Updating…" : "Apply Extension"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 6. PAYMENT & REVENUE MANAGEMENT
// ==========================================
function FinanceTable({ data }: { data: Data }) {
  const items = arr(data.items);

  function exportFinanceCsv() {
    if (!items.length) return;
    const headers = [
      "Transaction ID",
      "School Name",
      "School ID",
      "Subscription Plan",
      "Capacity",
      "Amount",
      "Currency",
      "Status",
      "Payment Date",
      "Starts At",
      "Ends At",
      "Payment Method",
      "Reference ID",
    ];
    const rows = items.map((x) => [
      `"${txt(x.transactionId)}"`,
      `"${txt(x.schoolName).replace(/"/g, '""')}"`,
      `"${txt(x.schoolId)}"`,
      `"${txt(x.subscription)}"`,
      txt(x.studentCapacity),
      txt(x.amount),
      `"${txt(x.currency)}"`,
      `"${txt(x.status)}"`,
      `"${txt(x.paymentDate)}"`,
      `"${txt(x.startsAt)}"`,
      `"${txt(x.endsAt)}"`,
      `"${txt(x.method)}"`,
      `"${txt(x.referenceId)}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `eduledger-platform-revenue-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Wrap count={data.total} onExportCsv={exportFinanceCsv}>
      <table className="min-w-full divide-y divide-slate-100 dark:divide-white/10">
        <thead>
          <tr>
            {[
              "Transaction ID",
              "School Name",
              "Subscription Plan",
              "Amount",
              "Payment Status",
              "Payment Date",
              "Licensed Period",
              "Method",
              "Razorpay Reference ID",
            ].map((x) => (
              <th className={th} key={x}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {items.map((x) => (
            <tr
              className="transition hover:bg-slate-50/70 dark:hover:bg-white/5"
              key={txt(x.id)}
            >
              <td className={`${td} font-mono font-bold text-slate-900 dark:text-white`}>
                {txt(x.transactionId)}
              </td>
              <td className={td}>
                <b className="block text-slate-900 dark:text-white">{txt(x.schoolName)}</b>
                <small className="font-mono text-slate-400">{txt(x.schoolId)}</small>
              </td>
              <td className={td}>
                <span className="font-semibold">{txt(x.subscription)}</span>
                <small className="block text-slate-400">
                  {number(x.studentCapacity)} students
                </small>
              </td>
              <td className={`${td} font-black text-emerald-600`}>
                {money(x.amount)}
                <small className="block text-slate-400">{txt(x.currency)}</small>
              </td>
              <td className={td}>
                <Badge value={x.status} />
              </td>
              <td className={td}>{date(x.paymentDate)}</td>
              <td className={td}>
                {date(x.startsAt)} – {date(x.endsAt)}
              </td>
              <td className={td}>{txt(x.method)}</td>
              <td className={td}>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono dark:bg-slate-800">
                  {txt(x.referenceId)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty message="No platform payment records found for this period." />}
    </Wrap>
  );
}

// ==========================================
// 7. ANALYTICS & REPORTS
// ==========================================
function Analytics({
  data,
  from,
  to,
  preset,
  onPreset,
  onFrom,
  onTo,
}: {
  data: Data;
  from: string;
  to: string;
  preset: string;
  onPreset: (v: string) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const u = obj(data.users),
    f = obj(data.finance),
    s = obj(data.schools),
    sub = obj(data.subscriptions),
    growth = arr(data.growth),
    trend = arr(data.revenueTrend);

  function exportAnalyticsCsv() {
    const lines = [
      "EduLedger Platform Analytics & Summary Report",
      `Generated At: ${new Date().toISOString()}`,
      `Date Range: ${from} to ${to}`,
      "",
      "Platform KPI Summary",
      `Total Registered Schools,${txt(s.total)}`,
      `Active Schools,${txt(s.active)}`,
      `Total Students,${txt(u.totalStudents)}`,
      `Total Teachers,${txt(u.totalTeachers)}`,
      `Total Platform Revenue,${txt(f.totalRevenue)}`,
      `Month Revenue,${txt(f.monthRevenue)}`,
      `Successful Payments,${txt(f.successful)}`,
      `Pending Payments,${txt(f.pending)}`,
      `Payment Success Rate,${txt(f.paymentSuccessRate)}%`,
      "",
      "Monthly School & User Growth Series",
      "Period,Users,Schools",
      ...growth.map((g) => `${g.period},${g.users},${g.schools}`),
      "",
      "Revenue Trend Series",
      "Date,Amount,Subscriptions",
      ...trend.map((t) => `${t.period},${t.amount},${t.subscriptions}`),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `eduledger-analytics-report-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Top Controls with Preset Filters & CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Analytics Range:</span>
          <select
            value={preset}
            onChange={(e) => onPreset(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="12m">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => onFrom(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs dark:border-white/10 dark:bg-slate-800"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                min={from}
                value={to}
                onChange={(e) => onTo(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs dark:border-white/10 dark:bg-slate-800"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportAnalyticsCsv}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            <span>Export Analytics CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="size-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <span className="text-xs font-bold text-slate-500">Payment Success Rate</span>
          <strong className="mt-2 block text-2xl font-black text-emerald-600">
            {txt(f.paymentSuccessRate)}%
          </strong>
          <small className="mt-1 block text-slate-400">
            {number(f.successful)} succeeded / {number(f.totalPayments)} attempts
          </small>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <span className="text-xs font-bold text-slate-500">School Active Ratio</span>
          <strong className="mt-2 block text-2xl font-black text-blue-600">
            {Number(s.total) ? Math.round((Number(s.active) / Number(s.total)) * 100) : 0}%
          </strong>
          <small className="mt-1 block text-slate-400">
            {number(s.active)} active of {number(s.total)} registered
          </small>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <span className="text-xs font-bold text-slate-500">Monthly Revenue</span>
          <strong className="mt-2 block text-2xl font-black text-indigo-600">
            {money(f.monthRevenue)}
          </strong>
          <small className="mt-1 block text-slate-400">EduLedger platform fees</small>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <span className="text-xs font-bold text-slate-500">Total Platform Revenue</span>
          <strong className="mt-2 block text-2xl font-black text-purple-600">
            {money(f.totalRevenue)}
          </strong>
          <small className="mt-1 block text-slate-400">Verified Razorpay collections</small>
        </article>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* User & School Registration Growth */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            School &amp; User Registration Growth
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Monthly cumulative acquisition across EduLedger
          </p>
          <div className="mt-5 h-72">
            {growth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth}>
                  <defs>
                    <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="schools"
                    name="Schools"
                    stroke="#8b5cf6"
                    fill="url(#growthFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    name="Users"
                    stroke="#06b6d4"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </section>

        {/* Revenue Growth Trend */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            Subscription Revenue &amp; Payment Volume
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Platform revenue collections for selected period
          </p>
          <div className="mt-5 h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `₹${Number(val) / 1000}k`}
                  />
                  <Tooltip
                    formatter={(val) => money(val)}
                  />
                  <Legend />
                  <Bar
                    dataKey="amount"
                    name="Revenue (₹)"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ==========================================
// 8. PLATFORM USER MANAGEMENT
// ==========================================
function UsersTable({
  data,
  refresh,
}: {
  data: Data;
  refresh: () => void;
}) {
  const items = arr(data.items);

  return (
    <Wrap count={data.total}>
      <table className="min-w-full divide-y divide-slate-100 dark:divide-white/10">
        <thead>
          <tr>
            {[
              "User / Email",
              "Role",
              "Associated School",
              "Account Status",
              "Account Created",
              "Last Login",
              "Actions",
            ].map((x) => (
              <th className={th} key={x}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {items.map((x) => (
            <tr
              className="transition hover:bg-slate-50/70 dark:hover:bg-white/5"
              key={txt(x.id)}
            >
              <td className={td}>
                <b className="block text-slate-900 dark:text-white">{txt(x.name)}</b>
                <small className="block text-slate-400">{txt(x.email)}</small>
              </td>
              <td className={td}>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {txt(x.role)}
                </span>
              </td>
              <td className={td}>
                <b className="block text-slate-800 dark:text-slate-200">
                  {txt(x.schoolName)}
                </b>
                <small className="font-mono text-slate-400">{txt(x.schoolId)}</small>
              </td>
              <td className={td}>
                <Badge value={x.status} />
              </td>
              <td className={td}>{date(x.createdAt)}</td>
              <td className={td}>{date(x.lastLogin)}</td>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Change status for ${txt(x.name)}`}
                    value={txt(x.status)}
                    onChange={(e) =>
                      void statusUpdate(
                        "user-status",
                        x.id,
                        e.target.value,
                        refresh,
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-bold outline-none dark:border-white/10 dark:bg-slate-800"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>

                  {txt(x.status) === "Active" && (
                    <DeleteRecordButton
                      label={`user ${txt(x.name)}`}
                      details={`${txt(x.email)} · ${txt(x.schoolName)}`}
                      url="/api/admin"
                      method="PATCH"
                      requestBody={{
                        type: "user-status",
                        id: x.id,
                        status: "Inactive",
                      }}
                      action="Deactivate"
                      onComplete={refresh}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty message="No registered platform users found." />}
    </Wrap>
  );
}

// ==========================================
// 9. ACTIVITY LOGS & AUDIT TRAIL
// ==========================================
function auditObject(value: unknown): Data {
  let current = value;
  for (let attempt = 0; attempt < 2 && typeof current === "string"; attempt++) {
    try {
      current = JSON.parse(current);
    } catch {
      return { value: current };
    }
  }
  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as Data)
    : {};
}

function auditLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function auditValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/paise$/i.test(key) && Number.isFinite(Number(value)))
    return money(Number(value) / 100);
  if (Array.isArray(value))
    return (
      value
        .map((item) =>
          typeof item === "object"
            ? Object.entries(auditObject(item))
                .map(([ck, cv]) => `${auditLabel(ck)}: ${auditValue(ck, cv)}`)
                .join(", ")
            : String(item),
        )
        .join("; ") || "—"
    );
  if (typeof value === "object")
    return (
      Object.entries(auditObject(value))
        .map(([ck, cv]) => `${auditLabel(ck)}: ${auditValue(ck, cv)}`)
        .join(" · ") || "—"
    );
  return String(value);
}

function AuditDetails({ value }: { value: unknown }) {
  const details = auditObject(value),
    entries = Object.entries(details);
  if (!entries.length)
    return <span className="text-slate-400">No additional details</span>;
  return (
    <dl className="grid min-w-64 gap-1.5">
      {entries.map(([key, item]) => (
        <div
          key={key}
          className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-2 text-xs"
        >
          <dt className="font-bold text-slate-400">{auditLabel(key)}</dt>
          <dd className="break-words font-semibold text-slate-800 dark:text-slate-200">
            {auditValue(key, item)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Audit({ data }: { data: Data }) {
  const items = arr(data.items);
  return (
    <Wrap count={items.length}>
      <table className="min-w-full divide-y divide-slate-100 dark:divide-white/10">
        <thead>
          <tr>
            {[
              "Action",
              "Resource Target",
              "Admin / Performer",
              "School",
              "Timestamp",
              "Audit Details",
            ].map((x) => (
              <th className={th} key={x}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {items.map((x) => (
            <tr className="border-t align-top" key={txt(x.id)}>
              <td className={`${td} font-bold text-slate-900 dark:text-white`}>
                {txt(x.action)}
              </td>
              <td className={td}>
                <b>{txt(x.entity)}</b>
                <small className="block max-w-52 break-all font-mono text-slate-400">
                  {txt(x.entityId)}
                </small>
              </td>
              <td className={td}>
                <b>{txt(x.userName)}</b>
                <small className="block text-slate-400">{txt(x.email)}</small>
              </td>
              <td className={td}>{txt(x.schoolName)}</td>
              <td className={`${td} whitespace-nowrap`}>{date(x.createdAt)}</td>
              <td className={td}>
                <AuditDetails value={x.details} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty message="No platform audit log entries recorded." />}
    </Wrap>
  );
}

function Notifications({ data }: { data: Data }) {
  const activities = arr(data.recent);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <h2 className="text-base font-black text-slate-900 dark:text-white">
        Platform Notifications &amp; System Events
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Recent automated system events, subscriptions, and administrative triggers
      </p>
      <div className="mt-5 divide-y divide-slate-100 dark:divide-white/5">
        {activities.length ? (
          activities.map((x, i) => (
            <div
              key={txt(x.id) || i}
              className="flex items-center gap-3 py-3"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                <Activity className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-xs font-bold text-slate-900 dark:text-white">
                  {txt(x.action)}
                </b>
                <p className="text-[11px] text-slate-500">
                  {txt(x.schoolName)} · {date(x.createdAt)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <Empty message="No active notifications." />
        )}
      </div>
    </section>
  );
}

// ==========================================
// 10. SYSTEM HEALTH & TELEMETRY
// ==========================================
function Health({ data }: { data: Data }) {
  const checks = [
    ["Database Connectivity", data.database, "PostgreSQL 54329"],
    ["Backend REST API", data.backend, "Next.js Route Handlers"],
    ["Platform Authentication", data.authentication, "Argon2 / BCrypt & HttpOnly"],
    ["Core Server", data.server, "Node.js Platform Runtime"],
    ["Razorpay Payment Gateway", data.paymentGateway, "Subscription Webhooks & Keys"],
    ["Email SMTP Service", data.emailService, "Transaction Notifications"],
    ["Environment", data.environment, "Operational Deployment"],
    ["Platform Version", data.applicationVersion, "EduLedger SaaS Engine"],
    ["Uptime", `${txt(data.uptimeSeconds)} seconds`, "Process duration"],
    ["API Latency", `${txt(data.apiLatencyMs)} ms`, "Roundtrip query response"],
    ["Telemetry Checked At", date(data.checkedAt), "System health probe"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map(([label, value, detail]) => (
          <article
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{String(label)}</span>
              <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </span>
            </div>
            <strong className="mt-3 block text-xl font-black text-slate-900 dark:text-white">
              {txt(value)}
            </strong>
            <small className="mt-1 block text-slate-400">{String(detail)}</small>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900">
        <ShieldCheck className="mb-2 size-4 text-emerald-600" />
        All health probes connect directly to internal database and platform services. Server secrets, credentials, and API secret keys are never exposed over any API endpoint.
      </div>
    </div>
  );
}

// ==========================================
// 11. PROFILE & SECURITY SETTINGS
// ==========================================
function Profile({ data }: { data: Data }) {
  const [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");

  async function securityUpdate(type: "change-password" | "logout-other-sessions") {
    setError("");
    setMessage("");
    if (type === "change-password" && newPassword !== confirmPassword)
      return setError("New passwords do not match.");
    setSaving(true);
    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, currentPassword, newPassword }),
      });
      const body = await readApiJson(response).catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Security update failed.");
      setMessage(body?.message || "Security settings updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Security update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 text-2xl font-black text-white">
          {txt(data.name).slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {txt(data.name)}
          </h2>
          <p className="text-xs text-slate-500">{txt(data.email)}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Super Admin · Platform Owner
          </span>
        </div>
      </div>

      <div className="mt-7 border-t border-slate-100 pt-6 dark:border-white/10">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">
          Platform Owner Credentials &amp; Session Controls
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Verify your current password before updating credentials or terminating other active sessions.
        </p>

        <div className="mt-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Current Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-800"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="At least 12 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Confirm New Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-800"
              />
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
            {message}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              saving ||
              !currentPassword ||
              newPassword.length < 12 ||
              confirmPassword.length < 12
            }
            onClick={() => void securityUpdate("change-password")}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "Updating…" : "Change Super Admin Password"}
          </button>
          <button
            type="button"
            disabled={saving || !currentPassword}
            onClick={() => void securityUpdate("logout-other-sessions")}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            Log Out Other Active Sessions
          </button>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// 12. ADMIN SETTINGS
// ==========================================
function AdminSettings({ data }: { data: Data }) {
  const [form, setForm] = useState(() => ({ ...data })),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");

  useEffect(() => setForm({ ...data }), [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "settings",
        settings: {
          ...form,
          sessionTimeoutMinutes: Number(form.sessionTimeoutMinutes),
          subscriptionGraceDays: Number(form.subscriptionGraceDays),
        },
      }),
    });
    const body = await readApiJson(response).catch(() => null);
    setMessage(
      response.ok
        ? "Platform and subscription lifecycle settings saved successfully."
        : body?.error || "Could not save settings.",
    );
    setSaving(false);
  }

  const toggle = (key: string, label: string) => (
    <label
      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
      key={key}
    >
      {label}
      <input
        type="checkbox"
        checked={Boolean(form[key])}
        onChange={(e) =>
          setForm((x) => ({ ...x, [key]: e.target.checked }))
        }
        className="size-4 accent-violet-600"
      />
    </label>
  );

  return (
    <form
      onSubmit={save}
      className="max-w-4xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
      <h2 className="text-base font-black text-slate-900 dark:text-white">
        Global SaaS Platform Settings
      </h2>
      <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
        {[
          ["applicationName", "Application Name"],
          ["supportEmail", "Platform Support Email"],
          ["currency", "Billing Currency (e.g. INR)"],
          ["timezone", "Platform Timezone"],
          ["dateFormat", "Date Format"],
          ["sessionTimeoutMinutes", "Session Timeout (Minutes)"],
        ].map(([key, label]) => (
          <label className="block" key={key}>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {label}
            </span>
            <input
              required
              value={txt(form[key]) === "—" ? "" : txt(form[key])}
              onChange={(e) =>
                setForm((x) => ({ ...x, [key]: e.target.value }))
              }
              type={
                key === "supportEmail"
                  ? "email"
                  : key === "sessionTimeoutMinutes"
                  ? "number"
                  : "text"
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-800"
            />
          </label>
        ))}
      </div>

      <h2 className="mt-8 border-t border-slate-100 pt-6 text-base font-black text-slate-900 dark:text-white dark:border-white/10">
        Subscription Lifecycle &amp; Notification Milestones
      </h2>
      <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
        <label className="block">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Notification Milestones (Days before expiry)
          </span>
          <input
            required
            value={
              txt(form.subscriptionWarningDays) === "—"
                ? "30,15,7,3,1,0,-1"
                : txt(form.subscriptionWarningDays)
            }
            onChange={(e) =>
              setForm((x) => ({
                ...x,
                subscriptionWarningDays: e.target.value.replaceAll(" ", ""),
              }))
            }
            placeholder="30,15,7,3,1,0,-1"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-800"
          />
          <small className="mt-1 block text-slate-400">
            Comma-separated days. Use -1 for post-expiry reminder.
          </small>
        </label>

        <label className="block">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Grace Period (Days after expiry)
          </span>
          <input
            type="number"
            min="0"
            max="90"
            required
            value={Number(form.subscriptionGraceDays) || 0}
            onChange={(e) =>
              setForm((x) => ({ ...x, subscriptionGraceDays: e.target.value }))
            }
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-800"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {toggle("subscriptionNotificationsEnabled", "Enable Subscription Expiry Notifications")}
        {toggle("inAppNotificationsEnabled", "Enable In-App Super Admin Notifications")}
        {toggle("emailNotificationsEnabled", "Enable Automated Email Notifications")}
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
          {message}
        </p>
      )}

      <button
        disabled={saving}
        className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Platform Settings"}
      </button>
    </form>
  );
}

function Badge({ value }: { value: unknown }) {
  const s = txt(value),
    lower = s.toLowerCase();
  let tone = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

  if (["active", "success", "paid", "operational", "connected"].includes(lower)) {
    tone =
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  } else if (["pending", "trial"].includes(lower)) {
    tone =
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  } else if (["inactive", "suspended", "failed", "expired", "cancelled"].includes(lower)) {
    tone =
      "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}
    >
      {s}
    </span>
  );
}

function Empty({
  message = "No real data is available for this view.",
}: {
  message?: string;
}) {
  return (
    <div className="grid min-h-36 place-items-center p-8 text-center text-xs text-slate-400">
      {message}
    </div>
  );
}
