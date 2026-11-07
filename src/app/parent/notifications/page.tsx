"use client";

import { readApiJson } from "@/lib/api-response";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Inbox,
  Loader2,
  Trash2,
} from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  link?: string;
  deliveryStatus?: string;
  readAt?: string | null;
  createdAt: string;
};

export default function ParentNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/parent/notifications");
      if (res.ok) {
        const data = await readApiJson(res);
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(id?: string) {
    setMarking(true);
    try {
      const res = await fetch("/api/parent/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      if (res.ok) {
        const data = await readApiJson(res);
        setUnreadCount(data.unread || 0);
        setNotifications((prev) =>
          prev.map((n) => (!id || n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
        );
      }
    } catch {
      // ignore
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Notification Centre</h1>
          <p className="mt-1 text-xs text-muted">
            Fee reminders, attendance alerts, exam announcements, and school notifications.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            disabled={marking}
            onClick={() => handleMarkRead()}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-panel px-4 py-2 text-xs font-bold text-foreground shadow-sm transition hover:border-blue-400 disabled:opacity-50"
          >
            <CheckCheck className="size-4 text-blue-600" />
            Mark All as Read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border bg-panel p-12 text-center text-xs text-muted">
          <Inbox className="mx-auto mb-2 size-8 text-muted" />
          You have no notifications at this time.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                className={`flex items-start justify-between rounded-3xl border p-5 shadow-sm transition ${
                  isUnread
                    ? "border-blue-500/40 bg-blue-500/5 dark:bg-blue-950/20"
                    : "border-border bg-panel"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl text-xs ${
                      isUnread
                        ? "bg-blue-600 text-white"
                        : "bg-canvas text-muted border"
                    }`}
                  >
                    <Bell className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-foreground">{n.title}</h3>
                      {isUnread && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.2 text-[9px] font-black uppercase text-white">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      {n.description}
                    </p>
                    <span className="mt-2 block text-[10px] text-muted">
                      {new Date(n.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>

                {isUnread && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    title="Mark as read"
                    className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-foreground"
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

