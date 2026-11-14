"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";

export function TeacherChangePasswordForm({
  teacherName,
  teacherEmail,
  schoolName,
}: {
  teacherName: string;
  teacherEmail: string;
  schoolName: string;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const meetsLength = newPassword.length >= 8;
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Please enter your current temporary password.");
      return;
    }
    if (!meetsLength) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Your new password must be different from your temporary password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/teacher/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update password. Please check your temporary password.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace("/teacher");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur sm:p-8">
      {/* Brand & Context Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-400">
          <KeyRound className="size-4" />
          <span>Security Setup</span>
        </div>
        <h1 className="mt-2 text-2xl font-black text-white">Set Your Private Password</h1>
        <p className="mt-1 text-sm text-slate-400">
          Welcome to <span className="font-semibold text-slate-200">{schoolName}</span>,{" "}
          <span className="font-semibold text-slate-200">{teacherName}</span>.
        </p>
        <p className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
          First-Time Sign-In: You signed in with a temporary password. For security, please choose a private password
          known only to you.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <ShieldCheck className="mx-auto size-12 text-emerald-400" />
          <h2 className="mt-3 text-lg font-bold text-white">Password Updated!</h2>
          <p className="mt-1 text-sm text-slate-300">
            Redirecting to your Teacher Portal dashboard...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Temporary / Current Password
            </label>
            <div className="relative mt-1.5">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter temporary password"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? "Hide temporary password" : "Show temporary password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              New Password
            </label>
            <div className="relative mt-1.5">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose a strong password (min 8 chars)"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? "Hide new password" : "Show new password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Confirm New Password
            </label>
            <div className="relative mt-1.5">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="space-y-1.5 rounded-xl border border-white/5 bg-slate-950/60 p-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Check className={`size-3.5 ${meetsLength ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={meetsLength ? "text-slate-200" : "text-slate-500"}>At least 8 characters</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className={`size-3.5 ${hasNumberOrSymbol ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={hasNumberOrSymbol ? "text-slate-200" : "text-slate-500"}>
                Includes number or symbol (recommended)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className={`size-3.5 ${passwordsMatch ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={passwordsMatch ? "text-slate-200" : "text-slate-500"}>Passwords match</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !meetsLength || newPassword !== confirmPassword}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <Lock className="size-4" />
                <span>Save Password & Open Dashboard</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
