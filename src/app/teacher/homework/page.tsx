"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

type HomeworkItem = {
  id: string;
  title: string;
  description: string;
  className: string;
  section: string;
  subject: string;
  academicYear: string;
  dueDate: string;
  status: "Active" | "Archived";
  createdAt?: string;
};

type Assignment = {
  academicYear: string;
  className: string;
  section: string;
  subject: string;
};

export default function TeacherHomeworkPage() {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tab, setTab] = useState<"ALL" | "Active" | "Archived">("Active");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New Homework Form State
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  );

  function loadHomework() {
    setLoading(true);
    fetch("/api/teacher/homework")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load homework records");
        return readApiJson(res);
      })
      .then((data) => {
        setItems(data.items || []);
        const asg: Assignment[] = data.assignments || [];
        setAssignments(asg);
        if (asg.length > 0 && !selectedScope) {
          setSelectedScope(`${asg[0].className} - ${asg[0].section} - ${asg[0].subject}`);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load homework");
        setLoading(false);
      });
  }

  useEffect(() => {
    loadHomework();
  }, []);

  const scopeOptions = useMemo(() => {
    return assignments.map((a) => ({
      key: `${a.className} - ${a.section} - ${a.subject}`,
      label: `${a.className} (Sec ${a.section}) • ${a.subject}`,
      className: a.className,
      section: a.section,
      subject: a.subject,
      academicYear: a.academicYear,
    }));
  }, [assignments]);

  async function createHomework(e: React.FormEvent) {
    e.preventDefault();
    const chosen = scopeOptions.find((s) => s.key === selectedScope);
    if (!chosen) {
      setError("Please choose an assigned class and subject.");
      return;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/teacher/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: chosen.academicYear,
          className: chosen.className,
          section: chosen.section,
          subject: chosen.subject,
          title,
          description,
          dueDate,
        }),
      });

      if (!res.ok) {
        const err = await readApiJson(res).catch(() => null);
        throw new Error(err?.error || "Could not assign homework");
      }

      setSuccess("Homework assignment created successfully.");
      setTitle("");
      setDescription("");
      setModalOpen(false);
      loadHomework();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating homework");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(item: HomeworkItem) {
    const nextStatus = item.status === "Active" ? "Archived" : "Active";
    try {
      const res = await fetch("/api/teacher/homework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error("Could not update status");
      setItems((prev) =>
        prev.map((h) => (h.id === item.id ? { ...h, status: nextStatus } : h))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update homework");
    }
  }

  async function deleteHomework(id: string) {
    if (!confirm("Are you sure you want to delete this homework?")) return;
    try {
      const res = await fetch(`/api/teacher/homework?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete homework");
      setItems((prev) => prev.filter((h) => h.id !== id));
      setSuccess("Homework deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete homework");
    }
  }

  const filtered = items.filter((item) => {
    if (tab === "Active") return item.status === "Active";
    if (tab === "Archived") return item.status === "Archived";
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading homework assignments…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Homework Management</h1>
          <p className="text-xs text-muted sm:text-sm">
            Assign curriculum tasks and track student submissions
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-900/20 transition hover:bg-blue-700 active:scale-95"
        >
          <Plus className="size-4" />
          Assign New Homework
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

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(["Active", "Archived", "ALL"] as const).map((t) => {
          const count = items.filter((h) => (t === "ALL" ? true : h.status === t)).length;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
                active
                  ? "bg-blue-600 text-white shadow"
                  : "bg-panel text-muted hover:text-foreground border"
              }`}
            >
              {t === "ALL" ? "All Assignments" : `${t} Tasks`} ({count})
            </button>
          );
        })}
      </div>

      {/* Homework Cards List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-3xl border bg-panel p-5 shadow-sm transition hover:border-blue-400"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    {item.className} - {item.section}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <span className="text-xs font-semibold text-blue-600">
                    {item.subject}
                  </span>
                </div>

                <p className="line-clamp-3 text-xs text-muted leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t space-y-3">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="size-3 text-amber-600" />
                    Due: <b>{item.dueDate}</b>
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => toggleStatus(item)}
                    className="inline-flex items-center gap-1 rounded-xl border bg-canvas px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-blue-400"
                  >
                    <Archive className="size-3" />
                    {item.status === "Active" ? "Archive" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteHomework(item.id)}
                    className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100 dark:border-rose-950 dark:bg-rose-950/40 dark:text-rose-300"
                    aria-label="Delete homework"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-3xl border border-dashed bg-panel p-12 text-center">
            <BookOpen className="mx-auto size-10 text-muted" />
            <h3 className="mt-3 text-base font-bold">No homework found</h3>
            <p className="mt-1 text-xs text-muted">
              {tab === "Active"
                ? "You have no active homework assignments. Click 'Assign New Homework' to create one."
                : "No homework records in this view."}
            </p>
          </div>
        )}
      </div>

      {/* New Homework Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border bg-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-black">Assign Homework</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-1 text-muted hover:bg-canvas"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={createHomework} className="mt-4 space-y-4">
              {/* Class & Subject Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Assigned Class & Subject
                </label>
                <select
                  required
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value)}
                  className="mt-1 w-full rounded-2xl border bg-canvas px-4 py-2.5 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                >
                  {scopeOptions.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 4 Practice Questions"
                  className="mt-1 w-full rounded-2xl border bg-canvas px-4 py-2.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Submission Due Date
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 w-full rounded-2xl border bg-canvas px-4 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Instructions & Details
                </label>
                <textarea
                  required
                  rows={4}
                  minLength={2}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide specific exercises, page numbers, or submission instructions…"
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
                      Assigning…
                    </>
                  ) : (
                    "Publish Assignment"
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

