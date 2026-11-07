"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useState } from "react";
import {
  Calendar,
  Loader2,
  Megaphone,
  School,
  Sparkles,
} from "lucide-react";

type Announcement = {
  id: string;
  title?: string;
  subject?: string;
  message?: string;
  recipient?: string;
  createdAt?: string;
};

export default function ParentNoticesPage() {
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/parent/announcements")
      .then(async (res) => {
        if (!res.ok) {
          const err = await readApiJson(res).catch(() => ({}));
          throw new Error(err.error || "Failed to load notices.");
        }
        return readApiJson(res);
      })
      .then((data) => {
        if (active) setNotices(data.announcements || []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error loading notices.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">School Announcements & Circulars</h1>
        <p className="mt-1 text-xs text-muted">
          Institutional broadcasts, holidays, event schedules, and administrative circulars.
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-xs text-red-500">
          {error}
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-3xl border bg-panel p-12 text-center text-xs text-muted">
          No official circulars or announcements posted at this time.
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-3xl border bg-panel p-6 shadow-sm transition hover:border-blue-400"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    <Megaphone className="size-4" />
                  </span>
                  <h3 className="text-sm font-bold text-foreground">
                    {notice.title || notice.subject || "Official Circular"}
                  </h3>
                </div>
                {notice.createdAt && (
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <Calendar className="size-3 text-blue-600" />
                    {new Date(notice.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>

              {notice.message && (
                <p className="mt-3 text-xs leading-relaxed text-muted whitespace-pre-line pl-10">
                  {notice.message}
                </p>
              )}

              {notice.recipient && (
                <div className="mt-3 pl-10">
                  <span className="rounded-md bg-canvas px-2 py-0.5 text-[10px] font-semibold text-muted">
                    Target: {notice.recipient}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

