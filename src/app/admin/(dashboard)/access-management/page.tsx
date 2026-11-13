"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  GraduationCap,
  FileDown,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  UserCheck,
  Lock,
} from "lucide-react";

type SchoolStat = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  teachersCount: number;
  studentsCount: number;
  teacherAccountsCount: number;
  parentAccountsCount: number;
  pendingTeacherCount: number;
  pendingParentCount: number;
};

type OverviewData = {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalTeachers: number;
  totalStudents: number;
  activeTeacherAccounts: number;
  activeParentAccounts: number;
  pendingTeacherActivations: number;
  pendingParentActivations: number;
  schools: SchoolStat[];
};

export default function AccessManagementPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "Active" | "Suspended">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/access-management");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const json: OverviewData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load access overview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleProvision(schoolId: string, schoolName: string) {
    try {
      setActionLoading(`prov-${schoolId}`);
      const res = await fetch("/api/admin/access-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provision", institutionId: schoolId, target: "all" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Provisioning failed");

      setNotification({
        message: `Successfully provisioned accounts for ${schoolName}: ${json.provisionedTeachers} teachers, ${json.provisionedParents} parents created.`,
        type: "success",
      });
      await loadData();
    } catch (err) {
      setNotification({
        message: err instanceof Error ? err.message : "Provisioning failed",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleProvisionAll() {
    if (!confirm("This will automatically create secure login credentials for all unprovisioned teachers and students across all registered schools. Proceed?")) {
      return;
    }
    try {
      setActionLoading("prov-all");
      const res = await fetch("/api/admin/access-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provision-all" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Batch provisioning failed");

      setNotification({
        message: `Platform reconciliation complete. Processed ${json.processedSchoolsCount} schools with pending accounts.`,
        type: "success",
      });
      await loadData();
    } catch (err) {
      setNotification({
        message: err instanceof Error ? err.message : "Batch provisioning failed",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleStatus(schoolId: string, currentStatus: string) {
    const newStatus = currentStatus === "Active" ? "Suspended" : "Active";
    if (!confirm(`Are you sure you want to change this institution's status to ${newStatus}?`)) {
      return;
    }
    try {
      setActionLoading(`toggle-${schoolId}`);
      const res = await fetch("/api/admin/access-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-status", institutionId: schoolId, status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");

      setNotification({
        message: `Institution status updated to ${newStatus}.`,
        type: "success",
      });
      await loadData();
    } catch (err) {
      setNotification({
        message: err instanceof Error ? err.message : "Failed to update status",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  const filteredSchools = (data?.schools || []).filter((school) => {
    const matchesSearch =
      school.name.toLowerCase().includes(search.toLowerCase()) ||
      school.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || school.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <KeyRound className="size-4" /> Multi-School Access & Credential Management
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            School Access & Credentials
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Centrally manage teacher & parent accounts, enforce institutional isolation, and generate official credential sheets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleProvisionAll}
            disabled={actionLoading !== null || loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <UserCheck className="size-4" />
            {actionLoading === "prov-all" ? "Provisioning All..." : "Auto-Provision All Schools"}
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-sm border ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Schools</span>
            <Building2 className="size-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {loading ? "…" : data?.totalSchools ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            {data?.activeSchools ?? 0} Active
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Teachers</span>
            <Users className="size-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {loading ? "…" : data?.totalTeachers ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">In School Rosters</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Students</span>
            <GraduationCap className="size-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {loading ? "…" : data?.totalStudents ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Enrolled Across Schools</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Active Teachers</span>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {loading ? "…" : data?.activeTeacherAccounts ?? 0}
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
            Teacher PWA Ready
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Active Parents</span>
            <UserCheck className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {loading ? "…" : data?.activeParentAccounts ?? 0}
          </div>
          <div className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-1 font-medium">
            Parent PWA Ready
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Pending Activations</span>
            <Lock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {loading
              ? "…"
              : (data?.pendingTeacherActivations ?? 0) + (data?.pendingParentActivations ?? 0)}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
            Unprovisioned Accounts
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school name or ID..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "Active", "Suspended"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterStatus === status
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {status === "all" ? "All Schools" : status}
            </button>
          ))}
        </div>
      </div>

      {/* Schools Table */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/75 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Institution Name</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Faculty & Teachers</th>
                <th className="py-3.5 px-3">Students & Parents</th>
                <th className="py-3.5 px-3">Pending</th>
                <th className="py-3.5 px-4 text-right">Access Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading institution access directory...
                  </td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No institutions match the current search filter.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => {
                  const isSuspended = school.status === "Suspended";
                  return (
                    <tr
                      key={school.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {school.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {school.id.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isSuspended
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {isSuspended ? (
                            <ShieldAlert className="size-3" />
                          ) : (
                            <ShieldCheck className="size-3" />
                          )}
                          {school.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {school.teachersCount} in roster
                        </div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400">
                          {school.teacherAccountsCount} accounts active
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {school.studentsCount} enrolled
                        </div>
                        <div className="text-xs text-cyan-600 dark:text-cyan-400">
                          {school.parentAccountsCount} parent linked
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {school.pendingTeacherCount > 0 || school.pendingParentCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {school.pendingTeacherCount}T + {school.pendingParentCount}P
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">All Provisioned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Teacher PDF */}
                          <a
                            href={`/api/admin/credentials/teacher-pdf?schoolId=${school.id}`}
                            download
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 rounded-lg transition"
                            title="Download Teacher Credentials PDF"
                          >
                            <FileDown className="size-3.5 text-violet-500" />
                            Teacher PDF
                          </a>

                          {/* Student PDF */}
                          <a
                            href={`/api/admin/credentials/student-pdf?schoolId=${school.id}`}
                            download
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 rounded-lg transition"
                            title="Download Student Credentials PDF"
                          >
                            <FileDown className="size-3.5 text-cyan-500" />
                            Student PDF
                          </a>

                          {/* Provision missing accounts */}
                          {(school.pendingTeacherCount > 0 || school.pendingParentCount > 0) && (
                            <button
                              onClick={() => handleProvision(school.id, school.name)}
                              disabled={actionLoading !== null}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                              title="Provision Missing Accounts"
                            >
                              <UserCheck className="size-3.5" />
                              {actionLoading === `prov-${school.id}` ? "..." : "Provision"}
                            </button>
                          )}

                          {/* Toggle Active / Suspended */}
                          <button
                            onClick={() => handleToggleStatus(school.id, school.status)}
                            disabled={actionLoading !== null}
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition ${
                              isSuspended
                                ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                                : "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                            }`}
                            title={isSuspended ? "Re-activate School" : "Suspend School Access"}
                          >
                            {isSuspended ? "Activate" : "Suspend"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

