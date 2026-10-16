'use client';
import {useId,useLayoutEffect,useRef,useState} from 'react';
import {validateOptions,matchingOptions,selectMatching,type SelectOption} from '../../../../../shared/multiselect.mjs';
import copy from '../../../../../config/elements-copy.json';import './elements.css';
export default function MultiSelect({label,options,values,onChange,onClose}:{label:string;options:readonly SelectOption[];values:readonly string[];onChange:(values:string[])=>void;onClose?:()=>void}){
 validateOptions(options,values);if(!label.trim()||typeof onChange!=='function')throw new Error('多选必须提供名称与变更实现。');
 const id=useId(),button=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null),all=useRef<HTMLInputElement>(null),closeCallback=useRef(onClose);
 closeCallback.current=onClose;
 const [open,setOpen]=useState(false),[term,setTerm]=useState('');const visible=matchingOptions(options,term),selected=new Set(values),count=visible.filter(o=>selected.has(o.value)).length;
 useLayoutEffect(()=>{if(all.current)all.current.indeterminate=count>0&&count<visible.length;},[count,visible.length,open]);
 useLayoutEffect(()=>{
  if(!open)return;const element=popup.current!,trigger=button.current!;
  const position=()=>{const r=trigger.getBoundingClientRect(),viewport=window.visualViewport,width=Math.min(352,(viewport?.width??innerWidth)-24),leftBound=viewport?.offsetLeft??0,topBound=viewport?.offsetTop??0,height=viewport?.height??innerHeight;
   const below=topBound+height-r.bottom-12,above=r.top-topBound-12,useBelow=below>=Math.min(260,above),available=Math.max(80,useBelow?below:above);
   element.style.width=width+'px';element.style.maxHeight=available+'px';element.style.left=Math.max(leftBound+12,Math.min(r.left,leftBound+(viewport?.width??innerWidth)-width-12))+'px';element.style.top=(useBelow?r.bottom+6:Math.max(topBound+6,r.top-Math.min(element.scrollHeight,available)-6))+'px';
  };
  position();search.current?.focus();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);};
 },[open]);
 const summary=values.length===options.length?copy.allSelected:values.length===0?copy.noneSelected:copy.selected+' '+values.length+' / '+options.length;
 return <div className="multi-select" onBlur={event=>{if(!open)return;const next=event.relatedTarget;if(!(next instanceof Node)||event.currentTarget.contains(next)||next.contains(event.currentTarget))return;popup.current?.hidePopover();}}>
  <button type="button" className="secondary-action multi-select-trigger" ref={button} popoverTarget={id} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}><span>{label}</span><span>{summary}</span></button>
  <div id={id} ref={popup} popover="auto" role="dialog" aria-label={label} className="multi-select-popup" onKeyDown={event=>{if(event.key==='Escape'&&!event.nativeEvent.isComposing){event.preventDefault();event.stopPropagation();popup.current?.hidePopover();button.current?.focus();}}} onToggle={event=>{const isOpen=event.newState==='open';setOpen(isOpen);if(!isOpen){setTerm('');closeCallback.current?.();}}}>
   <div className="multi-select-heading"><strong>{label}</strong><button type="button" className="secondary-action" aria-label={copy.closeOptions} onClick={()=>{popup.current?.hidePopover();button.current?.focus();}}>×</button></div>
   <label className="multi-select-search">{copy.optionSearch}<input ref={search} type="search" value={term} onChange={event=>setTerm(event.target.value)}/></label>
   <label className="multi-select-row multi-select-all"><input ref={all} type="checkbox" checked={visible.length>0&&count===visible.length} disabled={!visible.length} onChange={event=>onChange(selectMatching(options,values,visible,event.target.checked))}/><span>{copy.selectCurrent}</span></label>
   <div className="multi-select-options">{visible.map(option=><label className="multi-select-row" key={option.value}><input type="checkbox" value={option.value} checked={selected.has(option.value)} onChange={event=>onChange(selectMatching(options,values,[option],event.target.checked))}/><span>{option.label}</span></label>)}{!visible.length&&<p role="status">{copy.noOptions}</p>}</div>
  </div>
 </div>;
}
