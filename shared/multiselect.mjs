import {normalizeSearch} from './search.mjs';
export function validateOptions(options,values){
 if(!Array.isArray(options)||!options.length||options.some(o=>!o||typeof o.value!=='string'||!o.value.trim()||typeof o.label!=='string'||!o.label.trim())||new Set(options.map(o=>o.value)).size!==options.length)throw new Error('多选必须提供唯一值与可识别名称。');
 if(!Array.isArray(values)||new Set(values).size!==values.length||values.some(v=>!options.some(o=>o.value===v)))throw new Error('多选选中值必须属于显式选项。');
}
export function matchingOptions(options,term){const normalized=normalizeSearch(term);return options.filter(o=>o.label.toLowerCase().includes(normalized));}
export function selectMatching(options,values,visible,checked){validateOptions(options,values);validateOptions(options,visible.map(o=>o.value));const selected=new Set(values);for(const option of visible)checked?selected.add(option.value):selected.delete(option.value);return options.filter(o=>selected.has(o.value)).map(o=>o.value);}
