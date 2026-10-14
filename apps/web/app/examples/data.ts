export type Sample = { id: string; name: string };
const initial:readonly Sample[]=[{id:'sample-a',name:'示例条目 A'},{id:'sample-b',name:'示例条目 B'},{id:'sample-c',name:'示例条目 C'}];
export function freshSamples():Sample[]{return initial.map(row=>({...row}));}
