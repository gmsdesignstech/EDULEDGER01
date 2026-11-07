"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  Download,
  ExternalLink,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissalChecked, setDismissalChecked] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installError, setInstallError] = useState("");
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  const appContext = pathname.startsWith("/teacher")
    ? "teacher"
    : pathname.startsWith("/parent")
      ? "parent"
      : pathname.startsWith("/student")
        ? "student"
        : "admin";

  const dismissalKey = `eduledger_pwa_dismissed_${appContext}`;

  useEffect(() => {
    try {
      const dismissedUntil = Number(localStorage.getItem(dismissalKey) || 0);
      setDismissed(dismissedUntil > Date.now());
      if (dismissedUntil <= Date.now()) localStorage.removeItem(dismissalKey);
    } catch {
      setDismissed(false);
    } finally {
      setDismissalChecked(true);
    }
  }, [dismissalKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect standalone display mode
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    setIsStandalone(standaloneMode);

    // Detect iOS / iPadOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);

    // Capture Android/Chromium install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for successful install event
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstalledSuccessfully(true);
    };
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setInstallError("");
      try {
        const prompt = deferredPrompt;
        setDeferredPrompt(null);
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsStandalone(true);
          setInstalledSuccessfully(true);
        }
      } catch {
        setInstallError("Installation could not start. Use your browser menu to install EduLedger.");
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissalKey, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {
      // The install prompt remains dismissible for this page session.
    }
  };

  // Do not show if already in standalone mode, dismissed, or no trigger available
  if (!dismissalChecked || isStandalone || dismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  // Determine portal context for personalized label
  let portalTitle = "Install EduLedger App";
  let portalSubtitle = "Add EduLedger to your home screen for quick access and instant notifications.";
  let appUrl = "https://eduledger.co.in";

  if (pathname.startsWith("/teacher")) {
    portalTitle = "Install EduLedger Teacher App";
    portalSubtitle = "Quick attendance, timetable, and marks entry right from your home screen.";
    appUrl = "https://eduledger.co.in/teacher";
  } else if (pathname.startsWith("/parent")) {
    portalTitle = "Install EduLedger Parent App";
    portalSubtitle = "Instant alerts for attendance, fee invoices, homework, and exam results.";
    appUrl = "https://eduledger.co.in/parent";
  }

  return (
    <>
      <aside
        aria-label="PWA install banner"
        className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-blue-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-blue-900/50 dark:bg-slate-900/95 sm:bottom-6 sm:left-auto sm:right-6"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Smartphone className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{portalTitle}</h4>
              <button
                onClick={handleDismiss}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                aria-label="Dismiss install prompt"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              {portalSubtitle}
            </p>

            {installError && (
              <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
                {installError}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95"
              >
                <Download className="size-3.5" />
                <span>{isIos ? "Install on iOS" : "Install App"}</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Dedicated 6-Step iOS Installation Modal */}
      {showIosGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Close installation guide"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Smartphone className="size-6" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Add {portalTitle} to iPhone &amp; iPad
                </h3>
                <p className="text-xs text-slate-500">Apple Safari Home Screen Setup</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  1
                </span>
                <div>
                  <b className="text-slate-900 dark:text-white">Open in Apple Safari</b>
                  <p className="text-[11px] text-slate-500 mt-0.5">Ensure you are using the official Safari browser.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  2
                </span>
                <div>
                  <b className="text-slate-900 dark:text-white">Confirm Portal URL</b>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{appUrl}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  3
                </span>
                <div>
                  <b className="flex items-center gap-1 text-slate-900 dark:text-white">
                    Tap the Share Button <Share className="size-3.5 text-blue-600 inline" />
                  </b>
                  <p className="text-[11px] text-slate-500 mt-0.5">Located at the bottom of iPhone or top of iPad screen.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  4
                </span>
                <div>
                  <b className="flex items-center gap-1 text-slate-900 dark:text-white">
                    Select &quot;Add to Home Screen&quot; <PlusSquare className="size-3.5 text-blue-600 inline" />
                  </b>
                  <p className="text-[11px] text-slate-500 mt-0.5">Scroll down the share sheet menu options.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  5
                </span>
                <div>
                  <b className="text-slate-900 dark:text-white">Confirm by Tapping &quot;Add&quot;</b>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tap &quot;Add&quot; in the top-right corner of the confirmation prompt.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  6
                </span>
                <div>
                  <b className="text-slate-900 dark:text-white">Launch from Home Screen</b>
                  <p className="text-[11px] text-slate-500 mt-0.5">The app runs full screen as a standalone application.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white shadow transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              Got it, close guide
            </button>
          </div>
        </div>
      )}
    </>
  );
}
