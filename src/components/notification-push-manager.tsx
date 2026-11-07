"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";

export function NotificationPushManager() {
  const pathname = usePathname();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [supported, setSupported] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const syncPushToken = useCallback(async (registration: ServiceWorkerRegistration) => {
    try {
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        // Generate or obtain subscription
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const options: PushSubscriptionOptionsInit = { userVisibleOnly: true };
        if (vapidKey) {
          options.applicationServerKey = urlBase64ToUint8Array(vapidKey);
        }
        sub = await registration.pushManager.subscribe(options).catch(() => null);
      }

      if (!sub) return;
      const token = JSON.stringify(sub);
      await fetch("/api/notifications/push-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          deviceType: "web_pwa",
          userAgent: navigator.userAgent,
        }),
      });
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let active = true;
    const isAuthenticatedPortal =
      pathname.startsWith("/dashboard") ||
      (pathname.startsWith("/parent") && pathname !== "/parent/login") ||
      (pathname.startsWith("/teacher") && pathname !== "/teacher/login") ||
      (pathname.startsWith("/student") && pathname !== "/student/login");
    const canUsePush =
      isAuthenticatedPortal && "Notification" in window && "PushManager" in window;
    setSupported(canUsePush);
    if (!canUsePush) setShowPrompt(false);
    if ("Notification" in window) setPermission(Notification.permission);

    // Register the PWA worker even when the browser does not support push.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (!active || !canUsePush) return;
        if (Notification.permission === "granted") {
          syncPushToken(registration).catch(() => {});
        } else if (Notification.permission === "default") {
          let dismissed = false;
          try {
            dismissed = sessionStorage.getItem("eduledger_push_prompt_dismissed") === "true";
          } catch {
            // The prompt remains available if browser storage is restricted.
          }
          setShowPrompt(!dismissed);
        }
      })
      .catch(() => {
        // PWA installation and offline navigation fail safely if worker setup is blocked.
      });

    if (canUsePush) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "PUSH_RECEIVED") {
          window.dispatchEvent(
            new CustomEvent("eduledger:push-received", { detail: event.data.payload }),
          );
        }
      };
      navigator.serviceWorker.addEventListener("message", handleMessage);
      return () => {
        active = false;
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      };
    }
    return () => {
      active = false;
    };
  }, [pathname, syncPushToken]);

  const handleEnablePush = useCallback(async () => {
    if (!supported) return;
    setIsSubscribing(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        const reg = await navigator.serviceWorker.ready;
        await syncPushToken(reg);
        setShowPrompt(false);
      } else {
        setShowPrompt(false);
        try {
          sessionStorage.setItem("eduledger_push_prompt_dismissed", "true");
        } catch {
          // Permission remains under the browser's control.
        }
      }
    } catch (e) {
      console.warn("[PushManager] Request permission failed:", e);
    } finally {
      setIsSubscribing(false);
    }
  }, [supported]);

  const handleDismissPrompt = () => {
    setShowPrompt(false);
    try {
      sessionStorage.setItem("eduledger_push_prompt_dismissed", "true");
    } catch {
      // Dismissing still hides the prompt for this render.
    }
  };

  if (!supported || !showPrompt || permission === "granted" || permission === "denied") {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-violet-200 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-violet-900/40 dark:bg-slate-900/95"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Bell className="size-5" />
        </div>
        <div className="flex-1 text-xs">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
            Enable Push Notifications
          </h4>
          <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
            Get instant alerts on attendance, results, homework, fees, and school notices.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isSubscribing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white shadow hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Enabling...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>Enable</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDismissPrompt}
              className="rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

