"use client";
import { readApiJson } from "@/lib/api-response";
import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

type Props={label:string;details?:string;url:string;onComplete:()=>void|Promise<void>;onError?:(message:string)=>void;action?:"Delete"|"Void"|"Cancel"|"Archive"|"Deactivate"|"Restore";reasonRequired?:boolean;disabled?:boolean;method?:"DELETE"|"PATCH";requestBody?:Record<string,unknown>};
let permissionRequest:Promise<boolean>|undefined;
function canManageRecords(){
  permissionRequest??=fetch("/api/auth/me",{credentials:"same-origin"}).then(async response=>{
    if(!response.ok)return false;
    const result=await readApiJson(response);
    return ["SCHOOL_ADMIN","SUPER_ADMIN"].includes(result.user?.role);
  }).catch(()=>false);
  return permissionRequest;
}
export function DeleteRecordButton({label,details,url,onComplete,onError,action="Delete",reasonRequired=false,disabled=false,method="DELETE",requestBody}:Props){
  const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[reason,setReason]=useState(""),[error,setError]=useState(""),[allowed,setAllowed]=useState(false);
  const lock=useRef(false);
  useEffect(()=>{let active=true;void canManageRecords().then(value=>{if(active)setAllowed(value)});return()=>{active=false}},[]);
  // Student records remain available through lifecycle statuses; normal student
  // management intentionally exposes no delete/remove/archive control.
  if(/^student\s/i.test(label))return null;
  async function submit(){
    if(lock.current||reasonRequired&&!reason.trim())return;
    lock.current=true;setSaving(true);setError("");
    try{
      const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({...requestBody,reason:reason.trim()})});
      const data=await readApiJson(response).catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`Unable to ${action.toLowerCase()} this record.`);
      setOpen(false);setReason("");await onComplete();
    }catch(cause){const message=cause instanceof Error?cause.message:`Unable to ${action.toLowerCase()} this record.`;setError(message);onError?.(message)}
    finally{lock.current=false;setSaving(false)}
  }
  if(!allowed)return null;
  return <><button type="button" disabled={disabled} onClick={()=>{setError("");setOpen(true)}} className="icon-btn text-red-600 disabled:opacity-40" title={`${action} ${label}`} aria-label={`${action} ${label}`}><Trash2 className="size-4"/></button>
    {open&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setOpen(false)}}><div role="alertdialog" aria-modal="true" aria-labelledby="delete-record-title" aria-describedby="delete-record-description" className="card w-full max-w-md p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 className="size-5"/></span><button type="button" disabled={saving} onClick={()=>setOpen(false)} aria-label="Close"><X className="size-5"/></button></div><h2 id="delete-record-title" className="mt-5 text-xl font-black">{action} {label}?</h2><p id="delete-record-description" className="mt-2 text-sm text-muted">{details||label}. {action==="Void"?"This record stays in the audit history and financial totals will be updated.":action==="Archive"?"Historical records will be preserved.":"The selected record will be removed from the active list."}</p>{reasonRequired&&<label className="mt-5 block text-sm font-bold">Reason <span className="text-red-600">*</span><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} className="settings-input mt-2 min-h-24" placeholder={`Why are you choosing to ${action.toLowerCase()} this record?`}/></label>}{error&&<p role="alert" className="mt-4 text-sm font-semibold text-red-600">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={()=>setOpen(false)} className="btn-secondary">Cancel</button><button type="button" disabled={saving||reasonRequired&&!reason.trim()} onClick={()=>void submit()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{saving&&<Loader2 className="size-4 animate-spin"/>}{saving?`${action}ing…`:`${action} record`}</button></div></div></div>}
  </>;
}
