'use client';
import {useState} from 'react';
import {freshSamples} from './data';import SearchDemo from './search-demo';
import type {Presentation} from '../../../../shared/presentation.mjs';
import copy from '../../../../config/examples-copy.json';
export default function ExampleLab({elements}:{elements:Presentation['elements']}){
 const [rows,setRows]=useState(freshSamples),[name,setName]=useState(()=>freshSamples()[0]!.name),[density,setDensity]=useState('standard'),[notice,setNotice]=useState(''),[searchReset,setSearchReset]=useState(0);
 const reset=()=>{setRows(freshSamples());setName(freshSamples()[0]!.name);setDensity('standard');setNotice(copy.restored);setSearchReset(value=>value+1);};
 return <div className="example-lab"><div className="example-toolbar"><span className="example-badge">{copy.badge}</span><button type="button" className="secondary-action" onClick={reset}>{copy.reset}</button></div>
  <div className="example-columns"><section className="example-panel"><h2>{copy.sampleTitle}</h2><p className="scope-note">{copy.sampleNote}</p>
   <form className="example-form" onSubmit={event=>{event.preventDefault();if(!name.trim()){setNotice(copy.blank);return;}setRows(current=>current.map((row,index)=>index===0?{...row,name}:row));setNotice(copy.updated);}}>
    <label>{copy.name}<input name="sampleName" value={name} required maxLength={80} onChange={event=>setName(event.target.value)}/></label>
    <button type="submit">{copy.apply}</button></form>
   <label className="example-density">{copy.density}<select value={density} onChange={event=>setDensity(event.target.value)}><option value="standard">{copy.standard}</option><option value="compact">{copy.compact}</option></select></label>
   <ul className={'example-rows '+density}>{rows.map(row=><li key={row.id}>{row.name}</li>)}</ul><p role="status" className="example-notice">{notice}</p>
  </section><section className="example-panel"><h2>{copy.defaultsTitle}</h2><dl className="example-defaults"><div><dt>{copy.pageSize}</dt><dd>{elements.pagination.pageSize}</dd></div><div><dt>{copy.pageSizes}</dt><dd>{elements.pagination.pageSizes.join(' / ')}</dd></div><div><dt>{copy.duration}</dt><dd>{elements.notifications.durationMs/1000}</dd></div><div><dt>{copy.visible}</dt><dd>{elements.notifications.desktopVisible} / {elements.notifications.narrowVisible}</dd></div></dl><p className="scope-note">{copy.defaultsNote}</p></section></div>
 <SearchDemo key={searchReset} settings={elements.search} multiselect={elements.multiselect} pagination={elements.pagination}/></div>;
}
