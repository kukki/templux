import copy from '../config/maintenance-copy.json' with {type:'json'};
export function validateMaintenanceStart({at,message}){
 const match=typeof at==='string'&&/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(at);
 if(!match||+match[1]<1||+match[2]<1||+match[2]>12||+match[3]<1||+match[3]>new Date(Date.UTC(+match[1],+match[2],0)).getUTCDate()||+match[4]>23||+match[5]>59||+match[6]>59||+(match[8]??0)>14||+(match[9]??0)>59||(+match[8]===14&&+match[9]!==0)||!Number.isFinite(Date.parse(at)))throw Error('维护时刻必须是合法含时区的ISO时间（精确到秒，最多三位毫秒）。');
 if(typeof message!=='string'||message.trim().length<1||message.length>300||/[\x00-\x1f\x7f]/.test(message))throw Error('维护公开说明须为1–300字符单行文字。');
 return {at:new Date(at).toISOString(),message:message.trim()};
}
export function maintenanceCountdown(at,now){return Math.max(0,Math.ceil((Date.parse(at)-now)/1000));}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function maintenancePage(config,state){
 const style=Object.entries(config.theme).map(([k,v])=>`${k==='colorScheme'?'color-scheme':'--'+k}:${escape(v)}`).join(';');
 const title=state?.phase==='offline'?copy.offlineTitle:copy.unknownTitle,message=state?.phase==='offline'?copy.offlineBody:copy.unknownBody;
 return `<!doctype html><html lang="${escape(config.language)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(config.project.name)} · ${escape(title)}</title><body style="${style}"><style>body{margin:0;background:var(--background);color:var(--text);font:16px/1.6 system-ui,sans-serif}main{max-width:44rem;margin:12vh auto;padding:clamp(20px,5vw,48px);border:1px solid var(--border);border-radius:18px;background:var(--surface);overflow-wrap:anywhere}.brand{color:var(--accent);font-weight:700}h1{font-size:clamp(28px,6vw,40px)}p{color:var(--muted)}a{display:inline-block;padding:12px 18px;background:var(--accent);color:var(--accentText);border-radius:8px}a:focus-visible{outline:3px solid var(--text);outline-offset:3px}</style><main><div class="brand">${escape(config.brand.wordmark)}</div><h1>${escape(title)}</h1><p>${escape(message)}</p>${state?.active?`<p>${escape(state.message)}</p>`:''}<a href="/">${escape(copy.retry)}</a></main></body></html>`;
}
