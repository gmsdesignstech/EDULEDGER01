"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, Smartphone, X } from "lucide-react";

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
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already in standalone display mode
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    setIsStandalone(standaloneMode);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);

    // Check session dismissal
    const wasDismissed = sessionStorage.getItem("eduledger_pwa_dismissed") === "true";
    if (wasDismissed) {
      setDismissed(true);
    }

    // Capture Android/Chromium install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("eduledger_pwa_dismissed", "true");
  };

  // Do not show if already installed in standalone mode, or dismissed, or no trigger available
  if (isStandalone || dismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  // Determine portal context for personalized label
  let portalTitle = "Install EduLedger App";
  let portalSubtitle = "Add EduLedger to your home screen for quick access and instant notifications.";

  if (pathname.startsWith("/teacher")) {
    portalTitle = "Install Teacher Portal App";
    portalSubtitle = "Quick attendance, timetable, and marks entry right from your home screen.";
  } else if (pathname.startsWith("/parent")) {
    portalTitle = "Install Parent Portal App";
    portalSubtitle = "Instant alerts for attendance, fee invoices, homework, and exam results.";
  }

  return (
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

          {showIosGuide && (
            <div className="mt-2.5 rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 text-[11px] leading-relaxed text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-200">
              <span className="flex items-center gap-1 font-bold">
                <Share className="size-3.5" /> 1. Tap the Share button in Safari
              </span>
              <span className="mt-1 block">2. Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong></span>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-700 active:scale-95"
            >
              <Download className="size-3.5" />
              <span>{isIos ? "How to Install" : "Install App"}</span>
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
  );
}

