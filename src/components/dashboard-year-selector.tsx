"use client";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { useTransition } from "react";

export function DashboardYearSelector({years,selected,canManage}:{years:string[];selected:string;canManage:boolean}) {
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  return <div className="flex items-center gap-2 rounded-xl border bg-panel px-3 py-2 shadow-sm">
    {pending?<Loader2 className="size-4 animate-spin text-brand"/>:<CalendarDays className="size-4 text-brand"/>}
    <label htmlFor="dashboard-academic-year" className="text-xs font-bold text-muted">Academic year</label>
    <select id="dashboard-academic-year" aria-label="Academic year" disabled={pending} value={selected} onChange={event=>{
      const value=event.target.value;
      if(value==="__add__") { router.push("/dashboard/settings#academic-years"); return; }
      startTransition(()=>router.push(`/dashboard?year=${encodeURIComponent(value)}`));
    }} className="max-w-36 bg-transparent text-sm font-bold outline-none disabled:opacity-60">
      {years.map(year=><option key={year} value={year}>{year.replace("-","–")}</option>)}
      {canManage&&<option value="__add__">+ Add custom year…</option>}
    </select>
  </div>;
}
