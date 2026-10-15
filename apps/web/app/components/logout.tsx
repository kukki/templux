'use client';
import { useState } from 'react';
import { endSession, sessionFetch, wakeSessionTabs } from './session-client';
export default function Logout({label,failed,allLabel,request}:{label:string;failed:string;allLabel?:string;request?:(action:()=>void)=>boolean}) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState(false);
  async function logout(all=false) {
    if(busy)return;setBusy(true);setError(false);
    try { const result=await sessionFetch(all?'/api/auth/logout-all':'/api/auth/logout',{method:'POST'});if(!result.ok)throw new Error();
      const reason=all?'all_sessions_revoked':'logged_out';wakeSessionTabs(reason);endSession(reason); }
    catch {setError(true);setBusy(false);}
  }
  return <div className="logout-actions"><button data-session-action type="button" disabled={busy} onClick={()=>request?request(()=>{void logout();}):void logout()}>{label}</button>{allLabel&&<button data-session-action type="button" disabled={busy} onClick={()=>request?request(()=>{void logout(true);}):void logout(true)}>{allLabel}</button>}{error&&<p role="alert">{failed}</p>}</div>;
}
