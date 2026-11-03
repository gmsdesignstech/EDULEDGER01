"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, School, ShieldCheck, UserCheck } from "lucide-react";
import { Logo } from "@/components/logo";

export default function ParentActivationPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"code" | "admission">("code");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = {
        name: String(form.get("name") || "").trim(),
        email: String(form.get("email") || "").trim(),
        password,
      };

      if (mode === "code") {
        payload.invitationCode = String(form.get("invitationCode") || "").trim();
      } else {
        payload.admission = String(form.get("admission") || "").trim();
        payload.parentPhone = String(form.get("parentPhone") || "").trim();
      }

      const res = await fetch("/api/parent/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Activation failed. Please check your information.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace("/parent");
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen overflow-hidden bg-slate-950 lg:grid-cols-2">
      <section className="relative hidden place-items-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-10 text-white lg:grid lg:p-16">
        <div aria-hidden="true" className="absolute -left-24 -top-24 size-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -right-20 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-300">
            <ShieldCheck className="size-3.5 text-blue-400" />
            Verified Parent Access
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
            Stay Connected With Your Child’s School Journey
          </h2>
          <p className="text-slate-300 leading-relaxed">
            EduLedger Parent Portal gives you secure, real-time access to daily attendance, academic results, homework, schedules, fee invoices, and instant Razorpay online fee clearance.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-2xl font-black text-emerald-400">100%</p>
              <p className="text-xs text-slate-300 mt-1">Multi-child switching under one login</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-2xl font-black text-blue-400">Instant</p>
              <p className="text-xs text-slate-300 mt-1">Fee receipts & attendance tracking</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <Link
              href="/parent/login"
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Sign In Instead &rarr;
            </Link>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-400">
              Account Activation
            </p>
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              Activate Parent Portal
            </h1>
            <p className="text-sm text-slate-400">
              Connect your parent account to your child’s school records.
            </p>
          </div>

          <div className="mt-6 flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => { setMode("code"); setError(""); }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                mode === "code"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <KeyRound className="mr-1.5 inline-block size-3.5" />
              Invitation Code
            </button>
            <button
              type="button"
              onClick={() => { setMode("admission"); setError(""); }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                mode === "admission"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <School className="mr-1.5 inline-block size-3.5" />
              Admission & Phone
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              Account activated successfully! Redirecting to your dashboard...
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "code" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  School Invitation Code
                </label>
                <input
                  type="text"
                  name="invitationCode"
                  required
                  placeholder="e.g. PRNT-9B4F1A"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm uppercase font-mono tracking-wider text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Enter the invitation code provided on your school notice or SMS.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Child Admission No.
                  </label>
                  <input
                    type="text"
                    name="admission"
                    required
                    placeholder="e.g. ADM-2024-001"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Registered Mobile No.
                  </label>
                  <input
                    type="tel"
                    name="parentPhone"
                    required
                    placeholder="e.g. 9876543210"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Your Full Name (Guardian / Parent)
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Rajesh Sharma"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Email Address (Used for Login)
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="parent@example.com"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Create Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  required
                  placeholder="Repeat password"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Activating Account...
                </>
              ) : (
                <>
                  <UserCheck className="size-4" />
                  Activate & Access Portal
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Already activated your account?{" "}
            <Link
              href="/parent/login"
              className="font-bold text-blue-400 hover:underline"
            >
              Sign In Here
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

