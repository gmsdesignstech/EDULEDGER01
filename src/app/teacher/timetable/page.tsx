"use client";

import { readApiJson } from "@/lib/api-response";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  Layers3,
  Loader2,
  CalendarCheck2,
  AlertCircle,
} from "lucide-react";

type TimetableEntry = {
  id: string;
  academicYear: string;
  className: string;
  section: string;
  subject: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room?: string;
};

const days = [
  { index: 1, label: "Monday" },
  { index: 2, label: "Tuesday" },
  { index: 3, label: "Wednesday" },
  { index: 4, label: "Thursday" },
  { index: 5, label: "Friday" },
  { index: 6, label: "Saturday" },
];

export default function TeacherTimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentDay = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const initialActiveDay = currentDay >= 1 && currentDay <= 6 ? currentDay : 1;
  const [activeDay, setActiveDay] = useState<number>(initialActiveDay);

  useEffect(() => {
    fetch("/api/teacher/timetable")
      .then(async (res) => {
        if (!res.ok) {
          const err = await readApiJson(res).catch(() => null);
          throw new Error(err?.error || "Could not load timetable");
        }
        return readApiJson(res);
      })
      .then((data) => {
        setEntries(data.timetable || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load timetable");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading daily timetable…</p>
      </div>
    );
  }

  const dayEntries = entries
    .filter((e) => e.weekday === activeDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Daily Timetable</h1>
          <p className="text-xs text-muted sm:text-sm">
            Your weekly class schedule and teaching periods
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border bg-panel px-3 py-1.5 text-xs font-bold shadow-sm">
          <CalendarDays className="size-4 text-blue-600" />
          <span>{entries.length} Total Periods</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="size-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Weekday Selector Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 sm:pb-0">
        {days.map((d) => {
          const count = entries.filter((e) => e.weekday === d.index).length;
          const isToday = d.index === currentDay;
          const isSelected = activeDay === d.index;
          return (
            <button
              key={d.index}
              onClick={() => setActiveDay(d.index)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                  : "border bg-panel text-muted hover:border-blue-400 hover:text-foreground"
                }`}
            >
              <span>{d.label}</span>
              {isToday && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] uppercase font-black ${isSelected ? "bg-white text-blue-700" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    }`}
                >
                  Today
                </span>
              )}
              <span
                className={`ml-1 rounded-md px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-white/20 text-white" : "bg-canvas text-muted"
                  }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Daily Periods List */}
      <div className="space-y-3">
        {dayEntries.length > 0 ? (
          dayEntries.map((period, index) => (
            <div
              key={period.id}
              className="flex flex-col gap-4 rounded-3xl border bg-panel p-5 shadow-sm transition hover:border-blue-400 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 font-black text-white shadow">
                  P{index + 1}
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {period.className} - {period.section}
                    </span>
                    <span className="text-xs text-muted font-semibold">
                      AY {period.academicYear}
                    </span>
                  </div>

                  <h3 className="mt-1 text-base font-bold text-foreground">
                    {period.subject}
                  </h3>

                  <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="size-3 text-blue-600" />
                      {period.startTime} – {period.endTime}
                    </span>
                    {period.room && (
                      <span className="flex items-center gap-1">
                        <Layers3 className="size-3" /> Room {period.room}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t pt-3 sm:border-t-0 sm:pt-0">
                <Link
                  href={`/teacher/attendance?class=${encodeURIComponent(period.className)}&section=${encodeURIComponent(period.section)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border bg-canvas px-3 py-2 text-xs font-bold text-foreground transition hover:border-blue-400 hover:bg-panel"
                >
                  <CalendarCheck2 className="size-3.5 text-blue-600" />
                  Mark Attendance
                </Link>
                <Link
                  href={`/teacher/homework?class=${encodeURIComponent(period.className)}&section=${encodeURIComponent(period.section)}&subject=${encodeURIComponent(period.subject)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                >
                  Assign HW
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed bg-panel p-12 text-center">
            <Clock className="mx-auto size-10 text-muted" />
            <h3 className="mt-3 text-base font-bold">No classes scheduled</h3>
            <p className="mt-1 text-xs text-muted">
              You do not have any teaching periods scheduled on this day.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

