'use client';
import { useState } from 'react';
export default function Logout({label,failed}:{label:string;failed:string}) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState(false);
  async function logout() {
    setBusy(true); setError(false);
    try { const result=await fetch('/api/auth/logout',{method:'POST'}); if(!result.ok) throw new Error(); location.assign('/login'); }
    catch { setError(true); setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={logout}>{label}</button>{error&&<p role="alert">{failed}</p>}</div>;
}
