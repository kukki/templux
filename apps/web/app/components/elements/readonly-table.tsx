import './elements.css';
import type {ReactNode} from 'react';import type {ListState} from '../../../../../shared/latest-query.mjs';import copy from '../../../../../config/elements-copy.json';
export type ReadonlyColumn<Row>={key:string;label:string;render:(row:Row)=>ReactNode};
export default function ReadonlyTable<Row>({columns,rowKey,state,caption}:{columns:readonly ReadonlyColumn<Row>[];rowKey:(row:Row)=>string;state:ListState<Row>;caption:string}){
 if(typeof rowKey!=='function'||!columns.length||columns.some(column=>!column.key?.trim()||!column.label?.trim()||typeof column.render!=='function')||new Set(columns.map(c=>c.key)).size!==columns.length)throw new Error('只读列表必须提供唯一列及显示实现。');
 const message=state.status==='waiting'?[copy.waitingTitle,copy.waitingBody]:state.status==='loading'?[copy.loadingTitle,copy.loadingBody]:state.status==='error'?[copy.errorTitle,copy.errorBody]:state.status==='forbidden'?[copy.forbiddenTitle,copy.forbiddenBody]:[copy.emptyTitle,copy.emptyBody];
 return <div className="readonly-list-scroll" tabIndex={0} role="region" aria-label={copy.scroll}><table className="readonly-list-table" aria-busy={state.status==='loading'}><caption>{caption}</caption><thead><tr>{columns.map(column=><th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>
 {state.status==='success'&&state.rows.length?state.rows.map(row=><tr key={rowKey(row)}>{columns.map(column=><td key={column.key}>{column.render(row)}</td>)}</tr>):<tr><td colSpan={columns.length}><div className="list-message" role={state.status==='error'||state.status==='forbidden'?'alert':'status'}><strong>{message[0]}</strong><p>{message[1]}</p></div></td></tr>}
 </tbody></table></div>;
}
