"use client";

import { useMemo,useState } from "react";
import { Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from "recharts";
import { useEduQuery } from "./edu-cache-provider";

type CollectionPoint={date:string;amount:number};
type Payload={data:CollectionPoint[];total:number;timezone:string;from:string;to:string};
const inputClass="rounded-xl border bg-panel px-3 py-2 text-sm font-semibold";
const money=(value:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value);
const dateKey=(date:Date,timeZone="Asia/Kolkata")=>new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const shift=(value:string,days:number)=>{const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)};
function presetRange(preset:string){const to=dateKey(new Date());if(preset==="today")return{from:to,to};if(preset==="month")return{from:`${to.slice(0,7)}-01`,to};return{from:shift(to,-6),to}}
function axisMoney(value:number){if(value>=10_000_000)return`₹${Number((value/10_000_000).toFixed(1))}Cr`;if(value>=100_000)return`₹${Number((value/100_000).toFixed(1))}L`;if(value>=1_000)return`₹${Number((value/1_000).toFixed(1))}K`;return`₹${value}`}
function dayLabel(value:string,year=false){return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",...(year?{year:"numeric"}:{}),timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`))}

export function DailyFeeCollectionChart({academicYear}:{academicYear:string}){
  const[period,setPeriod]=useState("seven"),initial=presetRange("seven"),[customFrom,setCustomFrom]=useState(initial.from),[customTo,setCustomTo]=useState(initial.to);
  const range=period==="custom"?{from:customFrom,to:customTo}:presetRange(period);
  const url=useMemo(()=>{const query=new URLSearchParams({year:academicYear,from:range.from,to:range.to});return`/api/finance/daily-collections?${query}`},[academicYear,range.from,range.to]);
  const{data,error,isLoading,mutate}=useEduQuery<Payload>(url,{keepPreviousData:false});
  const points=(data?.data||[]).map(item=>({date:item.date,amount:Number(item.amount)})).filter(item=>/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&Number.isFinite(item.amount)&&item.amount>=0);
  const hasCollections=points.some(item=>item.amount>0),tickInterval=Math.max(0,Math.ceil(points.length/7)-1);
  return <section className="dashboard-card p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-lg font-black tracking-tight">Daily Fee Collection</h2><p className="mt-0.5 text-sm text-muted">Successful payments · {academicYear}{data?` · ${money(data.total)}`:""}</p></div><div className="flex flex-wrap gap-2"><select aria-label="Fee collection period" className={inputClass} value={period} onChange={event=>setPeriod(event.target.value)}><option value="today">Today</option><option value="seven">Last 7 Days</option><option value="month">This Month</option><option value="custom">Custom Range</option></select>{period==="custom"&&<><input aria-label="Collection from date" className={inputClass} type="date" max={customTo} value={customFrom} onChange={event=>setCustomFrom(event.target.value)}/><input aria-label="Collection to date" className={inputClass} type="date" min={customFrom} value={customTo} onChange={event=>setCustomTo(event.target.value)}/></>}</div></div>
    <div className="mt-5 min-h-[18rem] min-w-0">{isLoading?<div className="h-72 animate-pulse rounded-2xl bg-canvas" aria-label="Loading fee collection chart"/>:error?<div className="grid h-72 place-items-center rounded-2xl border border-red-100 bg-red-50/40 text-center text-sm text-red-600 dark:bg-red-500/5"><div><p>Unable to load fee collection data.</p><button className="mt-2 font-bold underline" onClick={()=>void mutate()}>Retry</button></div></div>:!hasCollections?<div className="grid h-72 place-items-center rounded-2xl border border-dashed bg-gradient-to-br from-canvas/70 to-violet-50/50 p-6 text-center dark:to-violet-500/5"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-100 text-2xl dark:bg-violet-500/10" aria-hidden="true">₹</span><b className="mt-4 block">No fee collections for this period</b><p className="mt-1 max-w-xs text-sm text-muted">Successful payments will appear here automatically when they are recorded.</p></div></div>:<div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}><BarChart data={points} margin={{top:12,right:8,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={.25}/><XAxis dataKey="date" interval={tickInterval} tickFormatter={value=>dayLabel(String(value))} tick={{fontSize:11}} minTickGap={12}/><YAxis width={56} domain={[0,"auto"]} tickFormatter={value=>axisMoney(Number(value))} tick={{fontSize:11}} allowDecimals={false}/><Tooltip cursor={{fill:"rgba(124,58,237,.06)"}} contentStyle={{borderRadius:14,borderColor:"rgba(124,58,237,.18)",boxShadow:"0 16px 35px -20px rgba(15,23,42,.4)"}} labelFormatter={label=>dayLabel(String(label),true)} formatter={value=>[money(Number(value)),"Fee Collection"]}/><Bar dataKey="amount" name="Fee Collection" fill="#7c3aed" radius={[7,7,0,0]} maxBarSize={52}/></BarChart></ResponsiveContainer></div>}</div>
  </section>;
}
