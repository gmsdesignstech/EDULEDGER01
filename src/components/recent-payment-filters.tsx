"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const periods=[["day","Today"],["week","This Week"],["month","This Month"],["year","This Year"]] as const;
export function RecentPaymentFilters(){
 const selected=useSearchParams().get("period")||"";
 return <section aria-label="Recently paid fee filters" className="mx-auto mb-4 flex max-w-[1500px] flex-wrap items-center gap-2 rounded-2xl border bg-panel p-3 shadow-sm"><span className="mr-1 px-2 text-xs font-black uppercase tracking-[.16em] text-muted">Recently paid</span>{periods.map(([value,label])=><Link key={value} href={`/dashboard/payment-history?period=${value}`} aria-current={selected===value?"page":undefined} className={`rounded-full px-4 py-2 text-xs font-bold transition ${selected===value?"bg-violet-600 text-white shadow-sm":"border bg-canvas text-muted hover:border-violet-400 hover:text-violet-700"}`}>{label}</Link>)}{selected&&<Link href="/dashboard/payment-history" className="px-3 py-2 text-xs font-bold text-muted hover:text-violet-700">Clear</Link>}</section>;
}
