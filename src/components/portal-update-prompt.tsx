"use client";

import { useEffect,useRef,useState } from "react";
import { RefreshCw } from "lucide-react";

export function PortalUpdatePrompt(){
  const [waiting,setWaiting]=useState<ServiceWorker|null>(null),[updating,setUpdating]=useState(false),updatingRef=useRef(false);
  useEffect(()=>{
    if(!("serviceWorker" in navigator))return;
    let active=true,registration:ServiceWorkerRegistration|undefined;
    const inspect=()=>{if(active&&registration?.waiting&&navigator.serviceWorker.controller)setWaiting(registration.waiting);};
    const handleUpdateFound=()=>registration?.installing?.addEventListener("statechange",inspect);
    const handleController=()=>{if(updatingRef.current)window.location.reload();};
    navigator.serviceWorker.ready.then(async ready=>{
      if(!active)return;registration=ready;inspect();
      registration.addEventListener("updatefound",handleUpdateFound);
      registration.installing?.addEventListener("statechange",inspect);
      await registration.update().catch(()=>undefined);inspect();
    }).catch(()=>undefined);
    navigator.serviceWorker.addEventListener("controllerchange",handleController);
    return()=>{active=false;registration?.removeEventListener("updatefound",handleUpdateFound);registration?.installing?.removeEventListener("statechange",inspect);navigator.serviceWorker.removeEventListener("controllerchange",handleController);};
  },[]);
  if(!waiting)return null;
  return <aside role="status" aria-live="polite" className="fixed left-4 right-4 top-20 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-panel p-3 shadow-xl"><span className="min-w-0 flex-1 text-sm font-medium">A new EduLedger version is ready.</span><button type="button" disabled={updating} onClick={()=>{updatingRef.current=true;setUpdating(true);waiting.postMessage({type:"SKIP_WAITING"});}} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white disabled:opacity-60"><RefreshCw className={`size-4 ${updating?"animate-spin":""}`}/>{updating?"Updating…":"Update"}</button></aside>;
}
