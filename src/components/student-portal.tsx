"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme";
import { PortalNetworkStatus } from "./portal-network-status";
import { logoutPortal } from "@/lib/portal-session";

export function StudentPortal({ children, user, schoolName }: { children: React.ReactNode; user: { name: string }; schoolName: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    await logoutPortal();
    router.replace("/student/login");
    router.refresh();
  }
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b bg-panel/95 px-4 shadow-sm backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><GraduationCap className="size-8 shrink-0 text-brand"/><div className="min-w-0"><Logo/><p className="truncate text-xs text-muted">{schoolName} · Student Portal</p></div></div>
        <div className="flex shrink-0 items-center gap-2"><span className="hidden max-w-40 truncate text-sm font-semibold sm:inline">{user.name}</span><ThemeToggle/><button type="button" disabled={loggingOut} onClick={() => void logout()} className="btn-secondary" aria-label="Sign out"><LogOut className="size-4"/><span className="hidden sm:inline">{loggingOut ? "Signing out…" : "Sign out"}</span></button></div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6"><PortalNetworkStatus/>{children}</main>
    </div>
  );
}
