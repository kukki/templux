'use client';
import {useEffect,useRef,useState} from 'react';import MultiSelect from './multi-select';import type {SelectOption} from '../../../../../shared/multiselect.mjs';import type {Presentation} from '../../../../../shared/presentation.mjs';
export default function ListMultiSelect({label,options,settings,onApply,onIntent}:{label:string;options:readonly SelectOption[];settings:Presentation['elements']['multiselect'];onApply:(values:readonly string[])=>void;onIntent:()=>void}){
 if(!Number.isInteger(settings.delayMs)||settings.delayMs<1||settings.delayMs>1000)throw new Error('无效多选筛选延迟。');
 const [values,setValues]=useState(()=>options.map(o=>o.value)),latest=useRef(values),dirty=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),apply=useRef(onApply);apply.current=onApply;
 const cancel=()=>{clearTimeout(timer.current);timer.current=undefined;};const flush=()=>{cancel();if(dirty.current){dirty.current=false;apply.current(latest.current);}};
 useEffect(()=>cancel,[]);
 const change=(next:string[])=>{onIntent();latest.current=next;setValues(next);dirty.current=true;cancel();timer.current=setTimeout(flush,settings.delayMs);};
 return <MultiSelect label={label} options={options} values={values} onChange={change} onClose={flush}/>;
}
