"use client";

import { useEffect,useState } from "react";
import { WifiOff } from "lucide-react";

export function PortalNetworkStatus(){
  const [online,setOnline]=useState(true);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);
    update();window.addEventListener("online",update);window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);
  if(online)return null;
  return <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><WifiOff className="mt-0.5 size-4 shrink-0"/><p><strong>You are offline.</strong> Private school information and save actions require an internet connection. Changes are not saved for later.</p></div>;
}
