"use client";

import { readApiJson } from "@/lib/api-response";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck2,
  GraduationCap,
  Layers3,
  Loader2,
  Sparkles,
  Users,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

type TeacherScopeData = {
  user: { name: string; email: string };
  school: { name: string; academicYear: string };
  teacher: {
    id: string;
    name: string;
    employeeId: string;
    email: string;
    phone: string;
    department: string;
    subject: string;
    classes: string;
    joiningDate: string;
  };
  assignments: {
    academicYear: string;
    className: string;
    section: string;
    subject: string;
  }[];
  timetable: {
    id: string;
    academicYear: string;
    className: string;
    section: string;
    subject: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }[];
  students: {
    id: string;
    name: string;
    admission: string;
    rollNumber: string;
    className: string;
    section: string;
    attendance?: number;
  }[];
  homework: {
    id: string;
    title: string;
    className: string;
    section: string;
    subject: string;
    dueDate: string;
    status: string;
  }[];
  leaveRequests: {
    id: string;
    fromDate: string;
    toDate: string;
    reason: string;
    status: string;
  }[];
  examinations: {
    id: string;
    name: string;
    className: string;
    section: string;
    status: string;
  }[];
  notifications: {
    id: string;
    title: string;
    description: string;
    readAt: string | null;
    createdAt: string;
  }[];
  unread: number;
};

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TeacherDashboardPage() {
  const [data, setData] = useState<TeacherScopeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const todayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...

  useEffect(() => {
    fetch("/api/teacher/dashboard")
      .then(async (res) => {
        if (!res.ok) {
          const err = await readApiJson(res).catch(() => null);
          throw new Error(err?.error || "Failed to load teacher dashboard");
        }
        return readApiJson(res);
      })
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load dashboard");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading teacher workspace…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-950/60 dark:bg-red-950/20 dark:text-red-200">
        <div className="flex items-center gap-3">
          <AlertCircle className="size-6 text-red-600 dark:text-red-400" />
          <h2 className="text-base font-bold">Portal Access Issue</h2>
        </div>
        <p className="mt-2 text-sm">{error || "Could not retrieve your teacher profile."}</p>
        <p className="mt-4 text-xs text-red-700 dark:text-red-300">
          Please verify that your staff account is active and linked to your email address by contacting your school administrator.
        </p>
      </div>
    );
  }

  const { teacher, assignments, timetable, students, homework, leaveRequests, notifications, unread } = data;

  // Distinct classes and sections
  const uniqueClassSections = Array.from(
    new Set(assignments.map((a) => `${a.className} - ${a.section}`))
  );

  // Distinct subjects
  const uniqueSubjects = Array.from(new Set(assignments.map((a) => a.subject)));

  // Today's classes from timetable
  const todayClasses = timetable
    .filter((t) => t.weekday === todayIndex)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const activeHomeworkCount = homework.filter((h) => h.status === "Active").length;
  const pendingLeaveCount = leaveRequests.filter((l) => l.status === "Pending").length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100 backdrop-blur">
                <Sparkles className="size-3.5" /> Teacher Workspace
              </span>
              <h1 className="mt-3 text-2xl font-black sm:text-3xl">
                Welcome back, {teacher.name}
              </h1>
              <p className="mt-1 text-xs text-blue-100 sm:text-sm">
                Emp: <b>{teacher.employeeId}</b> • Dept: <b>{teacher.department || "Faculty"}</b> • Primary Subject: <b>{teacher.subject || "General"}</b>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/teacher/attendance"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-blue-900 shadow transition hover:bg-blue-50 active:scale-95"
              >
                <CalendarCheck2 className="size-4" />
                Take Attendance
              </Link>
              <Link
                href="/teacher/homework"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-950/40 px-4 py-2.5 text-xs font-bold text-white shadow ring-1 ring-white/20 transition hover:bg-blue-950/60 active:scale-95"
              >
                <BookOpen className="size-4" />
                New Homework
              </Link>
            </div>
          </div>

          {/* Assigned Classes Chips */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-white/15 text-xs">
            <span className="font-semibold text-blue-200">Your Classes:</span>
            {uniqueClassSections.length > 0 ? (
              uniqueClassSections.map((cs) => (
                <span
                  key={cs}
                  className="rounded-lg bg-white/20 px-2.5 py-1 font-bold tracking-wide backdrop-blur"
                >
                  {cs}
                </span>
              ))
            ) : (
              <span className="italic text-blue-200">No classes assigned yet</span>
            )}
          </div>
        </div>
      </section>

      {/* Metrics Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border bg-panel p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Layers3 className="size-4 text-blue-600" />
            <span className="text-xs font-semibold">Classes</span>
          </div>
          <b className="mt-2 block text-2xl font-black">{uniqueClassSections.length}</b>
          <span className="text-[11px] text-muted">Assigned sections</span>
        </div>

        <div className="rounded-2xl border bg-panel p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <GraduationCap className="size-4 text-indigo-600" />
            <span className="text-xs font-semibold">Subjects</span>
          </div>
          <b className="mt-2 block text-2xl font-black">{uniqueSubjects.length}</b>
          <span className="text-[11px] text-muted">Subject courses</span>
        </div>

        <div className="rounded-2xl border bg-panel p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Users className="size-4 text-cyan-600" />
            <span className="text-xs font-semibold">Students</span>
          </div>
          <b className="mt-2 block text-2xl font-black">{students.length}</b>
          <span className="text-[11px] text-muted">Enrolled total</span>
        </div>

        <div className="rounded-2xl border bg-panel p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <CalendarDays className="size-4 text-emerald-600" />
            <span className="text-xs font-semibold">Today</span>
          </div>
          <b className="mt-2 block text-2xl font-black">{todayClasses.length}</b>
          <span className="text-[11px] text-muted">Periods scheduled</span>
        </div>

        <div className="rounded-2xl border bg-panel p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <BookOpen className="size-4 text-amber-600" />
            <span className="text-xs font-semibold">Homework</span>
          </div>
          <b className="mt-2 block text-2xl font-black">{activeHomeworkCount}</b>
          <span className="text-[11px] text-muted">Active tasks</span>
        </div>

        <div className="rounded-2xl border bg-panel p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Clock className="size-4 text-purple-600" />
            <span className="text-xs font-semibold">Leave</span>
          </div>
          <b className="mt-2 block text-2xl font-black">{pendingLeaveCount}</b>
          <span className="text-[11px] text-muted">Pending review</span>
        </div>
      </section>

      {/* Main Grid: Today's Schedule + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule (2 cols) */}
        <section className="rounded-3xl border bg-panel p-5 shadow-sm sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Today&apos;s Schedule ({weekdayNames[todayIndex]})
              </h2>
              <p className="text-xs text-muted">Your scheduled periods for today</p>
            </div>
            <Link
              href="/teacher/timetable"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Full Timetable →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {todayClasses.length > 0 ? (
              todayClasses.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-canvas p-4 transition hover:border-blue-400"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      <Clock className="size-5" />
                    </span>
                    <div>
                      <b className="text-sm font-bold">
                        {item.className} - Section {item.section}
                      </b>
                      <p className="text-xs text-muted">
                        Subject: <span className="font-semibold text-foreground">{item.subject}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-xl border bg-panel px-3 py-1.5 text-xs font-bold">
                      {item.startTime} – {item.endTime}
                    </span>
                    <Link
                      href={`/teacher/attendance?class=${encodeURIComponent(item.className)}&section=${encodeURIComponent(item.section)}`}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
                    >
                      Attendance
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed py-10 text-center">
                <CalendarDays className="mx-auto size-8 text-muted" />
                <p className="mt-2 text-sm font-bold">No classes scheduled for today.</p>
                <p className="text-xs text-muted">Enjoy your planning period or review student progress.</p>
              </div>
            )}
          </div>
        </section>

        {/* Quick Portal Shortcuts (1 col) */}
        <section className="space-y-4">
          <div className="rounded-3xl border bg-panel p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-bold">Quick Navigation</h2>
            <p className="text-xs text-muted">Class & academic management tools</p>

            <div className="mt-4 grid gap-2">
              <Link
                href="/teacher/attendance"
                className="group flex items-center justify-between rounded-2xl border p-3.5 transition hover:border-blue-400 hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <CalendarCheck2 className="size-4" />
                  </span>
                  <div>
                    <b className="text-xs font-bold">Take Attendance</b>
                    <small className="block text-[11px] text-muted">Mark daily student presence</small>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
              </Link>

              <Link
                href="/teacher/homework"
                className="group flex items-center justify-between rounded-2xl border p-3.5 transition hover:border-blue-400 hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
                    <BookOpen className="size-4" />
                  </span>
                  <div>
                    <b className="text-xs font-bold">Homework & Tasks</b>
                    <small className="block text-[11px] text-muted">Assign work to your classes</small>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-amber-600" />
              </Link>

              <Link
                href="/teacher/exams"
                className="group flex items-center justify-between rounded-2xl border p-3.5 transition hover:border-blue-400 hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                    <FileCheck2 className="size-4" />
                  </span>
                  <div>
                    <b className="text-xs font-bold">Exam Marks Entry</b>
                    <small className="block text-[11px] text-muted">Input marks for assigned subjects</small>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
              </Link>

              <Link
                href="/teacher/students"
                className="group flex items-center justify-between rounded-2xl border p-3.5 transition hover:border-blue-400 hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300">
                    <Users className="size-4" />
                  </span>
                  <div>
                    <b className="text-xs font-bold">My Students</b>
                    <small className="block text-[11px] text-muted">View roster & contact info</small>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-cyan-600" />
              </Link>

              <Link
                href="/teacher/leave"
                className="group flex items-center justify-between rounded-2xl border p-3.5 transition hover:border-blue-400 hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300">
                    <Clock className="size-4" />
                  </span>
                  <div>
                    <b className="text-xs font-bold">Leave Requests</b>
                    <small className="block text-[11px] text-muted">Apply for leave & track approval</small>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-purple-600" />
              </Link>
            </div>
          </div>

          {/* Notifications Card */}
          <div className="rounded-3xl border bg-panel p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-blue-600" />
                <h3 className="text-sm font-bold">Recent Notices</h3>
              </div>
              <Link href="/teacher/notifications" className="text-xs font-bold text-blue-600 hover:underline">
                View all ({unread} unread)
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {notifications.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 text-xs ${
                    !item.readAt ? "border-blue-300 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/30" : "bg-canvas"
                  }`}
                >
                  <b className="block font-bold">{item.title}</b>
                  <p className="mt-1 line-clamp-2 text-muted">{item.description}</p>
                </div>
              ))}
              {!notifications.length && (
                <p className="py-4 text-center text-xs text-muted">No recent notifications.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
