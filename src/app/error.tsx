"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Application rendering failed", { digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6">
      <section className="card max-w-lg p-8 text-center">
        <p className="label">Temporary problem</p>
        <h1 className="mt-3 text-2xl font-black">We could not load this page</h1>
        <p className="mt-2 text-sm text-muted">
          Your data has not been changed. Try loading the page again.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-muted">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button className="btn-primary" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Return to Dashboard
          </Link>
          <Link href="/" className="btn-ghost">
            Return Home
          </Link>
        </div>
      </section>
    </main>
  );
}
