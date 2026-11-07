"use client";

import { readApiJson } from "@/lib/api-response";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  School,
  Sparkles,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme";
import { useParentContext } from "./parent-context";
import { PortalNetworkStatus } from "./portal-network-status";
import { logoutPortal } from "@/lib/portal-session";

function Link(props: React.ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export function ParentShell({
  children: content,
  user,
  schoolName,
  academicYear,
}: {
  content?: React.ReactNode;
  children: React.ReactNode;
  user: { name: string; role: string; email: string };
  schoolName: string;
  academicYear: string;
}) {
  const actualContent = content || null;
  const path = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const switcherRef = useRef<HTMLDivElement>(null);

  const { children: childList, selectedChild, selectChild } = useParentContext();

  useEffect(() => {
    let active = true;
    fetch("/api/parent/notifications")
      .then((res) => (res.ok ? readApiJson(res) : null))
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

  // Close child switcher when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/parent", icon: LayoutDashboard },
    { label: "Attendance", href: "/parent/attendance", icon: CalendarCheck2 },
    { label: "Fee Payments", href: "/parent/fees", icon: CreditCard },
    { label: "Exam Results", href: "/parent/results", icon: FileCheck2 },
    { label: "Homework", href: "/parent/homework", icon: BookOpen },
    { label: "Timetable", href: "/parent/timetable", icon: CalendarDays },
    { label: "School Notices", href: "/parent/notices", icon: Megaphone },
    { label: "Child Profile", href: "/parent/profile", icon: UserCheck },
    { label: "Notifications", href: "/parent/notifications", icon: Bell, badge: unreadCount },
  ];

  const initials = user.name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    setLoggingOut(true);
    await logoutPortal(["eduledger_parent_child"]);
    router.replace("/parent/login");
    router.refresh();
  }

  function isSelected(href: string) {
    if (href === "/parent") return path === "/parent";
    return path === href || path.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-panel/95 px-4 shadow-sm backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-xl border bg-canvas p-2 text-foreground shadow-sm transition active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>

        {/* Child selector pill on mobile */}
        {selectedChild ? (
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300"
            >
              <GraduationCap className="size-3.5 text-blue-500" />
              <span className="max-w-[120px] truncate">{selectedChild.name}</span>
              <ChevronDown className="size-3 text-blue-500" />
            </button>

            {switcherOpen && childList.length > 1 && (
              <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-2xl border bg-panel p-2 shadow-2xl z-50">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Switch Child
                </p>
                {childList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      selectChild(c.id);
                      setSwitcherOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                      c.id === selectedChild.id
                        ? "bg-blue-600 text-white font-bold"
                        : "text-foreground hover:bg-canvas"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[10px] opacity-80">
                        Class {c.className} - {c.section}
                      </div>
                    </div>
                    {c.id === selectedChild.id && <Sparkles className="size-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Logo className="text-[13px]" />
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              Parent
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link
            href="/parent/notifications"
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
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Desktop Sidebar + Mobile Slide-over Drawer */}
      <aside
        aria-label="Parent navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r bg-[#091124] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand & School Header */}
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo className="text-[14px] text-white" />
              <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                Parent
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-slate-300">
            <Building2 className="size-4 shrink-0 text-blue-400" />
            <span className="truncate font-medium">{schoolName}</span>
          </div>
        </div>

        {/* Child Switcher Component in Sidebar */}
        {childList.length > 0 && (
          <div className="border-b border-white/10 p-3" ref={switcherRef}>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Child
              </span>
              {childList.length > 1 && (
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  {childList.length} Children
                </span>
              )}
            </div>

            {childList.length === 1 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">
                  {selectedChild?.name?.[0] || "C"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-white">{selectedChild?.name}</div>
                  <div className="text-[11px] text-slate-400">
                    Class {selectedChild?.className} - {selectedChild?.section} • Adm: {selectedChild?.admission}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {childList.map((c) => {
                  const active = c.id === selectedChild?.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectChild(c.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition ${
                        active
                          ? "border border-blue-500/40 bg-blue-600/30 text-white shadow-sm"
                          : "border border-transparent hover:bg-white/5 text-slate-300"
                      }`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                          active ? "bg-blue-600 text-white" : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {c.name[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">{c.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Class {c.className}-{c.section}
                        </div>
                      </div>
                      {active && <Sparkles className="size-3.5 text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sidebar Nav Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const selected = isSelected(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  selected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-lg transition ${
                    selected ? "bg-white/20 text-white" : "bg-white/5 text-slate-400 group-hover:text-white"
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

        {/* Parent Profile & Logout Footer */}
        <div className="shrink-0 border-t border-white/10 bg-[#060c1c] p-3">
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
        {/* Desktop Sticky Header */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b bg-panel/85 px-6 shadow-sm backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-xl border bg-canvas px-3 py-1.5 text-xs font-bold text-muted">
              <School className="size-3.5 text-blue-600" />
              <span>{schoolName}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-xl border bg-canvas px-3 py-1.5 text-xs font-semibold text-muted">
              <CalendarDays className="size-3.5 text-blue-600" />
              <span>Academic Year {academicYear}</span>
            </span>

            {/* Child Selector in Desktop Header if multiple children */}
            {childList.length > 1 && selectedChild && (
              <div className="flex items-center gap-2 pl-2">
                <span className="text-xs text-muted font-medium">Child:</span>
                <div className="flex items-center gap-1 rounded-xl border bg-canvas p-1">
                  {childList.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectChild(c.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        c.id === selectedChild.id
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-muted hover:text-foreground hover:bg-panel"
                      }`}
                    >
                      {c.name.split(" ")[0]} ({c.className}-{c.section})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/parent/notifications"
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
                <small className="block text-[10px] font-medium text-muted">Parent Account</small>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          <PortalNetworkStatus />
          {actualContent}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Parent navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t bg-panel/95 backdrop-blur shadow-lg lg:hidden"
      >
        <Link
          href="/parent"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            path === "/parent" ? "text-blue-600 dark:text-blue-400" : "text-muted"
          }`}
        >
          <LayoutDashboard className="size-5" />
          <span>Home</span>
        </Link>

        <Link
          href="/parent/attendance"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            isSelected("/parent/attendance") ? "text-blue-600 dark:text-blue-400" : "text-muted"
          }`}
        >
          <CalendarCheck2 className="size-5" />
          <span>Attendance</span>
        </Link>

        <Link
          href="/parent/fees"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            isSelected("/parent/fees") ? "text-blue-600 dark:text-blue-400" : "text-muted"
          }`}
        >
          <CreditCard className="size-5" />
          <span>Fees</span>
        </Link>

        <Link
          href="/parent/results"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            isSelected("/parent/results") || isSelected("/parent/homework")
              ? "text-blue-600 dark:text-blue-400"
              : "text-muted"
          }`}
        >
          <FileCheck2 className="size-5" />
          <span>Academics</span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-muted hover:text-foreground"
        >
          <Menu className="size-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

