import {readFileSync,lstatSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const sha=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest(algorithm==='sha256'?'hex':'base64');
const names=['@templux/core','@templux/web'];
const fail=()=>{throw new Error('共享发布校验失败：需要受信清单、准确锁定版本/字节和受支持组合。');};
const json=p=>JSON.parse(readFileSync(p,'utf8'));
function safeFile(root,file){if(!/^[a-z0-9.-]+\.tgz$/.test(file))fail();const path=join(root,'vendor',file);for(let p=path;p!==dirname(root);p=dirname(p)){if(lstatSync(p).isSymbolicLink())fail();if(p===root)break;}const s=lstatSync(path);if(!s.isFile()||s.size<1||s.size>64*1024*1024)fail();return path;}
export function verifyProject(directory,{installed=false}={}){
 try{
  const root=resolve(directory),m=json(join(root,'vendor/manifest.json')),lock=json(join(root,'templux.lock.json'));
  if(m.schemaVersion!==1||lock.schemaVersion!==1||m.version!=='0.1.0'||lock.version!==m.version||sha(readFileSync(join(root,'vendor/manifest.json')))!==lock.manifestSha256||JSON.stringify(m.compatibility)!==JSON.stringify({protocol:1,config:1,schema:'0010',node:24,next:16})||!m.source?.commit?.match(/^[a-f0-9]{40}$/)||!m.source.treeSha256?.match(/^[a-f0-9]{64}$/)||!Array.isArray(m.packages)||m.packages.length!==2||JSON.stringify(m.packages)!==JSON.stringify(lock.packages))fail();
  for(const [i,name]of names.entries()){
   const p=m.packages[i];if(p.name!==name||p.version!==m.version||p.file!==`templux-${i===0?'core':'web'}-${m.version}.tgz`||!/^[a-f0-9]{64}$/.test(p.sha256))fail();
   const path=safeFile(root,p.file),bytes=readFileSync(path);if(sha(bytes)!==p.sha256||'sha512-'+sha(bytes,'sha512')!==p.integrity)fail();
   const listing=spawnSync('tar',['-tzf',path],{encoding:'utf8',timeout:10000,maxBuffer:4*1024*1024}),types=spawnSync('tar',['-tvzf',path],{encoding:'utf8',timeout:10000,maxBuffer:4*1024*1024});
   if(listing.status!==0||types.status!==0||listing.stdout.trim().split('\n').some(name=>!name.startsWith('package/')||/[\\\x00-\x1f]/.test(name)||name.replace(/\/$/,'').split('/').some(part=>!part||part==='.'||part==='..'))||types.stdout.trim().split('\n').some(line=>!['-','d'].includes(line[0])))fail();
   const result=spawnSync('tar',['-xOf',path,'package/package.json'],{encoding:'utf8',timeout:10000,maxBuffer:65536});if(result.status!==0)fail();const metadata=JSON.parse(result.stdout);if(metadata.name!==name||metadata.version!==p.version)fail();
   const app=json(join(root,'apps',i===0?'api':'web','package.json'));if(app.dependencies?.[name]!==`file:../../vendor/${p.file}`)fail();
   if(installed){const entry=json(join(root,'package-lock.json')).packages?.['node_modules/'+name],actual=json(join(root,'node_modules',name,'package.json'));if(entry?.version!==p.version||entry.integrity!==p.integrity||entry.link||actual.version!==p.version||actual.name!==name)fail();}
  }
  return{ok:true,version:m.version,manifestSha256:lock.manifestSha256};
 }catch{fail();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2);if(args.some(a=>a.startsWith('--')&&a!=='--installed')||args.filter(a=>!a.startsWith('--')).length>1)fail();console.log(JSON.stringify(verifyProject(args.find(a=>!a.startsWith('--'))??process.cwd(),{installed:args.includes('--installed')})));}catch(error){console.error(JSON.stringify({event:'release_verification_failed'}));console.log(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}
}
