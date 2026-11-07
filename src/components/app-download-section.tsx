"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  GraduationCap,
  Monitor,
  Share,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { generateQrMatrix } from "@/lib/qr-code";
import { getSiteOrigin } from "@/lib/site-url";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type AppRole = "admin" | "teacher" | "parent";

type InstallStatus =
  | "available"
  | "in_progress"
  | "successful"
  | "dismissed"
  | "already_installed"
  | "instructions_required"
  | "unsupported";

function QrSvg({ url, title, accentColor = "#2563eb" }: { url: string; title: string; accentColor?: string }) {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(url);
    } catch {
      return [];
    }
  }, [url]);

  if (!matrix.length) return null;
  const size = matrix.length;

  return (
    <svg
      role="img"
      aria-label={`QR Code for ${title}`}
      viewBox={`0 0 ${size + 4} ${size + 4}`}
      className="size-full shape-rendering-crispEdges"
    >
      <rect x="0" y="0" width={size + 4} height={size + 4} fill="#ffffff" rx="2" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c + 2}
              y={r + 2}
              width="1"
              height="1"
              fill={accentColor}
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function AppDownloadSection() {
  const siteUrl = getSiteOrigin();
  const adminUrl = `${siteUrl}/login`;
  const teacherUrl = `${siteUrl}/teacher`;
  const parentUrl = `${siteUrl}/parent`;

  const [installModal, setInstallModal] = useState<AppRole | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [installStatus, setInstallStatus] = useState<Record<AppRole, InstallStatus>>({
    admin: "available",
    teacher: "available",
    parent: "available",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const androidDevice = /android/.test(ua);
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);

    setIsIos(iosDevice);
    setIsAndroid(androidDevice);
    setIsDesktop(!iosDevice && !androidDevice);
    setIsStandalone(standaloneMode);

    if (standaloneMode) {
      setInstallStatus({
        admin: "already_installed",
        teacher: "already_installed",
        parent: "already_installed",
      });
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstallStatus({
        admin: "successful",
        teacher: "successful",
        parent: "successful",
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function triggerInstall(type: AppRole) {
    if (isStandalone) {
      setInstallStatus((prev) => ({ ...prev, [type]: "already_installed" }));
      setInstallModal(type);
      return;
    }

    if (type === "admin" && deferredPrompt) {
      setInstallStatus((prev) => ({ ...prev, [type]: "in_progress" }));
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstallStatus((prev) => ({ ...prev, [type]: "successful" }));
          setIsStandalone(true);
        } else {
          setInstallStatus((prev) => ({ ...prev, [type]: "dismissed" }));
        }
        setDeferredPrompt(null);
      } catch {
        setInstallStatus((prev) => ({ ...prev, [type]: "instructions_required" }));
        setInstallModal(type);
      }
    } else {
      setInstallStatus((prev) => ({ ...prev, [type]: "instructions_required" }));
      setInstallModal(type);
    }
  }

  const adminFeatures = [
    "Real-time fee collections & cash book",
    "Student admissions & life-cycle tracking",
    "Teacher assignments & payroll control",
    "Automated timetable & exam management",
    "Official CBSE / State report card generation",
    "Multi-role security & school data isolation",
  ];

  const teacherFeatures = [
    "Manage assigned classes and sections",
    "Mark daily student attendance rapidly",
    "Upload homework and study assignments",
    "Enter unit test and term exam marks",
    "Instant access to class weekly timetables",
    "Receive official administrative broadcasts",
  ];

  const parentFeatures = [
    "Track your child’s daily attendance live",
    "View term exam results and report cards",
    "Check homework and upcoming submissions",
    "View fee balances and payment history",
    "Direct school notifications and notices",
    "Access your child’s weekly timetable",
  ];

  return (
    <section id="download-apps" className="relative px-5 py-24 sm:py-32">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 size-[520px] -translate-x-1/2 rounded-full bg-blue-400/10 blur-[130px]" />
        <div className="absolute right-1/4 top-1/2 size-[560px] translate-x-1/2 rounded-full bg-violet-400/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-[1300px]">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm backdrop-blur">
            <Smartphone className="size-3.5 text-blue-600" />
            <span>Installable Multi-Role Progressive Web Apps</span>
          </div>

          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-[#111a35] sm:text-5xl lg:text-6xl">
            Everything Your School Needs. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Dedicated Apps for Every Role.
            </span>
          </h2>

          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
            EduLedger delivers three distinct Progressive Web App experiences optimized for school administrators, teachers, and parents across Android, iPhone, iPad, Windows, and macOS.
          </p>
        </div>

        {/* 3 Premium Application Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-8">
          {/* CARD 1: EDULEDGER ADMINISTRATOR APP */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-blue-200/80 bg-white p-6 shadow-[0_25px_80px_-35px_rgba(37,99,235,.2)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_35px_100px_-30px_rgba(37,99,235,.28)] sm:p-8">
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500" />

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  <ShieldCheck className="size-3.5" />
                  For School Leadership
                </span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Admin PWA
                </span>
              </div>

              <h3 className="mt-5 text-2xl font-black text-slate-900">
                EduLedger App
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Install EduLedger on your device for convenient access to your school’s management dashboard.
              </p>

              <div className="mt-6 space-y-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Core Management Features
                </span>
                <ul className="space-y-2">
                  {adminFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => triggerInstall("admin")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:scale-95"
                >
                  <Download className="size-4" />
                  <span>
                    {isStandalone ? "Open Installed App" : "Install EduLedger App"}
                  </span>
                </button>

                <div className="flex items-center justify-between pt-1">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <span>Launch in browser</span>
                    <ChevronRight className="size-3" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                      <QrSvg url={adminUrl} title="Administrator Portal" accentColor="#1d4ed8" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Scan to open</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: EDULEDGER TEACHER APP */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-violet-200/80 bg-white p-6 shadow-[0_25px_80px_-35px_rgba(124,58,237,.2)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_35px_100px_-30px_rgba(124,58,237,.28)] sm:p-8">
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600" />

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-700/10">
                  <BookOpen className="size-3.5" />
                  For Teachers &amp; Faculty
                </span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Teacher PWA
                </span>
              </div>

              <h3 className="mt-5 text-2xl font-black text-slate-900">
                EduLedger Teacher
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Access your assigned classes, attendance, timetable, assignments, and examination tools.
              </p>

              <div className="mt-6 space-y-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Faculty Capabilities
                </span>
                <ul className="space-y-2">
                  {teacherFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => triggerInstall("teacher")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95"
                >
                  <Download className="size-4" />
                  <span>Install Teacher App</span>
                </button>

                <div className="flex items-center justify-between pt-1">
                  <Link
                    href="/teacher"
                    className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline"
                  >
                    <span>Launch in browser</span>
                    <ChevronRight className="size-3" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                      <QrSvg url={teacherUrl} title="Teacher Portal" accentColor="#6d28d9" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Scan to open</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: EDULEDGER PARENT APP */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-emerald-200/80 bg-white p-6 shadow-[0_25px_80px_-35px_rgba(16,185,129,.2)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_35px_100px_-30px_rgba(16,185,129,.28)] sm:p-8">
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600" />

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                  <GraduationCap className="size-3.5" />
                  For Parents &amp; Guardians
                </span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Parent PWA
                </span>
              </div>

              <h3 className="mt-5 text-2xl font-black text-slate-900">
                EduLedger Parent
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Stay updated with your child’s attendance, examination results, homework, fees, and school announcements.
              </p>

              <div className="mt-6 space-y-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Guardian Capabilities
                </span>
                <ul className="space-y-2">
                  {parentFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => triggerInstall("parent")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-700 hover:to-teal-700 active:scale-95"
                >
                  <Download className="size-4" />
                  <span>Install Parent App</span>
                </button>

                <div className="flex items-center justify-between pt-1">
                  <Link
                    href="/parent"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                  >
                    <span>Launch in browser</span>
                    <ChevronRight className="size-3" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                      <QrSvg url={parentUrl} title="Parent Portal" accentColor="#059669" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Scan to open</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligent Multi-Device Installation Helper Modal */}
      {installModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setInstallModal(null)}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close installation instructions"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
              <span
                className={`grid size-12 place-items-center rounded-2xl text-white shadow ${
                  installModal === "admin"
                    ? "bg-blue-600"
                    : installModal === "teacher"
                      ? "bg-violet-600"
                      : "bg-emerald-600"
                }`}
              >
                <Smartphone className="size-6" />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {installModal === "admin"
                    ? "Install EduLedger Administrator App"
                    : installModal === "teacher"
                      ? "Install EduLedger Teacher App"
                      : "Install EduLedger Parent App"}
                </h3>
                <p className="text-xs text-slate-500">
                  Progressive Web Application (PWA) · Device Setup
                </p>
              </div>
            </div>

            {/* Installation Status Notification */}
            <div className="mt-4">
              {installStatus[installModal] === "already_installed" ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" />
                    <span>This application is already installed on your device in standalone mode.</span>
                  </div>
                </div>
              ) : installStatus[installModal] === "dismissed" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <span>Installation prompt was dismissed. You can install anytime using the instructions below.</span>
                </div>
              ) : null}
            </div>

            {/* Device-Specific Instructions */}
            <div className="mt-4 space-y-4 text-xs text-slate-600">
              {isIos ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                  <b className="block font-bold text-blue-900 text-sm">
                    Apple iOS / Safari Setup (iPhone &amp; iPad)
                  </b>
                  <ol className="mt-3 list-decimal space-y-2 pl-4 text-blue-800">
                    <li>Open <strong>Safari</strong> on your Apple device.</li>
                    <li>
                      Visit{" "}
                      <strong>
                        {installModal === "admin"
                          ? siteUrl
                          : installModal === "teacher"
                            ? teacherUrl
                            : parentUrl}
                      </strong>
                    </li>
                    <li>
                      Tap the <strong>Share icon</strong> (square with an upward arrow) in the Safari toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.
                    </li>
                    <li>
                      Confirm by tapping <strong>&quot;Add&quot;</strong> in the top-right corner.
                    </li>
                    <li>
                      Launch the dedicated EduLedger app directly from your Home Screen.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                  <b className="block font-bold text-indigo-900 text-sm">
                    Android Setup (Google Chrome &amp; Microsoft Edge)
                  </b>
                  <ol className="mt-3 list-decimal space-y-2 pl-4 text-indigo-800">
                    <li>
                      Navigate to the portal:{" "}
                      <Link
                        href={installModal === "admin" ? "/" : installModal === "teacher" ? "/teacher" : "/parent"}
                        className="font-bold text-indigo-600 underline"
                      >
                        {installModal === "admin" ? "/" : installModal === "teacher" ? "/teacher" : "/parent"}
                      </Link>
                    </li>
                    <li>
                      Tap the browser menu (<strong>⋮</strong> three dots in Chrome or <strong>⋯</strong> in Edge).
                    </li>
                    <li>
                      Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong>.
                    </li>
                    <li>
                      Confirm the installation prompt to add the icon to your app drawer and home screen.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <b className="block font-bold text-slate-900 text-sm">
                    Desktop Setup (Windows, macOS, Chrome, Edge)
                  </b>
                  <ol className="mt-3 list-decimal space-y-2 pl-4 text-slate-700">
                    <li>
                      Open the target portal in Chrome or Edge:{" "}
                      <strong>
                        {installModal === "admin" ? "/login" : installModal === "teacher" ? "/teacher" : "/parent"}
                      </strong>
                    </li>
                    <li>
                      Click the <strong>Install icon</strong> (<Monitor className="inline size-3.5 mx-0.5" />) on the right side of your browser&apos;s address bar.
                    </li>
                    <li>
                      Click <strong>Install</strong> to run EduLedger as a dedicated desktop application.
                    </li>
                  </ol>
                </div>
              )}

              {/* Direct QR Code & Navigation */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-white bg-white p-1 shadow-sm">
                    <QrSvg
                      url={installModal === "admin" ? adminUrl : installModal === "teacher" ? teacherUrl : parentUrl}
                      title={installModal === "admin" ? "Admin Portal" : installModal === "teacher" ? "Teacher Portal" : "Parent Portal"}
                      accentColor={installModal === "admin" ? "#1d4ed8" : installModal === "teacher" ? "#6d28d9" : "#059669"}
                    />
                  </div>
                  <div>
                    <b className="block font-bold text-slate-900">Open on Your Phone</b>
                    <span className="text-[11px] text-slate-500">Scan this QR code with your mobile camera</span>
                  </div>
                </div>

                <Link
                  href={installModal === "admin" ? "/login" : installModal === "teacher" ? "/teacher" : "/parent"}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-slate-800"
                >
                  Open Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
