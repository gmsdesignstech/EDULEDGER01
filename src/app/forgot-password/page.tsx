"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || "Unable to send reset link. Please try again later."
        );
      }

      setSuccessMessage(
        data.message ||
          "If an account is associated with this email, a secure password reset link has been sent. Please check your inbox and spam folder."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50/60 px-4 py-8 dark:bg-slate-950 sm:p-6">
      <div className="card w-full max-w-md border border-slate-200/80 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-9">
        <Logo className="justify-center sm:justify-start" />

        {successMessage ? (
          <div className="mt-8 text-center sm:text-left">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 sm:mx-0">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
              Check your email
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {successMessage}
            </p>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Security Note:
              </span>{" "}
              The reset link will expire in 30 minutes and can only be used once.
            </div>

            <div className="mt-7 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setSuccessMessage("");
                  setEmail("");
                }}
                className="btn-secondary w-full"
              >
                Send another link
              </button>
              <Link
                href="/login"
                className="btn-primary w-full text-center"
              >
                Return to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8" noValidate>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              We’ll send a secure reset link to your email.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <label className="mt-6 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Email address
              <div className="relative mt-2">
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.edu"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <Mail className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-6 w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </button>

            <Link
              href="/login"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 text-center text-sm font-bold text-brand transition hover:underline"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
