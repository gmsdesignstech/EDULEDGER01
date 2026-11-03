"use client";
import useSWR from "swr";
import type { SubscriptionSummary } from "@/lib/db";
import { formatInr } from "@/lib/subscription-plans";

type StatusResponse={subscription:SubscriptionSummary};
const fetcher=async(url:string)=>{const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error("Unable to load subscription details.");return response.json() as Promise<StatusResponse>};

export function SubscriptionDetails({subscription:initial}:{subscription:SubscriptionSummary}){
  const {data,error,isLoading,mutate}=useSWR<StatusResponse>("/api/subscription/status",fetcher,{fallbackData:{subscription:initial},refreshInterval:30000,revalidateOnFocus:true});
  if(isLoading&&!data)return <State text="Loading subscription details..."/>;
  if(error)return <State text="Unable to load subscription details." retry={()=>void mutate()}/>;
  const subscription=data?.subscription;
  if(!subscription||subscription.status==="UNPAID")return null;
  const capacity=subscription.studentCapacity??0,remaining=Math.max(0,capacity-subscription.studentUsage),limitReached=capacity>0&&remaining===0;
  const rows=[
    ["Status",subscription.status.replaceAll("_"," ")],
    ["Active students",`${subscription.studentUsage} / ${capacity||"—"}`],
    ["Remaining students",limitReached?"Student limit reached":`${remaining} student slot${remaining===1?"":"s"} remaining`],
    ["Annual amount",formatInr(subscription.amountPaid)],
    ["Pricing",subscription.pricingModel==="FIXED"?"Fixed annual school subscription":`${formatInr(subscription.pricePerStudent)} / student / year`],
    ["Students at purchase",String(subscription.studentCountAtPurchase??subscription.studentCapacity??"—")],
    ["Subscription",subscription.planName||"EduLedger Annual Subscription"],
    ["Subscription period",period(subscription.activationDate,subscription.expiryDate)],
    ["Start date",date(subscription.activationDate)],
    ["Expiry date",date(subscription.expiryDate)],
    [subscription.status==="UPCOMING"?"Days until start":"Days remaining",String(subscription.status==="UPCOMING"?subscription.daysUntilStart:subscription.daysRemaining)],
    ["Payment reference",subscription.razorpayPaymentId||subscription.razorpayOrderId||"—"],
  ];
  return <section className="mx-auto mb-16 max-w-5xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-live="polite"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Subscription details</h2><p className="mt-1 text-sm text-slate-500">Live student usage and verified payment information.</p></div><button type="button" onClick={()=>void mutate()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">Refresh</button></div><dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">{rows.map(([label,value])=><div className="min-w-0 bg-white p-4" key={label}><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-800">{value}</dd></div>)}</dl></section>;
}
function State({text,retry}:{text:string;retry?:()=>void}){return <section className="mx-auto mb-16 max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-slate-600">{text}</p>{retry&&<button type="button" onClick={retry} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">Retry</button>}</section>}
function date(value:string|null){return value?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"}).format(new Date(value)):"Pending"}
function period(start:string|null,end:string|null){if(!start||!end)return"Pending";const format=new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:"UTC"});return`${format.format(new Date(start))} – ${format.format(new Date(end))}`}
