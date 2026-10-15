'use client';
import {createContext,useCallback,useContext,useEffect,useRef,type ReactNode,type ComponentProps} from 'react';
import Link from 'next/link';
import {sessionIsEnding} from '../session-client';
import copy from '../../../../../config/elements-copy.json';
type EditSource={getSnapshot:()=>{dirty:boolean;blocked?:boolean};subscribe:(listener:()=>void)=>()=>void;reset:()=>void;cancel:()=>void};
type Navigation={register:(source:EditSource)=>()=>void;requestLeave:(action:()=>void)=>boolean;requestDiscard:(source:EditSource,action:()=>void)=>boolean};
const Context=createContext<Navigation|null>(null);
function leavesEditDocument(href:string){const url=new URL(href,location.href);return ['http:','https:'].includes(url.protocol)&&!(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search);}
type LinkClick=Pick<MouseEvent,'defaultPrevented'|'button'|'metaKey'|'ctrlKey'|'shiftKey'|'altKey'>;
function sameWindowClick(anchor:HTMLAnchorElement,event:LinkClick){return !event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!anchor.hasAttribute('download')&&(!anchor.target||['_self','_top','_parent'].includes(anchor.target));}

export function EditNavigationProvider({children}:{children:ReactNode}){
 const sources=useRef(new Map<EditSource,()=>void>()),refresh=useRef(()=>{});
 const register=useCallback((source:EditSource)=>{const unsubscribe=source.subscribe(()=>refresh.current());sources.current.set(source,unsubscribe);refresh.current();return()=>{unsubscribe();sources.current.delete(source);refresh.current();};},[]);
 const discard=useCallback((targets:EditSource[],action:()=>void)=>{
  if(sessionIsEnding()||targets.some(source=>source.getSnapshot().blocked))return false;
  if(targets.some(source=>source.getSnapshot().dirty)){
   if(!window.confirm(copy.discardChanges))return false;
   for(const source of targets)source.reset();
  }
  action();return true;
 },[]);
 const requestLeave=useCallback((action:()=>void)=>discard([...sources.current.keys()],action),[discard]);
 const requestDiscard=useCallback((source:EditSource,action:()=>void)=>discard([source],action),[discard]);
 useEffect(()=>{
  let installed=false;
  const beforeUnload=(event:BeforeUnloadEvent)=>{if(sessionIsEnding())return;event.preventDefault();event.returnValue='';};
  const update=()=>{const dirty=!sessionIsEnding()&&[...sources.current.keys()].some(source=>source.getSnapshot().dirty);if(dirty&&!installed){window.addEventListener('beforeunload',beforeUnload);installed=true;}else if(!dirty&&installed){window.removeEventListener('beforeunload',beforeUnload);installed=false;}};
  refresh.current=update;update();
  const ending=()=>{for(const source of sources.current.keys())source.cancel();update();};
  // Native fallback runs after consumers. Next SPA clicks are already prevented and guarded by EditLink.
  const click=(event:MouseEvent)=>{
   if(sessionIsEnding())return;
   const anchor=event.target instanceof Element?event.target.closest('a[href]'):null;
   if(!(anchor instanceof HTMLAnchorElement)||!sameWindowClick(anchor,event))return;
   if(!leavesEditDocument(anchor.href))return;
   if(!requestLeave(()=>{})){event.preventDefault();event.stopPropagation();}
  };
  document.addEventListener('click',click);window.addEventListener('templux:session-ending',ending);
  return()=>{refresh.current=()=>{};window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('click',click);window.removeEventListener('templux:session-ending',ending);};
 },[requestLeave]);
 return <Context.Provider value={{register,requestLeave,requestDiscard}}>{children}</Context.Provider>;
}
export function useEditNavigation(){const value=useContext(Context);if(!value)throw new Error('EditNavigationProvider is required for editable routes');return value;}
/** Use for client-side Link navigation; imperative push/replace/back/forward must use requestLeave too. */
export function EditLink({onClick,onNavigate,...props}:ComponentProps<typeof Link>){
 const {requestLeave}=useEditNavigation(),destination=useRef<string|null>(null);
 // Read the rendered anchor so string, relative, object and decorated Next hrefs share browser resolution.
 return <Link {...props} onClick={event=>{
  const anchor=event.currentTarget;destination.current=anchor.href;onClick?.(event);
  // Next performs external replace before bubbling and never emits onNavigate for it.
  if(props.replace&&sameWindowClick(anchor,event)&&(!anchor.target||anchor.target==='_self')&&new URL(anchor.href).origin!==location.origin&&leavesEditDocument(anchor.href)&&!requestLeave(()=>{}))event.preventDefault();
 }} onNavigate={event=>{
  if(sessionIsEnding()){event.preventDefault();return;}
  let cancelled=false;onNavigate?.({preventDefault:()=>{cancelled=true;event.preventDefault();}});
  if(!cancelled&&(destination.current===null||leavesEditDocument(destination.current))&&!requestLeave(()=>{}))event.preventDefault();
 }}/>;
}
