import {mkdirSync,existsSync,readFileSync,lstatSync,rmSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import {verifyProject,sha,isExactVersion} from '../release/verify.mjs';
import {safePath,overlaps,entry,writeEntry,list,projectFiles,json,writeJSON,digestPath,secret} from './files.mjs';
import {mergeEntry,sameEntry} from './merge.mjs';import {runChecks} from './checks.mjs';
// New business/config files remain project owned. A new template path is not automatically eligible.
export const managed=p=>['Dockerfile','compose.yaml','templux','.dockerignore','.gitignore'].includes(p)||/^tools\/[a-z0-9-]+\.mjs$/.test(p)||/^apps\/(api|web)\/tsconfig\.json$/.test(p)||['apps/web/next.config.ts','apps/web/next-env.d.ts','apps/web/server.mjs','apps/web/app/layout.tsx','apps/web/app/page.tsx','apps/web/app/api/[...path]/route.ts'].includes(p)||/^apps\/web\/app\/(account|admin|audit|examples|login|protected)\/page\.tsx$/.test(p);
function baseline(root,manifest){
 const b=json(root,'.templux/baseline.json');if(b.schemaVersion!==1||b.manifestSha256!==sha(entry(root,'vendor/manifest.json').bytes)||JSON.stringify(b.source)!==JSON.stringify(manifest.source)||!b.files||sha(JSON.stringify(manifest.source.files))!==manifest.source.treeSha256)throw new Error('baseline provenance invalid');
 const paths=Object.keys(b.files).sort(),actual=list(join(root,'.templux/baseline/project')).sort();if(JSON.stringify(paths)!==JSON.stringify(actual))throw new Error('baseline inventory invalid');
 for(const p of paths){if(!digestPath(p)||secret(p)||sha(entry(root,'.templux/baseline/project/'+p).bytes)!==b.files[p])throw new Error('baseline bytes invalid');const origin=manifest.source.files['project-template/'+p]??manifest.source.files[p==='config/presentation.json'?'shared/default-presentation.json':p];if(origin!==b.files[p])throw new Error('baseline not anchored to release');}
 return b;
}
const identity=(root,files)=>Object.fromEntries(files.map(p=>[p,{sha256:sha(entry(root,p).bytes),mode:entry(root,p).mode}]));
function patch(current,candidate,paths,out){
 const temp=mkdtempSync(join(tmpdir(),'templux-patch-'));
 try{for(const [side,root]of [['a',current],['b',candidate]]){mkdirSync(join(temp,side));for(const p of paths){const e=entry(root,p);if(e&&!e.bytes.includes(0))writeEntry(join(temp,side),p,e);}}
 const r=spawnSync('git',['diff','--no-index','--no-ext-diff','--no-renames','--','a','b'],{cwd:temp,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});if(r.error||![0,1].includes(r.status))throw new Error('patch generation failed');writeFileSync(join(out,'changes.patch'),r.stdout.replaceAll('a/a/','a/').replaceAll('b/b/','b/'),{mode:0o600});
 }finally{rmSync(temp,{recursive:true,force:true});}
}
export async function propose({current,target,targetVersion,targetSha,output,trustProjectCode=false,behavior,timeout=180000}){
 current=safePath(current);target=safePath(target);output=safePath(output);
 if(!isExactVersion(targetVersion)||!/^[a-f0-9]{64}$/.test(targetSha??'')||[current,target].some(p=>overlaps(p,output))||overlaps(current,target)||existsSync(output))throw new Error('invalid version/hash or unsafe/existing output');
 if(!Number.isSafeInteger(timeout)||timeout<100||timeout>600000)throw new Error('invalid timeout');
 const currentVerified=verifyProject(current),targetProject=join(target,'project'),targetVerified=verifyProject(targetProject),m=json(current,'vendor/manifest.json'),t=json(target,'manifest.json'),complete=json(target,'complete.json');
 if(targetVerified.version!==targetVersion||targetVerified.manifestSha256!==targetSha||sha(entry(target,'manifest.json').bytes)!==targetSha||complete.version!==targetVersion||complete.manifestSha256!==targetSha)throw new Error('target release identity invalid');
 for(const pkg of t.packages)if(sha(entry(target,pkg.file).bytes)!==pkg.sha256)throw new Error('target artifact invalid');
 mkdirSync(output,{mode:0o700});const report={schemaVersion:1,source:{version:m.version,manifestSha256:currentVerified.manifestSha256,source:m.source},target:{version:t.version,manifestSha256:targetSha,source:t.source},current:{files:{}},changes:[],manual:[],checks:[],directlyApplicable:false};
 const finish=()=>{writeJSON(output,'report.json',report);return report;};
 let b,tb;try{b=baseline(current,m);tb=baseline(targetProject,t);}catch{report.manual.push({kind:'baseline',message:'Missing, damaged or release-mismatched baseline; supply the original trusted release baseline, never reconstruct from target.'});return finish();}
 if(!Array.isArray(t.upgrade?.from)||!t.upgrade.from.includes(m.version)||m.version===t.version){report.manual.push({kind:'unsupported-path',message:'Target does not declare this exact source version. No cumulative path inferred.'});return finish();}
 const sourceFiles=projectFiles(current);report.current.files=identity(current,[...sourceFiles,...m.packages.map(p=>'vendor/'+p.file),'vendor/manifest.json','.templux/verify.mjs','.templux/baseline.json',...Object.keys(b.files).map(p=>'.templux/baseline/project/'+p)].sort());report.current.treeSha256=sha(JSON.stringify(report.current.files));
 const candidate=join(output,'candidate');mkdirSync(candidate,{mode:0o755});for(const p of sourceFiles)writeEntry(candidate,p,entry(current,p));
 const changed=new Set(),all=new Set([...Object.keys(b.files),...Object.keys(tb.files)]);
 for(const p of [...all].sort()){
  if(!managed(p)){const old=entry(current,'.templux/baseline/project/'+p),next=entry(targetProject,'.templux/baseline/project/'+p);if(!sameEntry(old,next))report.changes.push({path:p,kind:'project-owned-not-migrated'});continue;}
  const old=entry(current,'.templux/baseline/project/'+p),now=entry(current,p),next=entry(targetProject,'.templux/baseline/project/'+p),result=mergeEntry(old,now,next);
  if(result.status==='conflict'){report.manual.push({path:p,kind:'merge',reason:result.reason});continue;}
  if(!sameEntry(now,result.entry)){if(result.entry)writeEntry(candidate,p,result.entry);else rmSync(join(candidate,p),{force:true});changed.add(p);report.changes.push({path:p,kind:!now?'add':!result.entry?'delete':'merge'});}
 }
 // Only the explicit shared dependency changes; business version/scripts/other packages stay current.
 for(const [kind,name]of [['api','core'],['web','web']]){const p=`apps/${kind}/package.json`,value=json(current,p),pkg=t.packages.find(x=>x.name==='@templux/'+name);value.dependencies['@templux/'+name]='file:../../vendor/'+pkg.file;writeEntry(candidate,p,{bytes:Buffer.from(JSON.stringify(value,null,2)+'\n'),mode:entry(current,p).mode});changed.add(p);report.changes.push({path:p,kind:'shared-dependency-only'});}
 mkdirSync(join(candidate,'vendor'));for(const p of t.packages)writeEntry(candidate,'vendor/'+p.file,entry(target,p.file));writeEntry(candidate,'vendor/manifest.json',entry(target,'manifest.json'));writeEntry(candidate,'templux.lock.json',entry(targetProject,'templux.lock.json'));writeEntry(candidate,'.templux/verify.mjs',entry(targetProject,'.templux/verify.mjs'));
 // Store only the target's pristine, validated baseline. It does not absorb project edits.
 writeEntry(candidate,'.templux/baseline.json',entry(targetProject,'.templux/baseline.json'));for(const p of Object.keys(tb.files))writeEntry(candidate,'.templux/baseline/project/'+p,entry(targetProject,'.templux/baseline/project/'+p));
 for(const p of ['templux.lock.json','vendor/manifest.json','.templux/verify.mjs','.templux/baseline.json',...Object.keys(tb.files).map(p=>'.templux/baseline/project/'+p)])changed.add(p);
 verifyProject(candidate);
 report.vendor=t.packages.map(p=>({file:p.file,sha256:p.sha256,integrity:p.integrity,replaces:m.packages.find(old=>old.name===p.name)?.file}));
 writeJSON(output,'vendor-replacements.json',report.vendor);
 if(report.manual.length===0&&trustProjectCode){
  if(!digestPath(behavior)||secret(behavior)||!sourceFiles.includes(behavior)||!behavior.endsWith('.mjs'))report.manual.push({kind:'behavior-required',message:'Supply an existing nonsecret project .mjs behavior check.'});
  else report.checks=await runChecks(candidate,behavior,timeout);
 }
 // Build output is not an application candidate and can carry caches; do not retain it.
 for(const p of ['node_modules','apps/api/dist','apps/web/.next','apps/web/tsconfig.tsbuildinfo'])rmSync(join(candidate,p),{recursive:true,force:true});
 for(const p of sourceFiles){if(!sameEntry(entry(current,p),entry(candidate,p))){if(managed(p)||['apps/api/package.json','apps/web/package.json','package-lock.json','templux.lock.json'].includes(p))changed.add(p);else{report.manual.push({kind:'project-file-mutated-by-check',path:p});writeEntry(candidate,p,entry(current,p));}}}
 if(existsSync(join(candidate,'package-lock.json')))changed.add('package-lock.json');
 report.directlyApplicable=report.manual.length===0&&report.checks.length===7&&report.checks.every(c=>c.status==='passed');
 if(!trustProjectCode)report.checks=[{name:'project-code',status:'not-run',reason:'Explicit trust and behavior check required.'}];
 patch(current,candidate,[...changed],output);
 writeFileSync(join(output,'REVIEW.md'),'# Review before applying\n\nInspect report.json, changes.patch and vendor-replacements.json. Not an automatic apply/deploy operation.\nDo not apply if directlyApplicable is false. Review project-owned code/config against the changed public interfaces, all three-way decisions, target source/manifest SHA and the trusted behavior check scope.\nIn a disposable copy, apply the reviewed text changes and replace exactly the vendor artifacts from candidate; remove only the old named packages. Candidate includes the new baseline for that reviewed change, never advance the live baseline first. Preserve runtime .env/credentials separately; they are absent here.\nThen build/test the copy, review backups/maintenance/migration prerequisites and arrange explicit deployment. A passed check set is not proof of arbitrary business correctness.\n',{mode:0o600});
 return finish();
}
