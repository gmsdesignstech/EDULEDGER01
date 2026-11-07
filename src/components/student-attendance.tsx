"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  History,
  Info,
  Loader2,
  Plus,
  Save,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useEduCache, useEduQuery } from "./edu-cache-provider";

type Status = "Present" | "Absent" | "Late" | "Excused" | "Half-day" | "Leave";

type Student = {
  studentId: string;
  name: string;
  admission: string;
  rollNumber: string;
  status: Status | null;
  remarks: string;
  recorded: boolean;
};

type Summary = {
  present: number;
  absent: number;
  late: number;
  excused?: number;
  halfDay?: number;
  leave: number;
  total: number;
  rate: number;
  records: {
    date: string;
    className: string;
    section: string;
    present: number;
    absent: number;
    late: number;
    excused?: number;
    halfDay?: number;
    leave: number;
    total: number;
  }[];
};

type MonthlyReport = {
  yearMonth: string;
  className: string;
  section: string;
  days: { date: string; day: number; weekday: number; isWeekend: boolean; holiday: string | null }[];
  students: {
    studentId: string;
    name: string;
    admission: string;
    rollNumber: string;
    statuses: { [date: string]: { status: string; remarks: string } };
    present: number;
    absent: number;
    late: number;
    excused: number;
    halfDay: number;
    totalMarked: number;
    rate: number;
  }[];
  totalWorkingDays: number;
};

type Analytics = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  halfDay: number;
  overallRate: number;
  trend: {
    date: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    halfDay: number;
    total: number;
    rate: number;
  }[];
  atRiskStudents: {
    studentId: string;
    name: string;
    admission: string;
    rollNumber: string;
    className: string;
    section: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    halfDay: number;
    total: number;
    rate: number;
  }[];
};

type AuditEntry = {
  id: string;
  studentId: string;
  studentName: string;
  admission: string;
  rollNumber: string;
  className: string;
  section: string;
  date: string;
  previousStatus: string | null;
  newStatus: string;
  previousRemarks: string;
  newRemarks: string;
  changedBy: string;
  changedByName: string;
  reason: string;
  createdAt: string;
};

type Holiday = {
  id: string;
  academicYear: string;
  date: string;
  name: string;
  type: string;
  description: string;
};

type Payload = {
  academicYear: string;
  timezone: string;
  years: string[];
  classes: { name: string; sections: string[] }[];
  students: Student[];
  recorded: boolean;
  holiday?: { name: string; type: string } | null;
  correctionWindowHours?: number;
  summary?: Summary;
  canEdit: boolean;
};

const field = "w-full rounded-xl border bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand";
const localDate = (zone = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date()
  );

const ATTENDANCE_STATUSES: Status[] = ["Present", "Absent", "Late", "Excused", "Half-day"];

export function StudentAttendance() {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [year, setYear] = useState(() => params.get("academicYear") || "");
  const [className, setClassName] = useState(() => params.get("className") || "");
  const [section, setSection] = useState(() => params.get("section") || "");
  const [date, setDate] = useState(() => params.get("date") || localDate());
  const [activeTab, setActiveTab] = useState<"daily" | "monthly" | "analytics" | "audit" | "holidays">("daily");

  // Daily sheet state
  const [students, setStudents] = useState<Student[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");

  // Views state
  const [monthlyYearMonth, setMonthlyYearMonth] = useState(() => localDate().slice(0, 7));
  const [monthlyData, setMonthlyData] = useState<MonthlyReport | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [auditList, setAuditList] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: localDate(), name: "", type: "School Holiday", description: "" });
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Daily sheet query
  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (year) q.set("academicYear", year);
    if (className) q.set("className", className);
    if (section) q.set("section", section);
    if (date) q.set("date", date);
    return `/api/attendance?${q}`;
  }, [year, className, section, date]);

  const { data, error: queryError, isLoading: loading, isValidating, mutate } = useEduQuery<Payload>(query);
  const { invalidate } = useEduCache();

  useEffect(() => {
    if (data) {
      setStudents(data.students || []);
      setEditing(!data.recorded);
      if (!year) setYear(data.academicYear);
    }
  }, [data, year]);

  const sections = useMemo(() => data?.classes.find((x) => x.name === className)?.sections || [], [data, className]);
  const error = localError || (queryError instanceof Error ? queryError.message : "");

  // Load Monthly Report
  useEffect(() => {
    if (activeTab !== "monthly" || !className || !section || !year) return;
    setMonthlyLoading(true);
    fetch(`/api/attendance?view=monthly&academicYear=${encodeURIComponent(year)}&className=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&yearMonth=${encodeURIComponent(monthlyYearMonth)}`)
      .then((r) => readApiJson(r))
      .then((res) => {
        if (res.monthly) setMonthlyData(res.monthly);
      })
      .catch((e) => setLocalError(e instanceof Error ? e.message : "Failed to load monthly report."))
      .finally(() => setMonthlyLoading(false));
  }, [activeTab, className, section, year, monthlyYearMonth]);

  // Load Analytics
  useEffect(() => {
    if (activeTab !== "analytics" || !year) return;
    setAnalyticsLoading(true);
    const from = `${date.slice(0, 7)}-01`;
    const to = date;
    fetch(`/api/attendance?view=analytics&academicYear=${encodeURIComponent(year)}&className=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => readApiJson(r))
      .then((res) => {
        if (res.analytics) setAnalyticsData(res.analytics);
      })
      .catch((e) => setLocalError(e instanceof Error ? e.message : "Failed to load analytics."))
      .finally(() => setAnalyticsLoading(false));
  }, [activeTab, className, section, year, date]);

  // Load Audit Log
  useEffect(() => {
    if (activeTab !== "audit" || !year) return;
    setAuditLoading(true);
    fetch(`/api/attendance?view=audit&academicYear=${encodeURIComponent(year)}&className=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&date=${encodeURIComponent(date)}`)
      .then((r) => readApiJson(r))
      .then((res) => {
        if (res.history) setAuditList(res.history);
      })
      .catch((e) => setLocalError(e instanceof Error ? e.message : "Failed to load audit history."))
      .finally(() => setAuditLoading(false));
  }, [activeTab, className, section, year, date]);

  // Load Holidays
  const loadHolidays = () => {
    if (!year) return;
    setHolidaysLoading(true);
    fetch(`/api/attendance?view=holidays&academicYear=${encodeURIComponent(year)}`)
      .then((r) => readApiJson(r))
      .then((res) => {
        if (res.holidays) setHolidaysList(res.holidays);
      })
      .catch((e) => setLocalError(e instanceof Error ? e.message : "Failed to load holidays."))
      .finally(() => setHolidaysLoading(false));
  };

  useEffect(() => {
    if (activeTab === "holidays") loadHolidays();
  }, [activeTab, year]);

  function update(id: string, values: Partial<Student>) {
    setStudents((current) => current.map((x) => (x.studentId === id ? { ...x, ...values } : x)));
  }

  function markAllPresent() {
    setStudents((x) => x.map((s) => ({ ...s, status: "Present" })));
  }

  // Pre-submission summary counts
  const statusCounts = useMemo(() => {
    const counts = { Present: 0, Absent: 0, Late: 0, Excused: 0, "Half-day": 0, unassigned: 0 };
    for (const s of students) {
      if (s.status && s.status in counts) {
        counts[s.status as keyof typeof counts]++;
      } else {
        counts.unassigned++;
      }
    }
    return counts;
  }, [students]);

  async function handleSaveAttendance() {
    setSaving(true);
    setLocalError("");
    setNotice("");
    try {
      const records = students.map(({ studentId, status, remarks }) => ({
        studentId,
        status: status || "Present",
        remarks: remarks || "",
      }));

      const isCorrection = Boolean(data?.recorded);
      const response = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: year,
          className,
          section,
          date,
          records,
          isCorrection,
          correctionReason: isCorrection ? correctionReason : undefined,
          allowOverwrite: isCorrection,
        }),
      });

      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error || "Unable to save attendance.");

      setNotice(
        isCorrection
          ? `Attendance successfully corrected for ${body.saved} students.`
          : `Attendance successfully saved for ${body.saved} students.`
      );
      setEditing(false);
      setShowConfirmModal(false);
      setCorrectionReason("");
      await Promise.all([mutate(), invalidate("/api/dashboard", "/api/classes")]);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Unable to save attendance.");
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddHoliday() {
    if (!newHoliday.name.trim() || !newHoliday.date) return;
    setAddingHoliday(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_holiday",
          holiday: { ...newHoliday, academicYear: year },
        }),
      });
      const body = await readApiJson(res);
      if (!res.ok) throw new Error(body.error || "Failed to add holiday.");
      setNotice(`Holiday "${newHoliday.name}" recorded.`);
      setNewHoliday({ date: localDate(), name: "", type: "School Holiday", description: "" });
      loadHolidays();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to add holiday.");
    } finally {
      setAddingHoliday(false);
    }
  }

  async function handleDeleteHoliday(id: string) {
    if (!confirm("Remove this holiday?")) return;
    try {
      const res = await fetch(`/api/attendance?holidayId=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete holiday.");
      setNotice("Holiday removed.");
      loadHolidays();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to delete holiday.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header>
        <p className="label">Academics</p>
        <h1 className="mt-2 text-3xl font-black">Student Attendance System</h1>
        <p className="mt-1 text-muted">
          Enterprise attendance lifecycle with holiday-aware calculations, audit trail, and multi-status grading.
        </p>
      </header>

      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Scope Controls */}
      <section className="card mt-6 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            Academic year
            <select
              className={field}
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setClassName("");
                setSection("");
              }}
            >
              {data?.years.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Class
            <select
              className={field}
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setSection("");
              }}
            >
              <option value="">Choose class</option>
              {data?.classes.map((x) => (
                <option key={x.name}>{x.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Section
            <select className={field} value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Choose section</option>
              {sections.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Attendance date
            <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          {[
            { key: "daily", label: "Daily Attendance", icon: CalendarCheck2 },
            { key: "monthly", label: "Monthly Report", icon: Clock },
            { key: "analytics", label: "Class Analytics", icon: TrendingUp },
            { key: "audit", label: "Audit History", icon: History },
            { key: "holidays", label: "School Holidays", icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-brand text-white shadow-md shadow-brand/20"
                    : "border bg-panel text-muted hover:text-foreground hover:border-brand/40"
                }`}
                onClick={() => setActiveTab(tab.key as any)}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Holiday Indicator Banner */}
      {data?.holiday && activeTab === "daily" && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-amber-600" />
            <div>
              <p className="font-bold text-sm">Official School Holiday</p>
              <p className="text-xs">
                {date} is designated as <strong>{data.holiday.name}</strong> ({data.holiday.type}). Working day calculations automatically exempt this date.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: DAILY ATTENDANCE SHEET */}
      {activeTab === "daily" && (
        <section className="card mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div className="flex items-center gap-3">
              <CalendarCheck2 className="size-5 text-brand" />
              <div>
                <h2 className="font-bold text-lg">
                  Attendance Sheet · {className || "Class"} {section || ""} ({date})
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-block size-2 rounded-full ${
                      data?.recorded ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                  <p className="text-xs text-muted">
                    {data?.recorded ? "Attendance submitted and locked." : "Attendance not recorded for this date."}
                  </p>
                </div>
              </div>
              {isValidating && !loading && <Loader2 className="size-4 animate-spin text-brand" />}
            </div>

            <div className="flex flex-wrap gap-2">
              {data?.recorded && data.canEdit && !editing && (
                <button className="btn-secondary" onClick={() => setEditing(true)}>
                  Edit Attendance (Correction)
                </button>
              )}
              {data?.canEdit && editing && students.length > 0 && (
                <button className="btn-secondary flex items-center gap-1.5" onClick={markAllPresent}>
                  <UserCheck className="size-4" />
                  Mark all present
                </button>
              )}
              {data?.canEdit && editing && (
                <button
                  className="btn-primary flex items-center gap-1.5"
                  disabled={saving || !className || !section || !students.length}
                  onClick={() => setShowConfirmModal(true)}
                >
                  <Save className="size-4" />
                  Submit Attendance
                </button>
              )}
            </div>
          </div>

          {loading && !data ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="size-8 animate-spin text-brand" />
            </div>
          ) : !className || !section ? (
            <p className="p-12 text-center text-muted">Select an academic class and section to open the attendance register.</p>
          ) : !students.length ? (
            <p className="p-12 text-center text-muted">No active students are enrolled in {className} - Section {section}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-canvas text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4">Admission</th>
                    <th className="px-4">Roll No</th>
                    <th className="px-4 min-w-[200px]">Attendance Status</th>
                    <th className="px-4">Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((s) => (
                    <tr key={s.studentId} className="hover:bg-canvas/50">
                      <td className="px-4 py-3 font-bold">{s.name}</td>
                      <td className="px-4 font-mono text-xs">{s.admission}</td>
                      <td className="px-4 font-mono text-xs">{s.rollNumber || "—"}</td>
                      <td className="px-4 py-2">
                        {editing ? (
                          <div className="flex flex-wrap gap-1">
                            {ATTENDANCE_STATUSES.map((st) => {
                              const isSelected = s.status === st;
                              const colors: Record<Status, string> = {
                                Present: isSelected ? "bg-emerald-600 text-white" : "border text-emerald-700 hover:bg-emerald-50",
                                Absent: isSelected ? "bg-red-600 text-white" : "border text-red-700 hover:bg-red-50",
                                Late: isSelected ? "bg-amber-600 text-white" : "border text-amber-700 hover:bg-amber-50",
                                Excused: isSelected ? "bg-blue-600 text-white" : "border text-blue-700 hover:bg-blue-50",
                                "Half-day": isSelected ? "bg-purple-600 text-white" : "border text-purple-700 hover:bg-purple-50",
                                Leave: isSelected ? "bg-blue-600 text-white" : "border text-blue-700 hover:bg-blue-50",
                              };
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${colors[st]}`}
                                  onClick={() => update(s.studentId, { status: st })}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              s.status === "Present"
                                ? "bg-emerald-100 text-emerald-800"
                                : s.status === "Absent"
                                ? "bg-red-100 text-red-800"
                                : s.status === "Late"
                                ? "bg-amber-100 text-amber-800"
                                : s.status === "Excused"
                                ? "bg-blue-100 text-blue-800"
                                : s.status === "Half-day"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {s.status || "Unrecorded"}
                          </span>
                        )}
                      </td>
                      <td className="px-4">
                        <input
                          disabled={!editing}
                          placeholder="Optional remarks"
                          className={`${field} py-1 text-xs`}
                          value={s.remarks}
                          onChange={(e) => update(s.studentId, { remarks: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: MONTHLY REPORT */}
      {activeTab === "monthly" && (
        <section className="card mt-5 overflow-hidden p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="font-bold text-lg">Monthly Attendance Register</h2>
              <p className="text-xs text-muted">
                Complete date-by-date matrix showing holidays, working days, and monthly attendance rates.
              </p>
            </div>
            <label className="text-xs font-semibold">
              Select Month
              <input
                type="month"
                className={`${field} ml-2 !w-auto inline-block`}
                value={monthlyYearMonth}
                onChange={(e) => setMonthlyYearMonth(e.target.value)}
              />
            </label>
          </div>

          {monthlyLoading ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="size-8 animate-spin text-brand" />
            </div>
          ) : !monthlyData || !monthlyData.students.length ? (
            <p className="p-12 text-center text-muted">No attendance data found for {monthlyYearMonth}.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas uppercase text-muted">
                  <tr>
                    <th className="sticky left-0 bg-canvas px-3 py-2 z-10">Student</th>
                    <th className="px-2">Roll</th>
                    {monthlyData.days.map((d) => (
                      <th
                        key={d.date}
                        className={`px-1 py-2 text-center min-w-[28px] ${
                          d.holiday ? "bg-amber-100/70 text-amber-900" : d.isWeekend ? "bg-canvas/80 text-muted" : ""
                        }`}
                        title={d.holiday ? `Holiday: ${d.holiday}` : d.isWeekend ? "Weekend" : d.date}
                      >
                        <div>{d.day}</div>
                      </th>
                    ))}
                    <th className="px-2 text-center">P</th>
                    <th className="px-2 text-center">A</th>
                    <th className="px-2 text-center">L</th>
                    <th className="px-2 text-center">E</th>
                    <th className="px-2 text-center">H</th>
                    <th className="px-3 text-right">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthlyData.students.map((st) => (
                    <tr key={st.studentId} className="hover:bg-canvas/50">
                      <td className="sticky left-0 bg-panel px-3 py-2 font-bold whitespace-nowrap z-10 border-r">
                        {st.name}
                      </td>
                      <td className="px-2 font-mono text-muted">{st.rollNumber || "—"}</td>
                      {monthlyData.days.map((d) => {
                        const rec = st.statuses[d.date];
                        let char = "—";
                        let color = "text-muted/40";
                        if (rec) {
                          if (rec.status === "Present") { char = "P"; color = "text-emerald-600 font-bold"; }
                          else if (rec.status === "Absent") { char = "A"; color = "text-red-600 font-black"; }
                          else if (rec.status === "Late") { char = "L"; color = "text-amber-600 font-bold"; }
                          else if (rec.status === "Excused") { char = "E"; color = "text-blue-600 font-bold"; }
                          else if (rec.status === "Half-day") { char = "H"; color = "text-purple-600 font-bold"; }
                        } else if (d.holiday) {
                          char = "•";
                          color = "text-amber-600";
                        } else if (d.isWeekend) {
                          char = "W";
                          color = "text-muted/30";
                        }
                        return (
                          <td
                            key={d.date}
                            className={`px-1 text-center font-mono ${color} ${
                              d.holiday ? "bg-amber-50/50" : d.isWeekend ? "bg-canvas/40" : ""
                            }`}
                          >
                            {char}
                          </td>
                        );
                      })}
                      <td className="px-2 text-center font-bold text-emerald-700">{st.present}</td>
                      <td className="px-2 text-center font-bold text-red-700">{st.absent}</td>
                      <td className="px-2 text-center font-bold text-amber-700">{st.late}</td>
                      <td className="px-2 text-center font-bold text-blue-700">{st.excused}</td>
                      <td className="px-2 text-center font-bold text-purple-700">{st.halfDay}</td>
                      <td className="px-3 text-right font-black">
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            st.rate >= 90
                              ? "bg-emerald-100 text-emerald-800"
                              : st.rate >= 75
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {st.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: CLASS ANALYTICS */}
      {activeTab === "analytics" && (
        <section className="card mt-5 p-5">
          <div className="border-b pb-4">
            <h2 className="font-bold text-lg">Class & Section Analytics</h2>
            <p className="text-xs text-muted">
              Aggregate attendance trends, distribution breakdown, and low-attendance alerts.
            </p>
          </div>

          {analyticsLoading ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="size-8 animate-spin text-brand" />
            </div>
          ) : !analyticsData || !analyticsData.total ? (
            <p className="p-12 text-center text-muted">No attendance activity recorded for this period.</p>
          ) : (
            <div className="mt-5 space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                {[
                  { label: "Overall Rate", val: `${analyticsData.overallRate}%`, color: "text-brand" },
                  { label: "Present", val: analyticsData.present, color: "text-emerald-600" },
                  { label: "Absent", val: analyticsData.absent, color: "text-red-600" },
                  { label: "Late", val: analyticsData.late, color: "text-amber-600" },
                  { label: "Excused", val: analyticsData.excused, color: "text-blue-600" },
                  { label: "Half-day", val: analyticsData.halfDay, color: "text-purple-600" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border bg-panel p-3 shadow-sm">
                    <p className="text-xs text-muted">{m.label}</p>
                    <p className={`mt-1 text-2xl font-black ${m.color}`}>{m.val}</p>
                  </div>
                ))}
              </div>

              {/* Low Attendance Alert (< 75%) */}
              <div>
                <h3 className="font-bold text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="size-4" />
                  Students Requiring Attention (Below 75% Threshold)
                </h3>
                {analyticsData.atRiskStudents.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">All students meet the 75% attendance requirement.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-canvas uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Student</th>
                          <th className="px-3">Admission</th>
                          <th className="px-3">Class</th>
                          <th className="px-3 text-center">Present</th>
                          <th className="px-3 text-center">Absent</th>
                          <th className="px-3 text-right">Attendance Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {analyticsData.atRiskStudents.map((st) => (
                          <tr key={st.studentId} className="hover:bg-canvas/50">
                            <td className="px-3 py-2 font-bold">{st.name}</td>
                            <td className="px-3 font-mono">{st.admission}</td>
                            <td className="px-3">{st.className} {st.section}</td>
                            <td className="px-3 text-center text-emerald-700 font-semibold">{st.present}</td>
                            <td className="px-3 text-center text-red-700 font-semibold">{st.absent}</td>
                            <td className="px-3 text-right font-black text-red-600">{st.rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: AUDIT HISTORY */}
      {activeTab === "audit" && (
        <section className="card mt-5 p-5">
          <div className="border-b pb-4">
            <h2 className="font-bold text-lg">Attendance Modification Audit Log</h2>
            <p className="text-xs text-muted">
              Complete historical trail of all initial submissions and subsequent corrections.
            </p>
          </div>

          {auditLoading ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="size-8 animate-spin text-brand" />
            </div>
          ) : !auditList.length ? (
            <p className="p-12 text-center text-muted">No attendance changes recorded for this class and date.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3">Student</th>
                    <th className="px-3">Class</th>
                    <th className="px-3">Date</th>
                    <th className="px-3">Change (Old → New)</th>
                    <th className="px-3">Reason</th>
                    <th className="px-3">Modified By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditList.map((log) => (
                    <tr key={log.id} className="hover:bg-canvas/50">
                      <td className="px-3 py-2 whitespace-nowrap text-muted font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 font-bold">{log.studentName}</td>
                      <td className="px-3">{log.className} {log.section}</td>
                      <td className="px-3 font-mono">{log.date}</td>
                      <td className="px-3">
                        <span className="font-semibold text-muted">{log.previousStatus || "None"}</span>
                        {" → "}
                        <span className="font-bold text-foreground">{log.newStatus}</span>
                      </td>
                      <td className="px-3 text-muted">{log.reason || "—"}</td>
                      <td className="px-3 font-medium">{log.changedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 5: SCHOOL HOLIDAYS */}
      {activeTab === "holidays" && (
        <section className="card mt-5 p-5">
          <div className="border-b pb-4">
            <h2 className="font-bold text-lg">Institutional Holidays Calendar</h2>
            <p className="text-xs text-muted">
              Holidays automatically exempt scheduled days from student absence calculations.
            </p>
          </div>

          {/* Add Holiday Form */}
          <div className="mt-4 rounded-xl border bg-canvas/60 p-4">
            <h3 className="font-bold text-sm mb-3">Declare School Holiday</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs font-semibold">
                Holiday Date
                <input
                  type="date"
                  className={field}
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold">
                Holiday Name
                <input
                  placeholder="e.g. Independence Day, Annual Sports"
                  className={field}
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold">
                Type
                <select
                  className={field}
                  value={newHoliday.type}
                  onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}
                >
                  <option>Public Holiday</option>
                  <option>School Holiday</option>
                  <option>Vacation</option>
                  <option>Weather Emergency</option>
                  <option>Administrative</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-primary w-full flex items-center justify-center gap-1.5"
                  disabled={addingHoliday || !newHoliday.name.trim()}
                  onClick={handleAddHoliday}
                >
                  <Plus className="size-4" />
                  {addingHoliday ? "Saving..." : "Add Holiday"}
                </button>
              </div>
            </div>
          </div>

          {/* Holiday List */}
          {holidaysLoading ? (
            <div className="grid min-h-48 place-items-center">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          ) : !holidaysList.length ? (
            <p className="p-8 text-center text-muted">No holidays declared for academic year {year}.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3">Holiday Name</th>
                    <th className="px-3">Category</th>
                    <th className="px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {holidaysList.map((h) => (
                    <tr key={h.id} className="hover:bg-canvas/50">
                      <td className="px-3 py-2 font-mono font-bold">{h.date}</td>
                      <td className="px-3 font-semibold text-foreground">{h.name}</td>
                      <td className="px-3">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">
                          {h.type}
                        </span>
                      </td>
                      <td className="px-3 text-right">
                        <button
                          className="text-red-600 hover:text-red-800 p-1"
                          onClick={() => handleDeleteHoliday(h.id)}
                          title="Delete Holiday"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* SUBMISSION CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-black flex items-center gap-2">
              <CalendarCheck2 className="size-5 text-brand" />
              {data?.recorded ? "Confirm Attendance Correction" : "Confirm Attendance Submission"}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {data?.recorded
                ? "You are submitting an amendment for previously submitted attendance. This change will be permanently audited."
                : `Submit verified daily attendance for ${className} - Section ${section} on ${date}.`}
            </p>

            <div className="mt-4 grid grid-cols-5 gap-2 rounded-xl bg-canvas p-3 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                <span className="block font-black text-lg">{statusCounts.Present}</span>
                Present
              </div>
              <div className="rounded-lg bg-red-50 p-2 text-red-800">
                <span className="block font-black text-lg">{statusCounts.Absent}</span>
                Absent
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-800">
                <span className="block font-black text-lg">{statusCounts.Late}</span>
                Late
              </div>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-800">
                <span className="block font-black text-lg">{statusCounts.Excused}</span>
                Excused
              </div>
              <div className="rounded-lg bg-purple-50 p-2 text-purple-800">
                <span className="block font-black text-lg">{statusCounts["Half-day"]}</span>
                Half-day
              </div>
            </div>

            {data?.recorded && (
              <label className="mt-4 block text-xs font-semibold">
                Reason for Correction (Audited)
                <input
                  placeholder="e.g. Student arrived late with bus note"
                  className={`${field} mt-1`}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={handleSaveAttendance}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
