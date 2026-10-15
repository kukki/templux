'use client';
import {useState} from 'react';
import SearchDemo from './search-demo';import FormDemo from './form-demo';import {useEditNavigation} from '../components/elements/edit-navigation';
import type {Presentation} from '../../../../shared/presentation.mjs';
import copy from '../../../../config/examples-copy.json';
export default function ExampleLab({elements}:{elements:Presentation['elements']}){
 const [searchReset,setSearchReset]=useState(0);const {requestLeave}=useEditNavigation();
 const reset=()=>requestLeave(()=>setSearchReset(value=>value+1));
 return <div className="example-lab"><div className="example-toolbar"><span className="example-badge">{copy.badge}</span><button type="button" className="secondary-action" onClick={reset}>{copy.reset}</button></div>
  <div className="example-columns"><FormDemo key={searchReset}/><section className="example-panel"><h2>{copy.defaultsTitle}</h2><dl className="example-defaults"><div><dt>{copy.pageSize}</dt><dd>{elements.pagination.pageSize}</dd></div><div><dt>{copy.pageSizes}</dt><dd>{elements.pagination.pageSizes.join(' / ')}</dd></div><div><dt>{copy.duration}</dt><dd>{elements.notifications.durationMs/1000}</dd></div><div><dt>{copy.visible}</dt><dd>{elements.notifications.desktopVisible} / {elements.notifications.narrowVisible}</dd></div></dl><p className="scope-note">{copy.defaultsNote}</p></section></div>
 <SearchDemo key={searchReset} settings={elements.search} multiselect={elements.multiselect} pagination={elements.pagination}/></div>;
}
