'use client';
import { useEffect } from 'react';
import { endSession, guardSessionNavigation, sessionIsEnding } from './session-client';
import { sessionReasons } from './session-reasons';
export default function SessionGuard({seconds,accountId,version}:{seconds:number;accountId:string;version:string}) {
  useEffect(()=>{
    let stopped=false; let heartbeatAbort:AbortController|null=null; let activityBusy=false; let lastActivity=0; let wakeReason:string|undefined;
    const controller=new AbortController(); const releaseNavigationGuard=guardSessionNavigation();
    const eligible=()=>navigator.onLine&&document.visibilityState==='visible';
    async function inspect(response:Response) {
      if(stopped||sessionIsEnding())return;
      const data=await response.json().catch(()=>null);
      if(stopped||sessionIsEnding())return;
      if(response.status===401&&data&&sessionReasons.has(data.error)) {
        endSession(data.error==='login_required'&&wakeReason?wakeReason:data.error);
      } else if(response.ok&&data?.account&&(data.account.id!==accountId||data.account.authVersion!==version)) {
        endSession('authorization_changed');
      }
    }
    async function check(force=false) {
      if(stopped||sessionIsEnding()||!navigator.onLine||(!force&&!eligible()))return;
      if(heartbeatAbort){if(force)heartbeatAbort.abort();else return;}
      const requestController=new AbortController();heartbeatAbort=requestController;
      try {const response=await fetch('/api/auth/heartbeat',{cache:'no-store',signal:AbortSignal.any([controller.signal,requestController.signal,AbortSignal.timeout(6000)])});if(heartbeatAbort===requestController)await inspect(response);} catch { /* Network errors preserve the current page. */ }
      finally{if(heartbeatAbort===requestController)heartbeatAbort=null;}
    }
    async function activity(event:Event) {
      if(event.target instanceof Element&&event.target.closest('[data-session-action]'))return;
      if(!event.isTrusted||!eligible()||stopped||sessionIsEnding()||activityBusy||Date.now()-lastActivity<5000)return;
      activityBusy=true; lastActivity=Date.now();
      try{await inspect(await fetch('/api/auth/activity',{method:'POST',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6000)])}));}catch{/* Retry on later real input, never via timer. */}
      finally{activityBusy=false;}
    }
    const visible=()=>{if(eligible())void check(true);};
    const restored=()=>{void check(true);};
    const storage=(event:StorageEvent)=>{
      if(event.key!=='templux:session-check')return;
      try{const message=JSON.parse(event.newValue??'null');if(['logged_out','all_sessions_revoked','session_revoked'].includes(message?.reason))wakeReason=message.reason;}catch{/* Untrusted notification is only a check request. */}
      void check(true);
    };
    const interval=setInterval(()=>{void check();},seconds*1000);
    document.addEventListener('visibilitychange',visible);window.addEventListener('online',restored);window.addEventListener('storage',storage);
    for(const type of ['pointerdown','keydown','wheel'])window.addEventListener(type,activity,{passive:true});
    void check();
    return()=>{stopped=true;controller.abort();clearInterval(interval);releaseNavigationGuard();document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',restored);window.removeEventListener('storage',storage);for(const type of ['pointerdown','keydown','wheel'])window.removeEventListener(type,activity);};
  },[seconds,accountId,version]);
  return null;
}
