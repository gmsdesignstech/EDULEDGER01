"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "./logo";
import { annualCheckoutHref, schoolAccountDestination, whatsappAddonCheckoutHref } from "@/lib/auth-redirect";
import { parseApiResponse } from "@/lib/api-response";
export function AuthForm({ mode, initialStudentCount = 1, afterSubscriptionHref, afterLoginHref, audience = "school" }: { mode: "login" | "register"; initialStudentCount?: number; afterSubscriptionHref?: string; afterLoginHref?: string; audience?: "school"|"teacher"|"parent"|"student" }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today=new Date(),academicStartYear=today.getMonth()>=3?today.getFullYear():today.getFullYear()-1;
  const [periodStart,setPeriodStart]=useState(`${academicStartYear}-04`);
  const [periodEnd,setPeriodEnd]=useState(`${academicStartYear+1}-03`);
  const periodLabel=(value:string)=>value?new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}-01T00:00:00Z`)):"—";
  const annualEnd=(value:string)=>{const match=/^(\d{4})-(\d{2})$/.exec(value);if(!match)return"";const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1+11,1));return`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`};
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget),
      password = String(form.get("password") ?? "");
    if (
      mode === "register" &&
      password !== String(form.get("confirmPassword") ?? "")
    ) {
      setError("Passwords do not match.");
      return;
    }
    if(mode==="register"&&(!periodStart||!periodEnd||periodEnd<=periodStart)){
      setError("Select an end month after the subscription start month.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          institution: form.get("institution"),
          phone: form.get("phone"),
          email: form.get("email"),
          password,
          studentCount: mode === "register" ? Number(form.get("studentCount")) : undefined,
          subscriptionStartMonth: mode === "register" ? form.get("subscriptionStartMonth") : undefined,
          subscriptionEndMonth: mode === "register" ? form.get("subscriptionEndMonth") : undefined,
          acceptedTerms: mode === "register" ? form.get("acceptedTerms") === "on" : undefined,
        }),
      });
      const result = await parseApiResponse<{ error?: string; user?: { role?: string }; subscription?: { status?: string; paymentStatus?: string; orderId?: string | null } }>(
        response,
        mode === "register"
          ? "Registration could not be completed. Please try again."
          : "Sign in could not be completed. Please try again.",
      );
      const submittedStudentCount=Number(form.get("studentCount"));
      const registrationDestination=annualCheckoutHref(submittedStudentCount);
      router.replace(mode === "register"
        ? afterSubscriptionHref
          ? `${registrationDestination}&next=${encodeURIComponent(afterSubscriptionHref)}`
          : registrationDestination
        : schoolAccountDestination({
            role:result.user?.role??"",
            subscriptionStatus:result.subscription?.status,
            paymentStatus:result.subscription?.paymentStatus,
            orderId:result.subscription?.orderId,
            requested:afterLoginHref,
          }));
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen overflow-hidden bg-slate-950 lg:grid-cols-2">
      <section className="auth-brand-panel relative hidden place-items-center overflow-hidden bg-slate-50 p-10 text-slate-950 lg:grid lg:p-16">
        <div aria-hidden="true" className="absolute -left-24 -top-24 size-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -right-20 size-96 rounded-full bg-blue-200/35 blur-3xl" />
        <div className="relative z-10 max-w-lg">
          <Logo className="text-slate-950" />
          <p className="mt-16 text-xs font-extrabold uppercase tracking-[.2em] text-emerald-700">EDUCATION, ORCHESTRATED</p>
          <h1 className="mt-5 text-5xl font-black leading-tight text-slate-950">
            One clear view of your entire institution.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Turn complex daily operations into simple, confident decisions for
            every learner.
          </p>
          <div className="mt-12 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <ShieldCheck className="text-emerald-700" />
            <p className="mt-4 leading-7 text-slate-600">
              Passwords are hashed and sessions are stored securely in HTTP-only
              cookies.
            </p>
          </div>
        </div>
      </section>
      <section className="grid place-items-center bg-slate-950 p-5 text-white sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-9 rounded-2xl border border-white/10 bg-white/[.04] p-4 lg:hidden">
            <Logo className="text-white" />
            <p className="mt-3 text-xs font-bold uppercase tracking-[.16em] text-emerald-400">Education, Orchestrated</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-400">
            {mode === "login" ? "Welcome back" : "Get started"}
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            {mode === "login"
              ? audience === "teacher"
                ? "Teacher Portal Sign In"
                : audience === "parent"
                  ? "Parent Portal Sign In"
                  : audience === "student"
                    ? "Student Portal Sign In"
                  : "School Administrator Sign In"
              : "Create your workspace"}
          </h1>
          <p className="mt-2 text-slate-400">
            {mode === "login"
              ? audience === "teacher"
                ? "Use the teacher account provided by your school."
                : audience === "parent"
                  ? "Enter your registered mobile number or email. Parent numbers come from the school's existing student profiles."
                  : audience === "student"
                    ? "Use the student credentials activated by your school."
                  : "Enter the registered credentials for your school workspace."
              : "Your school workspace will be ready in moments."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "register" && (
              <>
                <Field
                  name="name"
                  label="Full name"
                  placeholder="Aarav Sharma"
                  autoComplete="name"
                />
                <Field
                  name="institution"
                  label="Institution name"
                  placeholder="Springfield Academy"
                  autoComplete="organization"
                />
                <Field
                  name="phone"
                  label="Phone number"
                  placeholder="9876543210"
                  type="tel"
                  autoComplete="tel"
                />
                <Field name="studentCount" label="Expected number of students" placeholder="250" type="number" min={1} max={100000} defaultValue={initialStudentCount} />
                <fieldset className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                  <legend className="px-2 text-sm font-black text-emerald-400">School Subscription Period</legend>
                  <p className="mb-4 text-xs leading-5 text-slate-400">Choose the school&apos;s academic subscription period. It will be locked after successful payment.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-slate-100">Subscription Start<input required name="subscriptionStartMonth" type="month" min="2000-01" max="2200-12" value={periodStart} onChange={event=>{const start=event.target.value;setPeriodStart(start);setPeriodEnd(annualEnd(start))}} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-normal text-white"/></label>
                    <label className="text-sm font-bold text-slate-100">Subscription End<input required name="subscriptionEndMonth" type="month" min="2000-01" max="2200-12" value={periodEnd} onChange={event=>setPeriodEnd(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-normal text-white"/></label>
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-800 p-3 text-sm text-slate-300"><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Subscription Period</span><strong className="mt-1 block text-white">{periodLabel(periodStart)} – {periodLabel(periodEnd)}</strong></div>
                </fieldset>
              </>
            )}
            <Field
              name="email"
              label={audience === "parent" ? "Registered Mobile Number or Email" : "Email address"}
              placeholder={audience === "parent" ? "e.g. 9876543210 or parent@school.edu" : "admin@school.edu"}
              type={audience === "parent" ? "text" : "email"}
              autoComplete={audience === "parent" ? "username" : "email"}
            />
            <label className="block text-sm font-bold text-slate-100">
              Password
              <div className="relative mt-2">
                <input
                  required
                  minLength={8}
                  maxLength={128}
                  name="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  type={show ? "text" : "password"}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 pr-12 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-3 text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            {mode === "register" && (
              <>
                <Field
                  name="confirmPassword"
                  label="Confirm password"
                  placeholder="Repeat your password"
                  type="password"
                  autoComplete="new-password"
                />
                <p className="text-xs leading-5 text-slate-400">
                  Use at least 8 characters with an uppercase letter, a lowercase letter, and a number.
                </p>
                <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300">
                  <input
                    required
                    name="acceptedTerms"
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-emerald-500"
                  />
                  <span>
                    I agree to the{" "}
                    <Link className="font-bold text-emerald-400 underline" href="/terms" target="_blank">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link className="font-bold text-emerald-400 underline" href="/privacy" target="_blank">
                      Privacy Policy
                    </Link>.
                  </span>
                </label>
              </>
            )}
            {mode === "login" && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-bold text-emerald-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Forgot password?
                </Link>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Please wait…
                </>
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>
          {audience === "parent" ? (
            <p className="mt-7 text-center text-sm text-slate-400">
              Received a school invitation code?{" "}
              <Link
                className="font-bold text-emerald-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                href="/parent/activate"
              >
                Activate Account
              </Link>
            </p>
          ) : audience !== "teacher" && audience !== "student" ? (
            <p className="mt-7 text-center text-sm text-slate-400">
              {mode === "login"
                ? "New to EduLedger? "
                : "Already have an account? "}
              <Link
                className="font-bold text-emerald-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                href={
                  mode === "login"
                    ? "/register"
                    : afterSubscriptionHref
                      ? `/login?next=${encodeURIComponent(whatsappAddonCheckoutHref(initialStudentCount))}`
                      : "/login"
                }
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </Link>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
function Field({
  name,
  label,
  placeholder,
  type = "text",
  autoComplete,
  min,
  max,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
  defaultValue?: string | number;
}) {
  return (
    <label className="block text-sm font-bold text-slate-100">
      {label}
      <input
        required
        name={name}
        type={type}
        autoComplete={autoComplete}
        min={min}
        max={max}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-normal text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}
