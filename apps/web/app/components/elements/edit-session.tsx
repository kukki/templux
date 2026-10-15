'use client';
import {useEffect,useId,useRef,useState,type ReactNode,type KeyboardEvent} from 'react';
import type {Editor,EditorOptions,EditorSnapshot,Save,Values,Verification} from '../../../../../shared/editor.mjs';
import {useEditor} from './use-editor';import {useEditNavigation} from './edit-navigation';import {sessionIsEnding} from '../session-client';import copy from '../../../../../config/elements-copy.json';import './edit.css';
export type EditFields<T extends Values>=(context:{editor:Editor<T>;state:EditorSnapshot<T>})=>ReactNode;
export type EditSessionProps<T extends Values>={targetKey:string;title:string;options:EditorOptions<T>;fields:EditFields<T>;save:Save<T>;verify?:(receipt:NonNullable<EditorSnapshot<T>['uncertain']>,signal:AbortSignal)=>Promise<Verification<T>>;onCommit:(values:T)=>void;onClose:()=>void;conflict?:boolean;returnFocus?:HTMLElement|null};
export default function EditSession<T extends Values>(props:EditSessionProps<T>&{modal?:boolean}){
 const [frozen]=useState(()=>props),{editor,state}=useEditor({...frozen.options,timeoutMs:frozen.options.timeoutMs??30000,timeoutMessage:frozen.options.timeoutMessage??copy.unconfirmedEdit,lockWhileSaving:true});
 const {requestDiscard}=useEditNavigation(),dialog=useRef<HTMLDialogElement>(null),form=useRef<HTMLFormElement>(null),title=useRef<HTMLHeadingElement>(null),alive=useRef(false),verifyAbort=useRef<AbortController|null>(null),[verifying,setVerifying]=useState(false),[notice,setNotice]=useState(''),[focusRequest,setFocusRequest]=useState(0),heading=useId();
 const conflict=props.conflict||props.targetKey!==frozen.targetKey,latestConflict=useRef(conflict);latestConflict.current=conflict;
 const finish=()=>{dialog.current?.close();props.onClose();};
 const close=()=>{if(editor.getSnapshot().blocked)return;requestDiscard(editor,finish);};
 useEffect(()=>{
  alive.current=true;const origin=frozen.returnFocus??(document.activeElement instanceof HTMLElement?document.activeElement:null),node=dialog.current;
  if(frozen.modal)node?.showModal();form.current?.querySelector<HTMLElement>('input,select,textarea')?.focus();
  const ending=()=>{editor.cancel();verifyAbort.current?.abort();node?.close();};window.addEventListener('templux:session-ending',ending);
  return()=>{alive.current=false;verifyAbort.current?.abort();window.removeEventListener('templux:session-ending',ending);node?.close();if(!sessionIsEnding()&&origin?.isConnected)origin.focus();};
 },[editor,frozen.modal]);
 useEffect(()=>{if(focusRequest&&alive.current&&!sessionIsEnding())form.current?.querySelector<HTMLElement>('[aria-invalid="true"],.form-error')?.focus();},[focusRequest]);
 const focusError=()=>setFocusRequest(value=>value+1);
 useEffect(()=>{if(frozen.modal&&state.saving&&dialog.current?.open)title.current?.focus();},[frozen.modal,state.saving]);
 const trapFocus=(event:KeyboardEvent<HTMLDialogElement>)=>{if(event.key!=='Tab'||event.defaultPrevented||sessionIsEnding())return;const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href],[tabindex]')].filter(node=>node.tabIndex>=0&&!node.matches(':disabled')&&node.getClientRects().length>0);const first=controls[0],last=controls.at(-1),active=document.activeElement;if(!first||(!event.shiftKey&&active===last)||(event.shiftKey&&active===first)||!controls.includes(active as HTMLElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();if(!first)title.current?.focus();}};

 const submit=async()=>{
  if(conflict||sessionIsEnding())return;
  const result=await editor.submit(async(values,signal,attempt)=>{const outcome=await frozen.save(values,signal,attempt);return latestConflict.current?{kind:'unconfirmed',message:copy.sourceChangedEdit}:outcome;});if(!alive.current||sessionIsEnding())return;
  if(result?.kind==='saved'){frozen.onCommit(result.values);if(!editor.getSnapshot().dirty)finish();}else focusError();
 };
 const verify=async()=>{
  const receipt=editor.getSnapshot().uncertain;if(!receipt||verifyAbort.current||conflict||!frozen.verify||sessionIsEnding())return;
  const controller=new AbortController();verifyAbort.current=controller;setVerifying(true);setNotice('');
  try{const result=await frozen.verify(receipt,controller.signal);if(!alive.current||controller.signal.aborted||sessionIsEnding())return;if(latestConflict.current){setNotice(copy.sourceChangedEdit);return;}
   if(result.kind==='unknown'){setNotice(copy.unknownEdit);return;}
   if(editor.reconcile(receipt.attemptId,result)){if(result.kind==='saved'){frozen.onCommit(result.values);if(!editor.getSnapshot().dirty)finish();}else setNotice(copy.notAppliedEdit);}
  }catch{if(alive.current&&!controller.signal.aborted)setNotice(copy.unknownEdit);}finally{if(verifyAbort.current===controller)verifyAbort.current=null;if(alive.current)setVerifying(false);}
 };
 const content=<><div className="edit-heading"><h2 id={heading} ref={title} tabIndex={-1}>{props.title}</h2>{frozen.modal&&<button type="button" className="secondary-action" aria-label={copy.closeEdit} disabled={state.saving} onClick={close}>×</button>}</div>
 <form ref={form} className="ordinary-form edit-form" noValidate aria-busy={state.saving} onSubmit={event=>{event.preventDefault();void submit();}}>
  <fieldset disabled={state.saving}>{frozen.fields({editor,state})}</fieldset>
  {conflict&&<p className="form-error" role="alert" tabIndex={-1}>{copy.sourceChangedEdit}</p>}
  {state.formError&&(!conflict||state.formError!==copy.sourceChangedEdit)&&<p className="form-error" role="alert" tabIndex={-1}>{state.formError}</p>}
  <p className="edit-status" role="status">{state.saving?copy.savingEdit:state.uncertain?(notice||copy.unconfirmedEdit):notice||(state.dirty?copy.unsavedEdit:'')}</p>
  <div className="form-actions"><button type="submit" disabled={state.saving||!!state.uncertain||!!conflict}>{copy.saveEdit}</button><button type="button" className="secondary-action" disabled={state.saving} onClick={close}>{copy.cancelEdit}</button>{state.uncertain&&frozen.verify&&<button type="button" className="secondary-action" disabled={verifying||!!conflict} onClick={()=>void verify()}>{verifying?copy.verifyingEdit:copy.verifyEdit}</button>}</div>
 </form></>;
 return frozen.modal?<dialog className="edit-dialog" ref={dialog} aria-labelledby={heading} onKeyDown={trapFocus} onCancel={event=>{event.preventDefault();close();}}>{content}</dialog>:<section className="inline-edit-session" aria-labelledby={heading}>{content}</section>;
}
export function EditDialog<T extends Values>(props:EditSessionProps<T>){return <EditSession {...props} modal/>;}
