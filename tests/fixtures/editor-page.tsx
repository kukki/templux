'use client';
// Mounted only into an isolated test Web container. Never part of the shipped route tree.
import {useRef,useState} from 'react';import {useRouter} from 'next/navigation';
import {EditNavigationProvider,EditLink,useEditNavigation} from '../components/elements/edit-navigation';import {useEditor} from '../components/elements/use-editor';import FormField from '../components/elements/form-field';import type {SaveResult} from '../../../../shared/editor.mjs';
function Harness(){
 const [mounted,setMounted]=useState(true);const {requestLeave}=useEditNavigation(),router=useRouter();
 return <main><h1>隔离表单组件</h1><button onClick={()=>setMounted(value=>!value)}>挂载切换</button>{mounted&&<Editor/>}<EditLink href="/account">Next Link 离开</EditLink><button onClick={()=>requestLeave(()=>router.push('/account'))}>router 离开</button><button onClick={()=>requestLeave(()=>router.back())}>guarded back</button><button onClick={()=>requestLeave(()=>router.forward())}>guarded forward</button></main>;
}
function Editor(){
 const {editor,state}=useEditor({initial:{name:'Alpha',note:''},normalize:v=>({...v,name:v.name.trim()}),validate:v=>v.name?{}:{name:'Required'},failureMessage:'Unavailable'});
 const [calls,setCalls]=useState<number[]>([]),next=useRef(0),pending=useRef(new Map<number,(value:SaveResult<{name:string;note:string}>)=>void>());
 return <><form noValidate aria-label="fixture" onSubmit={event=>{event.preventDefault();void editor.submit(()=>new Promise(resolve=>{const id=++next.current;pending.current.set(id,resolve);setCalls(previous=>[...previous,id]);}));}}><FormField label="Name" error={state.errors.name}>{attributes=><input {...attributes} name="fixtureName" value={state.values.name} onChange={event=>editor.change('name',event.target.value)} onBlur={()=>editor.blur('name')}/>}</FormField><button disabled={state.saving}>Submit</button><button type="button" onClick={()=>editor.reset()}>Reset</button><p role="alert">{state.formError}</p></form><output aria-label="editor state">{JSON.stringify(state)}</output><output aria-label="save calls">{JSON.stringify(calls)}</output>{calls.map(id=><span key={id}><button onClick={()=>pending.current.get(id)?.({kind:'saved',values:{name:'Beta',note:''}})}>Resolve {id}</button><button onClick={()=>pending.current.get(id)?.({kind:'fields',errors:{name:'Taken'}})}>Fields {id}</button><button onClick={()=>pending.current.get(id)?.({kind:'error',message:'Rejected'})}>Reject {id}</button></span>)}</>;
}
export default function Page(){return <EditNavigationProvider><Harness/></EditNavigationProvider>;}
