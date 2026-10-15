"""Audit re-bound candidate and exercise only unapproved producer refusals.
Never creates approval records or runs a producer positive path. Own temp output is deleted.
"""
import argparse,pathlib,json,hashlib,subprocess,tempfile,shutil,os
p=argparse.ArgumentParser();p.add_argument('--image',required=True);p.add_argument('--old',default='test-results/t28/candidate-unapproved-7f2318b');p.add_argument('--new',default='test-results/t28/candidate');a=p.parse_args();root=pathlib.Path.cwd();old=pathlib.Path(a.old).resolve();new=pathlib.Path(a.new).resolve();before=json.loads((old/'candidate.json').read_text());after=json.loads((new/'candidate.json').read_text());sha=lambda x:hashlib.sha256(x).hexdigest();image=subprocess.check_output(['docker','image','inspect',a.image,'--format','{{.Id}}'],text=True).strip();evidence=root/'test-results/t28-fix';evidence.mkdir(exist_ok=True)
assert before['candidateCommit']!=after['candidateCommit'];assert before['files']==after['files'];assert before['stableSource']==after['stableSource'];assert before['stableModes']==after['stableModes'];assert (old/'changes.patch').read_bytes()==(new/'changes.patch').read_bytes();assert len(after['files'])==3 and len(after['compatibilityFiles'])==2
for file,record in {**after['files'],**after['compatibilityFiles']}.items():
 f=root/file;assert sha(f.read_bytes())==record['sha256'];assert f.stat().st_mode&511==record['mode'];assert (new/'files'/file).read_bytes()==f.read_bytes()
stable=root/'test-results/t28/stable-inputs';listed=after['stableSource']['files'];assert {str(f.relative_to(stable)) for f in stable.rglob('*') if f.is_file()}==set(listed)
for file,digest in listed.items():assert sha((stable/file).read_bytes())==digest and (stable/file).stat().st_mode&511==after['stableModes'][file]
project=pathlib.Path(after['sourceProject']['directory']);previous=json.loads((root/'test-results/t28/project-a-before.json').read_text());generated=[]
for file,record in previous.items():
 f=project/file;actual={'sha256':sha(f.read_bytes()),'mode':f.stat().st_mode&511}
 if actual!=record:assert file=='apps/web/next-env.d.ts';generated.append({'path':file,'before':record,'after':actual})
for name in after['sourceProject']['retainedProjectOwnedPaths']:assert sha((project/name).read_bytes())==previous[name]['sha256'];assert (project/name).stat().st_mode&511==previous[name]['mode']
producer=root/'tests/scenarios/t28-target.mjs';assert sha(producer.read_bytes())==after['producerScriptSha256'];rows=[]
for label,bundle,commit in [('old-unapproved',old,before['candidateCommit']),('new-unapproved',new,after['candidateCommit']),('old-bundle-new-source-unapproved',old,after['candidateCommit'])]:
 assert not (bundle/'approval.json').exists();temp=pathlib.Path(tempfile.mkdtemp(prefix='t28-unapproved-'));output=temp/'output';output.mkdir();cmd=['docker','run','--rm','-e','TEMPLUX_SOURCE_COMMIT='+commit,'-v',str(bundle)+':/review:ro','-v',str(stable)+':/stable:ro','-v',str(producer)+':/producer.mjs:ro','-v',str(output)+':/release','--entrypoint','node',image,'/producer.mjs']
 try:
  r=subprocess.run(cmd,capture_output=True,text=True);assert r.returncode==1 and not r.stdout and not list(output.iterdir());assert json.loads(r.stderr)=={'event':'t28_test_release_refused'};rows.append({'case':label,'candidateCommit':json.loads((bundle/'candidate.json').read_text())['candidateCommit'],'sourceCommit':commit,'exit':r.returncode,'stdoutBytes':0,'outputFiles':0,'command':cmd})
 finally:shutil.rmtree(temp)
formal=root/'test-results/t25/committed-releases/0.1.0';m=json.loads((formal/'manifest.json').read_text());assert sha((formal/'manifest.json').read_bytes())==after['stableManifestSha256']
for package in m['packages']:assert sha((formal/package['file']).read_bytes())==package['sha256']
assert not list((root/'test-results/t28').rglob('0.1.1-t28.1'));result={'image':image,'newCandidate':after['candidateCommit'],'oldCandidate':before['candidateCommit'],'productFilesAndModesUnchanged':True,'productPatchUnchanged':after['patchSha256'],'stableFilesAndModes':len(listed),'projectASourceFilesChecked':len(previous),'knownGeneratedNextDeclaration':generated,'producerSha256':after['producerScriptSha256'],'producerSourceUnchanged':before['producerScriptSha256']==after['producerScriptSha256'],'newCompatibilityPatchSha256':after['compatibilityPatchSha256'],'unapprovedCases':rows,'approvalCreated':False,'newTemplateVersionCreated':False,'noApprovedPositiveOrMismatchClaim':True,'ownTempOutputsRemoved':True};(evidence/'rebind-proof.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='unapprovedCases'},indent=2))
