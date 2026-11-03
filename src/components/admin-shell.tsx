"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileClock,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme";

const navGroups = [
  {
    label: "Platform Control",
    items: [
      { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Schools", href: "/admin/schools", icon: Building2 },
      { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
      { label: "Payments & Revenue", href: "/admin/revenue-payments", icon: WalletCards },
      { label: "Users", href: "/admin/users", icon: Users },
    ],
  },
  {
    label: "Insights & Operations",
    items: [
      { label: "Analytics & Reports", href: "/admin/analytics", icon: BarChart3 },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
      { label: "System Health", href: "/admin/system-health", icon: HeartPulse },
      { label: "Activity Logs", href: "/admin/audit-logs", icon: FileClock },
    ],
  },
  {
    label: "Platform Configuration",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
] as const;

export function AdminShell({
  admin,
  children,
}: {
  admin: { name: string; email: string };
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#07111f] dark:text-slate-100">
      {/* Desktop & Mobile Drawer Sidebar: #091225 dark navy */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#091225] p-5 text-white shadow-2xl transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 text-white shadow-lg shadow-violet-950/50">
              <ShieldCheck className="size-6" />
            </span>
            <div className="min-w-0">
              <b className="block text-base font-extrabold tracking-tight">EduLedger</b>
              <span className="inline-block rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                Super Admin
              </span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation drawer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav
          aria-label="Super Admin Portal Navigation"
          className="mt-6 flex-1 space-y-5 overflow-y-auto pr-1"
        >
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[.2em] text-white/35">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    path === item.href ||
                    (item.href === "/admin/dashboard" && path === "/admin") ||
                    (item.href === "/admin/revenue-payments" &&
                      (path === "/admin/payment-transactions" || path === "/admin/refunds"));

                  return (
                    <Link
                      key={item.href}
                      onClick={() => setOpen(false)}
                      href={item.href}
                      className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        active
                          ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white shadow-lg shadow-violet-950/40"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`size-4 transition-transform group-hover:scale-110 ${
                          active ? "text-white" : "text-white/60 group-hover:text-violet-300"
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Logout Button */}
        <div className="mt-auto border-t border-white/10 pt-4">
          <button
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
          >
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {open && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="lg:pl-72">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#07111f]/85 sm:px-7">
          <button
            onClick={() => setOpen(true)}
            className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <input
              aria-label="Global platform search"
              placeholder="Search registered schools, users or IDs…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/admin/notifications"
              aria-label="Notifications"
              className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            >
              <Bell className="size-4" />
            </Link>

            <Link
              href="/admin/settings"
              aria-label="Settings"
              className="hidden size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 sm:grid"
            >
              <Settings className="size-4" />
            </Link>

            <ThemeToggle />

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfile((x) => !x)}
                aria-expanded={profile}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-1.5 pr-3 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 font-black text-xs text-white">
                  {admin.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden text-left xl:block">
                  <b className="block text-xs font-bold leading-tight">{admin.name}</b>
                  <small className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                    Platform Owner
                  </small>
                </span>
              </button>

              {profile && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900">
                  <div className="border-b border-slate-100 p-3 dark:border-white/10">
                    <b className="block text-xs font-black">{admin.name}</b>
                    <small className="break-all text-[11px] text-slate-500 dark:text-slate-400">
                      {admin.email}
                    </small>
                  </div>
                  <Link
                    href="/admin/admin-profile"
                    onClick={() => setProfile(false)}
                    className="mt-1 flex rounded-xl p-2.5 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    Admin Profile &amp; Security
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full rounded-xl p-2.5 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
