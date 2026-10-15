import {mkdirSync,existsSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {propose} from '../upgrade/propose.mjs';import {capture,inventory,patchAndVerify} from '../upgrade/delivery.mjs';
import {safePath,overlaps,assertSeparated,writeEntry,writeJSON,json} from '../upgrade/files.mjs';import {sha,verifyProject} from '../release/verify.mjs';
import {UpdateError} from './catalog.mjs';
export async function cumulative({current,releases,output,behavior,trustProjectCode=false,timeout=180000}){
 current=safePath(current);output=safePath(output);if(!Array.isArray(releases)||!releases.length||releases.length>8||existsSync(output)||overlaps(current,output)||releases.some(r=>overlaps(safePath(r.directory),output)))throw new UpdateError('invalid_cumulative_inputs');assertSeparated([current,...releases.map(r=>r.directory)],output);verifyProject(current);mkdirSync(output,{mode:0o700});mkdirSync(join(output,'steps'));
 const source=json(current,'vendor/manifest.json'),report={schemaVersion:1,cumulative:true,status:'preparing',directlyApplicable:false,steps:[]};let at=current,first,last;
 for(const [index,r]of releases.entries()){
  const dir=join(output,'steps',String(index+1));const result=await propose({current:at,target:r.directory,targetVersion:r.version,targetSha:r.manifestSha256,output:dir,behavior,trustProjectCode,timeout});
  first??=result;last=result;report.steps.push({version:r.version,manifestSha256:r.manifestSha256,source:result.source,target:result.target,report:`steps/${index+1}/report.json`,checks:result.checks,manual:result.manual,directlyApplicable:result.directlyApplicable,finalTreeSha256:result.final?.treeSha256});
  if(!result.directlyApplicable){report.status='step_failed';report.source=first.source;report.target=result.target;writeJSON(output,'report.json',report);return report;}at=join(dir,'candidate');
 }
 const candidate=join(output,'candidate');mkdirSync(candidate,{mode:0o755});for(const[p,e]of capture(at))writeEntry(candidate,p,e);verifyProject(candidate);
 report.source=first.source;report.current=first.current;report.target=last.target;
 // Vendor rows intentionally use package identity from the final manifest, not filename guessing.
 const finalManifest=json(candidate,'vendor/manifest.json');report.vendor=finalManifest.packages.map(p=>({file:p.file,sha256:p.sha256,integrity:p.integrity,replaces:source.packages.find(old=>old.name===p.name)?.file}));
 const final=inventory(capture(candidate));report.final={files:final,treeSha256:sha(JSON.stringify(final))};writeJSON(output,'vendor-replacements.json',report.vendor);report.patchValidation=patchAndVerify(current,candidate,Object.keys(first.current.files),report.vendor,output);
 report.directlyApplicable=report.patchValidation.status==='passed'&&report.final.treeSha256===last.final.treeSha256;report.status=report.directlyApplicable?'proposal_ready':'final_gate_failed';
 writeFileSync(join(output,'REVIEW.md'),'# Cumulative proposal\n\nReview every steps/*/report.json and the final source/target identifiers. Each intermediate template migration and semantic/build/behavior check ran in isolation; there was no intermediate deployment.\nApply only the reviewed final changes.patch plus vendor-replacements.json in a disposable copy, then test the project and explicitly arrange deployment. Never advance the live baseline first. No automatic apply command is provided.\n',{mode:0o600});writeJSON(output,'report.json',report);return report;
}
