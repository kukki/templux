'use client';
import {useEffect,useId,useRef,useState} from 'react';
import './elements.css';
import {validateSearchFields,type SearchField} from '../../../../../shared/search.mjs';
import type {Presentation} from '../../../../../shared/presentation.mjs';
import copy from '../../../../../config/elements-copy.json';
export default function UnifiedSearch<Row>({fields,hint,settings,onApply,onIntent}:{fields:readonly SearchField<Row>[];hint:string;settings:Presentation['elements']['search'];onApply:(value:string)=>void;onIntent:()=>void}){
 validateSearchFields(fields);if(typeof hint!=='string'||!hint.trim()||typeof onApply!=='function'||typeof onIntent!=='function')throw new Error('搜索必须提供应用实现。');
 const [draft,setDraft]=useState('');const id=useId(),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),composing=useRef(false),lastComposition=useRef(-Infinity),apply=useRef(onApply);apply.current=onApply;
 if(!Number.isInteger(settings.delayMs)||settings.delayMs<1||settings.delayMs>1000||typeof settings.showButton!=='boolean')throw new Error('无效搜索延迟。');
 const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=undefined;};
 const trigger=(value:string)=>{cancel();apply.current(value);};
 const schedule=(value:string)=>{cancel();if(!composing.current)timer.current=setTimeout(()=>trigger(value),settings.delayMs);};
 const safeSubmit=()=>!composing.current&&performance.now()-lastComposition.current>100;
 useEffect(()=>cancel,[]);
 return <form role="search" className="unified-search" onSubmit={event=>{event.preventDefault();if(safeSubmit())trigger(draft);}}><label htmlFor={id}><span>{fields.map(field=>field.label).join(' / ')}</span><input id={id} type="search" name="query" value={draft} placeholder={hint} aria-label={fields.map(field=>field.label).join(' / ')} onChange={event=>{const value=event.target.value;onIntent();setDraft(value);if(!value&&!composing.current)trigger('');else schedule(value);}}
 onCompositionStart={()=>{onIntent();composing.current=true;cancel();}} onCompositionEnd={event=>{onIntent();composing.current=false;lastComposition.current=performance.now();const value=event.currentTarget.value;setDraft(value);schedule(value);}}
 onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing&&event.keyCode!==229&&safeSubmit()){event.preventDefault();trigger(draft);}}}/></label>
 {draft&&<button type="button" className="secondary-action" aria-label={copy.clear} onClick={()=>{onIntent();composing.current=false;setDraft('');trigger('');}}>{copy.clear}</button>}{settings.showButton&&<button type="submit">{copy.search}</button>}
 </form>;
}
