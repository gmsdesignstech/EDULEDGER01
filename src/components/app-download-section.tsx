"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { generateQrMatrix } from "@/lib/qr-code";
import { getSiteOrigin } from "@/lib/site-url";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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
  const parentUrl = `${siteUrl}/parent`;
  const teacherUrl = `${siteUrl}/teacher`;

  const [installModal, setInstallModal] = useState<"parent" | "teacher" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function triggerInstall(type: "parent" | "teacher") {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setInstallModal(type);
    }
  }

  const parentFeatures = [
    "Track your child’s attendance.",
    "View examination results.",
    "Check homework and assignments.",
    "View fee details and payment history.",
    "Receive school announcements.",
    "Access your child’s timetable.",
    "View academic reports.",
  ];

  const teacherFeatures = [
    "Manage assigned classes.",
    "Mark student attendance.",
    "Upload assignments and study materials.",
    "Enter examination marks.",
    "Access class timetables.",
    "View student academic performance.",
    "Receive school notifications.",
  ];

  return (
    <section id="download-apps" className="relative px-5 py-24 sm:py-32">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-1/3 size-[520px] -translate-x-1/2 rounded-full bg-blue-400/10 blur-[130px]" />
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
              Everyone Connected.
            </span>
          </h2>

          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
            Stay connected with your school from anywhere. Download the EduLedger Parent and Teacher Apps for a smarter school experience.
          </p>
        </div>

        {/* 2 Premium Application Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
          {/* CARD 1: EDULEDGER PARENT APP */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[36px] border border-blue-100 bg-white p-7 shadow-[0_30px_90px_-40px_rgba(37,99,235,.2)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_40px_110px_-35px_rgba(37,99,235,.28)] sm:p-10">
            {/* Visual Accent Top Bar */}
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500" />

            <div>
              {/* Badge & Title */}
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  <GraduationCap className="size-3.5" />
                  For Parents &amp; Guardians
                </span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  PWA • Android / iOS / Web
                </span>
              </div>

              <h3 className="mt-5 text-2xl font-black text-slate-900 sm:text-3xl">
                EduLedger Parent App
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Stay updated with your child’s academic progress, attendance, homework, examination results, fee payments and important school announcements.
              </p>

              {/* Verified School Number Source Badge */}
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/80 px-3.5 py-2.5 text-xs font-semibold text-blue-900 shadow-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-lg bg-blue-600 text-white">
                  <Check className="size-3 stroke-[3]" />
                </span>
                <span>Parent numbers come from the school&apos;s existing student profiles.</span>
              </div>

              {/* Mobile Phone Mockup: Parent View */}
              <div className="relative mx-auto my-8 max-w-[340px] rounded-[38px] border-[6px] border-slate-900 bg-slate-950 p-2.5 shadow-2xl transition duration-500 group-hover:scale-[1.02]">
                {/* Notch / Speaker */}
                <div className="absolute left-1/2 top-3 h-3.5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />

                <div className="overflow-hidden rounded-[28px] bg-gradient-to-b from-blue-50/90 to-white p-3.5 pt-6 text-slate-900">
                  {/* Mockup Header */}
                  <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-black text-white shadow">
                        AP
                      </div>
                      <div className="min-w-0">
                        <b className="block text-xs font-bold leading-tight text-slate-900 truncate">Aarav Patel</b>
                        <span className="block text-[10px] text-slate-500 mt-0.5">Class 7-A • Roll #12</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Present Today
                    </span>
                  </div>

                  {/* Mockup Quick Metrics */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-blue-100 bg-white p-2.5 shadow-sm">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Attendance</span>
                        <CalendarCheck2 className="size-3 text-blue-600" />
                      </div>
                      <b className="block text-lg font-black text-blue-700 leading-tight">96.4%</b>
                      <span className="block text-[9px] text-slate-400 mt-0.5">Term 2 Summary</span>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-white p-2.5 shadow-sm">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Fee Balance</span>
                        <ShieldCheck className="size-3 text-emerald-600" />
                      </div>
                      <b className="block text-lg font-black text-emerald-700 leading-tight">₹0 Due</b>
                      <span className="block text-[9px] text-slate-400 mt-0.5">All Invoices Paid</span>
                    </div>
                  </div>

                  {/* Mockup Homework Preview */}
                  <div className="mt-2.5 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-700">Recent Homework</span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">Science Lab</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight truncate">
                      Complete Chapter 5 diagram &amp; botanical summary
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Key Capabilities
                </span>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {parentFeatures.map((f) => (
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

            {/* Card Footer: CTA & QR Code */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => triggerInstall("parent")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:scale-95"
                  >
                    <Download className="size-4" />
                    <span>Install Parent App</span>
                  </button>

                  <Link
                    href="/parent"
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <span>Launch in browser</span>
                    <ChevronRight className="size-3" />
                  </Link>
                </div>

                {/* QR Code */}
                <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-2.5">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-white bg-white p-1 shadow-sm">
                    <QrSvg url={parentUrl} title="Parent Portal" accentColor="#1d4ed8" />
                  </div>
                  <div className="flex flex-col justify-center text-[11px] leading-snug">
                    <b className="font-bold text-slate-900 text-xs">Scan to Open</b>
                    <span className="text-slate-500 text-[11px] mt-0.5">Scan with your phone to open Parent App</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: EDULEDGER TEACHER APP */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[36px] border border-violet-100 bg-white p-7 shadow-[0_30px_90px_-40px_rgba(124,58,237,.2)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_40px_110px_-35px_rgba(124,58,237,.28)] sm:p-10">
            {/* Visual Accent Top Bar */}
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600" />

            <div>
              {/* Badge & Title */}
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-700/10">
                  <BookOpen className="size-3.5" />
                  For Teachers &amp; Faculty
                </span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  PWA • Android / iOS / Web
                </span>
              </div>

              <h3 className="mt-5 text-2xl font-black text-slate-900 sm:text-3xl">
                EduLedger Teacher App
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Manage your classes, mark attendance, share assignments, update examination marks and stay connected with your school.
              </p>

              {/* Verified Faculty Assignment Badge */}
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-violet-200 bg-violet-50/80 px-3.5 py-2.5 text-xs font-semibold text-violet-900 shadow-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-lg bg-violet-600 text-white">
                  <Check className="size-3 stroke-[3]" />
                </span>
                <span>Connected directly to assigned school classes and timetables.</span>
              </div>

              {/* Mobile Phone Mockup: Teacher View */}
              <div className="relative mx-auto my-8 max-w-[340px] rounded-[38px] border-[6px] border-slate-900 bg-slate-950 p-2.5 shadow-2xl transition duration-500 group-hover:scale-[1.02]">
                {/* Notch / Speaker */}
                <div className="absolute left-1/2 top-3 h-3.5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />

                <div className="overflow-hidden rounded-[28px] bg-gradient-to-b from-violet-50/90 to-white p-3.5 pt-6 text-slate-900">
                  {/* Mockup Header */}
                  <div className="flex items-center justify-between border-b border-violet-100 pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-xs font-black text-white shadow">
                        VM
                      </div>
                      <div className="min-w-0">
                        <b className="block text-xs font-bold leading-tight text-slate-900 truncate">Prof. V. Malhotra</b>
                        <span className="block text-[10px] text-slate-500 mt-0.5">Senior Science • Class 9 &amp; 10</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                      Faculty Active
                    </span>
                  </div>

                  {/* Mockup Quick Metrics */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-violet-100 bg-white p-2.5 shadow-sm">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Class 9-A</span>
                        <CalendarCheck2 className="size-3 text-violet-600" />
                      </div>
                      <b className="block text-lg font-black text-violet-700 leading-tight">28 / 30</b>
                      <span className="block text-[9px] text-slate-400 mt-0.5">Attendance Recorded</span>
                    </div>

                    <div className="rounded-2xl border border-indigo-100 bg-white p-2.5 shadow-sm">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Next Period</span>
                        <Clock className="size-3 text-indigo-600" />
                      </div>
                      <b className="block text-lg font-black text-indigo-700 leading-tight">09:40 AM</b>
                      <span className="block text-[9px] text-slate-400 mt-0.5">Physics Lab 1</span>
                    </div>
                  </div>

                  {/* Mockup Attendance Action Preview */}
                  <div className="mt-2.5 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-700">Marks Pending</span>
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">Unit Test II</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight truncate">
                      Class 10-B: Physics (18 submitted, 12 pending)
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Key Capabilities
                </span>
                <ul className="grid gap-2 sm:grid-cols-2">
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

            {/* Card Footer: CTA & QR Code */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => triggerInstall("teacher")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95"
                  >
                    <Download className="size-4" />
                    <span>Install Teacher App</span>
                  </button>

                  <Link
                    href="/teacher"
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 hover:underline"
                  >
                    <span>Launch in browser</span>
                    <ChevronRight className="size-3" />
                  </Link>
                </div>

                {/* QR Code */}
                <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-2.5">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-white bg-white p-1 shadow-sm">
                    <QrSvg url={teacherUrl} title="Teacher Portal" accentColor="#6d28d9" />
                  </div>
                  <div className="flex flex-col justify-center text-[11px] leading-snug">
                    <b className="font-bold text-slate-900 text-xs">Scan to Open</b>
                    <span className="text-slate-500 text-[11px] mt-0.5">Scan with your phone to open Teacher App</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Installation Helper Modal */}
      {installModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setInstallModal(null)}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close installation instructions"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
              <span
                className={`grid size-11 place-items-center rounded-2xl text-white shadow ${
                  installModal === "parent" ? "bg-blue-600" : "bg-violet-600"
                }`}
              >
                <Smartphone className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {installModal === "parent" ? "Install EduLedger Parent App" : "Install EduLedger Teacher App"}
                </h3>
                <p className="text-xs text-slate-500">Instant Progressive Web App (PWA)</p>
              </div>
            </div>

            <div className="mt-5 space-y-3.5 text-xs text-slate-600">
              {isIos ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <b className="block font-bold text-amber-900">Apple iOS / Safari Instructions:</b>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-amber-800">
                    <li>Open this page or app URL in <strong>Safari</strong></li>
                    <li>Tap the <strong>Share</strong> button at the bottom of the screen</li>
                    <li>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong></li>
                    <li>Tap <strong>Add</strong> in the top right corner to install</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                  <b className="block font-bold text-blue-900">Android &amp; Chrome / Edge Instructions:</b>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-blue-800">
                    <li>Tap your browser’s menu icon (<strong>⋮</strong> or <strong>⋯</strong>)</li>
                    <li>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong></li>
                    <li>Confirm installation to add the app icon directly to your home screen</li>
                  </ol>
                </div>
              )}

              {/* Direct QR and Link */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="size-14 overflow-hidden rounded-xl border border-white bg-white p-1 shadow-sm">
                    <QrSvg
                      url={installModal === "parent" ? parentUrl : teacherUrl}
                      title={installModal === "parent" ? "Parent App" : "Teacher App"}
                      accentColor={installModal === "parent" ? "#1d4ed8" : "#6d28d9"}
                    />
                  </div>
                  <div>
                    <b className="block font-bold text-slate-900">Direct Link</b>
                    <code className="text-[10px] text-slate-500">
                      {installModal === "parent" ? "/parent" : "/teacher"}
                    </code>
                  </div>
                </div>

                <Link
                  href={installModal === "parent" ? "/parent" : "/teacher"}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  Open App
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
