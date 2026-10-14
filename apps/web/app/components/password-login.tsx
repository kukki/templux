'use client';
import { useEffect, useState, type FormEvent } from 'react';
type Copy = { username:string; password:string; submit:string; busy:string; invalid:string; denied:string; limited:string; unavailable:string };
export default function PasswordLogin({copy}:{copy:Copy}) {
  const [ready,setReady]=useState(false); useEffect(()=>setReady(true),[]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function login(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy) return;
    const form=event.currentTarget; const data=new FormData(form); setBusy(true); setError('');
    try {
      const response=await fetch('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:data.get('username'),password:data.get('password')})});
      if(response.ok) { form.reset(); window.location.assign('/account'); return; }
      const value=await response.json().catch(()=>({}));
      setError(value.error==='login_limited'?copy.limited:value.error==='invalid_credentials'?copy.invalid:copy.unavailable);
    } catch {setError(copy.unavailable);} finally {setBusy(false);}
  }
  return <form className="password-form" method="post" action="/api/auth/password" onSubmit={login}>
    <label>{copy.username}<input name="username" autoComplete="username" required minLength={3} maxLength={80}/></label>
    <label>{copy.password}<input name="password" type="password" autoComplete="current-password" required maxLength={1024}/></label>
    {error&&<p className="auth-message" role="alert">{error}</p>}
    <button className="action" type="submit" disabled={busy||!ready}>{busy?copy.busy:copy.submit}</button>
  </form>;
}
