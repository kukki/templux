import {readFileSync} from 'node:fs';import {join} from 'node:path';
import {version} from './versions.mjs';import {verifyProject,sha} from '../release/verify.mjs';import {capture} from '../upgrade/delivery.mjs';import {entry,safePath,digestPath,secret,json} from '../upgrade/files.mjs';
export const hashPattern=/^[a-f0-9]{64}$/;
export const publicPath=p=>digestPath(p)&&!secret(p)&&p.split('/').every(x=>/^[a-zA-Z0-9_.@\[\] -]+$/.test(x));
export class UpdateError extends Error{constructor(code){super(code);this.code=code;}}
export function validateCatalog(c){
 if(c?.schemaVersion!==1||!Array.isArray(c.releases)||!c.releases.length||c.releases.length>128)throw new UpdateError('corrupt_catalog');
 const seen=new Set();for(const r of c.releases){try{version(r.version);if(seen.has(r.version)||!publicPath(r.directory)||!hashPattern.test(r.manifestSha256)||!Array.isArray(r.from)||r.from.some(v=>{version(v);return v===r.version;})||new Set(r.from).size!==r.from.length||!r.files||typeof r.files!=='object'||Array.isArray(r.files))throw Error();seen.add(r.version);const f=Object.entries(r.files);if(!f.length||f.length>512||!r.files['manifest.json']||!r.files['complete.json'])throw Error();let total=0;for(const[p,v]of f){if(!publicPath(p)||!hashPattern.test(v.sha256)||!Number.isSafeInteger(v.size)||v.size<0||v.size>16*1024*1024||![0o644,0o755].includes(v.mode))throw Error();total+=v.size;}if(total>256*1024*1024)throw Error();}catch{throw new UpdateError('corrupt_catalog');}}
 return c;
}
export function buildCatalog(root,directories){
 root=safePath(root);if(!Array.isArray(directories)||!directories.length)throw new UpdateError('invalid_catalog_inputs');
 const releases=directories.map(directory=>{if(!publicPath(directory))throw new UpdateError('invalid_catalog_inputs');const path=join(root,directory),verified=verifyProject(join(path,'project')),m=json(path,'manifest.json'),complete=json(path,'complete.json');if(verified.manifestSha256!==sha(entry(path,'manifest.json').bytes)||complete.manifestSha256!==verified.manifestSha256||complete.version!==m.version)throw new UpdateError('corrupt_artifact');const files={};for(const[p,e]of capture(path)){if(!publicPath(p))throw new UpdateError('unsafe_artifact');files[p]={sha256:sha(e.bytes),size:e.bytes.length,mode:e.mode};}return{version:m.version,manifestSha256:verified.manifestSha256,directory,from:m.upgrade?.from??[],files};});
 return validateCatalog({schemaVersion:1,releases});
}
