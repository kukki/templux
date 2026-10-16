import test from'node:test';import assert from'node:assert/strict';import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync}from'node:fs';import {tmpdir}from'node:os';import {join}from'node:path';
import * as f from'../tools/upgrade/files.mjs';import {managed}from'../tools/upgrade/propose.mjs';import {publicPath,validateCatalog}from'../tools/updates/catalog.mjs';import {sha}from'../tools/release/verify.mjs';
test('anchored public root example participates in baseline, copy, ownership and exact catalog paths',()=>{
 const root=mkdtempSync(join(realpathSync(tmpdir()),'domain-boundary-'));try{
 mkdirSync(join(root,'.templux/baseline/project'),{recursive:true});mkdirSync(join(root,'vendor'));
 const value='# public synthetic sample\n';writeFileSync(join(root,'.env.example'),value);writeFileSync(join(root,'.templux/baseline/project/.env.example'),value);
 const files={'.env.example':sha(value)},sourceFiles={'project-template/.env.example':sha(value)},m={source:{files:sourceFiles,treeSha256:sha(JSON.stringify(sourceFiles))},upgrade:{from:['0.1.3-domain.2']}};
 writeFileSync(join(root,'vendor/manifest.json'),JSON.stringify(m));writeFileSync(join(root,'.templux/baseline.json'),JSON.stringify({schemaVersion:1,manifestSha256:sha(JSON.stringify(m)),source:m.source,files}));
 const text=readFileSync('tools/upgrade/propose.mjs','utf8'),body=text.slice(text.indexOf('function baseline('),text.indexOf('\nconst identity='));
 const baseline=Function('json','sha','entry','list','join','digestPath','secret','publicTemplatePath',body+';return baseline')(f.json,sha,f.entry,f.list,join,f.digestPath,f.secret,f.publicTemplatePath);
 assert.doesNotThrow(()=>baseline(root,m));assert(f.projectFiles(root).includes('.env.example'));assert(managed('.env.example'));assert(managed('compose.yaml'));
 const paths=['.env.example','.templux/baseline/project/.env.example','project/.env.example','project/.templux/baseline/project/.env.example'];
 for(const p of paths){assert.equal(f.secret(p),true,'generic secret predicate remains conservative');assert.equal(publicPath(p),true,p);}
 const c={schemaVersion:1,releases:[{version:'0.1.4-domain.1',directory:'next',manifestSha256:'a'.repeat(64),from:['0.1.3-domain.2'],files:Object.fromEntries(['manifest.json','complete.json',...paths].map(p=>[p,{sha256:'b'.repeat(64),size:1,mode:0o644}]))}]};assert.doesNotThrow(()=>validateCatalog(c));
 symlinkSync('/etc/passwd',join(root,'link'));assert.throws(()=>f.entry(root,'link'),/symlink/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
for(const p of ['.env','.env.prod','.env.local','.env.example.bak','.ENV.EXAMPLE','other/.env.example','project/other/.env.example','secrets/.env.example','project/secrets/.env.example','credentials/password','../.env.example','project/../.env.example','project//.env.example','project/%2eenv.example'])test('private or spoofed path stays rejected: '+p,()=>assert.equal(publicPath(p),false));
