'use client';
import Pagination from './elements/pagination';
import LoginMethodManager from './login-method-manager';
import CopyButton from './elements/copy-button';
import elementsCopy from '../../../../config/elements-copy.json';
import { useEffect, useState } from 'react';
import type { AuthCopy } from './auth-copy';
import { endSession, sessionFetch, wakeSessionTabs } from './session-client';
type AccountRow = {id:string;name:string;state:'pending'|'active'|'disabled';kind:'person'|'agent';roles:string[];authVersion:string;hasFeishu:boolean;passwordUsername:string|null;passwordEnabled:boolean;responsiblePersonId:string|null;responsiblePersonName:string|null};
type Role = {label:string;permissions:string[];excludes?:string[]};
type Listing = {accounts:AccountRow[];roles:Record<string,Role>;total:number;page:number;pages:number;pageSize:number};
export default function AccountManager({copy,pagination,ownAccountId}:{copy:AuthCopy;ownAccountId:string;pagination:{pageSize:number;pageSizes:number[]}}) {
  const [data,setData]=useState<Listing|null>(null),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[state,setState]=useState(''),[kind,setKind]=useState('');
  const [page,setPage]=useState(1),[size,setSize]=useState(pagination.pageSize),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [target,setTarget]=useState<AccountRow|null>(null),[roles,setRoles]=useState<string[]>([]),[nextState,setNextState]=useState<'active'|'disabled'>('active'),[confirmed,setConfirmed]=useState(false),[authorizationBusy,setBusy]=useState(false);
  const [methodBusy,setMethodBusy]=useState(false);const busy=authorizationBusy||methodBusy;
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query);setPage(1);},400);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{
    let ignore=false;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6000);
    setLoading(true);setError('');
    const params=new URLSearchParams({q:search,page:String(page),pageSize:String(size)});if(state)params.set('state',state);if(kind)params.set('kind',kind);
    void (async()=>{try{const response=await sessionFetch(`/api/admin/accounts?${params}`,{signal:controller.signal});const value=await response.json();if(ignore)return;if(!response.ok){setError(value.error==='permission_denied'?copy.permission_denied:copy.sessionNetwork);return;}setData(value);}catch{if(!ignore)setError(copy.sessionNetwork);}finally{clearTimeout(timeout);if(!ignore)setLoading(false);}})();
    return()=>{ignore=true;clearTimeout(timeout);controller.abort();};
  },[search,page,size,state,kind,refresh,copy]);
  useEffect(()=>{if(target)document.getElementById('edit-title')?.focus();},[target]);
  const label=(value:AccountRow['state'])=>value==='pending'?copy.managementPending:value==='disabled'?copy.managementDisabled:copy.managementActive;
  function edit(account:AccountRow){setTarget(account);setRoles(account.roles);setNextState(account.state==='disabled'?'disabled':'active');setConfirmed(false);setNotice('');setError('');}
  const conflict=roles.some(role=>data?.roles[role]?.excludes?.some(other=>roles.includes(other)));
  async function save(){
    if(!target||busy||!confirmed||conflict)return;setBusy(true);setError('');setNotice('');
    // Do not retry a write automatically: network/COMMIT failure can have an uncertain outcome.
    try{
      const response=await sessionFetch(`/api/admin/accounts/${target.id}/authorization`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roles,state:nextState,expectedVersion:target.authVersion,confirm:true}),signal:AbortSignal.timeout(15000)});
      const value=await response.json();
      if(!response.ok){const key=value.error as keyof AuthCopy;setError(response.status>=500 ? (value.error==='management_save_failed'?copy.management_save_failed:copy.managementUnknown) : (copy[key]??copy.managementFailure));return;}
      if(value.ok!==true){setError(copy.managementUnknown);return;}
      if(value.selfChanged){wakeSessionTabs('authorization_changed');endSession('authorization_changed');return;}
      setNotice(copy.managementSaved);setTarget(null);setRefresh(value=>value+1);
    }catch{setError(copy.managementUnknown);}finally{setBusy(false);}
  }
  return <section className="account-management" aria-labelledby="management-title">
    <h2 id="management-title">{copy.managementTitle}</h2><p className="scope-note">{copy.managementIntro}</p>
    <div className="management-filters">
      <label className="management-search">{copy.managementSearch}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} disabled={busy}/></label>
      <label>{copy.managementState}<select value={state} disabled={busy} onChange={event=>{setState(event.target.value);setPage(1);}}><option value="">{copy.managementAll}</option><option value="pending">{copy.managementPending}</option><option value="active">{copy.managementActive}</option><option value="disabled">{copy.managementDisabled}</option></select></label>
      <label>{copy.accountKind}<select value={kind} disabled={busy} onChange={event=>{setKind(event.target.value);setPage(1);}}><option value="">{copy.managementAll}</option><option value="person">{copy.managementPerson}</option><option value="agent">{copy.managementAgent}</option></select></label>
    </div>
    {error&&<p role="alert" className="auth-message failed">{error}</p>}{notice&&<p role="status" className="auth-message ready">{notice}</p>}
    <button className="secondary-action" disabled={loading||busy} onClick={()=>{setTarget(null);setRefresh(value=>value+1);}}>{copy.managementRefresh}</button>
    {target&&<section className="management-editor" aria-labelledby="edit-title"><h3 id="edit-title" tabIndex={-1}>{copy.managementTarget}: {target.name} (#{target.id} <CopyButton value={target.id} label={elementsCopy.copyAccountId}/>)</h3><p>{copy.accountKind}: {target.kind==='agent'?copy.managementAgent:copy.managementPerson} · {label(target.state)}</p>
      <fieldset disabled={busy}><legend>{copy.accountRoles}</legend><p className="scope-note">{copy.managementRoleHint}</p>{Object.entries(data?.roles??{}).map(([key,role])=><label className="management-option" key={key}><input type="checkbox" checked={roles.includes(key)} onChange={event=>{setRoles(current=>event.target.checked?[...current,key]:current.filter(value=>value!==key));setConfirmed(false);}}/><span>{role.label} <small>({key})</small></span></label>)}</fieldset>
      {conflict&&<p className="failed" role="alert">{copy.role_conflict}</p>}
      <label className="management-state">{copy.managementState}<select disabled={busy} value={nextState} onChange={event=>{setNextState(event.target.value as 'active'|'disabled');setConfirmed(false);}}><option value="active">{copy.managementActive}</option><option value="disabled">{copy.managementDisabled}</option></select></label>
      <p className="auth-message">{copy.accountRoles}: {roles.length?roles.map(role=>data?.roles[role]?.label??role).join(', '):copy.managementZero} · {nextState==='active'?copy.managementActive:copy.managementDisabled}</p>
      <label className="management-option"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/><span>{copy.managementConfirm}</span></label>
      <div className="auth-actions"><button disabled={!confirmed||busy||conflict} onClick={()=>void save()}>{busy?copy.managementBusy:copy.managementSave}</button><button className="secondary-action" disabled={busy} onClick={()=>{setTarget(null);setError('');}}>{copy.managementCancel}</button></div>
    <LoginMethodManager key={target.id} target={target} ownAccountId={ownAccountId} copy={copy} blocked={busy} onBusy={setMethodBusy} onComplete={message=>{setNotice(message);setTarget(null);setRefresh(value=>value+1);}}/>
    </section>}
    {loading?<p role="status">{copy.managementLoading}</p>:!error&&data&&<>
      <p className="scope-note">{copy.managementTotal}: {data.total}</p>
      <div className="management-accounts">{data.accounts.length===0?<p>{copy.managementEmpty}</p>:data.accounts.map(account=><article className="management-account" key={account.id}>
        <div className="panel-heading"><h3>{account.name}</h3><span className="badge">{label(account.state)}</span></div>
        <dl><div><dt>{copy.accountId}</dt><dd>{account.id} <CopyButton value={account.id} label={elementsCopy.copyAccountId}/></dd></div><div><dt>{copy.accountKind}</dt><dd>{account.kind==='agent'?copy.managementAgent:copy.managementPerson}</dd></div><div><dt>{copy.managementOwner}</dt><dd>{account.kind==='agent'?`${account.responsiblePersonName??'—'} (#${account.responsiblePersonId})`:copy.managementNoOwner}</dd></div><div><dt>{copy.accountRoles}</dt><dd>{account.roles.length?account.roles.map(role=>data.roles[role]?.label??role).join(', '):copy.managementZero}</dd></div></dl>
        <button disabled={busy} onClick={()=>edit(account)} aria-label={`${copy.managementEdit} ${account.name}`}>{copy.managementEdit}</button>
      </article>)}</div>
      <Pagination state={{page:data.page,pageSize:size,sort:'base'}} total={data.total} settings={{...pagination,controls:{total:false,size:true,edges:true,pages:true,jump:true}}} disabled={busy} onChange={patch=>{if(patch.pageSize!==undefined)setSize(patch.pageSize);if(patch.page!==undefined)setPage(patch.page);}}/>
    </>}

  </section>;
}
