"use client";

import Link from "next/link";
import { RefreshCw, WifiOff, ShieldCheck, ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function OfflinePage() {
  const [checking, setChecking] = useState(false);

  const handleRetry = () => {
    setChecking(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid size-20 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
          <WifiOff className="size-10" />
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight">You&apos;re Offline</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          It looks like you lost your internet connection. Please check your Wi-Fi or mobile data network to reconnect.
        </p>

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-left dark:border-blue-900/40 dark:bg-blue-950/30">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <strong className="block font-bold text-blue-900 dark:text-blue-200">
                Privacy Protection
              </strong>
              Student records, attendance, marks, fees, and payment actions are not available offline. Unsaved changes are not queued or submitted later.
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={checking}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} />
            <span>{checking ? "Checking connection..." : "Try Reconnecting"}</span>
          </button>

          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="size-4" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

