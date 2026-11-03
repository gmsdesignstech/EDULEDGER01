"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  GraduationCap,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useParentContext } from "@/components/parent-context";

type TimetableEntry = {
  id: string;
  subject: string;
  teacherName: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

const WEEKDAYS = [
  { num: 1, label: "Monday" },
  { num: 2, label: "Tuesday" },
  { num: 3, label: "Wednesday" },
  { num: 4, label: "Thursday" },
  { num: 5, label: "Friday" },
  { num: 6, label: "Saturday" },
];

export default function ParentTimetablePage() {
  const { selectedChild } = useParentContext();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentDayNum = new Date().getDay(); // 0 is Sun, 1 is Mon...
  const initialDay = currentDayNum === 0 || currentDayNum > 6 ? 1 : currentDayNum;
  const [selectedDay, setSelectedDay] = useState<number>(initialDay);

  useEffect(() => {
    if (!selectedChild?.id) return;
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/parent/children/${selectedChild.id}/timetable`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load timetable.");
        }
        return res.json();
      })
      .then((data) => {
        if (active) setEntries(data.timetable || []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error loading timetable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedChild?.id]);

  if (!selectedChild) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        Select a child from the top bar to view timetable.
      </div>
    );
  }

  const dayEntries = entries.filter((e) => e.weekday === selectedDay);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-foreground">Class Timetable</h1>
        <p className="mt-1 text-xs text-muted">
          Weekly period schedule and faculty allocation for {selectedChild.name} (Class {selectedChild.className}-{selectedChild.section})
        </p>
      </div>

      {/* Weekday Switcher */}
      <div className="flex overflow-x-auto pb-2 scrollbar-none gap-2">
        {WEEKDAYS.map((day) => {
          const isToday = currentDayNum === day.num;
          const isSelected = selectedDay === day.num;
          return (
            <button
              key={day.num}
              onClick={() => setSelectedDay(day.num)}
              className={`flex items-center gap-2 shrink-0 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
                isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "border bg-panel text-muted hover:text-foreground hover:bg-canvas"
              }`}
            >
              <span>{day.label}</span>
              {isToday && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-black uppercase ${
                    isSelected ? "bg-white text-blue-700" : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  }`}
                >
                  Today
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-xs text-red-500">
          {error}
        </div>
      ) : dayEntries.length === 0 ? (
        <div className="rounded-3xl border bg-panel p-12 text-center text-xs text-muted">
          No class periods scheduled for {WEEKDAYS.find((w) => w.num === selectedDay)?.label}.
        </div>
      ) : (
        <div className="space-y-3">
          {dayEntries.map((period, index) => (
            <div
              key={period.id || index}
              className="flex items-center justify-between rounded-3xl border bg-panel p-5 shadow-sm transition hover:border-blue-400"
            >
              <div className="flex items-center gap-4">
                <span className="grid size-10 place-items-center rounded-2xl bg-blue-100 text-sm font-black text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{period.subject}</h3>
                  <p className="text-xs text-muted">Faculty: {period.teacherName || "Assigned Teacher"}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border bg-canvas px-3 py-1.5 text-xs font-semibold text-foreground">
                <Clock className="size-3.5 text-blue-600" />
                <span>
                  {period.startTime} - {period.endTime}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

