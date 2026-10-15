import {lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,chmodSync,existsSync} from 'node:fs';
import {resolve,dirname,join,relative,sep} from 'node:path';
export const digestPath=p=>typeof p==='string'&&p.length<240&&!p.startsWith('/')&&!/[\\\x00-\x1f]/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
export function safePath(path){const p=resolve(path);for(let x=p;;x=dirname(x)){if((existsSync(x)||(()=>{try{return lstatSync(x).isSymbolicLink();}catch{return false;}})())&&lstatSync(x).isSymbolicLink())throw new Error('symlink input/output rejected');if(x===dirname(x))break;}return p;}
export const overlaps=(a,b)=>a===b||a.startsWith(b+sep)||b.startsWith(a+sep);
export const secret=p=>p.split('/').some(x=>/^(?:\.env(?:\..*)?|\.npmrc|\.git|node_modules|dist|\.next|credentials?|secrets?|backups?|logs?|test-results)$/i.test(x)||/\.(?:pem|key|p12|pfx|log|tsbuildinfo|map)$/i.test(x));
export function entry(root,p){if(!digestPath(p))throw new Error('unsafe relative path');const full=safePath(join(root,p));if(!existsSync(full))return null;const s=lstatSync(full);if(!s.isFile()||s.size>16*1024*1024)throw new Error('unsupported source file');return{bytes:readFileSync(full),mode:s.mode&0o777};}
export function writeEntry(root,p,e){if(!digestPath(p))throw new Error('unsafe output path');const path=join(root,p);mkdirSync(dirname(path),{recursive:true,mode:0o755});writeFileSync(path,e.bytes,{mode:e.mode});chmodSync(path,e.mode);}
export function list(root,prefix=''){const result=[];for(const item of readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=prefix?prefix+'/'+item.name:item.name;if(secret(p))continue;if(item.isSymbolicLink())throw new Error('symlink source rejected');if(item.isDirectory())result.push(...list(join(root,item.name),p));else if(item.isFile())result.push(p);else throw new Error('unsupported source entry');if(result.length>5000)throw new Error('source inventory too large');}return result;}
// Copy only project source, not an arbitrary checkout. Runtime data is never a candidate input.
export function projectFiles(root){return list(root).filter(p=>['package.json','package-lock.json','templux.lock.json','Dockerfile','compose.yaml','templux','README.md','.dockerignore','.gitignore'].includes(p)||/^(apps|config|tools)\//.test(p)&&/\.(?:[cm]?[jt]sx?|json|css|svg|md|ya?ml|sh)$/.test(p));}
export const json=(root,p)=>JSON.parse(entry(root,p).bytes.toString('utf8'));
export const writeJSON=(root,p,value)=>writeEntry(root,p,{bytes:Buffer.from(JSON.stringify(value,null,2)+'\n'),mode:0o600});
// Bind mounts can expose the same directory under unrelated lexical paths.
// Compare filesystem identities as well; do not read any file contents here.
export function assertSeparated(inputs,output){
 const ids=new Set();let count=0;
 function visit(p){const s=lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory())return;if(++count>10000)throw new Error('input directory inventory too large');ids.add(`${s.dev}:${s.ino}`);for(const x of readdirSync(p,{withFileTypes:true}))if(x.isDirectory())visit(join(p,x.name));}
 for(const p of inputs)visit(p);
 for(let p=output;;p=dirname(p)){if(existsSync(p)){const s=lstatSync(p);if(ids.has(`${s.dev}:${s.ino}`))throw new Error('output aliases an input directory');}if(p===dirname(p))break;}
}
