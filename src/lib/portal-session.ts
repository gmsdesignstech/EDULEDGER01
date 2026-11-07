"use client";

export function clearPortalStorageKeys(storage:Pick<Storage,"removeItem">,keys:string[]){
  for(const key of keys)storage.removeItem(key);
}

export async function logoutPortal(clearKeys:string[]=[]){
  if(typeof window!=="undefined"){
    try{clearPortalStorageKeys(localStorage,clearKeys);}catch{/* Continue server-side sign-out even when browser storage is unavailable. */}
    if("serviceWorker" in navigator){
      try{
        const registration=await navigator.serviceWorker.getRegistration("/");
        const subscription=await registration?.pushManager.getSubscription();
        if(subscription){
          const timeout=new AbortController(),timer=window.setTimeout(()=>timeout.abort(),1500);
          try{await fetch("/api/notifications/push-token",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:JSON.stringify(subscription)}) ,signal:timeout.signal,cache:"no-store"});}finally{window.clearTimeout(timer);}
          await subscription.unsubscribe().catch(()=>false);
        }
      }catch{/* Sign-out must continue if push revocation is unavailable. */}
    }
  }
  return fetch("/api/auth/logout",{method:"POST",cache:"no-store",credentials:"same-origin"});
}
