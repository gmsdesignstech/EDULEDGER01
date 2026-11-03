"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  XCircle,
} from "lucide-react";
import { useParentContext } from "@/components/parent-context";

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  remarks: string;
};

type AttendanceSummary = {
  totalDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  halfDayCount: number;
  attendancePercentage: number;
};

export default function ParentAttendancePage() {
  const { selectedChild } = useParentContext();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  useEffect(() => {
    if (!selectedChild?.id) return;
    let active = true;
    setLoading(true);
    setError("");

    const url = `/api/parent/children/${selectedChild.id}/attendance?month=${selectedMonth}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load attendance.");
        }
        return res.json();
      })
      .then((data) => {
        if (active) {
          setRecords(data.records || []);
          setSummary(data.summary || null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error loading attendance.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedChild?.id, selectedMonth]);

  function formatMonthLabel(m: string) {
    const [y, mon] = m.split("-");
    const d = new Date(Number(y), Number(mon) - 1, 1);
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  function changeMonth(delta: number) {
    const [y, mon] = selectedMonth.split("-").map(Number);
    const d = new Date(y, mon - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonth);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "Present":
        return "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
      case "Absent":
        return "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800";
      case "Late":
        return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
      case "Excused":
      case "Leave":
        return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
      case "Half-day":
      case "Half Day":
        return "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  }

  if (!selectedChild) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        Select a child from the top bar to view attendance records.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Title & Month Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Attendance Tracker</h1>
          <p className="mt-1 text-xs text-muted">
            Daily logs and monthly attendance statistics for {selectedChild.name} (Class {selectedChild.className}-{selectedChild.section})
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border bg-panel p-1.5 shadow-sm">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-xl p-2 text-muted hover:bg-canvas hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[130px] text-center text-xs font-bold text-foreground">
            {formatMonthLabel(selectedMonth)}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="rounded-xl p-2 text-muted hover:bg-canvas hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border bg-panel p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Days</p>
            <p className="mt-1 text-2xl font-black text-foreground">{summary.totalDays}</p>
          </div>
          <div className="rounded-2xl border bg-panel p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Present</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{summary.presentCount}</p>
          </div>
          <div className="rounded-2xl border bg-panel p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Absent</p>
            <p className="mt-1 text-2xl font-black text-rose-600">{summary.absentCount}</p>
          </div>
          <div className="rounded-2xl border bg-panel p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Late</p>
            <p className="mt-1 text-2xl font-black text-amber-600">{summary.lateCount}</p>
          </div>
          <div className="rounded-2xl border bg-panel p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Excused</p>
            <p className="mt-1 text-2xl font-black text-blue-600">{summary.excusedCount}</p>
          </div>
          <div className="rounded-2xl border bg-panel p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Attendance %</p>
            <p className="mt-1 text-2xl font-black text-purple-600">{summary.attendancePercentage}%</p>
          </div>
        </div>
      )}

      {/* Attendance History Table */}
      <div className="rounded-3xl border bg-panel p-6 shadow-sm">
        <h2 className="text-base font-bold text-foreground mb-4">
          Daily Attendance History ({formatMonthLabel(selectedMonth)})
        </h2>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-xs text-red-500">
            {error}
          </div>
        ) : records.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted">
            No attendance records found for this month.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 px-4">Day</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 pl-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => {
                  const dateObj = new Date(`${r.date}T00:00:00Z`);
                  const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
                  const dateFormatted = dateObj.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  });
                  return (
                    <tr key={r.id || r.date} className="transition hover:bg-canvas">
                      <td className="py-3.5 pr-4 font-semibold text-foreground">
                        {dateFormatted}
                      </td>
                      <td className="py-3.5 px-4 text-muted">{dayName}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStatusBadge(
                            r.status
                          )}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-muted">
                        {r.remarks || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

