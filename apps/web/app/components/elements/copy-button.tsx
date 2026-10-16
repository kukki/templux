'use client';
import {useEffect,useId,useMemo,useSyncExternalStore} from 'react';
import {createCopyFeedback,resolveCopyMessages,type CopyMessages,type CopySettings,type CopyWriter} from '../../../../../shared/copy.mjs';
import defaults from '../../../../../shared/default-presentation.json';import copy from '../../../../../config/elements-copy.json';import {sessionIsEnding} from '../session-client';import {writeClipboard} from './clipboard';import './copy-button.css';
const defaultMessages={action:copy.copyAction,pending:copy.copyPending,succeeded:copy.copySucceeded,retry:copy.copyRetry,empty:copy.copyEmpty,denied:copy.copyDenied,unsupported:copy.copyUnsupported,failed:copy.copyFailed};
export type CopyButtonProps={value:string|null|undefined;label:string;settings?:CopySettings;write?:CopyWriter;messages?:Partial<CopyMessages>};
export default function CopyButton({value,label,settings,write=writeClipboard,messages}:CopyButtonProps){
 const text=resolveCopyMessages(defaultMessages,messages);
 const options=settings===undefined?defaults.elements.copy:settings;if(!options||typeof options!=='object')throw new Error('Invalid copy control configuration');const {feedbackMs,emptyMode}=options;
 if(emptyMode!=='hide'&&emptyMode!=='disable')throw new Error('Invalid copy control configuration');
 const store=useMemo(()=>createCopyFeedback({value,label,feedbackMs,emptyMode,write}),[value,label,feedbackMs,emptyMode,write]),state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot),messageId=useId();
 useEffect(()=>{const end=()=>store.end();window.addEventListener('templux:session-ending',end);if(sessionIsEnding())end();return()=>{window.removeEventListener('templux:session-ending',end);store.invalidate();};},[store]);
 if(state.ended||sessionIsEnding()||state.hidden)return null;
 const message=state.empty?text.empty:state.status==='denied'?text.denied:state.status==='unsupported'?text.unsupported:state.status==='failed'?text.failed:state.status==='copied'?text.succeeded:state.status==='pending'?text.pending:'',failed=['denied','unsupported','failed'].includes(state.status);
 return <span className="copy-control" data-copy-state={state.status}><button type="button" className="secondary-action copy-button" aria-label={label} aria-describedby={messageId} aria-busy={state.status==='pending'} disabled={state.empty||state.status==='pending'} title={message||label} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();}} onClick={event=>{event.preventDefault();event.stopPropagation();if(!sessionIsEnding())store.copy();}}>{state.status==='copied'?<svg className="copy-button-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>:state.status==='pending'?text.pending:failed?text.retry:text.action}</button><span id={messageId} className={`copy-feedback${failed?' copy-feedback-error':''}`} role="status" aria-live="polite" aria-atomic="true">{message}</span></span>;
}
