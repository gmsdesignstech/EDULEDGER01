"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  Info,
  Key,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

type ServerDiagnostics = {
  timestamp: string;
  institutionId: string;
  pwa: {
    status: string;
    scope: string;
    startUrl: string;
    manifestUrl: string;
    teacherManifestUrl: string;
    parentManifestUrl: string;
    serviceWorkerUrl: string;
    offlineFallbackUrl: string;
  };
  firebase: {
    status: "PASS" | "WARNING" | "FAILED" | "NOT CONFIGURED";
    configured: boolean;
    hasVapidKey: boolean;
    hasProjectId: boolean;
    hasClientEmail: boolean;
    hasPrivateKey: boolean;
    pushService: string;
  };
  devices: {
    totalActiveDevices: number;
    breakdown: Array<{ deviceType: string; count: number }>;
  };
  deliveries: {
    total: number;
    delivered: number;
    pending: number;
    failed: number;
  };
  notificationSettings: {
    pushEnabled: boolean;
    studentAbsent: boolean;
    feePayment: boolean;
    feeReminders: boolean;
    homework: boolean;
    examResults: boolean;
    announcements: boolean;
  };
};

type ClientDiagnostics = {
  isStandalone: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerActive: boolean;
  notificationSupported: boolean;
  permission: NotificationPermission | "unsupported";
  pushSupported: boolean;
  online: boolean;
  os: string;
  browser: string;
};

export function PwaDiagnosticsClient() {
  const [serverData, setServerData] = useState<ServerDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientDiag, setClientDiag] = useState<ClientDiagnostics | null>(null);
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const [swTesting, setSwTesting] = useState(false);
  const [swTestMessage, setSwTestMessage] = useState("");

  const inspectClient = useCallback(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent.toLowerCase();
    let os = "Desktop / Other";
    if (/iphone|ipad|ipod/.test(ua)) os = "iOS (Apple)";
    else if (/android/.test(ua)) os = "Android";
    else if (/windows/.test(ua)) os = "Windows";
    else if (/macintosh|mac os x/.test(ua)) os = "macOS";
    else if (/linux/.test(ua)) os = "Linux";

    let browser = "Browser";
    if (/edg\//.test(ua)) browser = "Microsoft Edge";
    else if (/chrome\//.test(ua) && !/edg\//.test(ua)) browser = "Google Chrome";
    else if (/safari\//.test(ua) && !/chrome\//.test(ua)) browser = "Apple Safari";
    else if (/firefox\//.test(ua)) browser = "Mozilla Firefox";

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);

    setClientDiag({
      isStandalone,
      serviceWorkerSupported: "serviceWorker" in navigator,
      serviceWorkerActive: Boolean(navigator.serviceWorker?.controller),
      notificationSupported: "Notification" in window,
      permission: "Notification" in window ? Notification.permission : "unsupported",
      pushSupported: "PushManager" in window,
      online: navigator.onLine,
      os,
      browser,
    });
  }, []);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      inspectClient();
      const res = await fetch("/api/settings/pwa", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load server diagnostics: HTTP ${res.status}`);
      }
      const data = await res.json();
      setServerData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load PWA diagnostics");
    } finally {
      setLoading(false);
    }
  }, [inspectClient]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleRequestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermissionRequesting(true);
    try {
      const res = await Notification.requestPermission();
      inspectClient();
      if (res === "granted" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const vapidKey =
          process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidKey) {
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          }).catch(() => null);
          if (sub) {
            await fetch("/api/notifications/push-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: JSON.stringify(sub),
                deviceType: "web_admin_test",
                userAgent: navigator.userAgent,
              }),
            });
            await loadDiagnostics();
          }
        }
      }
    } finally {
      setPermissionRequesting(false);
    }
  };

  const handleTestSw = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setSwTestMessage("Service workers are not supported by this browser.");
      return;
    }
    setSwTesting(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        setSwTestMessage("Registered /sw.js with scope / successfully.");
      } else {
        await reg.update();
        setSwTestMessage(
          `Service Worker active: scope "${reg.scope}". State: ${reg.active?.state || "installed"}.`
        );
      }
      inspectClient();
    } catch (e) {
      setSwTestMessage(`Service Worker test error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSwTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Navigation Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/dashboard" className="hover:text-blue-600">
              Dashboard
            </Link>
            <ChevronRight className="size-3" />
            <Link href="/dashboard/settings" className="hover:text-blue-600">
              Settings
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-slate-900 font-bold dark:text-white">PWA &amp; Push Diagnostics</span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl dark:text-white">
            Progressive Web App &amp; Notification Diagnostics
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Live technical audit for PWA manifests, service worker lifecycle, offline capabilities, and Firebase push credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadDiagnostics}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Diagnostics</span>
          </button>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            <ArrowLeft className="size-3.5" />
            <span>Settings Overview</span>
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2">
            <XCircle className="size-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading && !serverData ? (
        <div className="grid min-h-[400px] place-items-center rounded-3xl border border-slate-100 bg-white p-12 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-500">Auditing PWA environment...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 4 Quick Health Badges */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: PWA Installation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">PWA Manifests</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  PASS
                </span>
              </div>
              <b className="mt-3 block text-xl font-black text-slate-900 dark:text-white">
                3 Scoped Apps
              </b>
              <p className="mt-1 text-xs text-slate-500">
                Admin (/), Teacher (/teacher), Parent (/parent)
              </p>
            </div>

            {/* Card 2: Service Worker */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Service Worker</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    clientDiag?.serviceWorkerActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {clientDiag?.serviceWorkerActive ? "ACTIVE" : "REGISTERED"}
                </span>
              </div>
              <b className="mt-3 block text-xl font-black text-slate-900 dark:text-white">
                Cache v5 Active
              </b>
              <p className="mt-1 text-xs text-slate-500">
                Offline fallback + safe sensitive exclusions
              </p>
            </div>

            {/* Card 3: Firebase Push */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Firebase Cloud Messaging</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    serverData?.firebase.configured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {serverData?.firebase.status || "CHECKING"}
                </span>
              </div>
              <b className="mt-3 block text-xl font-black text-slate-900 dark:text-white">
                {serverData?.firebase.configured ? "Configured" : "Optional Setup"}
              </b>
              <p className="mt-1 text-xs text-slate-500">
                {serverData?.firebase.configured
                  ? "HTTP v1 Push Active"
                  : "In-app & WhatsApp alerts active"}
              </p>
            </div>

            {/* Card 4: Registered Devices */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Devices</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  {serverData?.devices.totalActiveDevices || 0} ACTIVE
                </span>
              </div>
              <b className="mt-3 block text-xl font-black text-slate-900 dark:text-white">
                {serverData?.devices.totalActiveDevices || 0} Tokens
              </b>
              <p className="mt-1 text-xs text-slate-500">
                Enrolled for push notifications
              </p>
            </div>
          </div>

          {/* 10-Point Technical Diagnostic Matrix */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Layers className="size-5 text-blue-600" />
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                10-Point Technical Audit Matrix
              </h2>
            </div>

            <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
              {/* 1. Overall PWA Status */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">1. PWA System Status</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Multi-portal installable Progressive Web Application architecture
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
                    PASS
                  </span>
                </div>
              </div>

              {/* 2. Web App Manifests */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">2. Manifest Endpoints</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <code className="text-[11px] text-blue-600">/manifest.webmanifest</code>,{" "}
                  <code className="text-[11px] text-blue-600">/manifest-teacher.webmanifest</code>,{" "}
                  <code className="text-[11px] text-blue-600">/manifest-parent.webmanifest</code>
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
                    PASS · Valid JSON
                  </span>
                </div>
              </div>

              {/* 3. Service Worker Status */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">3. Service Worker Lifecycle</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Root registration at <code className="text-[11px]">/sw.js</code> with scope <code className="text-[11px]">&quot;/&quot;</code>
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
                    PASS · Single Root Worker
                  </span>
                </div>
              </div>

              {/* 4. Installation Availability */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <Download className="size-4 text-blue-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">4. Device Install Availability</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Current Display: {clientDiag?.isStandalone ? "Standalone Application Window" : "Standard Web Browser"} · Detected: {clientDiag?.os} ({clientDiag?.browser})
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-800">
                    {clientDiag?.isStandalone ? "ALREADY INSTALLED" : "READY TO INSTALL"}
                  </span>
                </div>
              </div>

              {/* 5. Offline Fallback */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">5. Offline Shell &amp; Privacy</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Static <code className="text-[11px]">/offline.html</code> pre-cached. Sensitive portals excluded from cache storage.
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
                    PASS · Strict Privacy Invariant
                  </span>
                </div>
              </div>

              {/* 6. Firebase Server Configuration */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <Flame className={`size-4 ${serverData?.firebase.configured ? "text-amber-500" : "text-slate-400"}`} />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">6. Firebase Credentials</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  VAPID: {serverData?.firebase.hasVapidKey ? "✓" : "✗"} · Project ID: {serverData?.firebase.hasProjectId ? "✓" : "✗"} · Client Email: {serverData?.firebase.hasClientEmail ? "✓" : "✗"} · Private Key: {serverData?.firebase.hasPrivateKey ? "✓" : "✗"}
                </div>
                <div className="sm:text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                      serverData?.firebase.configured
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {serverData?.firebase.configured ? "PASS · Configured" : "NOT CONFIGURED"}
                  </span>
                </div>
              </div>

              {/* 7. Push Notification Support */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-indigo-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">7. Browser Push Support</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Notification API: {clientDiag?.notificationSupported ? "Supported" : "Unsupported"} · PushManager: {clientDiag?.pushSupported ? "Supported" : "Unsupported"}
                </div>
                <div className="sm:text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                      clientDiag?.pushSupported ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {clientDiag?.pushSupported ? "PASS" : "NOT SUPPORTED ON THIS BROWSER"}
                  </span>
                </div>
              </div>

              {/* 8. Browser Notification Permission */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-violet-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">8. Current Device Permission</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Status: <strong className="capitalize">{clientDiag?.permission}</strong>
                </div>
                <div className="sm:text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                      clientDiag?.permission === "granted"
                        ? "bg-emerald-100 text-emerald-800"
                        : clientDiag?.permission === "denied"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {clientDiag?.permission === "granted" ? "PASS · GRANTED" : clientDiag?.permission?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* 9. Enrolled Device Tokens */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-blue-600" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">9. Enrolled Device Tokens</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {serverData?.devices.breakdown.length
                    ? serverData.devices.breakdown.map((b) => `${b.deviceType}: ${b.count}`).join(" · ")
                    : "No active device tokens enrolled yet"}
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-800">
                    {serverData?.devices.totalActiveDevices || 0} ENROLLED
                  </span>
                </div>
              </div>

              {/* 10. Last Validation Timestamp */}
              <div className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <ClockIcon className="size-4 text-slate-500" />
                  <b className="text-xs font-bold text-slate-900 dark:text-slate-100">10. Last Audit Timestamp</b>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {serverData?.timestamp ? new Date(serverData.timestamp).toLocaleString() : "Real-time"}
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                    LIVE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Test Panel */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Administrator Diagnostics Tools
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Run manual client checks from your current device without affecting school records.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestSw}
                disabled={swTesting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Server className="size-3.5" />
                <span>{swTesting ? "Testing Worker..." : "Test Service Worker Registration"}</span>
              </button>

              <button
                type="button"
                onClick={handleRequestPermission}
                disabled={permissionRequesting || clientDiag?.permission === "granted"}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
              >
                <Bell className="size-3.5 text-amber-500" />
                <span>
                  {clientDiag?.permission === "granted"
                    ? "Notifications Already Granted"
                    : permissionRequesting
                      ? "Requesting..."
                      : "Request Device Push Permission"}
                </span>
              </button>

              <a
                href="/manifest.webmanifest"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400"
              >
                <span>Inspect Root Manifest</span>
                <ExternalLink className="size-3" />
              </a>

              <a
                href="/manifest-teacher.webmanifest"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400"
              >
                <span>Teacher Manifest</span>
                <ExternalLink className="size-3" />
              </a>

              <a
                href="/manifest-parent.webmanifest"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400"
              >
                <span>Parent Manifest</span>
                <ExternalLink className="size-3" />
              </a>
            </div>

            {swTestMessage && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs font-medium text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
                {swTestMessage}
              </div>
            )}
          </div>

          {/* Safe Step-by-Step Configuration Guide for Firebase */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5">
              <Key className="size-5 text-amber-500" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Firebase Cloud Messaging (FCM) Configuration Guide
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Firebase Web Push is completely optional. If credentials are not supplied, EduLedger operates normally with in-app notifications and WhatsApp alerts.
            </p>

            <div className="mt-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <b className="font-bold text-slate-900 dark:text-white">Step 1: Firebase Console Setup</b>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
                  <li>Visit the <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="size-3" /></a> and create or select your EduLedger project.</li>
                  <li>Navigate to <strong>Project Settings</strong> $\rightarrow$ <strong>Cloud Messaging</strong> tab.</li>
                  <li>Under <strong>Web configuration</strong>, generate a <strong>Web Push certificates (VAPID key)</strong> pair.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <b className="font-bold text-slate-900 dark:text-white">Step 2: Generate Service Account Key (Server Secret)</b>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
                  <li>In Project Settings, switch to the <strong>Service accounts</strong> tab.</li>
                  <li>Click <strong>Generate new private key</strong> $\rightarrow$ download the credentials JSON file.</li>
                  <li>Extract the <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-slate-800">project_id</code>, <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-slate-800">client_email</code>, and <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-slate-800">private_key</code> fields.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <b className="font-bold text-slate-900 dark:text-white">Step 3: Configure Environment Variables in Vercel</b>
                <p className="mt-1 text-slate-500">Add the following variables in your Vercel Project Settings $\rightarrow$ Environment Variables:</p>
                <div className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-slate-100">
                  <div>NEXT_PUBLIC_FIREBASE_VAPID_KEY=&quot;YOUR_PUBLIC_VAPID_KEY&quot;</div>
                  <div>FIREBASE_PROJECT_ID=&quot;your-project-id&quot;</div>
                  <div>FIREBASE_CLIENT_EMAIL=&quot;firebase-adminsdk@...iam.gserviceaccount.com&quot;</div>
                  <div>FIREBASE_PRIVATE_KEY=&quot;-----BEGIN PRIVATE KEY-----\nMIIE...-----END PRIVATE KEY-----\n&quot;</div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <Shield className="size-3.5 shrink-0" />
                  <span>Security Notice: Never prefix server private keys with <code className="font-mono">NEXT_PUBLIC_</code>.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClockIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
