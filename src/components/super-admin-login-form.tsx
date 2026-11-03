"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

export function SuperAdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Administrator sign-in failed. Please verify credentials.",
        );
      }

      router.replace(data?.redirect || "/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#070e1e] px-4 py-12 text-slate-100 sm:px-6">
      {/* Background ambient decorative glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-violet-600/25 to-cyan-500/20 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 right-10 -z-10 h-[350px] w-[450px] rounded-full bg-indigo-600/20 blur-[100px]" />

      <div className="w-full max-w-md">
        {/* Top return link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back to EduLedger
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-950/60 px-3 py-1 text-[11px] font-bold text-violet-300">
            <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
            Platform Owner Portal
          </span>
        </div>

        {/* Login Card */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d172c]/90 p-7 shadow-2xl shadow-black/80 backdrop-blur-2xl sm:p-9">
          <div className="text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-violet-900/40">
              <ShieldCheck className="size-7" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Super Admin Portal
            </h1>
            <p className="mt-2 text-xs text-slate-400 sm:text-sm">
              EduLedger platform owner control center. Sign in to oversee registered schools, subscriptions, and system health.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs font-semibold text-rose-300"
            >
              <AlertCircle className="size-5 shrink-0 text-rose-400" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300"
              >
                Owner Email Address
              </label>
              <div className="relative mt-2">
                <Mail className="absolute left-3.5 top-3.5 size-4 text-slate-500" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="superadmin@eduledger.in"
                  className="h-11 w-full rounded-xl border border-white/10 bg-slate-900/80 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300"
              >
                Owner Password
              </label>
              <div className="relative mt-2">
                <Lock className="absolute left-3.5 top-3.5 size-4 text-slate-500" />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11 w-full rounded-xl border border-white/10 bg-slate-900/80 pl-10 pr-11 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3 text-slate-500 transition hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating owner…</span>
              ) : (
                <>
                  <span>Sign In as Super Admin</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Security notice */}
          <div className="mt-6 rounded-2xl border border-white/5 bg-slate-950/60 p-3.5 text-center text-[11px] text-slate-400">
            <ShieldAlert className="mx-auto mb-1.5 size-4 text-amber-400" />
            <p>
              Restricted platform area. Super Admin registration is closed. All login attempts are recorded for compliance.
            </p>
          </div>
        </div>

        {/* Footer link to regular login */}
        <div className="mt-6 text-center text-xs text-slate-400">
          School administrator, teacher, or parent?{" "}
          <Link
            href="/login"
            className="font-bold text-violet-400 underline underline-offset-4 transition hover:text-violet-300"
          >
            Go to Standard Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

