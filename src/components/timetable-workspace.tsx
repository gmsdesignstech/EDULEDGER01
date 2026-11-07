"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Globe2,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { TimetableSettings, TimetableSlot } from "@/lib/timetable";
import { timeMinutes } from "@/lib/timetable";
import { useEduCache, useEduQuery } from "./edu-cache-provider";

type Entry = {
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherName: string;
  teacherId?: string | null;
};
type SavedEntry = Entry & {
  id: string;
  className: string;
  section: string;
  academicYear: string;
  teacherId: string | null;
  generated: boolean;
  status: "Draft" | "Published" | "Archived";
};
type Teacher = { id: string; name: string; subject: string };
type SchoolClass = { name: string; section: string; academicYear: string };
type Payload = {
  academicYear: string;
  settings: TimetableSettings;
  classes: SchoolClass[];
  slots: TimetableSlot[];
  preview: { entries: Entry[]; warnings: string[]; manualCount: number } | null;
  entries: SavedEntry[];
  teachers: Teacher[];
  previewError: string;
  canEdit: boolean;
};

type EditablePeriod = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherId: string | null;
  teacherName: string;
};

const field =
  "w-full rounded-xl border bg-panel px-3 py-2 text-sm outline-none focus:border-brand";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const clock = (value: string) => {
  try {
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
  } catch {
    return value;
  }
};

export function TimetableWorkspace() {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<TimetableSettings | null>(null);
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const [year, setYear] = useState(() => params.get("academicYear") || "");
  const [className, setClassName] = useState(() => params.get("className") || "");
  const [section, setSection] = useState(() => params.get("section") || "");
  const [customEnd, setCustomEnd] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingSingle, setEditingSingle] = useState<SavedEntry | null>(null);

  // Batch editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editableEntries, setEditableEntries] = useState<EditablePeriod[]>([]);
  const [selectedDayTab, setSelectedDayTab] = useState<number>(1); // 1 = Monday
  const [addingDay, setAddingDay] = useState<number | null>(null);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (year) q.set("academicYear", year);
    if (className && section) {
      q.set("className", className);
      q.set("section", section);
    }
    return `/api/timetable?${q}`;
  }, [year, className, section]);

  const { data: cachedData, error: queryError, isLoading: loading } =
    useEduQuery<Payload>(query);
  const { invalidate } = useEduCache();

  useEffect(() => {
    if (cachedData) {
      setData(cachedData);
      setDraft(cachedData.settings);
      if (!year) setYear(cachedData.academicYear);
    }
  }, [cachedData, year]);

  useEffect(() => {
    if (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : "Could not load timetable."
      );
    }
  }, [queryError]);

  // Warn if navigating away with unsaved changes
  useEffect(() => {
    if (!isEditing || editableEntries.length === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditing, editableEntries.length]);

  const sections = useMemo(
    () =>
      [
        ...new Set(
          data?.classes
            .filter((item) => item.name === className)
            .map((item) => item.section) || []
        ),
      ].sort(),
    [data, className]
  );

  const availableSubjects = useMemo(() => {
    const fromTeachers = (data?.teachers || []).map((t) => t.subject).filter(Boolean);
    const fromEntries = (data?.entries || []).map((e) => e.subject).filter(Boolean);
    return [...new Set([...fromTeachers, ...fromEntries])].sort();
  }, [data]);

  // Save Settings
  async function saveTiming() {
    if (!draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/timetable", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error || "Could not save settings.");
      setNotice("School timing saved. Review the new preview before generating.");
      await invalidate("/api/timetable");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  // Generate and Save Timetable
  async function generate() {
    if (!className || !section || !year) return;
    if (
      !window.confirm(
        `Generate the weekly timetable for ${className} ${section}? Existing generated entries will be refreshed. Manual entries stay in place.`
      )
    )
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className, section, academicYear: year }),
      });
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error || "Could not generate timetable.");
      setNotice(
        `Saved ${body.result?.entries?.length || 0} periods for ${className} ${section}.`
      );
      await invalidate("/api/timetable");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate timetable.");
    } finally {
      setSaving(false);
    }
  }

  // Publish Timetable
  async function publish() {
    if (!className || !section || !year) return;
    if (
      !window.confirm(
        `Publish the validated timetable for ${className} ${section}? It will become visible in the teacher and parent portals.`
      )
    )
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          className,
          section,
          academicYear: year,
        }),
      });
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error || "Could not publish timetable.");
      setNotice("Timetable published to the teacher and parent portals.");
      await invalidate("/api/timetable");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish timetable.");
    } finally {
      setSaving(false);
    }
  }

  // Start Batch Editing Mode
  function startEditing() {
    if (!className || !section) return;
    const initial: EditablePeriod[] =
      data?.entries && data.entries.length > 0
        ? data.entries.map((e) => ({
          id: e.id,
          weekday: e.weekday,
          startTime: e.startTime,
          endTime: e.endTime,
          subject: e.subject,
          teacherId: e.teacherId ?? null,
          teacherName: e.teacherName,
        }))
        : (data?.preview?.entries || []).map((e, idx) => ({
          id: `gen-${idx}-${Date.now()}`,
          weekday: e.weekday,
          startTime: e.startTime,
          endTime: e.endTime,
          subject: e.subject,
          teacherId: e.teacherId ?? null,
          teacherName: e.teacherName,
        }));

    setEditableEntries(initial);
    setIsEditing(true);
    setError("");
    setNotice("");
  }

  // Cancel Batch Editing
  function cancelEditing() {
    if (
      window.confirm(
        "Discard unsaved timetable changes? All edits in this session will be reverted."
      )
    ) {
      setIsEditing(false);
      setEditableEntries([]);
      setError("");
    }
  }

  // Reorder Period Up / Down on a specific day
  function movePeriod(day: number, indexOnDay: number, direction: "up" | "down") {
    const dayPeriods = editableEntries
      .filter((e) => e.weekday === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const targetIndex = direction === "up" ? indexOnDay - 1 : indexOnDay + 1;
    if (targetIndex < 0 || targetIndex >= dayPeriods.length) return;

    const current = dayPeriods[indexOnDay];
    const target = dayPeriods[targetIndex];

    // Swap their timings so they stay chronological
    const currentStart = current.startTime;
    const currentEnd = current.endTime;
    const targetStart = target.startTime;
    const targetEnd = target.endTime;

    setEditableEntries((prev) =>
      prev.map((p) => {
        if (p.id === current.id) {
          return { ...p, startTime: targetStart, endTime: targetEnd };
        }
        if (p.id === target.id) {
          return { ...p, startTime: currentStart, endTime: currentEnd };
        }
        return p;
      })
    );
  }

  // Add Period to a specific Day
  function addPeriodToDay(day: number) {
    const dayPeriods = editableEntries
      .filter((e) => e.weekday === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    let start = "09:00";
    let end = "09:40";
    const periodMin = draft?.periodMinutes || 40;

    if (dayPeriods.length > 0) {
      const last = dayPeriods[dayPeriods.length - 1];
      start = last.endTime;
      try {
        const lastMinutes = timeMinutes(start);
        const nextEndMinutes = lastMinutes + periodMin;
        end = `${String(Math.floor(nextEndMinutes / 60)).padStart(2, "0")}:${String(
          nextEndMinutes % 60
        ).padStart(2, "0")}`;
      } catch {
        end = "10:20";
      }
    }

    const defaultTeacher = data?.teachers?.[0];
    const newPeriod: EditablePeriod = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      weekday: day,
      startTime: start,
      endTime: end,
      subject: defaultTeacher?.subject || "General",
      teacherId: defaultTeacher?.id || null,
      teacherName: defaultTeacher?.name || "Unassigned",
    };

    setEditableEntries((prev) => [...prev, newPeriod]);
  }

  // Delete Period from editable list
  function deleteEditablePeriod(id: string, subject: string, day: number) {
    if (
      !window.confirm(
        `Are you sure you want to remove the '${subject}' period from ${days[day]}?`
      )
    )
      return;
    setEditableEntries((prev) => prev.filter((p) => p.id !== id));
  }

  // Update a single period in the editable list
  function updateEditablePeriod(
    id: string,
    fieldKey: "subject" | "teacherId" | "startTime" | "endTime",
    val: string
  ) {
    setEditableEntries((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (fieldKey === "teacherId") {
          const teacherObj = (data?.teachers || []).find((t) => t.id === val);
          return {
            ...p,
            teacherId: val || null,
            teacherName: teacherObj ? teacherObj.name : "Unassigned",
          };
        }
        return { ...p, [fieldKey]: val };
      })
    );
  }

  // Save All Changes from Edit Mode
  async function saveEditedTimetable(targetStatus: "Draft" | "Published") {
    if (saving || !className || !section || !year) return;

    // Client-side pre-validations
    for (const p of editableEntries) {
      if (!p.subject.trim()) {
        setError("Every timetable period must have a valid subject name.");
        return;
      }
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endTime)
      ) {
        setError(`Invalid time format in period '${p.subject}'. Use HH:mm format.`);
        return;
      }
      if (timeMinutes(p.endTime) <= timeMinutes(p.startTime)) {
        setError(
          `Invalid timing in '${p.subject}': end time (${p.endTime}) must be later than start time (${p.startTime}).`
        );
        return;
      }
    }

    // Check internal class overlaps
    for (let i = 0; i < editableEntries.length; i++) {
      for (let j = i + 1; j < editableEntries.length; j++) {
        const a = editableEntries[i];
        const b = editableEntries[j];
        if (a.weekday !== b.weekday) continue;
        const aStart = timeMinutes(a.startTime);
        const aEnd = timeMinutes(a.endTime);
        const bStart = timeMinutes(b.startTime);
        const bEnd = timeMinutes(b.endTime);
        if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
          setError(
            `Timetable conflict: '${a.subject}' (${clock(a.startTime)}–${clock(
              a.endTime
            )}) overlaps with '${b.subject}' (${clock(b.startTime)}–${clock(
              b.endTime
            )}) on ${days[a.weekday]}.`
          );
          return;
        }
      }
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-edited",
          className,
          section,
          academicYear: year,
          status: targetStatus,
          entries: editableEntries.map((e) => ({
            id: e.id.startsWith("new-") || e.id.startsWith("gen-") ? undefined : e.id,
            weekday: e.weekday,
            startTime: e.startTime,
            endTime: e.endTime,
            subject: e.subject.trim(),
            teacherId: e.teacherId || null,
          })),
        }),
      });

      const body = await readApiJson(response);
      if (!response.ok) {
        throw new Error(body.error || "Could not save the timetable.");
      }

      setIsEditing(false);
      setEditableEntries([]);
      setNotice(
        targetStatus === "Published"
          ? `Successfully saved and published ${editableEntries.length} periods for Class ${className} Section ${section}.`
          : `Saved ${editableEntries.length} periods as draft for Class ${className} Section ${section}.`
      );
      await invalidate("/api/timetable");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the timetable."
      );
      // Retain editableEntries so user can fix and retry
    } finally {
      setSaving(false);
    }
  }

  // Single Entry Update from modal
  async function updateSingleEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSingle) return;
    setSaving(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/timetable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingSingle,
          ...values,
          weekday: Number(values.weekday),
          teacherId: values.teacherId || null,
        }),
      });
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error || "Could not update timetable entry.");
      setEditingSingle(null);
      setNotice("Timetable entry updated.");
      await invalidate("/api/timetable");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update timetable entry."
      );
    } finally {
      setSaving(false);
    }
  }

  // Single Entry Delete
  async function removeSingleEntry(id: string) {
    if (!window.confirm("Delete this timetable entry?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/timetable?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await readApiJson(response);
        throw new Error(body.error || "Could not delete timetable entry.");
      }
      setNotice("Timetable entry deleted.");
      await invalidate("/api/timetable");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete timetable entry."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="card flex min-h-64 items-center justify-center gap-2 p-8">
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin text-brand" />
            <span>Loading timetable…</span>
          </>
        ) : (
          <span>{error || "Timetable is unavailable."}</span>
        )}
      </div>
    );
  }

  const activeDays = draft?.workingDays || [1, 2, 3, 4, 5, 6];
  const hasSavedEntries = data.entries && data.entries.length > 0;
  const isAllPublished =
    hasSavedEntries && data.entries.every((e) => e.status === "Published");

  return (
    <div className="timetable-print-sheet mx-auto max-w-7xl space-y-5">
      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="label">Academics</p>
          <h1 className="mt-2 text-3xl font-black">Weekly Timetable</h1>
          <p className="mt-1 text-muted">
            Configure school hours, edit period schedules, and publish class timetables.
          </p>
        </div>
        {className && section && (
          <div className="flex flex-wrap items-center gap-2">
            {!isEditing && (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={startEditing}
                  disabled={saving}
                >
                  <Pencil className="size-4" />
                  Edit Timetable
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.print()}
                  disabled={!hasSavedEntries}
                >
                  <Printer className="size-4" />
                  Print / PDF
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Status Notifications */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="size-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <b className="font-bold">Validation or Save Error</b>
            <p className="mt-0.5 whitespace-pre-wrap">{error}</p>
          </div>
          <button
            type="button"
            className="text-red-700 hover:text-red-900"
            onClick={() => setError("")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
          <p className="flex-1 font-semibold">{notice}</p>
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-900"
            onClick={() => setNotice("")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Section 1: School Timing & Slot Settings (Hidden while editing a class timetable) */}
      {!isEditing && (
        <section className="card p-5 sm:p-6 print:hidden">
          <div className="mb-5 flex items-center gap-2">
            <CalendarClock className="size-5 text-brand" />
            <h2 className="text-xl font-bold">Timetable Settings</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold">
              School start
              <input
                aria-label="School start time"
                type="time"
                className={field}
                disabled={!data.canEdit}
                value={draft?.startTime || "09:00"}
                onChange={(event) =>
                  draft && setDraft({ ...draft, startTime: event.target.value })
                }
              />
            </label>
            <label className="text-sm font-semibold">
              School end
              <select
                aria-label="School end time"
                className={field}
                disabled={!data.canEdit}
                value={
                  customEnd ||
                    !["15:30", "16:00", "16:30"].includes(draft?.endTime || "")
                    ? "custom"
                    : draft?.endTime
                }
                onChange={(event) => {
                  setCustomEnd(event.target.value === "custom");
                  if (event.target.value !== "custom" && draft)
                    setDraft({ ...draft, endTime: event.target.value });
                }}
              >
                <option value="15:30">3:30 PM</option>
                <option value="16:00">4:00 PM</option>
                <option value="16:30">4:30 PM</option>
                <option value="custom">Custom time</option>
              </select>
              {(customEnd ||
                !["15:30", "16:00", "16:30"].includes(draft?.endTime || "")) && (
                  <input
                    aria-label="Custom school end time"
                    type="time"
                    className={`${field} mt-1`}
                    disabled={!data.canEdit}
                    value={draft?.endTime || "16:00"}
                    onChange={(event) =>
                      draft && setDraft({ ...draft, endTime: event.target.value })
                    }
                  />
                )}
            </label>
            <label className="text-sm font-semibold">
              Period duration (min)
              <input
                type="number"
                min="20"
                max="120"
                className={field}
                disabled={!data.canEdit}
                value={draft?.periodMinutes || 40}
                onChange={(event) =>
                  draft &&
                  setDraft({ ...draft, periodMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Periods per day
              <input
                type="number"
                min="1"
                max="15"
                className={field}
                disabled={!data.canEdit}
                value={draft?.periodsPerDay || 9}
                onChange={(event) =>
                  draft &&
                  setDraft({ ...draft, periodsPerDay: Number(event.target.value) })
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Short break (min)
              <input
                type="number"
                min="0"
                max="120"
                className={field}
                disabled={!data.canEdit}
                value={draft?.shortBreakMinutes || 15}
                onChange={(event) =>
                  draft &&
                  setDraft({ ...draft, shortBreakMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Lunch break (min)
              <input
                type="number"
                min="0"
                max="120"
                className={field}
                disabled={!data.canEdit}
                value={draft?.lunchMinutes || 40}
                onChange={(event) =>
                  draft &&
                  setDraft({ ...draft, lunchMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              School timezone
              <input
                className={field}
                disabled={!data.canEdit}
                value={draft?.timezone || "Asia/Kolkata"}
                onChange={(event) =>
                  draft && setDraft({ ...draft, timezone: event.target.value })
                }
              />
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">Working Days</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {days.slice(1).map((label, index) => (
                <label key={label} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    disabled={!data.canEdit}
                    checked={draft?.workingDays.includes(index + 1) || false}
                    onChange={(event) =>
                      draft &&
                      setDraft({
                        ...draft,
                        workingDays: event.target.checked
                          ? [...draft.workingDays, index + 1]
                          : draft.workingDays.filter((day) => day !== index + 1),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {data.canEdit && (
            <button
              type="button"
              className="btn-primary mt-5"
              disabled={saving}
              onClick={() => void saveTiming()}
            >
              <Save className="size-4" />
              Save timing
            </button>
          )}
        </section>
      )}

      {/* Section 2: Class Selection Bar */}
      <section className="card p-5 sm:p-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Class Timetable Selection</h2>
            <p className="mt-1 text-sm text-muted">
              Choose the academic year, class, and section to view, edit, or generate.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold">
            Academic year
            <input
              className={field}
              value={year}
              disabled={isEditing}
              onChange={(event) => {
                setYear(event.target.value);
                setClassName("");
                setSection("");
              }}
            />
          </label>
          <label className="text-sm font-semibold">
            Class
            <select
              className={field}
              value={className}
              disabled={isEditing}
              onChange={(event) => {
                setClassName(event.target.value);
                setSection("");
              }}
            >
              <option value="">Choose class</option>
              {[...new Set(data.classes.map((item) => item.name))].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Section
            <select
              className={field}
              value={section}
              disabled={isEditing}
              onChange={(event) => setSection(event.target.value)}
            >
              <option value="">Choose section</option>
              {sections.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* EDITING INTERFACE (When isEditing === true)                              */}
      {/* ========================================================================= */}
      {isEditing && className && section && (
        <section className="card border-2 border-violet-400 p-5 sm:p-6 shadow-xl print:hidden">
          {/* Editor Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
                <Pencil className="size-3.5" />
                Timetable Editor Mode
              </span>
              <h2 className="mt-2 text-2xl font-black">
                Editing: Class {className} – Section {section}
              </h2>
              <p className="mt-1 text-xs text-muted">
                Academic Year {year} · Modify period timings, subjects, and teachers, or
                add/remove periods. Overlaps and teacher conflicts will be validated on save.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelEditing}
                disabled={saving}
              >
                <RotateCcw className="size-4" />
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void saveEditedTimetable("Draft")}
                disabled={saving}
              >
                <Save className="size-4" />
                Save as Draft
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void saveEditedTimetable("Published")}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Globe2 className="size-4" />
                )}
                Save &amp; Publish
              </button>
            </div>
          </div>

          {/* Day Navigation Tabs */}
          <div className="mt-5 flex flex-wrap gap-2 border-b pb-3">
            {activeDays.map((dayNum) => {
              const count = editableEntries.filter((e) => e.weekday === dayNum).length;
              const isSelected = selectedDayTab === dayNum;
              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setSelectedDayTab(dayNum)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${isSelected
                      ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                      : "bg-panel text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                >
                  {days[dayNum]}
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Periods for Selected Day Tab */}
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">
                {days[selectedDayTab]} Schedule
              </h3>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5 px-3"
                onClick={() => addPeriodToDay(selectedDayTab)}
              >
                <Plus className="size-3.5" />
                Add Period to {days[selectedDayTab]}
              </button>
            </div>

            {/* List of Periods for the active day */}
            {(() => {
              const dayList = editableEntries
                .filter((e) => e.weekday === selectedDayTab)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              if (dayList.length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-muted">
                    <p className="font-semibold">No periods scheduled for {days[selectedDayTab]}.</p>
                    <button
                      type="button"
                      className="btn-secondary mt-3"
                      onClick={() => addPeriodToDay(selectedDayTab)}
                    >
                      <Plus className="size-4" />
                      Add first period
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {dayList.map((period, index) => {
                    const isFirst = index === 0;
                    const isLast = index === dayList.length - 1;

                    return (
                      <div
                        key={period.id}
                        className="rounded-2xl border bg-canvas/30 p-4 transition hover:border-violet-300 dark:hover:border-violet-600"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-lg bg-violet-100 font-bold text-xs text-violet-800">
                              {index + 1}
                            </span>
                            <span className="font-bold text-sm">
                              Period {index + 1}
                            </span>
                            <span className="text-xs text-muted">
                              ({clock(period.startTime)} – {clock(period.endTime)})
                            </span>
                          </div>
                          {/* Reordering and Actions */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Move period up"
                              aria-label="Move period up"
                              disabled={isFirst}
                              onClick={() => movePeriod(selectedDayTab, index, "up")}
                              className="rounded-lg border p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                            >
                              <ChevronUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="Move period down"
                              aria-label="Move period down"
                              disabled={isLast}
                              onClick={() => movePeriod(selectedDayTab, index, "down")}
                              className="rounded-lg border p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                            >
                              <ChevronDown className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="Delete period"
                              aria-label="Delete period"
                              onClick={() =>
                                deleteEditablePeriod(
                                  period.id,
                                  period.subject,
                                  selectedDayTab
                                )
                              }
                              className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>

                        {/* Period Inputs Grid */}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <label className="text-xs font-semibold">
                            Subject
                            <input
                              className={field}
                              required
                              value={period.subject}
                              list="subject-suggestions"
                              onChange={(e) =>
                                updateEditablePeriod(
                                  period.id,
                                  "subject",
                                  e.target.value
                                )
                              }
                            />
                            <datalist id="subject-suggestions">
                              {availableSubjects.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </label>

                          <label className="text-xs font-semibold">
                            Assigned Teacher
                            <select
                              className={field}
                              value={period.teacherId || ""}
                              onChange={(e) =>
                                updateEditablePeriod(
                                  period.id,
                                  "teacherId",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">Unassigned</option>
                              {data.teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.subject || "General"})
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-xs font-semibold">
                            Start Time
                            <input
                              type="time"
                              className={field}
                              required
                              value={period.startTime}
                              onChange={(e) =>
                                updateEditablePeriod(
                                  period.id,
                                  "startTime",
                                  e.target.value
                                )
                              }
                            />
                          </label>

                          <label className="text-xs font-semibold">
                            End Time
                            <input
                              type="time"
                              className={field}
                              required
                              value={period.endTime}
                              onChange={(e) =>
                                updateEditablePeriod(
                                  period.id,
                                  "endTime",
                                  e.target.value
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Bottom Save / Cancel Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <span className="text-xs text-muted">
              Total scheduled periods across all days: {editableEntries.length}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void saveEditedTimetable("Draft")}
                disabled={saving}
              >
                Save as Draft
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void saveEditedTimetable("Published")}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Globe2 className="size-4" />
                )}
                Save &amp; Publish
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* VIEW & PRINT INTERFACE (When isEditing === false)                          */}
      {/* ========================================================================= */}
      {!isEditing && className && section && (
        <section className="card p-5 sm:p-6 shadow-md">
          {/* Printable School Header (Visible only when printing) */}
          <div className="hidden print:block mb-4 border-b pb-3">
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              Class Timetable
            </h1>
            <p className="text-sm font-bold text-slate-700">
              Class: {className} · Section: {section} · Academic Year: {year}
            </p>
            <p className="text-xs text-slate-500">
              Printed on {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
            </p>
          </div>

          {/* Class Timetable Title & Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-5 text-brand" />
                <h3 className="text-xl font-black">
                  Class {className} – Section {section}
                </h3>
                {hasSavedEntries && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isAllPublished
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                      }`}
                  >
                    {isAllPublished ? "Published" : "Draft / Unfinished"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Academic Year {year} · {data.entries.length} saved period records
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {data.canEdit && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={startEditing}
                  disabled={saving}
                >
                  <Pencil className="size-4" />
                  Edit Timetable
                </button>
              )}

              {data.canEdit && !isAllPublished && hasSavedEntries && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => void publish()}
                >
                  <Globe2 className="size-4" />
                  Publish
                </button>
              )}

              {data.canEdit && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving || !data.preview}
                  onClick={() => void generate()}
                >
                  <Sparkles className="size-4" />
                  {hasSavedEntries ? "Regenerate" : "Generate & Save"}
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                disabled={!hasSavedEntries}
                onClick={() => window.print()}
              >
                <Printer className="size-4" />
                Print / PDF
              </button>
            </div>
          </div>

          {/* Warnings & Notices */}
          {data.previewError && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 print:hidden"
            >
              {data.previewError}
            </p>
          )}
          {data.preview?.warnings?.map((warning) => (
            <p
              key={warning}
              className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 print:hidden"
            >
              {warning}
            </p>
          ))}

          {/* Weekly Timetable Matrix Grid (Uses ACTUAL saved entries!) */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm border-collapse">
              <thead className="bg-canvas text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 border-b">Time Slot</th>
                  <th className="px-4 py-3 border-b">Period</th>
                  {activeDays.map((dayNum) => (
                    <th key={dayNum} className="px-4 py-3 border-b font-extrabold">
                      {days[dayNum]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.slots.map((slot) => {
                  const isPeriod = slot.kind === "Period";

                  return (
                    <tr
                      key={slot.startTime}
                      className={
                        !isPeriod
                          ? "bg-slate-50/70 dark:bg-slate-900/30 font-semibold"
                          : ""
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
                        {clock(slot.startTime)} – {clock(slot.endTime)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs whitespace-nowrap">
                        {isPeriod ? `Period ${slot.period}` : slot.kind}
                      </td>

                      {/* Day Columns */}
                      {activeDays.map((dayNum) => {
                        if (!isPeriod) {
                          return (
                            <td
                              key={dayNum}
                              className="px-4 py-3 text-xs text-muted italic"
                            >
                              {slot.kind}
                            </td>
                          );
                        }

                        // Lookup the ACTUAL SAVED entry for this class/section
                        const entry = data.entries.find(
                          (e) =>
                            e.weekday === dayNum &&
                            (e.startTime === slot.startTime ||
                              (e.startTime < slot.endTime && e.endTime > slot.startTime))
                        );

                        if (entry) {
                          return (
                            <td key={dayNum} className="px-4 py-3 align-top">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-extrabold text-slate-900 dark:text-white">
                                  {entry.subject}
                                </span>
                                {entry.status === "Draft" && (
                                  <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 print:hidden">
                                    Draft
                                  </span>
                                )}
                              </div>
                              <span className="block text-xs text-muted mt-0.5 truncate max-w-[130px]">
                                {entry.teacherName}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {clock(entry.startTime)}–{clock(entry.endTime)}
                              </span>
                            </td>
                          );
                        }

                        // If no entry exists yet, fall back to preview suggestion if available
                        const previewEntry = data.preview?.entries?.find(
                          (e) => e.weekday === dayNum && e.startTime === slot.startTime
                        );

                        if (previewEntry) {
                          return (
                            <td key={dayNum} className="px-4 py-3 align-top opacity-60">
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                {previewEntry.subject}
                              </span>
                              <span className="block text-xs text-muted truncate">
                                {previewEntry.teacherName}
                              </span>
                              <span className="text-[10px] text-amber-600 block print:hidden">
                                (Not saved yet)
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={dayNum} className="px-4 py-3 text-xs text-slate-300">
                            —
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted print:hidden">
            School closing time: {clock(data.settings.endTime)}. No periods extend beyond it.
          </p>

          {/* Detailed Period List (Print-hidden for screen management) */}
          {hasSavedEntries && (
            <div className="mt-8 border-t pt-6 print:hidden">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base">Period Management Table</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    Quickly review, modify, or remove individual period records.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-canvas text-xs uppercase text-muted">
                    <tr>
                      {["Day", "Time", "Subject", "Teacher", "Status", "Actions"].map(
                        (col) => (
                          <th className="px-3 py-3" key={col}>
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.entries.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-3 font-semibold">{days[item.weekday]}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {clock(item.startTime)} – {clock(item.endTime)}
                        </td>
                        <td className="px-3 py-3 font-bold">{item.subject}</td>
                        <td className="px-3 py-3 text-muted">{item.teacherName}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.status === "Published"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-800"
                              }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button
                              aria-label={`Edit ${item.subject}`}
                              className="icon-btn"
                              onClick={() => setEditingSingle(item)}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              aria-label={`Delete ${item.subject}`}
                              className="icon-btn text-red-600"
                              disabled={saving}
                              onClick={() => void removeSingleEntry(item.id)}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasSavedEntries && (
            <div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-muted">
              <CalendarDays className="mx-auto size-8 text-muted" />
              <p className="mt-2 font-bold text-slate-800 dark:text-slate-200">
                No saved timetable for Class {className} Section {section}
              </p>
              <p className="mt-1 text-xs text-muted">
                Click &quot;Edit Timetable&quot; to build a schedule manually, or &quot;Generate &amp; Save&quot; to auto-generate based on teacher assignments.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={startEditing}
                >
                  <Pencil className="size-3.5" />
                  Build / Edit Timetable
                </button>
                {data.preview && (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => void generate()}
                  >
                    <Sparkles className="size-3.5" />
                    Auto-Generate
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Single Entry Edit Modal */}
      {editingSingle && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 print:hidden">
          <form
            onSubmit={updateSingleEntry}
            className="card w-full max-w-xl p-6 shadow-2xl"
          >
            <div className="flex justify-between border-b pb-3">
              <h2 className="text-xl font-black">Edit Timetable Entry</h2>
              <button
                type="button"
                onClick={() => setEditingSingle(null)}
                className="text-muted hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Class
                <select
                  name="className"
                  value={editingSingle.className}
                  onChange={(event) =>
                    setEditingSingle({
                      ...editingSingle,
                      className: event.target.value,
                      section: "",
                    })
                  }
                  className={field}
                >
                  {[...new Set(data.classes.map((item) => item.name))].map(
                    (item) => (
                      <option key={item}>{item}</option>
                    )
                  )}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Section
                <select
                  name="section"
                  value={editingSingle.section}
                  onChange={(event) =>
                    setEditingSingle({
                      ...editingSingle,
                      section: event.target.value,
                    })
                  }
                  className={field}
                >
                  <option value="">Choose section</option>
                  {[
                    ...new Set(
                      data.classes
                        .filter((item) => item.name === editingSingle.className)
                        .map((item) => item.section)
                    ),
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Day
                <select
                  name="weekday"
                  defaultValue={editingSingle.weekday}
                  className={field}
                >
                  {days.slice(1).map((day, index) => (
                    <option value={index + 1} key={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Subject
                <input
                  name="subject"
                  required
                  defaultValue={editingSingle.subject}
                  className={field}
                />
              </label>
              <label className="text-sm font-semibold">
                Teacher
                <select
                  name="teacherId"
                  defaultValue={editingSingle.teacherId || ""}
                  className={field}
                >
                  <option value="">Unassigned</option>
                  {data.teachers.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.subject}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Start time
                <input
                  name="startTime"
                  type="time"
                  required
                  defaultValue={editingSingle.startTime}
                  className={field}
                />
              </label>
              <label className="text-sm font-semibold">
                End time
                <input
                  name="endTime"
                  type="time"
                  required
                  defaultValue={editingSingle.endTime}
                  className={field}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditingSingle(null)}
              >
                Cancel
              </button>
              <button
                disabled={saving || !editingSingle.section}
                className="btn-primary"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
