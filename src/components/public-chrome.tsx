import Link from "next/link";
import { GraduationCap, Mail, Phone } from "lucide-react";

const publicLinks = [
  ["About EduLedger", "/about"],
  ["Terms & Conditions", "/terms"],
  ["Privacy Policy", "/privacy"],
  ["Contact Us", "/contact"],
] as const;

export function PublicBrand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20" aria-hidden="true">
        <GraduationCap className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold leading-none tracking-tight">EduLedger</span>
        <span className="mt-1 block truncate text-[10px] font-medium text-slate-500 sm:text-xs">School management, reimagined</span>
      </span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 py-4">
        <PublicBrand />
        <nav aria-label="Public navigation" className="hidden items-center gap-5 text-sm font-semibold text-slate-600 md:flex">
          {publicLinks.map(([label, href]) => <Link className="rounded-md transition hover:text-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500" href={href} key={href}>{label.replace(" EduLedger", "")}</Link>)}
        </nav>
        <Link href="/login" className="landing-secondary shrink-0">Sign in</Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-[#f8faff] px-5 pb-10 pt-16 text-[#111a35]">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-10 border-b border-slate-200 pb-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <PublicBrand />
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500">A School Management Software by GMS DESIGNS AND TECH</p>
          </div>
          <nav aria-label="Footer navigation">
            <h2 className="text-sm font-bold">Company & legal</h2>
            <div className="mt-5 flex flex-col gap-3 text-sm text-slate-500">
              {publicLinks.map(([label, href]) => <Link className="w-fit rounded transition hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500" href={href} key={href}>{label}</Link>)}
            </div>
          </nav>
          <div>
            <h2 className="text-sm font-bold">Support</h2>
            <div className="mt-5 space-y-3 text-sm text-slate-500">
              <a className="flex w-fit items-center gap-2 rounded transition hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500" href="tel:+919928788015"><Phone className="size-4" aria-hidden="true" />9928788015</a>
              <a className="flex w-fit items-center gap-2 rounded transition hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500" href="mailto:support@eduledger.in"><Mail className="size-4" aria-hidden="true" />support@eduledger.in</a>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-7 text-sm text-slate-500 sm:flex-row sm:justify-between"><span>© 2026 EduLedger. All rights reserved.</span><span>Simplifying School Management. Empowering Education.</span></div>
      </div>
    </footer>
  );
}

