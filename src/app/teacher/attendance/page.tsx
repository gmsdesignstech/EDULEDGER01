"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Lock,
  Save,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused" | "Half-day" | "Leave";

type AttendanceStudent = {
  studentId: string;
  name: string;
  admission: string;
  rollNumber: string;
  status: AttendanceStatus | null;
  remarks: string;
  recorded: boolean;
};

type Assignment = {
  academicYear: string;
  className: string;
  section: string;
  subject: string;
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

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["Present", "Absent", "Late", "Excused", "Half-day"];

export default function TeacherAttendancePage() {
  const searchParams = useSearchParams();
  const initialClass = searchParams.get("class") || "";
  const initialSection = searchParams.get("section") || "";

  const [activeTab, setActiveTab] = useState<"daily" | "monthly" | "analytics">("daily");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>(initialClass);
  const [selectedSection, setSelectedSection] = useState<string>(initialSection);
  const [academicYear, setAcademicYear] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [isRecorded, setIsRecorded] = useState(false);
  const [holiday, setHoliday] = useState<{ name: string; type: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");

  // Views state
  const [monthlyYearMonth, setMonthlyYearMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [monthlyData, setMonthlyData] = useState<MonthlyReport | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Load teacher scope to get assigned classes
  useEffect(() => {
    fetch("/api/teacher/dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load teacher profile");
        return res.json();
      })
      .then((data) => {
        const asg: Assignment[] = data.assignments || [];
        setAssignments(asg);
        if (asg.length > 0) {
          const first = asg[0];
          setAcademicYear(first.academicYear);
          if (!selectedClass) setSelectedClass(first.className);
          if (!selectedSection) setSelectedSection(first.section);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load assigned classes");
        setLoading(false);
      });
  }, []);

  // Unique classes from assignments
  const classOptions = Array.from(new Set(assignments.map((a) => a.className))).sort();

  // Sections for selected class
  const sectionOptions = Array.from(
    new Set(
      assignments
        .filter((a) => a.className === selectedClass)
        .map((a) => a.section)
    )
  ).sort();

  // Load attendance sheet when class, section, or date changes
  useEffect(() => {
    if (!selectedClass || !selectedSection || !date || !academicYear) return;
    setError("");
    setSuccess("");

    const params = new URLSearchParams({
      academicYear,
      className: selectedClass,
      section: selectedSection,
      date,
    });

    fetch(`/api/teacher/attendance?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Could not load attendance sheet");
        }
        return res.json();
      })
      .then((data) => {
        const list: AttendanceStudent[] = data.students || [];
        const rec = Boolean(data.recorded);
        setIsRecorded(rec);
        setEditing(!rec);
        setHoliday(data.holiday || null);

        const initialized = list.map((s) => ({
          ...s,
          status: s.status || "Present",
          remarks: s.remarks || "",
        }));
        setStudents(initialized);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error loading attendance");
        setStudents([]);
      });
  }, [selectedClass, selectedSection, date, academicYear]);

  // Load Monthly Report
  useEffect(() => {
    if (activeTab !== "monthly" || !selectedClass || !selectedSection || !academicYear) return;
    setMonthlyLoading(true);
    fetch(`/api/teacher/attendance?view=monthly&academicYear=${encodeURIComponent(academicYear)}&className=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}&date=${encodeURIComponent(date)}&yearMonth=${encodeURIComponent(monthlyYearMonth)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.monthly) setMonthlyData(res.monthly);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load monthly report"))
      .finally(() => setMonthlyLoading(false));
  }, [activeTab, selectedClass, selectedSection, academicYear, monthlyYearMonth, date]);

  // Load Analytics
  useEffect(() => {
    if (activeTab !== "analytics" || !selectedClass || !selectedSection || !academicYear) return;
    setAnalyticsLoading(true);
    const from = `${date.slice(0, 7)}-01`;
    const to = date;
    fetch(`/api/teacher/attendance?view=analytics&academicYear=${encodeURIComponent(academicYear)}&className=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}&date=${encodeURIComponent(date)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.analytics) setAnalyticsData(res.analytics);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics"))
      .finally(() => setAnalyticsLoading(false));
  }, [activeTab, selectedClass, selectedSection, academicYear, date]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  }

  function setRemarks(studentId: string, remarks: string) {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s))
    );
  }

  function markAllPresent() {
    setStudents((prev) => prev.map((s) => ({ ...s, status: "Present" })));
  }

  async function submitAttendance() {
    if (!students.length) return;
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const payload = {
        academicYear,
        className: selectedClass,
        section: selectedSection,
        date,
        records: students.map((s) => ({
          studentId: s.studentId,
          status: s.status || "Present",
          remarks: s.remarks || "",
        })),
        isCorrection: isRecorded,
        correctionReason: isRecorded ? correctionReason : undefined,
        allowOverwrite: isRecorded,
      };

      const res = await fetch("/api/teacher/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to submit attendance");
      }

      const result = await res.json();
      setSuccess(
        isRecorded
          ? `Attendance correction recorded successfully for ${result.saved || students.length} students.`
          : `Attendance recorded successfully for ${result.saved || students.length} students.`
      );
      setIsRecorded(true);
      setEditing(false);
      setShowConfirmModal(false);
      setCorrectionReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit attendance");
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    present: students.filter((s) => s.status === "Present").length,
    absent: students.filter((s) => s.status === "Absent").length,
    late: students.filter((s) => s.status === "Late").length,
    excused: students.filter((s) => s.status === "Excused").length,
    halfDay: students.filter((s) => s.status === "Half-day").length,
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading attendance register…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Teacher Attendance Register</h1>
          <p className="text-xs text-muted sm:text-sm">
            Mark, correct, and review daily attendance with holiday awareness and parent notifications
          </p>
        </div>

        {activeTab === "daily" && (
          <div className="flex flex-wrap gap-2">
            {isRecorded && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-2xl border bg-panel px-4 py-2 text-xs font-bold text-amber-700 shadow-sm transition hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                Edit Attendance (Correction)
              </button>
            )}
            {editing && students.length > 0 && (
              <button
                type="button"
                onClick={markAllPresent}
                className="rounded-2xl border bg-panel px-4 py-2 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40 flex items-center gap-1.5"
              >
                <UserCheck className="size-4" />
                Mark All Present
              </button>
            )}
            {editing && (
              <button
                type="button"
                disabled={saving || !students.length}
                onClick={() => setShowConfirmModal(true)}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="size-4" />
                Submit Attendance
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="size-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Holiday Indicator */}
      {holiday && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">Official School Holiday: {holiday.name}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This date is exempt from absence deductions. Working days are computed accurately.
            </p>
          </div>
        </div>
      )}

      {/* Control Panel: Class, Section, Date */}
      <div className="rounded-3xl border bg-panel p-5 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Class Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">
              Assigned Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                const cls = e.target.value;
                setSelectedClass(cls);
                const matchingSections = assignments.filter((a) => a.className === cls);
                if (matchingSections.length > 0) {
                  setSelectedSection(matchingSections[0].section);
                  setAcademicYear(matchingSections[0].academicYear);
                }
              }}
              className="mt-1 w-full rounded-2xl border bg-panel px-4 py-2.5 text-xs font-semibold shadow-sm focus:border-blue-500 focus:outline-none"
            >
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Section Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">
              Assigned Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="mt-1 w-full rounded-2xl border bg-panel px-4 py-2.5 text-xs font-semibold shadow-sm focus:border-blue-500 focus:outline-none"
            >
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">
              Attendance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border bg-panel px-4 py-2 text-xs font-semibold shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {[
            { key: "daily", label: "Daily Attendance Sheet", icon: CalendarCheck2 },
            { key: "monthly", label: "Monthly Register", icon: Clock },
            { key: "analytics", label: "Class Analytics", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "border bg-panel text-muted hover:text-foreground"
                }`}
                onClick={() => setActiveTab(tab.key as any)}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: DAILY SHEET */}
      {activeTab === "daily" && (
        <>
          {/* Summary Metric Badges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border bg-panel p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Present
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {counts.present}
              </p>
            </div>
            <div className="rounded-2xl border bg-panel p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                Absent
              </span>
              <p className="mt-1 text-2xl font-black text-red-700 dark:text-red-400">
                {counts.absent}
              </p>
            </div>
            <div className="rounded-2xl border bg-panel p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Late
              </span>
              <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400">
                {counts.late}
              </p>
            </div>
            <div className="rounded-2xl border bg-panel p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Excused
              </span>
              <p className="mt-1 text-2xl font-black text-blue-700 dark:text-blue-400">
                {counts.excused}
              </p>
            </div>
            <div className="rounded-2xl border bg-panel p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                Half-Day
              </span>
              <p className="mt-1 text-2xl font-black text-purple-700 dark:text-purple-400">
                {counts.halfDay}
              </p>
            </div>
          </div>

          {/* Student Roster Table */}
          {students.length === 0 ? (
            <div className="rounded-3xl border bg-panel p-12 text-center text-muted">
              <Users className="mx-auto size-12 opacity-30" />
              <p className="mt-3 text-sm font-semibold">No students found for this class and section.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border bg-panel shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-canvas/60 uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-3 font-bold">Student</th>
                      <th className="px-3 py-3 font-bold">Roll No</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-5 py-3 font-bold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((student) => (
                      <tr key={student.studentId} className="hover:bg-canvas/30 transition">
                        <td className="px-5 py-3">
                          <p className="font-black text-sm">{student.name}</p>
                          <p className="font-mono text-[11px] text-muted">{student.admission}</p>
                        </td>
                        <td className="px-3 py-3 font-mono font-semibold text-muted">
                          {student.rollNumber || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {editing ? (
                            <div className="flex flex-wrap gap-1">
                              {ATTENDANCE_STATUSES.map((st) => {
                                const selected = student.status === st;
                                const colors: Record<AttendanceStatus, string> = {
                                  Present: selected ? "bg-emerald-600 text-white" : "border text-emerald-700 hover:bg-emerald-50",
                                  Absent: selected ? "bg-red-600 text-white" : "border text-red-700 hover:bg-red-50",
                                  Late: selected ? "bg-amber-600 text-white" : "border text-amber-700 hover:bg-amber-50",
                                  Excused: selected ? "bg-blue-600 text-white" : "border text-blue-700 hover:bg-blue-50",
                                  "Half-day": selected ? "bg-purple-600 text-white" : "border text-purple-700 hover:bg-purple-50",
                                  Leave: selected ? "bg-blue-600 text-white" : "border text-blue-700 hover:bg-blue-50",
                                };
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => setStatus(student.studentId, st)}
                                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${colors[st]}`}
                                  >
                                    {st}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                student.status === "Present"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : student.status === "Absent"
                                  ? "bg-red-100 text-red-800"
                                  : student.status === "Late"
                                  ? "bg-amber-100 text-amber-800"
                                  : student.status === "Excused"
                                  ? "bg-blue-100 text-blue-800"
                                  : student.status === "Half-day"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {student.status || "Unrecorded"}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            disabled={!editing}
                            value={student.remarks}
                            onChange={(e) => setRemarks(student.studentId, e.target.value)}
                            placeholder="Optional remark"
                            className="w-full rounded-xl border bg-panel px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: MONTHLY REGISTER */}
      {activeTab === "monthly" && (
        <div className="rounded-3xl border bg-panel p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="font-bold text-base">Monthly Roster Overview</h2>
              <p className="text-xs text-muted">
                Student attendance progression across all working days in {monthlyYearMonth}
              </p>
            </div>
            <input
              type="month"
              value={monthlyYearMonth}
              onChange={(e) => setMonthlyYearMonth(e.target.value)}
              className="rounded-xl border bg-panel px-3 py-1.5 text-xs font-semibold"
            />
          </div>

          {monthlyLoading ? (
            <div className="grid min-h-48 place-items-center">
              <Loader2 className="size-6 animate-spin text-blue-600" />
            </div>
          ) : !monthlyData || !monthlyData.students.length ? (
            <p className="p-8 text-center text-xs text-muted">No attendance recorded for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/60 uppercase text-muted">
                  <tr>
                    <th className="sticky left-0 bg-canvas/80 px-3 py-2 z-10">Student</th>
                    {monthlyData.days.map((d) => (
                      <th
                        key={d.date}
                        className={`px-1 py-1.5 text-center min-w-[26px] ${
                          d.holiday ? "bg-amber-100/60 text-amber-900" : d.isWeekend ? "text-muted/40" : ""
                        }`}
                        title={d.holiday ? `Holiday: ${d.holiday}` : d.date}
                      >
                        {d.day}
                      </th>
                    ))}
                    <th className="px-2 text-center">P</th>
                    <th className="px-2 text-center">A</th>
                    <th className="px-2 text-center">L</th>
                    <th className="px-2 text-center">E</th>
                    <th className="px-2 text-center">H</th>
                    <th className="px-3 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthlyData.students.map((st) => (
                    <tr key={st.studentId} className="hover:bg-canvas/30">
                      <td className="sticky left-0 bg-panel px-3 py-2 font-bold whitespace-nowrap z-10 border-r">
                        {st.name}
                      </td>
                      {monthlyData.days.map((d) => {
                        const rec = st.statuses[d.date];
                        let char = "—";
                        let color = "text-muted/30";
                        if (rec) {
                          if (rec.status === "Present") { char = "P"; color = "text-emerald-600 font-bold"; }
                          else if (rec.status === "Absent") { char = "A"; color = "text-red-600 font-bold"; }
                          else if (rec.status === "Late") { char = "L"; color = "text-amber-600 font-bold"; }
                          else if (rec.status === "Excused") { char = "E"; color = "text-blue-600 font-bold"; }
                          else if (rec.status === "Half-day") { char = "H"; color = "text-purple-600 font-bold"; }
                        } else if (d.holiday) {
                          char = "•";
                          color = "text-amber-500 font-bold";
                        }
                        return (
                          <td key={d.date} className={`px-1 text-center font-mono ${color}`}>
                            {char}
                          </td>
                        );
                      })}
                      <td className="px-2 text-center font-bold text-emerald-700">{st.present}</td>
                      <td className="px-2 text-center font-bold text-red-700">{st.absent}</td>
                      <td className="px-2 text-center font-bold text-amber-700">{st.late}</td>
                      <td className="px-2 text-center font-bold text-blue-700">{st.excused}</td>
                      <td className="px-2 text-center font-bold text-purple-700">{st.halfDay}</td>
                      <td className="px-3 text-right font-black text-foreground">{st.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLASS ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="rounded-3xl border bg-panel p-5 shadow-sm space-y-5">
          <div className="border-b pb-3">
            <h2 className="font-bold text-base">Class Performance Metrics</h2>
            <p className="text-xs text-muted">Attendance breakdown and low-attendance tracking for this class</p>
          </div>

          {analyticsLoading ? (
            <div className="grid min-h-48 place-items-center">
              <Loader2 className="size-6 animate-spin text-blue-600" />
            </div>
          ) : !analyticsData || !analyticsData.total ? (
            <p className="p-8 text-center text-xs text-muted">No attendance data available for analysis.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                {[
                  { label: "Class Average", val: `${analyticsData.overallRate}%`, color: "text-blue-600" },
                  { label: "Present", val: analyticsData.present, color: "text-emerald-600" },
                  { label: "Absent", val: analyticsData.absent, color: "text-red-600" },
                  { label: "Late", val: analyticsData.late, color: "text-amber-600" },
                  { label: "Excused", val: analyticsData.excused, color: "text-blue-600" },
                  { label: "Half-day", val: analyticsData.halfDay, color: "text-purple-600" },
                ].map((m) => (
                  <div key={m.label} className="rounded-2xl border bg-canvas/60 p-3 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{m.label}</span>
                    <p className={`mt-0.5 text-xl font-black ${m.color}`}>{m.val}</p>
                  </div>
                ))}
              </div>

              {/* At-risk student alert */}
              {analyticsData.atRiskStudents.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-950 dark:bg-red-950/20">
                  <h3 className="font-bold text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                    <AlertCircle className="size-4" />
                    Students with Attendance Under 75%
                  </h3>
                  <div className="mt-2 divide-y divide-red-200/50 text-xs">
                    {analyticsData.atRiskStudents.map((st) => (
                      <div key={st.studentId} className="flex items-center justify-between py-1.5">
                        <span className="font-bold">{st.name} ({st.admission})</span>
                        <span className="font-black text-red-600">{st.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border bg-panel p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black flex items-center gap-2">
              <CalendarCheck2 className="size-5 text-blue-600" />
              {isRecorded ? "Confirm Attendance Amendment" : "Confirm Attendance Submission"}
            </h3>
            <p className="text-xs text-muted">
              {isRecorded
                ? `You are amending existing attendance for ${selectedClass} - Section ${selectedSection} on ${date}. All amendments are permanently logged in the audit history.`
                : `Submit recorded attendance for ${selectedClass} - Section ${selectedSection} on ${date}.`}
            </p>

            <div className="grid grid-cols-5 gap-2 rounded-2xl bg-canvas/80 p-3 text-center text-xs">
              <div className="rounded-xl bg-emerald-50 p-1.5 text-emerald-800">
                <span className="block font-black text-base">{counts.present}</span>
                Present
              </div>
              <div className="rounded-xl bg-red-50 p-1.5 text-red-800">
                <span className="block font-black text-base">{counts.absent}</span>
                Absent
              </div>
              <div className="rounded-xl bg-amber-50 p-1.5 text-amber-800">
                <span className="block font-black text-base">{counts.late}</span>
                Late
              </div>
              <div className="rounded-xl bg-blue-50 p-1.5 text-blue-800">
                <span className="block font-black text-base">{counts.excused}</span>
                Excused
              </div>
              <div className="rounded-xl bg-purple-50 p-1.5 text-purple-800">
                <span className="block font-black text-base">{counts.halfDay}</span>
                Half-Day
              </div>
            </div>

            {isRecorded && (
              <label className="block text-xs font-semibold">
                Correction Reason (Logged)
                <input
                  type="text"
                  placeholder="e.g. Student arrived late with doctor's slip"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-panel px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border bg-panel px-4 py-2 text-xs font-bold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submitAttendance}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
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
