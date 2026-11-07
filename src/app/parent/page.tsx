"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Loader2,
  Megaphone,
  School,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useParentContext } from "@/components/parent-context";
import { StudentPhotoImage } from "@/components/student-photo-image";

type OverviewData = {
  child: {
    id: string;
    name: string;
    admission: string;
    className: string;
    section: string;
    rollNumber: string;
    academicYear: string;
    fee: string;
    totalFee: number;
    paidFee: number;
    pendingFee: number;
    attendance: number;
  };
  todayAttendance: string;
  attendanceSummary: {
    totalDays: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    attendancePercentage: number;
  };
  pendingInvoices: Array<{
    id: string;
    invoiceNumber: string;
    feeType: string;
    finalAmount: number;
    pendingAmount: number;
    dueDate: string;
    status: string;
  }>;
  recentResults: Array<{
    id: string;
    examName: string;
    subject: string;
    marks: number;
    maxMarks: number;
    grade: string;
    status: string;
  }>;
  activeHomework: Array<{
    id: string;
    title: string;
    subject: string;
    dueDate: string;
  }>;
  todayTimetable: Array<{
    id: string;
    subject: string;
    teacherName: string;
    startTime: string;
    endTime: string;
  }>;
  announcements: Array<{
    id: string;
    title?: string;
    subject?: string;
    message?: string;
    createdAt?: string;
  }>;
};

export default function ParentDashboardPage() {
  const { selectedChild, children: childList, selectChild } = useParentContext();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedChild?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/parent/children/${selectedChild.id}/overview`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await readApiJson(res).catch(() => ({}));
          throw new Error(err.error || "Failed to load child overview.");
        }
        return readApiJson(res);
      })
      .then((json) => {
        if (active && json.overview) {
          setData(json.overview);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error loading dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedChild?.id]);

  if (childList.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
          <GraduationCap className="size-8" />
        </div>
        <h2 className="mt-4 text-2xl font-bold">No Students Linked Yet</h2>
        <p className="mt-2 text-sm text-muted">
          Your parent account is active, but no student records are currently linked. Please check with your school administrator or enter your invitation code.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/parent/activate"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-500"
          >
            Activate With Code
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="size-5 animate-spin text-blue-600" />
          Loading student dashboard...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-500">
        <p className="font-semibold">{error || "Failed to load dashboard data."}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow"
        >
          Retry
        </button>
      </div>
    );
  }

  const attendanceStatus = data.todayAttendance;
  const attendanceColor =
    attendanceStatus === "Present"
      ? "text-emerald-700 bg-emerald-100 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
      : attendanceStatus === "Absent"
      ? "text-rose-700 bg-rose-100 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
      : attendanceStatus === "Late"
      ? "text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
      : attendanceStatus === "Excused" || attendanceStatus === "Leave"
      ? "text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
      : "text-slate-700 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 space-y-1">
            <StudentPhotoImage studentId={data.child.id} name={data.child.name} size={64} className="rounded-2xl border border-white/20 object-cover" />
            <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-500/30 px-2.5 py-0.5 text-[11px] font-bold text-blue-200">
                Class {data.child.className} - {data.child.section}
              </span>
              <span className="text-xs text-slate-300">Roll No: {data.child.rollNumber || "—"}</span>
              <span className="text-xs text-slate-300">• Adm: {data.child.admission}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {data.child.name}
            </h1>
            <p className="text-xs text-slate-300 sm:text-sm">
              Academic Year {data.child.academicYear} • Overview & Updates
            </p>
            </div>
          </div>

          {/* Child Switcher Pills if parent has multiple children */}
          {childList.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-black/30 p-1.5 backdrop-blur-md">
              {childList.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectChild(c.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    c.id === selectedChild?.id
                      ? "bg-blue-500 text-white shadow"
                      : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {c.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Attendance */}
        <div className="rounded-2xl border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Attendance</span>
            <CalendarCheck2 className="size-4 text-blue-600" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`rounded-xl border px-3 py-1 text-sm font-black tracking-wide ${attendanceColor}`}
            >
              {attendanceStatus}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            {attendanceStatus === "Not Marked"
              ? "Attendance has not been marked for today yet."
              : `Status recorded for today's school session.`}
          </p>
        </div>

        {/* Monthly Attendance % */}
        <div className="rounded-2xl border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Attendance Rate</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {data.attendanceSummary.attendancePercentage}%
            </span>
            <span className="text-xs text-muted">
              ({data.attendanceSummary.presentCount}/{data.attendanceSummary.totalDays} days)
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className={`h-full rounded-full ${
                data.attendanceSummary.attendancePercentage >= 80
                  ? "bg-emerald-500"
                  : data.attendanceSummary.attendancePercentage >= 65
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(100, data.attendanceSummary.attendancePercentage)}%` }}
            />
          </div>
        </div>

        {/* Pending Fee */}
        <div className="rounded-2xl border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Fee Balance</span>
            <CreditCard className="size-4 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                data.child.pendingFee > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              ₹{Number(data.child.pendingFee).toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-muted">
              {data.child.pendingFee > 0 ? "Outstanding" : "Cleared"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-muted">
              Paid: ₹{Number(data.child.paidFee).toLocaleString("en-IN")}
            </span>
            {data.child.pendingFee > 0 && (
              <Link
                href="/parent/fees"
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Pay Now &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Academic Status / Exams */}
        <div className="rounded-2xl border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Academics</span>
            <FileCheck2 className="size-4 text-purple-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            {data.recentResults.length > 0 ? (
              <>
                <span className="text-2xl font-black text-foreground">
                  {data.recentResults[0].grade || "Passed"}
                </span>
                <span className="text-xs text-muted">
                  Latest: {data.recentResults[0].subject} ({data.recentResults[0].marks}/{data.recentResults[0].maxMarks})
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-muted">No exams recorded</span>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            <Link href="/parent/results" className="font-bold text-blue-600 hover:underline">
              View All Marks & Report &rarr;
            </Link>
          </p>
        </div>
      </div>

      {/* Main Grid: Schedule & Homework vs Invoices & Notices */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Timetable */}
        <section className="rounded-3xl border bg-panel p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <CalendarDays className="size-4 text-blue-600" />
              <span>Today&apos;s Class Schedule</span>
            </div>
            <Link href="/parent/timetable" className="text-xs font-bold text-blue-600 hover:underline">
              Full Timetable &rarr;
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {data.todayTimetable.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">
                No classes scheduled for today.
              </p>
            ) : (
              data.todayTimetable.map((period, idx) => (
                <div
                  key={period.id || idx}
                  className="flex items-center justify-between rounded-2xl border bg-canvas p-3 transition hover:border-blue-400"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-foreground">{period.subject}</p>
                      <p className="text-[11px] text-muted">{period.teacherName || "Assigned Faculty"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                      <Clock className="size-3 text-blue-600" />
                      {period.startTime} - {period.endTime}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Active Homework */}
        <section className="rounded-3xl border bg-panel p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <BookOpen className="size-4 text-emerald-600" />
              <span>Active Homework & Assignments</span>
            </div>
            <Link href="/parent/homework" className="text-xs font-bold text-blue-600 hover:underline">
              View All &rarr;
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {data.activeHomework.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">
                No pending homework assignments.
              </p>
            ) : (
              data.activeHomework.map((hw) => (
                <div
                  key={hw.id}
                  className="flex items-center justify-between rounded-2xl border bg-canvas p-3 transition hover:border-emerald-400"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {hw.subject}
                      </span>
                      <p className="truncate text-xs font-bold text-foreground">{hw.title}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-medium text-muted">Due Date</p>
                    <p className="text-xs font-bold text-foreground">{hw.dueDate}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Pending Fees Banner if applicable */}
      {data.pendingInvoices.length > 0 && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Pending Fee Invoices Require Attention
                </h3>
                <p className="mt-1 text-xs text-muted">
                  You have {data.pendingInvoices.length} outstanding invoice(s) totaling ₹{Number(data.child.pendingFee).toLocaleString("en-IN")}. Settle securely online via Razorpay.
                </p>
              </div>
            </div>
            <Link
              href="/parent/fees"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-amber-500"
            >
              Pay Fees Online &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* School Announcements */}
      <section className="rounded-3xl border bg-panel p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Megaphone className="size-4 text-blue-600" />
            <span>School Announcements & Broadcasts</span>
          </div>
          <Link href="/parent/notices" className="text-xs font-bold text-blue-600 hover:underline">
            All Notices &rarr;
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {data.announcements.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">
              No general announcements at this time.
            </p>
          ) : (
            data.announcements.map((ann, i) => (
              <div
                key={ann.id || i}
                className="rounded-2xl border bg-canvas p-4 transition hover:border-blue-400"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground">
                    {ann.title || ann.subject || "Notice"}
                  </h4>
                  {ann.createdAt && (
                    <span className="text-[10px] text-muted">
                      {new Date(ann.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
                {ann.message && (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted line-clamp-2">
                    {ann.message}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
