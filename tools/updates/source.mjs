import {lstatSync,readFileSync,mkdirSync,existsSync} from 'node:fs';import {join,isAbsolute} from 'node:path';
import {safePath,entry,writeEntry} from '../upgrade/files.mjs';import {sha,verifyProject} from '../release/verify.mjs';
import {UpdateError,hashPattern,publicPath,validateCatalog} from './catalog.mjs';
export function validateSource(s){
 if(!s||!['directory','https'].includes(s.kind)||s.catalogSha256!==undefined&&!hashPattern.test(s.catalogSha256))throw new UpdateError('invalid_source');
 const allowed=s.kind==='directory'?['kind','root','catalogSha256']:['kind','url','catalogSha256','allowHttpLoopback','tokenEnv','tokenFile'];if(Object.keys(s).some(k=>!allowed.includes(k)))throw new UpdateError('invalid_source');
 if(s.kind==='directory'){if(typeof s.root!=='string'||!isAbsolute(s.root))throw new UpdateError('invalid_source');safePath(s.root);return;}
 try{const u=new URL(s.url);if(u.username||u.password||u.search||u.hash||!['https:','http:'].includes(u.protocol)||u.protocol==='http:'&&!(s.allowHttpLoopback===true&&['127.0.0.1','[::1]'].includes(u.hostname)))throw Error();if(s.allowHttpLoopback!==undefined&&typeof s.allowHttpLoopback!=='boolean'||s.tokenEnv!==undefined&&s.tokenEnv!=='TEMPLUX_UPDATE_TOKEN'||s.tokenEnv!==undefined&&s.tokenFile!==undefined||s.tokenFile!==undefined&&(typeof s.tokenFile!=='string'||!isAbsolute(s.tokenFile)))throw Error();}catch{throw new UpdateError('invalid_source');}
}
function headers(s){try{let token;if(s.tokenEnv)token=process.env.TEMPLUX_UPDATE_TOKEN;if(s.tokenFile){const p=safePath(s.tokenFile),st=lstatSync(p);if(!st.isFile()||![0o400,0o600].includes(st.mode&0o777)||st.size>8192)throw new UpdateError('invalid_credential');token=readFileSync(p,'utf8').trim();}if((s.tokenEnv||s.tokenFile)&&(!token||token.length>4096||/\s/.test(token)))throw new UpdateError('invalid_credential');return token?{Authorization:'Bearer '+token}:{};}catch{throw new UpdateError('invalid_credential');}}
async function get(s,path,timeout,max){
 try{
  if(s.kind==='directory'){const b=entry(s.root,path)?.bytes;if(!b||b.length>max)throw new UpdateError('source_error');return b;}
  const base=new URL('.',s.url),url=path==='catalog.json'?new URL(s.url):new URL(path.split('/').map(encodeURIComponent).join('/'),base);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw new UpdateError('invalid_source');
  const response=await fetch(url,{headers:headers(s),redirect:'manual',signal:AbortSignal.timeout(timeout)});
  if(!response.ok){await response.body?.cancel();throw new UpdateError(response.status===401?'unauthorized':response.status===403?'forbidden':response.status>=300&&response.status<400?'redirect_refused':'http_error');}
  const chunks=[];let size=0;for await(const c of response.body??[]){size+=c.length;if(size>max)throw new UpdateError('response_too_large');chunks.push(c);}return Buffer.concat(chunks);
 }catch(e){if(e instanceof UpdateError)throw e;throw new UpdateError(e.name==='TimeoutError'||e.name==='AbortError'?'timeout':s.kind==='directory'?'source_error':'network_error');}
}
export async function readCatalog(source,timeout=10000){validateSource(source);const bytes=await get(source,'catalog.json',timeout,512*1024),hash=sha(bytes);if(source.catalogSha256&&source.catalogSha256!==hash)throw new UpdateError('catalog_changed');let catalog;try{catalog=validateCatalog(JSON.parse(bytes));}catch{throw new UpdateError('corrupt_catalog');}return{catalog,sha256:hash,trust:source.catalogSha256?'pinned':source.kind==='directory'?'directory-authorized':'transport-trusted'};}
export async function downloadRelease(source,record,directory,timeout=10000){
 validateSource(source);validateCatalog({schemaVersion:1,releases:[record]});directory=safePath(directory);if(existsSync(directory))throw new UpdateError('output_exists');mkdirSync(directory,{mode:0o700});
 for(const[p,meta]of Object.entries(record.files)){const bytes=await get(source,record.directory+'/'+p,timeout,Math.max(1,meta.size));if(bytes.length!==meta.size||sha(bytes)!==meta.sha256)throw new UpdateError('corrupt_artifact');writeEntry(directory,p,{bytes,mode:meta.mode});}
 try{const v=verifyProject(join(directory,'project'));const bytes=entry(directory,'manifest.json').bytes,m=JSON.parse(bytes),complete=JSON.parse(entry(directory,'complete.json').bytes);if(v.version!==record.version||v.manifestSha256!==record.manifestSha256||sha(bytes)!==record.manifestSha256||complete.version!==record.version||complete.manifestSha256!==record.manifestSha256||JSON.stringify(m.upgrade?.from??[])!==JSON.stringify(record.from))throw Error();}catch{throw new UpdateError('corrupt_artifact');}
 return directory;
}
