"use client";

import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  GraduationCap,
  HeartPulse,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Data = Record<string, unknown>;
const object = (value: unknown) => (value && typeof value === "object" ? (value as Data) : {});
const list = (value: unknown) => (Array.isArray(value) ? (value as Data[]) : []);
const text = (value: unknown) => (value == null || value === "" ? "—" : String(value));
const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const number = (value: unknown) =>
  new Intl.NumberFormat("en-IN").format(Number(value) || 0);
const date = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: String(value).includes("T") ? "short" : undefined,
      }).format(new Date(String(value)))
    : "—";

const quickActions = [
  { label: "Manage Schools", href: "/admin/schools", icon: Building2 },
  { label: "Manage Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Payments & Revenue", href: "/admin/revenue-payments", icon: ReceiptText },
  { label: "Platform Users", href: "/admin/users", icon: Users },
  { label: "Platform Analytics", href: "/admin/analytics", icon: TrendingUp },
  { label: "System Health", href: "/admin/system-health", icon: HeartPulse },
  { label: "Platform Settings", href: "/admin/settings", icon: Settings },
] as const;

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  badge,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  badge?: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${tone}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <strong className="mt-2 block text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {value}
          </strong>
        </div>
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone} text-white shadow-md`}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          {detail}
        </p>
        {badge && (
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {badge}
          </span>
        )}
      </div>
    </article>
  );
}

export function AdminOverview({
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
  onPreset: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const users = object(data.users),
    schools = object(data.schools),
    subscriptions = object(data.subscriptions),
    finance = object(data.finance),
    trend = list(data.revenueTrend),
    activities = list(data.recent),
    recentSchools = list(data.recentSchools);

  // 12 LIVE STATISTICS - Exact matches from database
  const live12Metrics = [
    {
      label: "1. Total Registered Schools",
      value: number(schools.total),
      detail: `${number(schools.period)} added in this filter period`,
      icon: Building2,
      tone: "bg-gradient-to-r from-blue-600 to-indigo-600",
      badge: "Platform DB",
    },
    {
      label: "2. Active Schools",
      value: number(schools.active),
      detail: "Operational with active institution status",
      icon: CheckCircle2,
      tone: "bg-gradient-to-r from-emerald-600 to-teal-500",
      badge: `${number(schools.active)} Active`,
    },
    {
      label: "3. Inactive Schools",
      value: number(schools.inactive),
      detail: "Inactive or suspended school profiles",
      icon: ShieldX,
      tone: "bg-gradient-to-r from-slate-600 to-zinc-700",
      badge: "Inactive",
    },
    {
      label: "4. Trial Schools",
      value: number(schools.trial),
      detail: "Onboarding or trial grace subscription",
      icon: Clock,
      tone: "bg-gradient-to-r from-amber-500 to-yellow-600",
      badge: "Trial",
    },
    {
      label: "5. Total Registered Students",
      value: number(users.totalStudents),
      detail: "Active student records across all schools",
      icon: GraduationCap,
      tone: "bg-gradient-to-r from-violet-600 to-purple-600",
      badge: "Platform total",
    },
    {
      label: "6. Total Teachers",
      value: number(users.totalTeachers),
      detail: "Faculty profiles active across all schools",
      icon: Users,
      tone: "bg-gradient-to-r from-indigo-600 to-sky-600",
      badge: "Teaching staff",
    },
    {
      label: "7. Total School Administrators",
      value: number(users.totalSchoolAdmins),
      detail: "Registered school administration accounts",
      icon: UserCheck,
      tone: "bg-gradient-to-r from-cyan-600 to-blue-600",
      badge: "Admin users",
    },
    {
      label: "8. Total Subscription Revenue",
      value: money(finance.totalRevenue),
      detail: "All-time EduLedger platform revenue",
      icon: CircleDollarSign,
      tone: "bg-gradient-to-r from-fuchsia-600 to-pink-600",
      badge: "Platform only",
    },
    {
      label: "9. Monthly Revenue",
      value: money(finance.monthRevenue),
      detail: "Platform subscription collections this month",
      icon: TrendingUp,
      tone: "bg-gradient-to-r from-emerald-500 to-teal-600",
      badge: "Current month",
    },
    {
      label: "10. Pending Payments",
      value: number(finance.pending),
      detail: "Pending Razorpay transactions & orders",
      icon: AlertCircle,
      tone: "bg-gradient-to-r from-orange-500 to-amber-600",
      badge: "Pending",
    },
    {
      label: "11. Expired Subscriptions",
      value: number(subscriptions.expired),
      detail: "Subscriptions past expiry date or cancelled",
      icon: ShieldX,
      tone: "bg-gradient-to-r from-rose-600 to-red-600",
      badge: "Expired",
    },
    {
      label: "12. Subscriptions Expiring Soon",
      value: number(subscriptions.expiringSoon),
      detail: `7d: ${number(subscriptions.expiring7d)} · 15d: ${number(subscriptions.expiring15d)} · 30d: ${number(subscriptions.expiring30d)}`,
      icon: AlertTriangle,
      tone: "bg-gradient-to-r from-amber-600 to-orange-500",
      badge: "Next 30 days",
    },
  ] as const;

  return (
    <div className="space-y-7">
      {/* Header with Title and Date Preset Filter */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
            <ShieldCheck className="size-3.5" />
            <span>EduLedger SaaS Platform Overview</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Super Admin Portal
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Live metrics aggregated directly from the platform database. Platform-owner financial visibility only.
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <span className="px-2 text-xs font-bold text-slate-500">Filter Range:</span>
          <select
            aria-label="Dashboard date range"
            value={preset}
            onChange={(event) => onPreset(event.target.value)}
            className="h-10 rounded-xl border-0 bg-slate-100 px-3 text-xs font-bold text-slate-800 outline-none transition focus:ring-2 focus:ring-violet-500 dark:bg-slate-800 dark:text-slate-100"
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
                aria-label="Start date"
                type="date"
                value={from}
                onChange={(event) => onFrom(event.target.value)}
                className="h-10 rounded-xl bg-slate-100 px-2 text-xs dark:bg-slate-800"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                aria-label="End date"
                type="date"
                min={from}
                value={to}
                onChange={(event) => onTo(event.target.value)}
                className="h-10 rounded-xl bg-slate-100 px-2 text-xs dark:bg-slate-800"
              />
            </div>
          )}
        </div>
      </header>

      {/* 12 Live Statistics Grid */}
      <section aria-label="12 Live Statistics">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Platform-Wide Live Metrics (12 Real-Time Stats)
          </h2>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            ● Live Database Sync
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {live12Metrics.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              detail={item.detail}
              icon={item.icon}
              tone={item.tone}
              badge={item.badge}
            />
          ))}
        </div>
      </section>

      {/* Main Charts & Quick Actions */}
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Revenue & Subscription Growth Chart */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white sm:text-lg">
                EduLedger Platform Subscription Revenue &amp; Growth
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Activity records from {date(from)} to {date(to)} (Platform subscription collections only)
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Verified Revenue
            </span>
          </div>

          <div className="mt-6 h-80 min-w-[500px] sm:min-w-0">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="revenue"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `₹${Number(val) / 1000}k`}
                  />
                  <YAxis
                    yAxisId="subscriptions"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(val, name) =>
                      name === "Revenue" ? money(val) : number(val)
                    }
                  />
                  <Legend />
                  <Bar
                    yAxisId="revenue"
                    dataKey="amount"
                    name="Revenue"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    yAxisId="subscriptions"
                    type="monotone"
                    dataKey="subscriptions"
                    name="Subscriptions"
                    stroke="#14b8a6"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-center text-xs text-slate-400">
                No subscription revenue recorded in this date range.
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions Card */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            Quick Platform Actions
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Immediate shortcuts to primary modules
          </p>
          <div className="mt-4 space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs font-bold transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/5 dark:bg-white/5 dark:hover:bg-violet-950/30"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-white text-violet-600 shadow-sm dark:bg-slate-800 dark:text-violet-400">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 text-slate-800 dark:text-slate-200">
                    {action.label}
                  </span>
                  <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600" />
                </Link>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Recent Activity and Recent Registered Schools */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        {/* Recent Events */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Recent Platform Events
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Administrative actions and subscription events
              </p>
            </div>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-black text-violet-600 hover:underline dark:text-violet-400"
            >
              View All Logs →
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
            {activities.length ? (
              activities.map((item, index) => (
                <div
                  key={text(item.id) || index}
                  className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
                      <Activity className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <b className="block truncate text-xs font-bold text-slate-900 dark:text-white">
                        {text(item.action)}
                      </b>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {text(item.schoolName) !== "—"
                          ? text(item.schoolName)
                          : text(item.userName)}
                      </p>
                    </div>
                  </div>
                  <time className="text-[11px] font-medium text-slate-400 sm:text-right">
                    {date(item.createdAt)}
                  </time>
                </div>
              ))
            ) : (
              <div className="grid min-h-28 place-items-center text-xs text-slate-400">
                No recent platform activity recorded.
              </div>
            )}
          </div>
        </section>

        {/* Recently Registered Schools */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Recently Registered Schools
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Newest institutions on EduLedger
              </p>
            </div>
            <Link
              href="/admin/schools"
              className="text-xs font-black text-violet-600 hover:underline dark:text-violet-400"
            >
              All Schools →
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
            {recentSchools.length ? (
              recentSchools.map((school, index) => (
                <div key={text(school.id) || index} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="block truncate text-xs font-bold text-slate-900 dark:text-white">
                        {text(school.name)}
                      </b>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {number(school.students)} students · {text(school.planName)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        String(school.status).toLowerCase() === "active"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {text(school.status)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Registered {date(school.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <div className="grid min-h-28 place-items-center text-xs text-slate-400">
                No schools registered yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
