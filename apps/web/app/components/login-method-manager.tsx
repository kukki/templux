'use client';
import {useEffect,useState} from 'react';import type {AuthCopy} from './auth-copy';import {sessionFetch,endSession,wakeSessionTabs} from './session-client';
type RequestRow={id:string;method:string;username:string|null;status:string;verifiedName:string|null};
type Target={id:string;kind:string;authVersion:string;hasFeishu:boolean;passwordUsername:string|null;passwordEnabled:boolean};
export default function LoginMethodManager({target,ownAccountId,copy,blocked,onBusy,onComplete}:{target:Target;ownAccountId:string;copy:AuthCopy;blocked:boolean;onBusy:(value:boolean)=>void;onComplete:(notice:string)=>void}){
 const [requests,setRequests]=useState<RequestRow[]>([]),[username,setUsername]=useState(target.passwordUsername??''),[confirm,setConfirm]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let ignore=false;const controller=new AbortController();setLoading(true);void sessionFetch(`/api/admin/login-links?account=${target.id}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!ignore){if(response.ok)setRequests(data.requests);else setError(copy.sessionNetwork);}}).catch(()=>{if(!ignore)setError(copy.sessionNetwork);}).finally(()=>{if(!ignore)setLoading(false);});return()=>{ignore=true;controller.abort();};},[target.id,refresh,copy]);
 const label=(status:string)=>status==='pending'?copy.methodPending:status==='verified'?copy.methodApproved:status==='completed'?copy.methodDone:status==='expired'?copy.methodExpired:copy.methodCancelled;
 async function mutate(path:string,input:object,completion=false){if(blocked||!confirm)return;onBusy(true);setError('');setNotice('');let committed=false;
 try{const response=await sessionFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,confirm:true}),signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok){setError(response.status>=500&&value.error!=='login_method_save_failed'?copy.managementUnknown:copy[value.error as keyof AuthCopy]??copy.managementFailure);return;}if(value.ok!==true){setError(copy.managementUnknown);return;}committed=true;
 if(value.credential){const payload=JSON.stringify(value.credential);delete value.credential;const blob=new Blob([payload],{type:'application/json'});const url=URL.createObjectURL(blob);try{const link=document.createElement('a');link.href=url;link.download=`person-${target.id}-credential.json`;link.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}onComplete(copy.methodCredentialNotice);}
 else if(value.selfChanged){wakeSessionTabs('authorization_changed');endSession('authorization_changed');}
 else if(completion)onComplete(copy.methodCommitted);else{setNotice(copy.methodRequested);setRefresh(value=>value+1);}
 setConfirm(false);
 }catch{setError(committed?copy.credential_delivery_failed:copy.managementUnknown);}finally{onBusy(false);}}
 if(target.kind!=='person')return <p className="scope-note">{copy.methodAgentNote}</p>;
 return <section className="method-management"><h3>{copy.methodTitle}</h3><p>{copy.methodFeishu}: {target.hasFeishu?copy.managementActive:copy.methodMissing} · {copy.methodPassword}: {target.passwordEnabled?copy.managementActive:copy.methodMissing}</p><p className="scope-note">{copy.methodVerifyIntro}</p>
 {error&&<p role="alert" className="auth-message failed">{error}</p>}{notice&&<p role="status" className="auth-message">{notice}</p>}
 <label className="management-state">{copy.passwordUsername}<input value={username} disabled={blocked||!!target.passwordUsername} autoComplete="off" onChange={event=>{setUsername(event.target.value);setConfirm(false);}}/></label>
 <label className="management-option"><input type="checkbox" checked={confirm} disabled={blocked} onChange={event=>setConfirm(event.target.checked)}/><span>{copy.methodRequestConfirm}<br/>{copy.methodResetConfirm}</span></label>
 <div className="auth-actions">{target.passwordEnabled&&<button disabled={blocked||!confirm} onClick={()=>void mutate('/api/admin/login-links',{accountId:target.id,expectedVersion:target.authVersion,method:'feishu'})}>{copy.methodRequestFeishu}</button>}
 {target.hasFeishu&&!target.passwordEnabled&&<button disabled={blocked||!confirm||!username} onClick={()=>void mutate('/api/admin/login-links',{accountId:target.id,expectedVersion:target.authVersion,method:'password',username})}>{copy.methodRequestPassword}</button>}
 {target.passwordUsername&&target.id!==ownAccountId&&<button disabled={blocked||!confirm} onClick={()=>void mutate(`/api/admin/accounts/${target.id}/password-reset`,{expectedVersion:target.authVersion},true)}>{copy.methodReset}</button>}
 <button className="secondary-action" disabled={blocked||loading} onClick={()=>{setError('');setRefresh(value=>value+1);}}>{copy.methodRefresh}</button></div>
 {target.id===ownAccountId&&<p className="scope-note">{copy.methodSelfNote.replace('<ID>',target.id)}</p>}
 {requests.map(request=><article className="method-request" key={request.id}><p>{copy.methodRequestId}: {request.id} · {request.method==='password'?copy.methodPassword:copy.methodFeishu} · {label(request.status)}</p>{request.verifiedName&&<p>{copy.methodVerifiedName}: {request.verifiedName}</p>}{request.status==='verified'&&<button disabled={!confirm||blocked} onClick={()=>void mutate(`/api/admin/login-links/${request.id}/complete`,{},true)}>{copy.methodComplete}</button>}</article>)}
 </section>;
}
