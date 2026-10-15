import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {verifyProject} from '../tools/release/verify.mjs';
const hash=(x,a='sha256')=>createHash(a).update(x).digest(a==='sha256'?'hex':'base64');
function fixture(){const root=mkdtempSync(join(tmpdir(),'t25-lock-'));mkdirSync(join(root,'vendor'));const packages=[];for(const part of ['core','web']){const stage=join(root,part);mkdirSync(join(stage,'package'),{recursive:true});writeFileSync(join(stage,'package/package.json'),JSON.stringify({name:'@templux/'+part,version:'0.1.0'}));const file=`templux-${part}-0.1.0.tgz`;assert.equal(spawnSync('tar',['-czf',join(root,'vendor',file),'-C',stage,'package']).status,0);const bytes=readFileSync(join(root,'vendor',file));packages.push({name:'@templux/'+part,version:'0.1.0',file,sha256:hash(bytes),integrity:'sha512-'+hash(bytes,'sha512')});mkdirSync(join(root,'apps',part==='core'?'api':'web'),{recursive:true});writeFileSync(join(root,'apps',part==='core'?'api':'web','package.json'),JSON.stringify({dependencies:{['@templux/'+part]:'file:../../vendor/'+file}}));}const manifest={schemaVersion:1,version:'0.1.0',compatibility:{protocol:1,config:1,schema:'0010',node:24,next:16},source:{commit:'a'.repeat(40),treeSha256:'b'.repeat(64)},packages};writeFileSync(join(root,'vendor/manifest.json'),JSON.stringify(manifest));writeLock(root,manifest);return{root,manifest};}
function writeLock(root,m){writeFileSync(join(root,'templux.lock.json'),JSON.stringify({schemaVersion:1,version:m.version,manifestSha256:hash(readFileSync(join(root,'vendor/manifest.json'))),packages:m.packages}));}
test('exact local artifacts and consumer declarations verify without a registry',()=>{const{root}=fixture();try{assert.equal(verifyProject(root).version,'0.1.0');}finally{rmSync(root,{recursive:true,force:true});}});
for(const mode of ['missing-lock','corrupt','same-version-different-package','range','unsupported','mixed-version','package-metadata'])test(`release rejects ${mode}`,()=>{const{root,manifest:m}=fixture();try{
 if(mode==='missing-lock')rmSync(join(root,'templux.lock.json'));
 if(mode==='corrupt')writeFileSync(join(root,'vendor',m.packages[0].file),'corrupt archive bytes');
 if(mode==='same-version-different-package'){writeFileSync(join(root,'core/package/changed.js'),'export const changed=true;');assert.equal(spawnSync('tar',['-czf',join(root,'vendor',m.packages[0].file),'-C',join(root,'core'),'package']).status,0);}
 if(mode==='range')writeFileSync(join(root,'apps/api/package.json'),JSON.stringify({dependencies:{'@templux/core':'^0.1.0'}}));
 if(mode==='unsupported')m.compatibility.protocol=2;
 if(mode==='mixed-version')m.packages[1].version='0.2.0';
 if(mode==='package-metadata')m.packages[0].name='@other/core';
 if(['unsupported','mixed-version','package-metadata'].includes(mode)){writeFileSync(join(root,'vendor/manifest.json'),JSON.stringify(m));writeLock(root,m);}
 assert.throws(()=>verifyProject(root),/共享发布/);
 }finally{rmSync(root,{recursive:true,force:true});}});
for(const mode of ['symlink','traversal','wrong-package-version'])test(`even a correctly hashed archive rejects ${mode}`,()=>{const{root,manifest:m}=fixture();try{
 const stage=join(root,'core'),file=join(root,'vendor',m.packages[0].file);
 if(mode==='symlink')symlinkSync('/etc/passwd',join(stage,'package/link'));
 if(mode==='wrong-package-version')writeFileSync(join(stage,'package/package.json'),JSON.stringify({name:'@templux/core',version:'0.2.0'}));
 const args=['-czf',file,'-C',stage,...(mode==='traversal'?['--transform=s|package/package.json|package/../outside.json|']:[]),'package'];assert.equal(spawnSync('tar',args).status,0);
 const b=readFileSync(file);m.packages[0].sha256=hash(b);m.packages[0].integrity='sha512-'+hash(b,'sha512');writeFileSync(join(root,'vendor/manifest.json'),JSON.stringify(m));writeLock(root,m);
 assert.throws(()=>verifyProject(root),/共享发布/);
 }finally{rmSync(root,{recursive:true,force:true});}});
