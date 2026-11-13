"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/logo";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token || token.trim().length < 16) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError("Missing or invalid password reset token. Please request a new link.");
      return;
    }

    let active = true;

    async function checkToken() {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token.trim())}`);
        const data = await res.json().catch(() => ({}));

        if (!active) return;

        if (res.ok && data.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError(data.error || "This reset link is invalid or has expired.");
        }
      } catch {
        if (active) {
          setTokenValid(false);
          setTokenError("Unable to verify reset link. Please check your internet connection.");
        }
      } finally {
        if (active) setVerifying(false);
      }
    }

    checkToken();

    return () => {
      active = false;
    };
  }, [token]);

  // Password requirement checks
  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");

    if (!hasMinLength) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }

    if (!passwordsMatch) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to update password. Please try again.");
      }

      setSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // 1. Verifying Token State
  if (verifying) {
    return (
      <div className="card w-full max-w-md border border-slate-200/80 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <Logo className="justify-center" />
        <div className="mt-12 flex flex-col items-center justify-center">
          <Loader2 className="size-8 animate-spin text-brand" />
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Verifying your security reset link...
          </p>
        </div>
      </div>
    );
  }

  // 2. Invalid Token State
  if (!tokenValid) {
    return (
      <div className="card w-full max-w-md border border-slate-200/80 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <Logo className="justify-center" />
        <div className="mx-auto mt-8 grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
          Reset Link Expired or Invalid
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {tokenError || "This password reset link is invalid or has already expired."}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/forgot-password" className="btn-primary w-full text-center">
            Request new reset link
          </Link>
          <Link href="/login" className="btn-secondary w-full text-center">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // 3. Password Updated Success State
  if (success) {
    return (
      <div className="card w-full max-w-md border border-slate-200/80 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <Logo className="justify-center" />
        <div className="mx-auto mt-8 grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
          Password Updated
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Your password has been successfully reset. All active sessions have been secured. You can now sign in with your new password.
        </p>

        <div className="mt-8">
          <Link href="/login" className="btn-primary w-full text-center">
            Sign In with New Password
          </Link>
        </div>
      </div>
    );
  }

  // 4. Reset Form State
  return (
    <div className="card w-full max-w-md border border-slate-200/80 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-9">
      <Logo className="justify-center sm:justify-start" />

      <form onSubmit={handleSubmit} className="mt-8" noValidate>
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-brand">
          <KeyRound className="size-3.5" />
          <span>Account Security</span>
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Create a secure password with at least eight characters.
        </p>

        {submitError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {submitError}
          </div>
        )}

        {/* New Password */}
        <div className="mt-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            New password
          </label>
          <div className="relative mt-2">
            <input
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <Lock className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-3.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="mt-4">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Confirm new password
          </label>
          <div className="relative mt-2">
            <input
              required
              minLength={8}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <Lock className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-3.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Password Strength Validation Hints */}
        <div className="mt-4 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
          <div
            className={`flex items-center gap-2 transition ${
              hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
            }`}
          >
            <Check className={`size-3.5 ${hasMinLength ? "opacity-100" : "opacity-30"}`} />
            <span>At least 8 characters</span>
          </div>
          <div
            className={`flex items-center gap-2 transition ${
              passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
            }`}
          >
            <Check className={`size-3.5 ${passwordsMatch ? "opacity-100" : "opacity-30"}`} />
            <span>Passwords match</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !hasMinLength || !passwordsMatch}
          className="btn-primary mt-6 w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Updating password...
            </>
          ) : (
            "Update Password"
          )}
        </button>

        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 text-center text-sm font-bold text-brand transition hover:underline"
        >
          <ArrowLeft className="size-4" />
          Return to sign in
        </Link>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50/60 px-4 py-8 dark:bg-slate-950 sm:p-6">
      <Suspense
        fallback={
          <div className="card w-full max-w-md border border-slate-200/80 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <Logo className="justify-center" />
            <div className="mt-12 flex flex-col items-center justify-center">
              <Loader2 className="size-8 animate-spin text-brand" />
              <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Loading...
              </p>
            </div>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
