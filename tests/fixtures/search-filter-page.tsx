'use client';
// Isolated component harness, mounted into a test container only. No authentication or business route is shipped.
import {useCallback,useRef,useState} from 'react';
import SearchList from '../components/elements/search-list';
import ListMultiSelect from '../components/elements/list-multi-select';
import {containsFields} from '../../../../shared/search.mjs';
import type {ListResult,SearchRequest} from '../../../../shared/latest-query.mjs';
type Row={id:string;name:string;category:string};
const fields=[{key:'name',label:'名称',read:(row:Row)=>row.name}],columns=[{key:'name',label:'名称',render:(row:Row)=>row.name}],options=[{value:'display',label:'展示'},{value:'test',label:'测试'}],rowKey=(row:Row)=>row.id;
type Call={id:number;term:string;selected:readonly string[];time:number};
export default function ComponentHarness(){
 const [selected,setSelected]=useState<readonly string[]>(options.map(o=>o.value)),[calls,setCalls]=useState<Call[]>([]),nextId=useRef(0),pending=useRef(new Map<number,{resolve:(result:ListResult<Row>)=>void;reject:()=>void;selected:readonly string[]}>());
 const load=useCallback(({term}:SearchRequest):Promise<ListResult<Row>>=>{const id=++nextId.current;setCalls(previous=>[...previous,{id,term,selected,time:performance.now()}]);return new Promise((resolve,reject)=>{pending.current.set(id,{resolve,reject:()=>reject(new Error('controlled failure')),selected});});},[selected]);
 const finish=(id:number,fail=false)=>{const request=pending.current.get(id);if(!request)return;pending.current.delete(id);if(fail)request.reject();else request.resolve({status:'success',rows:request.selected.includes('display')?[{id:'sample',name:'Alpha',category:'display'}]:[]});};
 return <main style={{padding:'2rem'}}><h1>隔离组件测试</h1><output aria-label="load calls">{JSON.stringify(calls)}</output><div>{calls.map(call=><span key={call.id}><button type="button" onClick={()=>finish(call.id)}>成功 {call.id}</button><button type="button" onClick={()=>finish(call.id,true)}>失败 {call.id}</button></span>)}</div>
 <SearchList fields={fields} matches={containsFields} load={load} columns={columns} rowKey={rowKey} caption="组件结果" hint="名称" settings={{delayMs:400,showButton:false}} renderFilters={events=><ListMultiSelect label="分类" options={options} settings={{delayMs:1000}} onIntent={events.onIntent} onApply={values=>{setSelected(values);events.onApply();}}/>}/></main>;
}
