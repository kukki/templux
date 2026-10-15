'use client';
import {useState} from 'react';import {useRouter} from 'next/navigation';
import {useEditor} from '../components/elements/use-editor';import FormField from '../components/elements/form-field';import {EditLink,useEditNavigation} from '../components/elements/edit-navigation';
import type {SaveResult} from '../../../../shared/editor.mjs';import copy from '../../../../config/examples-copy.json';import elementsCopy from '../../../../config/elements-copy.json';
const initial={name:'示例条目 A',note:''};
export default function FormDemo(){
 const [scenario,setScenario]=useState('success'),[saved,setSaved]=useState(initial);const router=useRouter(),{requestLeave}=useEditNavigation();
 const {editor,state}=useEditor({initial,normalize:values=>({...values,name:values.name.trim(),note:values.note.trim()}),validate:values=>({...(!values.name?{name:copy.requiredName}:values.name.length>80?{name:copy.longName}:{}),...(values.note.length>200?{note:copy.longNote}:{})}),failureMessage:elementsCopy.saveFailed});
 const save=async(values:Readonly<typeof initial>,signal:AbortSignal):Promise<SaveResult<typeof initial>>=>{
  const mode=scenario;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,mode==='slow'?1800:150);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
  if(mode==='fields')return {kind:'fields',errors:{name:copy.nameTaken}};
  if(mode==='form')return {kind:'error',message:copy.formFailure};
  if(mode==='forbidden')return {kind:'forbidden',message:copy.forbiddenSave};
  if(mode==='network')throw new TypeError('Synthetic unavailable transport');
  setSaved({...values});return {kind:'saved',values:{...values}};
 };
 return <section className="example-panel"><h2>{copy.formTitle}</h2><p className="scope-note">{copy.formNote}</p>
  <form className="ordinary-form" noValidate aria-label={copy.formTitle} aria-busy={state.saving} onSubmit={event=>{event.preventDefault();void editor.submit(save);}}>
   <FormField label={copy.formName} hint={copy.formNameHint} error={state.errors.name}>{attributes=><input {...attributes} name="sampleName" required value={state.values.name} onChange={event=>editor.change('name',event.target.value)} onBlur={()=>editor.blur('name')}/>}</FormField>
   <FormField label={copy.formNoteLabel} error={state.errors.note}>{attributes=><textarea {...attributes} name="sampleNote" value={state.values.note} onChange={event=>editor.change('note',event.target.value)} onBlur={()=>editor.blur('note')}/>}</FormField>
   <FormField label={copy.formScenario}>{attributes=><select {...attributes} name="saveScenario" value={scenario} onChange={event=>setScenario(event.target.value)}>{[['success',copy.saveSuccess],['fields',copy.saveFields],['form',copy.saveFormError],['forbidden',copy.saveForbidden],['network',copy.saveNetwork],['slow',copy.saveSlow]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}</FormField>
   {state.formError&&<p className="form-error" role="alert">{state.formError}</p>}
   <div className="form-actions"><button type="submit" disabled={state.saving}>{state.saving?copy.saving:copy.save}</button><button type="button" className="secondary-action" onClick={()=>requestLeave(()=>editor.reset())}>{copy.revert}</button></div>
   <p className="edit-status" role="status" data-dirty={state.dirty}>{state.status==='saved'?copy.saved:state.dirty?copy.dirty:copy.clean}</p>
  </form><div className="saved-preview"><strong>{copy.savedPreview}</strong><p>{saved.name}</p>{saved.note&&<p>{saved.note}</p>}</div>
  <div className="auth-actions"><EditLink className="text-link" href="/account">{copy.linkLeave}</EditLink><button type="button" className="secondary-action" onClick={()=>requestLeave(()=>router.push('/account'))}>{copy.routerLeave}</button></div>
 </section>;
}
