'use client';
import {createContext,useCallback,useContext,useEffect,useRef,type ReactNode,type ComponentProps} from 'react';
import Link from 'next/link';
import {sessionIsEnding} from '../session-client';
import copy from '../../../../../config/elements-copy.json';
type EditSource={getSnapshot:()=>{dirty:boolean};subscribe:(listener:()=>void)=>()=>void;reset:()=>void;cancel:()=>void};
type Navigation={register:(source:EditSource)=>()=>void;requestLeave:(action:()=>void)=>boolean};
const Context=createContext<Navigation|null>(null);
function leavesEditDocument(href:string){const url=new URL(href,location.href);return ['http:','https:'].includes(url.protocol)&&!(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search);}
export function EditNavigationProvider({children}:{children:ReactNode}){
 const sources=useRef(new Map<EditSource,()=>void>()),refresh=useRef(()=>{});
 const register=useCallback((source:EditSource)=>{const unsubscribe=source.subscribe(()=>refresh.current());sources.current.set(source,unsubscribe);refresh.current();return()=>{unsubscribe();sources.current.delete(source);refresh.current();};},[]);
 const requestLeave=useCallback((action:()=>void)=>{
  if(sessionIsEnding())return false;
  if([...sources.current.keys()].some(source=>source.getSnapshot().dirty)){
   if(!window.confirm(copy.discardChanges))return false;
   for(const source of sources.current.keys())source.reset();
  }
  action();return true;
 },[]);
 useEffect(()=>{
  let installed=false;
  const beforeUnload=(event:BeforeUnloadEvent)=>{if(sessionIsEnding())return;event.preventDefault();event.returnValue='';};
  const update=()=>{const dirty=!sessionIsEnding()&&[...sources.current.keys()].some(source=>source.getSnapshot().dirty);if(dirty&&!installed){window.addEventListener('beforeunload',beforeUnload);installed=true;}else if(!dirty&&installed){window.removeEventListener('beforeunload',beforeUnload);installed=false;}};
  refresh.current=update;update();
  const ending=()=>{for(const source of sources.current.keys())source.cancel();update();};
  // Capture covers ordinary anchors and Next Link before its client handler. New tabs/downloads do not leave this editor.
  const click=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||sessionIsEnding())return;
   const anchor=event.target instanceof Element?event.target.closest('a[href]'):null;
   if(!(anchor instanceof HTMLAnchorElement)||anchor.hasAttribute('download')||(anchor.target&&!['_self','_top','_parent'].includes(anchor.target)))return;
   if(!leavesEditDocument(anchor.href))return;
   if(!requestLeave(()=>{})){event.preventDefault();event.stopPropagation();}
  };
  document.addEventListener('click',click,true);window.addEventListener('templux:session-ending',ending);
  return()=>{refresh.current=()=>{};window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('click',click,true);window.removeEventListener('templux:session-ending',ending);};
 },[requestLeave]);
 return <Context.Provider value={{register,requestLeave}}>{children}</Context.Provider>;
}
export function useEditNavigation(){const value=useContext(Context);if(!value)throw new Error('EditNavigationProvider is required for editable routes');return value;}
/** Use for client-side Link navigation; imperative push/replace/back/forward must use requestLeave too. */
export function EditLink({onClick,onNavigate,...props}:ComponentProps<typeof Link>){
 const {requestLeave}=useEditNavigation(),destination=useRef<string|null>(null);
 // Read the rendered anchor so string, relative, object and decorated Next hrefs share browser resolution.
 return <Link {...props} onClick={event=>{destination.current=event.currentTarget.href;onClick?.(event);}} onNavigate={event=>{if(sessionIsEnding()||((destination.current===null||leavesEditDocument(destination.current))&&!requestLeave(()=>{})))event.preventDefault();else onNavigate?.(event);}}/>;
}
