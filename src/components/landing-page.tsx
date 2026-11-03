"use client";
import { PublicFooter } from "@/components/public-chrome";
import { WhatsAppLandingSection } from "@/components/whatsapp-landing-section";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  CreditCard,
  GraduationCap,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
const features = [
  [
    GraduationCap,
    "Smart student records",
    "Admissions, attendance, sections, and class promotions are all managed in one clean dashboard.",
  ],
  [
    CreditCard,
    "Fee & invoice automation",
    "Track collections, generate receipts instantly, and keep payment status visible in real time.",
  ],
  [
    BookOpen,
    "Admissions & onboarding flow",
    "Create student profiles, assign sections, and keep parent communication centralized and professional.",
  ],
  [
    ShieldCheck,
    "Secure access for your team",
    "Role-based controls and trusted authentication help keep your school data protected.",
  ],
  [
    CalendarCheck,
    "Attendance & daily operations",
    "Track attendance, monitor student activity, and keep important school information visible in real time.",
  ],
  [
    BriefcaseBusiness,
    "Staff & payroll control",
    "Manage teachers, roles, salaries, and monthly payroll with less paperwork and more visibility.",
  ],
  [
    BarChart3,
    "Financial reporting at a glance",
    "Monitor cashbook activity, revenue flow, and school finances with advanced reporting tools.",
  ],
  [
    BookOpen,
    "Academic management",
    "Organize classes, sections, subjects, promotions, and academic records from one centralized platform.",
  ],
] as const;
const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};
export function LandingPage() {
  const [menu, setMenu] = useState(false);
  return (
    <main className="landing overflow-hidden bg-[#f8faff] text-[#111a35]">
      <Header menu={menu} setMenu={setMenu} />
      <Hero />
      <Stats />
      <Everything />
      <Features />
      <WhatsAppLandingSection />
      <Benefits />
      <DashboardShowcase />
      <FinalCTA />
      <PublicFooter />
    </main>
  );
}
function Header({
  menu,
  setMenu,
}: {
  menu: boolean;
  setMenu: (v: boolean) => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div className="mx-auto flex max-w-[1340px] items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_10px_40px_-18px_rgba(28,39,94,.25)] backdrop-blur-xl sm:px-5">
        <Brand />
        <nav className="hidden items-center gap-3 sm:flex">
          <Link
            className="text-xs font-bold text-slate-500 transition hover:text-violet-600"
            href="/admin/login"
          >
            Super Admin Portal
          </Link>
          <Link className="landing-secondary" href="/login">
            Sign in
          </Link>
          <Link className="landing-primary" href="/register">
            Get started
          </Link>
        </nav>
        <button
          className="grid size-11 place-items-center rounded-xl border sm:hidden"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label="Toggle navigation"
        >
          {menu ? <X /> : <Menu />}
        </button>
      </div>
      {menu && (
        <nav className="mx-auto mt-2 grid max-w-[1340px] grid-cols-2 gap-2 rounded-2xl border bg-white p-3 shadow-xl sm:hidden">
          <Link
            onClick={() => setMenu(false)}
            className="landing-secondary col-span-2 text-center"
            href="/admin/login"
          >
            Super Admin Portal
          </Link>
          <Link
            onClick={() => setMenu(false)}
            className="landing-secondary"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            onClick={() => setMenu(false)}
            className="landing-primary"
            href="/register"
          >
            Get started
          </Link>
        </nav>
      )}
    </header>
  );
}
function Brand() {
  return (
    <Link
      href="/"
      aria-label="EduLedger home"
      className="flex min-w-0 items-center gap-3"
    >
      <span
        aria-hidden="true"
        className="size-10 shrink-0 rounded-xl border border-slate-200 bg-white bg-no-repeat shadow-lg shadow-blue-500/10"
        style={{
          backgroundImage: "url('/eduledger-logo.jpeg')",
          backgroundPosition: "center 35%",
          backgroundSize: "220%",
        }}
      />
      <span className="min-w-0">
        <b className="block text-[15px] font-extrabold leading-none tracking-tight">
          EduLedger
        </b>
        <small className="mt-1 block truncate text-[10px] font-medium text-slate-500 sm:text-xs">
          School management, reimagined
        </small>
      </span>
    </Link>
  );
}
function Hero() {
  const reduce = useReducedMotion();
  return (
    <section className="landing-grid relative min-h-[790px] px-5 pb-24 pt-40 sm:pt-44">
      <div className="landing-orb left-[8%] top-32 bg-blue-400/25" />
      <div className="landing-orb right-[7%] top-52 bg-violet-400/20" />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-[1.04fr_.96fr]">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="landing-pill">
            <Sparkles className="size-4" />
            One connected platform for your school
          </span>
          <h1 className="mt-7 max-w-3xl text-[clamp(2.75rem,6vw,5.6rem)] font-extrabold leading-[.98] tracking-[-.055em]">
            Manage every part of your school in one{" "}
            <span className="gradient-text">beautiful platform.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-8">
            From admissions and attendance to fees, payroll, and cashbook
            reporting, EduLedger helps campus leaders stay organized, efficient,
            and in control.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="landing-primary !px-6 !py-3.5">
              Start your account <ArrowRight className="size-4" />
            </Link>
            <Link href="/dashboard" className="landing-secondary !px-6 !py-3.5">
              Explore dashboard
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
            {[
              "No setup fee",
              "Secure by design",
              "Built for Indian schools",
            ].map((x) => (
              <span className="flex items-center gap-2" key={x}>
                <Check className="size-4 text-emerald-500" />
                {x}
              </span>
            ))}
          </div>
        </motion.div>
        <HeroDashboard />
      </div>
    </section>
  );
}
function HeroDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, rotateY: -6 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ delay: 0.2, duration: 0.8 }}
      className="relative mx-auto w-full max-w-[600px] [perspective:1200px]"
    >
      <div className="absolute -inset-10 rounded-full bg-gradient-to-r from-blue-500/15 to-violet-500/15 blur-3xl" />
      <div className="landing-float relative rounded-[28px] border border-white bg-white/90 p-3 shadow-[0_40px_100px_-35px_rgba(34,47,110,.35)] sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <small className="font-bold text-blue-600">OVERVIEW</small>
            <h3 className="font-bold">Greenfield Public School</h3>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-violet-100 font-bold text-violet-700">
            AK
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 py-4 sm:grid-cols-4">
          {[
            ["2,486", "Students"],
            ["2,357", "Present"],
            ["₹8.4L", "Collected"],
            ["94.8%", "Attendance"],
          ].map((x) => (
            <div className="rounded-2xl bg-slate-50 p-3" key={x[1]}>
              <b className="block text-lg sm:text-xl">{x[0]}</b>
              <small className="text-slate-500">{x[1]}</small>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl bg-[#111a35] p-4 text-white">
            <div className="flex justify-between text-xs">
              <span>Monthly revenue</span>
              <span className="text-emerald-400">+18.4%</span>
            </div>
            <div className="mt-5 flex h-28 items-end gap-2">
              {[38, 52, 46, 65, 58, 78, 68, 91].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-blue-500 to-violet-400"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 p-4">
            <CreditCard className="text-violet-600" />
            <b className="mt-8 block text-2xl">86%</b>
            <small className="text-slate-500">Fees collected</small>
          </div>
        </div>
      </div>
      <div className="landing-float-delay absolute -bottom-9 -left-4 hidden rounded-2xl border bg-white p-4 shadow-xl sm:flex sm:items-center sm:gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
          <Zap />
        </span>
        <span>
          <b className="block text-sm">12 new admissions</b>
          <small className="text-slate-500">Ready for review</small>
        </span>
      </div>
    </motion.div>
  );
}
function Stats() {
  return (
    <section className="relative z-10 px-5">
      <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
        {[
          ["10k+", "Students tracked"],
          ["24/7", "Monthly reporting"],
          ["Live", "Support"],
        ].map((x, i) => (
          <motion.article
            variants={reveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-3xl border border-white bg-white/85 p-7 text-center shadow-[0_20px_60px_-35px_rgba(38,52,115,.4)] backdrop-blur transition hover:-translate-y-1"
            key={x[1]}
          >
            <b className="gradient-text text-4xl font-extrabold">{x[0]}</b>
            <p className="mt-2 font-medium text-slate-500">{x[1]}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
function Everything() {
  const items = [
    "One dashboard for students, staff, fees, and finances",
    "Fast setup with zero-code onboarding for school admins",
    "Friendly reports that help leaders make better decisions",
    "Built for growing schools that need clarity and control",
  ];
  return (
    <section className="px-5 py-28">
      <motion.div
        variants={reveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="relative mx-auto grid max-w-[1200px] overflow-hidden rounded-[36px] border border-blue-100 bg-white p-7 shadow-[0_30px_100px_-55px_rgba(63,72,190,.4)] sm:p-12 lg:grid-cols-[.8fr_1.2fr] lg:p-16"
      >
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div>
          <p className="landing-label">Everything in one place</p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
            A polished workflow for admins, teachers, and finance teams.
          </h2>
        </div>
        <div className="mt-10 space-y-4 lg:ml-16 lg:mt-0">
          {items.map((x, i) => (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              key={x}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="size-4" />
              </span>
              <p className="font-semibold leading-7">{x}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
function SectionHead({
  label,
  title,
  copy,
}: {
  label: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="landing-label">{label}</p>
      <h2 className="mt-4 text-3xl font-extrabold tracking-[-.03em] sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-7 text-slate-500 sm:text-lg">
        {copy}
      </p>
    </div>
  );
}
function Features() {
  return (
    <section id="features" className="px-5 py-28">
      <div className="mx-auto max-w-[1240px]">
        <SectionHead
          label="Features"
          title="Designed to simplify school operations from day one."
          copy="Every module is intentional, easy to learn, and built to grow with your school."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {features.map(([Icon, title, copy], i) => (
            <motion.article
              variants={reveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: (i % 2) * 0.08 }}
              whileHover={{ y: -6 }}
              className="group rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-[0_18px_50px_-35px_rgba(37,47,105,.35)] transition hover:border-blue-200 hover:shadow-[0_28px_65px_-35px_rgba(80,70,200,.4)] sm:p-9"
              key={title}
            >
              <span className="grid size-13 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-100 text-violet-600 transition duration-300 group-hover:rotate-3 group-hover:scale-110">
                <Icon />
              </span>
              <h3 className="mt-8 text-xl font-bold sm:text-2xl">{title}</h3>
              <p className="mt-3 max-w-xl leading-7 text-slate-500">{copy}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
function Benefits() {
  return (
    <section className="px-5 py-28">
      <div className="mx-auto grid max-w-[1240px] gap-5 md:grid-cols-2">
        {[
          [
            "Built for school growth",
            "A streamlined experience that keeps your team focused on teaching, not spreadsheets.",
          ],
          [
            "Why schools choose EduLedger",
            "Everything is connected — from student profiles and fee collection to payroll and finance — so your team can move faster and stay aligned.",
          ],
        ].map((x, i) => (
          <motion.article
            variants={reveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm"
            key={x[0]}
          >
            <span className="mb-10 block text-sm font-bold text-violet-600">
              0{i + 1}
            </span>
            <h3 className="text-xl font-bold">{x[0]}</h3>
            <p className="mt-3 leading-7 text-slate-500">{x[1]}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
function DashboardShowcase() {
  return (
    <section className="px-5 py-28">
      <div className="mx-auto max-w-[1240px]">
        <SectionHead
          label="One command centre"
          title="Everything your school needs. One powerful dashboard."
          copy="See the numbers that matter, act on priorities, and keep every team working from the same trusted information."
        />
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 3 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-14 rounded-[30px] border border-white bg-white p-3 shadow-[0_45px_120px_-55px_rgba(47,55,130,.5)] sm:p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total students", "2,486", "+8.2%"],
              ["Present today", "2,357", "94.8%"],
              ["Fee collection", "₹8.4L", "+18.4%"],
              ["Pending fees", "₹4.2L", "-12.5%"],
            ].map((x) => (
              <div className="rounded-2xl bg-slate-50 p-5" key={x[0]}>
                <small className="text-slate-500">{x[0]}</small>
                <div className="mt-3 flex items-end justify-between">
                  <b className="text-2xl">{x[1]}</b>
                  <span className="text-xs font-bold text-emerald-600">
                    {x[2]}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl bg-[#111a35] p-6 text-white">
              <div className="flex justify-between">
                <div>
                  <b>Monthly finances</b>
                  <p className="text-xs text-white/50">Revenue and expenses</p>
                </div>
                <small>2026–27</small>
              </div>
              <div className="mt-6 flex h-52 items-end gap-2 sm:gap-4">
                {[42, 55, 49, 64, 58, 76, 70, 91, 84, 96].map((h, i) => (
                  <div className="flex h-full flex-1 items-end gap-0.5" key={i}>
                    <span
                      className="w-1/2 rounded-t bg-blue-500"
                      style={{ height: `${h}%` }}
                    />
                    <span
                      className="w-1/2 rounded-t bg-violet-400/60"
                      style={{ height: `${Math.max(18, h - 24)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {[
                ["Recent admissions", "12 awaiting review"],
                ["Recent payments", "18 received today"],
                ["Notifications", "5 need attention"],
                ["Quick actions", "Add student · Record fee"],
              ].map((x) => (
                <div
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                  key={x[0]}
                >
                  <b className="text-sm">{x[0]}</b>
                  <p className="mt-1 text-xs text-slate-500">{x[1]}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Staff count", "142"],
              ["Monthly revenue", "₹12.6L"],
              ["Expenses", "₹4.1L"],
              ["Attendance", "94.8%"],
            ].map((x) => (
              <div className="rounded-2xl border p-4" key={x[0]}>
                <small className="text-slate-500">{x[0]}</small>
                <b className="mt-1 block text-lg">{x[1]}</b>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
function FinalCTA() {
  return (
    <section className="px-4 py-10 sm:px-5">
      <div className="cta-glow relative mx-auto max-w-[1300px] overflow-hidden rounded-[36px] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-6 py-20 text-center text-white sm:px-12 sm:py-28">
        <div className="absolute left-0 top-0 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-80 translate-x-1/2 translate-y-1/2 rounded-full bg-fuchsia-300/30 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Ready to simplify your school management?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg">
            Bring students, staff, admissions, fees, payroll, and finances
            together in one powerful platform.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="landing-secondary border-white bg-white !px-7 !py-3.5 text-blue-700"
              href="/register"
            >
              Get started <ArrowRight className="size-4" />
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-white/30 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              href="/dashboard"
            >
              Explore dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
