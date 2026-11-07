"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
} from "lucide-react";
import { useParentContext } from "@/components/parent-context";

type HomeworkItem = {
  id: string;
  title: string;
  description: string;
  className: string;
  section: string;
  subject: string;
  dueDate: string;
  status: "Active" | "Archived";
  createdAt?: string;
};

export default function ParentHomeworkPage() {
  const { selectedChild } = useParentContext();
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"All" | "Active" | "Archived">("Active");

  useEffect(() => {
    if (!selectedChild?.id) return;
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/parent/children/${selectedChild.id}/homework`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await readApiJson(res).catch(() => ({}));
          throw new Error(err.error || "Failed to load homework.");
        }
        return readApiJson(res);
      })
      .then((data) => {
        if (active) setHomeworkList(data.homework || []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error loading homework.");
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
        Select a child from the top bar to view homework assignments.
      </div>
    );
  }

  const filtered = homeworkList.filter((item) => {
    if (filter === "All") return true;
    return item.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Homework & Assignments</h1>
          <p className="mt-1 text-xs text-muted">
            Daily tasks and project submissions for {selectedChild.name} (Class {selectedChild.className}-{selectedChild.section})
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-2xl border bg-panel p-1 shadow-sm">
          {(["Active", "Archived", "All"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                filter === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-xs text-red-500">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border bg-panel p-12 text-center text-xs text-muted">
          No {filter.toLowerCase()} homework found for Class {selectedChild.className}-{selectedChild.section}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((hw) => (
            <div
              key={hw.id}
              className="flex flex-col justify-between rounded-3xl border bg-panel p-6 shadow-sm transition hover:border-blue-400"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {hw.subject}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      hw.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {hw.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground">{hw.title}</h3>
                {hw.description && (
                  <p className="text-xs leading-relaxed text-muted line-clamp-4">
                    {hw.description}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="size-3.5 text-blue-600" />
                  Due: <b className="text-foreground">{hw.dueDate}</b>
                </span>
                {hw.createdAt && (
                  <span className="text-[10px]">
                    Assigned: {new Date(hw.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

