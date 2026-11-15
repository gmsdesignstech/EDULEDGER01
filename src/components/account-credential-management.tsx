"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  RefreshCw,
  Download,
  Users,
  GraduationCap,
  KeyRound,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Mail,
  FileText,
  Copy,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  UserCheck,
} from "lucide-react";

type AccountOverview = {
  institution: {
    id: string;
    name: string;
    type: string;
  };
  settings: {
    defaultTeacherPassword: string;
    defaultStudentPassword: string;
    teacherPasswordMode: "COMMON" | "UNIQUE";
    studentPasswordMode: "COMMON" | "UNIQUE";
    accountsLastSyncedAt: string | null;
  };
  teachers: {
    total: number;
    active: number;
    pending: number;
    passwordSet: number;
  };
  students: {
    total: number;
    active: number;
    pending: number;
    passwordSet: number;
  };
};

type SyncReport = {
  teachers: {
    total: number;
    provisioned: number;
    repaired: number;
    activeWithSetPassword: number;
  };
  students: {
    total: number;
    provisioned: number;
    repaired: number;
    activeWithSetPassword: number;
  };
};

type RegeneratedCredentials = {
  name: string;
  loginId: string;
  temporaryPassword: string;
  loginUrl: string;
  email?: string;
  phone?: string;
  status: string;
};

export function AccountCredentialManagement() {
  const [data, setData] = useState<AccountOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form states for password configuration
  const [teacherMode, setTeacherMode] = useState<"COMMON" | "UNIQUE">("COMMON");
  const [studentMode, setStudentMode] = useState<"COMMON" | "UNIQUE">("COMMON");
  const [teacherDefaultPassword, setTeacherDefaultPassword] = useState("EduTeacher@2026");
  const [studentDefaultPassword, setStudentDefaultPassword] = useState("EduStudent@2026");

  // Modals state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);

  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<"TEACHER" | "STUDENT">("TEACHER");
  const [targetIdentifier, setTargetIdentifier] = useState("");
  const [regenerateMode, setRegenerateMode] = useState<"common" | "unique">("common");
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratedResult, setRegeneratedResult] = useState<RegeneratedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  async function loadOverview() {
    try {
      const res = await fetch("/api/admin/accounts/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setTeacherMode(json.settings.teacherPasswordMode || "COMMON");
        setStudentMode(json.settings.studentPasswordMode || "COMMON");
        setTeacherDefaultPassword(json.settings.defaultTeacherPassword || "EduTeacher@2026");
        setStudentDefaultPassword(json.settings.defaultStudentPassword || "EduStudent@2026");
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function handleSync(regenerateAll?: boolean) {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/accounts/synchronize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regenerateAllTeachers: regenerateAll,
          regenerateAllStudents: regenerateAll,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setSyncReport(result);
        setMessage({
          type: "success",
          text: `Synchronization complete! Provisioned/updated ${result.teachers.provisioned + result.teachers.repaired} faculty accounts and ${result.students.provisioned + result.students.repaired} student accounts.`,
        });
        await loadOverview();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Account synchronization failed. Please try again.",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Network or server connection failed.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/accounts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultTeacherPassword: teacherDefaultPassword,
          defaultStudentPassword: studentDefaultPassword,
          teacherPasswordMode: teacherMode,
          studentPasswordMode: studentMode,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setMessage({
          type: "success",
          text: "Default password format and provisioning settings saved successfully.",
        });
        await loadOverview();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to update settings.",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Failed to connect to the server.",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleRegeneratePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!targetIdentifier.trim()) return;
    setRegenerating(true);
    setRegeneratedResult(null);
    try {
      const endpoint =
        regenerateTarget === "TEACHER"
          ? `/api/teachers/${encodeURIComponent(targetIdentifier.trim())}/reset-password`
          : `/api/students/${encodeURIComponent(targetIdentifier.trim())}/reset-password`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: regenerateMode }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRegeneratedResult(json.credentials);
        await loadOverview();
      } else {
        alert(json.error || "Could not find record or reset credentials.");
      }
    } catch {
      alert("Failed to communicate with authentication service.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSendBulkEmails(target: "BULK_TEACHERS" | "BULK_STUDENTS") {
    setEmailing(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/admin/accounts/activate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: target }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setEmailStatus(json.message || `Dispatched ${json.sent} activation emails.`);
      } else {
        setEmailStatus(json.error || "Failed to dispatch activation emails.");
      }
    } catch {
      setEmailStatus("Network error occurred while dispatching emails.");
    } finally {
      setEmailing(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="size-5 animate-spin text-emerald-500" />
          <span>Loading centralized credential system…</span>
        </div>
      </div>
    );
  }

  const lastSyncLabel = data?.settings?.accountsLastSyncedAt
    ? new Date(data.settings.accountsLastSyncedAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl dark:border-white/10 sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-white">ACCOUNT & CREDENTIAL MANAGEMENT</h1>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                    {data?.institution.type || "School"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 sm:text-sm">
                  {data?.institution.name} &bull; Centralized Automatic Account Provisioning & Multi-Portal Authentication
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleSync(false)}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Synchronizing…" : "Synchronize All Accounts"}</span>
            </button>
            <button
              onClick={() => {
                setRegeneratedResult(null);
                setRegenerateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              <KeyRound className="size-3.5 text-amber-300" />
              <span>Regenerate Password</span>
            </button>
            <button
              onClick={() => setEmailModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              <Mail className="size-3.5 text-cyan-300" />
              <span>Send Activation Emails</span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-slate-400" />
            <span>Last Synchronized: <strong>{lastSyncLabel}</strong></span>
          </div>
          <button
            onClick={() => setReportModalOpen(true)}
            className="flex items-center gap-1 text-cyan-300 hover:underline"
          >
            <FileText className="size-3.5" />
            <span>View Account Provisioning Report</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-medium ${
            message.type === "success"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="size-5 shrink-0 text-rose-500" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Faculty */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Faculty Accounts
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Users className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
            {data?.teachers.total || 0}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Active: <strong>{data?.teachers.active || 0}</strong></span>
            <span className="text-amber-600 dark:text-amber-400">Pending: <strong>{data?.teachers.pending || 0}</strong></span>
          </div>
        </div>

        {/* Faculty Passwords Configured */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Teacher Password Status
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Lock className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {data?.teachers.passwordSet || 0}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Permanent Password Set</span>
            <span>{data?.teachers.total ? Math.round(((data.teachers.passwordSet) / data.teachers.total) * 100) : 0}%</span>
          </div>
        </div>

        {/* Total Students */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Student Accounts
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-500">
              <GraduationCap className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
            {data?.students.total || 0}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Portal Accounts: <strong>{data?.students.active || 0}</strong></span>
            <span className="text-amber-600 dark:text-amber-400">Pending: <strong>{data?.students.pending || 0}</strong></span>
          </div>
        </div>

        {/* Student Passwords Configured */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Student / Parent Set
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-teal-500/10 text-teal-500">
              <KeyRound className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-teal-600 dark:text-teal-400">
            {data?.students.passwordSet || 0}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Permanent Passwords</span>
            <span>{data?.students.total ? Math.round(((data.students.passwordSet) / data.students.total) * 100) : 0}%</span>
          </div>
        </div>
      </div>

      {/* Official Actions & Portal Status Hub */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Portal Access Status */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Official Portal Endpoints
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Live & Secure
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Official login URLs for institutional faculty, students, and parents.
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-950/40">
              <div>
                <b className="text-sm text-slate-900 dark:text-white">Teacher Portal</b>
                <p className="text-xs font-mono text-slate-500">https://eduledger.co.in/teacher/login</p>
              </div>
              <a
                href="/teacher/login"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400"
              >
                <span>Open</span>
                <ExternalLink className="size-3" />
              </a>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-950/40">
              <div>
                <b className="text-sm text-slate-900 dark:text-white">Student & Parent Portal</b>
                <p className="text-xs font-mono text-slate-500">https://eduledger.co.in/student/login</p>
              </div>
              <a
                href="/student/login"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400"
              >
                <span>Open</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Administrator Quick Actions */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-7">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            Administrator Quick Actions
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Centralized controls to manage, synchronize, and regenerate credentials.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleSync(false)}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-emerald-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/40"
            >
              <RefreshCw className={`size-4 text-emerald-500 ${syncing ? "animate-spin" : ""}`} />
              <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white">Sync All</span>
                <span className="block text-[10px] text-slate-400">Align all records</span>
              </div>
            </button>

            <button
              onClick={() => {
                setRegeneratedResult(null);
                setRegenerateModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-amber-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/40"
            >
              <KeyRound className="size-4 text-amber-500" />
              <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white">Reset PW</span>
                <span className="block text-[10px] text-slate-400">Individual user</span>
              </div>
            </button>

            <button
              onClick={() => setEmailModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-cyan-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/40"
            >
              <Mail className="size-4 text-cyan-500" />
              <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white">Email Notice</span>
                <span className="block text-[10px] text-slate-400">Send activations</span>
              </div>
            </button>

            <button
              onClick={() => setReportModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-indigo-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/40"
            >
              <FileText className="size-4 text-indigo-500" />
              <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white">Audit Report</span>
                <span className="block text-[10px] text-slate-400">Provision metrics</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Password System Settings */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Default Temporary Password Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Configure initial temporary passwords for newly registered teachers and students. Temporary passwords are only used during initial account activation and must be changed on first login.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Teacher Password Box */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-slate-950/60">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Teacher Default Password
                </span>
                <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-500">
                  Teacher Portal
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Applied to new faculty registrations and credential resets.
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTeacherMode("COMMON")}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      teacherMode === "COMMON"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    Standard Temporary
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherMode("UNIQUE")}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      teacherMode === "UNIQUE"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    Unique Cryptographic
                  </button>
                </div>

                {teacherMode === "COMMON" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Standard Temporary Password
                    </label>
                    <input
                      type="text"
                      required
                      minLength={8}
                      value={teacherDefaultPassword}
                      onChange={(e) => setTeacherDefaultPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                      placeholder="EduTeacher@2026"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTeacherDefaultPassword("EduTeacher@2026")}
                        className="text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Reset to EduTeacher@2026
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Student Password Box */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-slate-950/60">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Student Default Password
                </span>
                <span className="rounded-lg bg-blue-500/15 px-2 py-0.5 text-[11px] font-bold text-blue-500">
                  Student & Parent Portal
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Applied to newly enrolled students and parent activations.
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentMode("COMMON")}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      studentMode === "COMMON"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    Standard Temporary
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentMode("UNIQUE")}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      studentMode === "UNIQUE"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    Unique Cryptographic
                  </button>
                </div>

                {studentMode === "COMMON" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Standard Temporary Password
                    </label>
                    <input
                      type="text"
                      required
                      minLength={8}
                      value={studentDefaultPassword}
                      onChange={(e) => setStudentDefaultPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                      placeholder="EduStudent@2026"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStudentDefaultPassword("EduStudent@2026")}
                        className="text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Reset to EduStudent@2026
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              <span>{savingSettings ? "Saving…" : "Save Password Configuration"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Official PDF & Document Download Hub */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-8">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Official Access Credentials PDF Documents
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          Download administrative 8-column credentials sheets formatted for institutional distribution. All sheets include faculty/student IDs, login portals, and unclipped temporary passwords.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-white/10 dark:bg-slate-950/40">
            <div>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-indigo-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Faculty & Staff Access Credentials</h3>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Contains Faculty ID, Teacher Name, Dept / Subject, Registered Email, Mobile, Temporary Password, and Account Status.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href="/api/credentials/teachers/pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500"
              >
                <Download className="size-3.5" />
                <span>Download Faculty PDF</span>
              </a>
              <a
                href="/api/credentials/teachers/pdf?regenerate=missing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                title="Repair & Download (generate passwords for pending)"
              >
                <RefreshCw className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-white/10 dark:bg-slate-950/40">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Student & Parent Access Credentials</h3>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Contains Admission No, Student Name, Class & Sec, Parent Contact, Login ID, Temporary Password, and Status.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href="/api/credentials/students/pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500"
              >
                <Download className="size-3.5" />
                <span>Download Student PDF</span>
              </a>
              <a
                href="/api/credentials/students/pdf?regenerate=missing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                title="Repair & Download (generate passwords for pending)"
              >
                <RefreshCw className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: REGENERATE INDIVIDUAL PASSWORD */}
      {regenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-7">
            <button
              onClick={() => setRegenerateModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <KeyRound className="size-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Regenerate Individual Credentials
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Generate a new temporary password for a faculty member or student. Requires password change upon their next login.
            </p>

            {!regeneratedResult ? (
              <form onSubmit={handleRegeneratePassword} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Account Target
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRegenerateTarget("TEACHER")}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        regenerateTarget === "TEACHER"
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-800"
                      }`}
                    >
                      Faculty / Teacher
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegenerateTarget("STUDENT")}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        regenerateTarget === "STUDENT"
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-800"
                      }`}
                    >
                      Student / Parent
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {regenerateTarget === "TEACHER" ? "Teacher Record ID" : "Student Record ID"}
                  </label>
                  <input
                    type="text"
                    required
                    value={targetIdentifier}
                    onChange={(e) => setTargetIdentifier(e.target.value)}
                    placeholder={regenerateTarget === "TEACHER" ? "Enter Teacher UUID" : "Enter Student UUID"}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Copy the ID from the Teachers/Students roster table or PDF sheet.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password Generation Mode
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRegenerateMode("common")}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        regenerateMode === "common"
                          ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-800"
                      }`}
                    >
                      Default ({regenerateTarget === "TEACHER" ? "EduTeacher@2026" : "EduStudent@2026"})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegenerateMode("unique")}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        regenerateMode === "unique"
                          ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-800"
                      }`}
                    >
                      Unique Random
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRegenerateModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={regenerating}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                    <span>{regenerating ? "Generating…" : "Issue New Password"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" />
                    <span className="text-xs font-bold">New Temporary Password Issued Successfully</span>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Name:</dt>
                      <dd className="font-bold text-slate-900 dark:text-white">{regeneratedResult.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Login Identifier:</dt>
                      <dd className="font-mono font-bold text-slate-900 dark:text-white">{regeneratedResult.loginId}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Temporary Password:</dt>
                      <dd className="rounded bg-white/70 px-1.5 py-0.5 font-mono font-black text-emerald-600 dark:bg-slate-900 dark:text-emerald-400">
                        {regeneratedResult.temporaryPassword}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Portal Link:</dt>
                      <dd className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{regeneratedResult.loginUrl}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `EduLedger Login Credentials\nName: ${regeneratedResult.name}\nLogin ID: ${regeneratedResult.loginId}\nTemporary Password: ${regeneratedResult.temporaryPassword}\nLogin Portal: ${regeneratedResult.loginUrl}`
                      )
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    <span>{copied ? "Copied to Clipboard!" : "Copy Full Credentials"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setRegeneratedResult(null);
                      setTargetIdentifier("");
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                  >
                    Reset Another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: SEND ACTIVATION EMAILS */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-7">
            <button
              onClick={() => {
                setEmailModalOpen(false);
                setEmailStatus(null);
              }}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <Mail className="size-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Dispatch Account Activation Emails
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Send formal onboarding emails containing portal login URLs, Faculty/Student Login IDs, and activation instructions.
            </p>

            <div className="mt-5 space-y-3">
              <button
                onClick={() => handleSendBulkEmails("BULK_TEACHERS")}
                disabled={emailing}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left transition hover:border-indigo-500 hover:bg-indigo-50/20 dark:border-white/10 dark:hover:bg-indigo-950/30"
              >
                <div>
                  <b className="text-sm text-slate-900 dark:text-white">Notify Faculty & Staff</b>
                  <p className="text-xs text-slate-500">Dispatch emails to all registered teachers</p>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleSendBulkEmails("BULK_STUDENTS")}
                disabled={emailing}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-white/10 dark:hover:bg-emerald-950/30"
              >
                <div>
                  <b className="text-sm text-slate-900 dark:text-white">Notify Students & Parents</b>
                  <p className="text-xs text-slate-500">Dispatch emails to registered parent contacts</p>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </button>
            </div>

            {emailStatus && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300">
                {emailStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: PROVISIONING AUDIT REPORT */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-7">
            <button
              onClick={() => setReportModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <FileText className="size-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Account Provisioning Audit Report
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Real-time audit metrics for tenant accounts across the institution environment.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/50">
                <b className="text-xs uppercase tracking-wider text-slate-500">Faculty & Staff Metrics</b>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>Total Roster: <strong>{data?.teachers.total || 0}</strong></div>
                  <div>Active Accounts: <strong className="text-emerald-600">{data?.teachers.active || 0}</strong></div>
                  <div>Pending Activation: <strong className="text-amber-600">{data?.teachers.pending || 0}</strong></div>
                  <div>Permanent PW Set: <strong className="text-indigo-600">{data?.teachers.passwordSet || 0}</strong></div>
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/50">
                <b className="text-xs uppercase tracking-wider text-slate-500">Student & Parent Metrics</b>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>Total Students: <strong>{data?.students.total || 0}</strong></div>
                  <div>Active Accounts: <strong className="text-emerald-600">{data?.students.active || 0}</strong></div>
                  <div>Pending Activation: <strong className="text-amber-600">{data?.students.pending || 0}</strong></div>
                  <div>Permanent PW Set: <strong className="text-teal-600">{data?.students.passwordSet || 0}</strong></div>
                </dl>
              </div>

              {syncReport && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <b>Latest Synchronization Batch:</b>
                  <p className="mt-1">
                    Faculty updated: {syncReport.teachers.provisioned + syncReport.teachers.repaired} &bull; Students updated: {syncReport.students.provisioned + syncReport.students.repaired}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setReportModalOpen(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
