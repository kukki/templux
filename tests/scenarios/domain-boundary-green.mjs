// Original independent fixtures with success expectations after F1; original report/script unchanged.
import {realpathSync,mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {secret,list,projectFiles,entry} from '../../tools/upgrade/files.mjs';
import {publicPath,validateCatalog} from '../../tools/updates/catalog.mjs';
import {sha} from '../../tools/release/verify.mjs';
import {managed} from '../../tools/upgrade/propose.mjs';
const base=mkdtempSync(join(realpathSync(tmpdir()),'templux-domain-review-'));const rows=[];
try {
 const text=readFileSync('tools/upgrade/propose.mjs','utf8');
 // Execute the exact private validator body, replacing only its lexical imports.
 const body=text.slice(text.indexOf('function baseline('),text.indexOf('\nconst identity='));
 const baseline=Function('json','sha','entry','list','join','digestPath','secret',body+'; return baseline;');
 const f=await import('../../tools/upgrade/files.mjs');
 const validate=baseline(f.json,sha,entry,list,join,f.digestPath,secret);
 function fixture(name,example){const root=join(base,name);mkdirSync(join(root,'.templux/baseline/project'),{recursive:true});mkdirSync(join(root,'vendor'));
 const files={'README.md':sha('synthetic public readme\n')};writeFileSync(join(root,'.templux/baseline/project/README.md'),'synthetic public readme\n');
 if(example){files['.env.example']=sha('# public example, no credentials\n');writeFileSync(join(root,'.templux/baseline/project/.env.example'),'# public example, no credentials\n');writeFileSync(join(root,'.env.example'),'# public example, no credentials\n');}
 const sourceFiles=Object.fromEntries(Object.entries(files).map(([p,h])=>['project-template/'+p,h]));const m={source:{files:sourceFiles,treeSha256:sha(JSON.stringify(sourceFiles))},upgrade:{from:['0.1.3-domain.1']}};
 const bytes=JSON.stringify(m);writeFileSync(join(root,'vendor/manifest.json'),bytes);writeFileSync(join(root,'.templux/baseline.json'),JSON.stringify({schemaVersion:1,manifestSha256:sha(bytes),source:m.source,files}));return{root,m};}
 const control=fixture('control',false);assert.doesNotThrow(()=>validate(control.root,control.m));rows.push({case:'baseline without example',accepted:true});
 const subject=fixture('public-example',true);assert.doesNotThrow(()=>validate(subject.root,subject.m));rows.push({case:'anchored baseline with exact .env.example and explicit from',accepted:true,observed:'accepted',actual:list(join(subject.root,'.templux/baseline/project')),metadata:Object.keys(JSON.parse(readFileSync(join(subject.root,'.templux/baseline.json'))).files)});
 const c={schemaVersion:1,releases:[{version:'0.1.4-domain.1',directory:'release',manifestSha256:'a'.repeat(64),from:['0.1.3-domain.1'],files:Object.fromEntries(['manifest.json','complete.json'].map(p=>[p,{sha256:'b'.repeat(64),size:1,mode:0o644}]))}]};assert.doesNotThrow(()=>validateCatalog(c));c.releases[0].files['project/.env.example']={sha256:'c'.repeat(64),size:1,mode:0o644};assert.doesNotThrow(()=>validateCatalog(c));rows.push({case:'explicit from catalog with public example',accepted:true,observed:'accepted'});
 const paths=['.env.example','project/.env.example','project/.templux/baseline/project/.env.example','.env','.env.prod','.env.local','secrets/x','credentials/x','backups/x','../.env.example'];rows.push({case:'path matrix',paths:Object.fromEntries(paths.map(p=>[p,{secret:secret(p),public:publicPath(p)}]))});
 rows.push({case:'root public example current-copy and ownership',copied:projectFiles(subject.root).includes('.env.example'),managed:managed('.env.example')});assert(projectFiles(subject.root).includes('.env.example'));assert(managed('.env.example'));
 symlinkSync(join(subject.root,'.env.example'),join(subject.root,'alias'));assert.throws(()=>entry(subject.root,'alias'),/symlink/);rows.push({case:'symlink entry still rejected',accepted:false});
 console.log(JSON.stringify({ok:true,rows,privateBodySha256:sha(body),temporaryFixtureRemoved:true},null,2));
}finally{rmSync(base,{recursive:true,force:true});}
