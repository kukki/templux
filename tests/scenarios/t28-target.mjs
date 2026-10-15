// TEST ONLY producer. Requires a real independent decision supplied by TL after candidate review.
// Mount immutable formal source blobs at /stable and the fixed review bundle at /review.
import {readFileSync,writeFileSync,readdirSync,lstatSync,mkdirSync,rmSync,existsSync} from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const root='/opt/templux',hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(readFileSync(p)),scopes=['apps/api/src','apps/web','shared','config','database','tools/release','project-template'];
try{
 const candidate=read('/review/candidate.json'),approval=read('/review/approval.json');
 if(approval.decision!=='approved'||approval.candidateCommit!==candidate.candidateCommit||process.env.TEMPLUX_SOURCE_COMMIT!==candidate.candidateCommit||typeof approval.reviewer!=='string'||!approval.reviewer||typeof approval.evidence!=='string'||!approval.evidence)throw Error('A real matching independent approval record is required');
 const baseline=candidate.stableSource.files,overlays={...candidate.files,...candidate.compatibilityFiles};if(candidate.stableVersion!=='0.1.0'||Object.keys(baseline).length!==198||Object.keys(overlays).length!==5)throw Error('Unexpected stable input inventory');
 const safe=p=>typeof p==='string'&&!p.split('/').some(x=>!x||x==='.'||x==='..')&&scopes.some(s=>p.startsWith(s+'/'));
 for(const[p,digest]of Object.entries(baseline)){if(!safe(p)||!lstatSync(join('/stable',p)).isFile()||hash(readFileSync(join('/stable',p)))!==digest||(lstatSync(join('/stable',p)).mode&0o777)!==candidate.stableModes[p])throw Error('Stable source mismatch');}
 for(const[p,record]of Object.entries(overlays)){if(!safe(p)||!Object.hasOwn(baseline,p)||!lstatSync(join('/review/files',p)).isFile()||hash(readFileSync(join('/review/files',p)))!==record.sha256||(lstatSync(join('/review/files',p)).mode&0o777)!==record.mode)throw Error('Reviewed overlay mismatch');}
 const walk=(base,prefix='')=>readdirSync(base,{withFileTypes:true}).flatMap(e=>{if(e.isSymbolicLink())throw Error('Unexpected link');const p=prefix?prefix+'/'+e.name:e.name;return e.isDirectory()?walk(join(base,e.name),p):e.isFile()?[p]:(()=>{throw Error('Unexpected input type');})();});
 if(JSON.stringify(walk('/stable').sort())!==JSON.stringify(Object.keys(baseline).sort()))throw Error('Extra or missing formal source file');
 // Only the manifest's selected scopes are replaced, never host files; original formal files remain readonly.
 for(const scope of scopes)rmSync(join(root,scope),{recursive:true,force:true});
 for(const p of Object.keys(baseline)){mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),readFileSync(join('/stable',p)),{mode:lstatSync(join('/stable',p)).mode&0o777});}
 for(const[p,record]of Object.entries(overlays))writeFileSync(join(root,p),readFileSync(join('/review/files',p)),{mode:record.mode});
 const actual=Object.fromEntries(scopes.flatMap(s=>walk(join(root,s)).map(p=>[s+'/'+p,hash(readFileSync(join(root,s,p)))])));if(JSON.stringify(Object.keys(actual).sort())!==JSON.stringify(Object.keys(baseline).sort()))throw Error('Prepared inventory differs');
 const changed=Object.keys(baseline).filter(p=>actual[p]!==baseline[p]).sort();if(JSON.stringify(changed)!==JSON.stringify(Object.keys(overlays).sort()))throw Error('Unexpected prepared stable difference');
 // Version/from are explicit test release metadata, not a new application feature or production publish.
 const config=read(root+'/release.config.json');config.version='0.1.1-t28.1';config.upgradeFrom=['0.1.0'];writeFileSync(root+'/release.config.json',JSON.stringify(config));
 const compiled=spawnSync('npm',['run','build','--workspace','@templux/api'],{cwd:root,stdio:'inherit'});if(compiled.status!==0)throw Error('Stable API compilation failed');
 mkdirSync('/release',{recursive:true});writeFileSync('/release/input-proof.json',JSON.stringify({stableSource:candidate.stableSource,candidateCommit:candidate.candidateCommit,approval,selectedFiles:actual,changedFiles:changed,version:config.version,from:config.upgradeFrom},null,2));
 const result=spawnSync('node',['tools/release/build.mjs','/release'],{cwd:root,stdio:'inherit'});if(result.status!==0)throw Error('Test release failed');
}catch{console.error(JSON.stringify({event:'t28_test_release_refused'}));process.exitCode=1;}
