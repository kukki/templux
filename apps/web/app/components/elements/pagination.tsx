'use client';
import {pageNumbers, validatePagination, type ListViewState} from '../../../../../shared/list-state.mjs';
import type {Presentation} from '../../../../../shared/presentation.mjs';
import copy from '../../../../../config/elements-copy.json';
import './elements.css';

export default function Pagination({state, total, settings, onChange, disabled = false}: {
  state: ListViewState;
  total: number | null;
  settings: Presentation['elements']['pagination'];
  onChange: (patch: Partial<ListViewState>) => void;
  disabled?: boolean;
}) {
  validatePagination(settings);
  if ((total !== null && (!Number.isSafeInteger(total) || total < 0)) || !Number.isSafeInteger(state.page) || state.page < 1 || !settings.pageSizes.includes(state.pageSize)) throw new Error('无效分页状态。');
  const pages = total === null ? null : Math.max(1, Math.ceil(total / state.pageSize));
  const {controls} = settings;
  const navigationDisabled = disabled || pages === null;
  const previous = () => <button type="button" disabled={navigationDisabled || state.page <= 1} onClick={() => onChange({page: state.page - 1})}>{copy.previousPage}</button>;
  const next = () => <button type="button" disabled={navigationDisabled || state.page >= (pages ?? 1)} onClick={() => onChange({page: state.page + 1})}>{copy.nextPage}</button>;
  const position = () => <span className="pagination-position" aria-live="polite">{copy.page} {state.page} / {pages ?? '—'} {copy.pageUnit}</span>;
  const buttons = () => <div className="pagination-buttons-scroll" tabIndex={0} role="group" aria-label={copy.pagination}>
    <div className="pagination-button-group">
      {controls.edges && <button type="button" disabled={navigationDisabled || state.page <= 1} onClick={() => onChange({page: 1})}>{copy.firstPage}</button>}
      {previous()}
      {controls.pages && pages !== null && pageNumbers(pages, state.page).map(page => <button type="button" key={page} aria-label={copy.page + page + copy.pageUnit} aria-current={page === state.page ? 'page' : undefined} disabled={disabled || page === state.page} onClick={() => onChange({page})}>{page}</button>)}
      {next()}
      {controls.edges && <button type="button" disabled={navigationDisabled || state.page >= (pages ?? 1)} onClick={() => onChange({page: pages ?? 1})}>{copy.lastPage}</button>}
    </div>
  </div>;
  const count = () => controls.total && <p className="pagination-count">{total === null ? copy.unknownTotal : <>{copy.total} {total} {copy.records} · {copy.range} {total ? ((state.page - 1) * state.pageSize + 1) : 0}–{Math.min(state.page * state.pageSize, total)}</>}</p>;
  const options = () => <>
    {controls.size && <label className="pagination-size">{copy.pageSize}<select disabled={disabled} value={state.pageSize} onChange={event => onChange({page: 1, pageSize: Number(event.target.value)})}>{settings.pageSizes.map(size => <option key={size} value={size}>{size}</option>)}</select></label>}
    {controls.jump && <label className="pagination-jump">{copy.jumpPage}<select value={pages === null ? '' : state.page} disabled={navigationDisabled} onChange={event => onChange({page: Number(event.target.value)})}>{pages === null ? <option value="">—</option> : Array.from({length: pages}, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>}
  </>;
  return <nav className="list-pagination" aria-label={copy.pagination}>
    {controls.total && <div className="pagination-desktop pagination-total">{count()}</div>}
    <div className="pagination-desktop pagination-options">{options()}</div>
    <div className="pagination-desktop pagination-primary">{position()}{buttons()}</div>
    <div className="pagination-mobile-primary">{previous()}{position()}{next()}</div>
    {Object.values(controls).some(Boolean) && <details className="pagination-more"><summary>{copy.morePagination}</summary><div className="pagination-expanded">{count()}{buttons()}{options()}</div></details>}
  </nav>;
}
