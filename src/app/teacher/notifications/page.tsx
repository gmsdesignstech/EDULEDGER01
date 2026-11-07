"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  readAt: string | null;
  createdAt: string;
};

export default function TeacherNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function loadNotifications() {
    setLoading(true);
    fetch("/api/teacher/notifications")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load notifications");
        return readApiJson(res);
      })
      .then((data) => {
        setItems(data.items || []);
        setUnreadCount(data.unread || 0);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load notifications");
        setLoading(false);
      });
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markRead(id?: string, markAll = false) {
    try {
      const res = await fetch("/api/teacher/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(markAll ? { all: true } : { id }),
      });
      if (!res.ok) throw new Error("Could not mark as read");

      if (markAll) {
        setItems((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
        );
        setUnreadCount(0);
        setSuccess("All notifications marked as read.");
      } else if (id) {
        setItems((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update notification");
    }
  }

  const displayed = items.filter((n) => (filter === "UNREAD" ? !n.readAt : true));

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading notification inbox…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Notification Inbox</h1>
          <p className="text-xs text-muted sm:text-sm">
            Institutional announcements, system alerts, and updates
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markRead(undefined, true)}
            className="inline-flex items-center gap-1.5 rounded-2xl border bg-panel px-4 py-2 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            <CheckCheck className="size-4 text-blue-600" />
            Mark All as Read ({unreadCount})
          </button>
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

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
            filter === "ALL"
              ? "bg-blue-600 text-white shadow"
              : "bg-panel text-muted hover:text-foreground border"
          }`}
        >
          All Notifications ({items.length})
        </button>
        <button
          onClick={() => setFilter("UNREAD")}
          className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
            filter === "UNREAD"
              ? "bg-blue-600 text-white shadow"
              : "bg-panel text-muted hover:text-foreground border"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {displayed.length > 0 ? (
          displayed.map((item) => {
            const isUnread = !item.readAt;
            return (
              <div
                key={item.id}
                onClick={() => isUnread && markRead(item.id)}
                className={`flex cursor-pointer items-start justify-between gap-4 rounded-3xl border p-5 shadow-sm transition hover:border-blue-400 ${
                  isUnread
                    ? "border-blue-300 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20"
                    : "bg-panel"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-2xl ${
                      isUnread
                        ? "bg-blue-600 text-white shadow"
                        : "bg-canvas text-muted border"
                    }`}
                  >
                    <Bell className="size-4" />
                  </span>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <b className="text-sm font-bold text-foreground leading-snug">
                        {item.title}
                      </b>
                      {isUnread && (
                        <span className="size-2 rounded-full bg-blue-600" />
                      )}
                    </div>

                    <p className="text-xs text-muted leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-muted">
                      <Clock className="size-3" />
                      <span>{new Date(item.createdAt).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {isUnread && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markRead(item.id);
                    }}
                    className="shrink-0 rounded-xl border bg-canvas px-2.5 py-1 text-[11px] font-bold text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-950/50"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed bg-panel p-12 text-center">
            <Bell className="mx-auto size-10 text-muted" />
            <h3 className="mt-3 text-base font-bold">No notifications</h3>
            <p className="mt-1 text-xs text-muted">
              {filter === "UNREAD"
                ? "You have caught up with all notifications."
                : "Your notification inbox is clean."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

