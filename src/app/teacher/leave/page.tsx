"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

type LeaveRequest = {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt?: string;
};

export default function TeacherLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [reason, setReason] = useState("");

  function loadRequests() {
    setLoading(true);
    fetch("/api/teacher/leave")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load leave records");
        return res.json();
      })
      .then((data) => {
        setRequests(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load leave requests");
        setLoading(false);
      });
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function applyLeave(e: React.FormEvent) {
    e.preventDefault();
    if (toDate < fromDate) {
      setError("End date must be on or after start date.");
      return;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/teacher/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate, reason }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Could not submit leave request");
      }

      setSuccess("Leave request submitted for administrative review.");
      setReason("");
      setModalOpen(false);
      loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply for leave");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRequest(id: string) {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      const res = await fetch(`/api/teacher/leave?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not cancel request");
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setSuccess("Leave request cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel request");
    }
  }

  const counts = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading leave requests…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Staff Leave Requests</h1>
          <p className="text-xs text-muted sm:text-sm">
            Apply for formal absence and track management approval
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-900/20 transition hover:bg-blue-700 active:scale-95"
        >
          <Plus className="size-4" />
          Apply for Leave
        </button>
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

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-panel p-4">
          <span className="text-xs font-semibold text-muted">Total Requests</span>
          <b className="mt-1 block text-2xl font-black">{counts.total}</b>
        </div>
        <div className="rounded-2xl border bg-panel p-4">
          <span className="text-xs font-semibold text-amber-600">Pending Review</span>
          <b className="mt-1 block text-2xl font-black text-amber-600">{counts.pending}</b>
        </div>
        <div className="rounded-2xl border bg-panel p-4">
          <span className="text-xs font-semibold text-emerald-600">Approved</span>
          <b className="mt-1 block text-2xl font-black text-emerald-600">{counts.approved}</b>
        </div>
        <div className="rounded-2xl border bg-panel p-4">
          <span className="text-xs font-semibold text-rose-600">Rejected</span>
          <b className="mt-1 block text-2xl font-black text-rose-600">{counts.rejected}</b>
        </div>
      </div>

      {/* Leave List */}
      <div className="space-y-3">
        {requests.length > 0 ? (
          requests.map((item) => {
            const statusColors = {
              Pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300",
              Approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300",
              Rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300",
            }[item.status] || "bg-canvas text-muted border";

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-3xl border bg-panel p-5 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                      <Calendar className="size-3.5 text-blue-600" />
                      {item.fromDate} {item.fromDate !== item.toDate ? `→ ${item.toDate}` : ""}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${statusColors}`}>
                      {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                    {item.reason}
                  </p>
                </div>

                {item.status === "Pending" && (
                  <div className="flex shrink-0 items-center justify-end border-t pt-2 sm:border-t-0 sm:pt-0">
                    <button
                      onClick={() => cancelRequest(item.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 dark:border-rose-950 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      <Trash2 className="size-3.5" />
                      Cancel Request
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed bg-panel p-12 text-center">
            <Clock className="mx-auto size-10 text-muted" />
            <h3 className="mt-3 text-base font-bold">No leave requests</h3>
            <p className="mt-1 text-xs text-muted">
              You haven&apos;t submitted any leave applications yet.
            </p>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border bg-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-black">Apply for Leave</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-1 text-muted hover:bg-canvas"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={applyLeave} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    From Date
                  </label>
                  <input
                    type="date"
                    required
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      if (toDate < e.target.value) setToDate(e.target.value);
                    }}
                    className="mt-1 w-full rounded-2xl border bg-canvas px-4 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    To Date
                  </label>
                  <input
                    type="date"
                    required
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="mt-1 w-full rounded-2xl border bg-canvas px-4 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Reason for Absence
                </label>
                <textarea
                  required
                  rows={4}
                  minLength={5}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide specific reason (medical, personal emergency, family function, etc.)…"
                  className="mt-1 w-full rounded-2xl border bg-canvas px-4 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border bg-canvas px-4 py-2.5 text-xs font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

