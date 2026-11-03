"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Clock,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme";

function Link(props: React.ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export function TeacherShell({
  children,
  user,
  schoolName,
  academicYear,
}: {
  children: React.ReactNode;
  user: { name: string; role: string; email: string };
  schoolName: string;
  academicYear: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.unread != null) {
          setUnreadCount(data.unread);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path]);

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { label: "My Students", href: "/teacher/students", icon: Users },
    { label: "Daily Timetable", href: "/teacher/timetable", icon: CalendarDays },
    { label: "Take Attendance", href: "/teacher/attendance", icon: CalendarCheck2 },
    { label: "Homework", href: "/teacher/homework", icon: BookOpen },
    { label: "Exam Marks", href: "/teacher/exams", icon: FileCheck2 },
    { label: "Leave Requests", href: "/teacher/leave", icon: Clock },
    { label: "Notifications", href: "/teacher/notifications", icon: Bell, badge: unreadCount },
  ];

  const initials = user.name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/teacher/login");
    router.refresh();
  }

  function isSelected(href: string) {
    if (href === "/teacher") return path === "/teacher";
    return path === href || path.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile Top Bar */}
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-panel/95 px-4 shadow-sm backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl border bg-canvas p-2 text-foreground shadow-sm transition active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <Logo className="text-[13px]" />
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            Teacher
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/teacher/notifications"
            className="relative rounded-xl border bg-canvas p-2 text-foreground transition"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Backdrop */}
      {open && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar (Desktop + Mobile slide-over) */}
      <aside
        aria-label="Teacher navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r bg-[#0b1329] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* School & Brand Info */}
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo className="text-[14px] text-white" />
              <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                Teacher
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500/20 text-blue-400">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-xs font-bold text-white">{schoolName}</b>
              <small className="block truncate text-[11px] text-slate-400">
                AY {academicYear}
              </small>
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const selected = isSelected(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition duration-150 ${
                  selected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-900/30 ring-1 ring-white/15"
                    : "text-slate-300 hover:bg-white/[.07] hover:text-white"
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg transition ${
                    selected ? "bg-white/20 text-white" : "text-slate-400 group-hover:text-blue-300"
                  }`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="truncate">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                    {item.badge}
                  </span>
                )}
                {selected && !item.badge && (
                  <ChevronRight className="ml-auto size-4 opacity-75" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Teacher profile & Logout */}
        <div className="shrink-0 border-t border-white/10 bg-[#080d1e] p-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white shadow">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-xs font-bold text-white">{user.name}</b>
              <span className="block truncate text-[11px] text-slate-400">{user.email}</span>
            </div>
          </div>
          <button
            disabled={loggingOut}
            onClick={logout}
            className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
          >
            <LogOut className="size-3.5" />
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 lg:pl-[280px]">
        {/* Desktop Header */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b bg-panel/85 px-6 shadow-sm backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-xl border bg-canvas px-3 py-1.5 text-xs font-bold text-muted">
              <Building2 className="size-3.5 text-blue-600" />
              <span>{schoolName}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-xl border bg-canvas px-3 py-1.5 text-xs font-semibold text-muted">
              <CalendarDays className="size-3.5 text-blue-600" />
              <span>Academic Year {academicYear}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/teacher/notifications"
              className="relative flex items-center gap-2 rounded-xl border bg-canvas px-3 py-2 text-xs font-bold text-foreground transition hover:border-blue-400 hover:bg-panel"
            >
              <Bell className="size-4 text-blue-600" />
              <span>Inbox</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-black text-white">
                  {unreadCount}
                </span>
              )}
            </Link>

            <ThemeToggle />

            <div className="flex items-center gap-2.5 rounded-2xl border bg-canvas p-1.5 pr-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-black text-white shadow">
                {initials}
              </span>
              <div className="text-left">
                <b className="block max-w-40 truncate text-xs font-bold leading-4">{user.name}</b>
                <small className="block text-[10px] font-medium text-muted">Teacher</small>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="min-w-0 p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Teacher navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t bg-panel/95 backdrop-blur shadow-lg lg:hidden"
      >
        <Link
          href="/teacher"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            path === "/teacher" ? "text-blue-600 dark:text-blue-400" : "text-muted"
          }`}
        >
          <LayoutDashboard className="size-5" />
          <span>Home</span>
        </Link>

        <Link
          href="/teacher/attendance"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            path.startsWith("/teacher/attendance") ? "text-blue-600 dark:text-blue-400" : "text-muted"
          }`}
        >
          <CalendarCheck2 className="size-5" />
          <span>Attendance</span>
        </Link>

        <Link
          href="/teacher/homework"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            path.startsWith("/teacher/homework") ? "text-blue-600 dark:text-blue-400" : "text-muted"
          }`}
        >
          <BookOpen className="size-5" />
          <span>Homework</span>
        </Link>

        <Link
          href="/teacher/marks"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            path.startsWith("/teacher/marks") ? "text-blue-600 dark:text-blue-400" : "text-muted"
          }`}
        >
          <FileCheck2 className="size-5" />
          <span>Marks</span>
        </Link>

        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-muted hover:text-foreground"
        >
          <Menu className="size-5" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}

