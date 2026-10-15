"""Verify approved local test release boundaries, inventory and archive payloads."""
import pathlib,json,hashlib,tarfile
r=pathlib.Path.cwd();base=r/'test-results/t25/committed-releases/0.1.0';new=r/'test-results/t28/releases/0.1.1-t28.1';load=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();a=load(base/'manifest.json');b=load(new/'manifest.json');proof=load(new.parent/'input-proof.json');assert b['source']['files']==proof['selectedFiles'];assert b['source']['commit']==proof['candidateCommit']=='4d69b683f7f1edefef2d6261895de9f368869f5d';assert len(b['source']['files'])==198;changed=[p for p,h in a['source']['files'].items()if b['source']['files'][p]!=h];assert sorted(changed)==sorted(proof['changedFiles']);assert len(changed)==5;assert b['upgrade']['from']==['0.1.0'];assert load(new/'complete.json')['manifestSha256']==sha(new/'manifest.json');assert sha(new/'project/.templux/verify.mjs')==b['source']['files']['tools/release/verify.mjs'];diffs={}
for old,pkg in zip(a['packages'],b['packages']):
 assert sha(new/pkg['file'])==pkg['sha256']
 def entries(path):
  with tarfile.open(path)as t:return{f.name:(f.mode,t.extractfile(f).read())for f in t.getmembers()if f.isfile()}
 x,y=entries(base/old['file']),entries(new/pkg['file']);assert x.keys()==y.keys();d=[p for p in x if x[p]!=y[p]];diffs[pkg['name']]=d
 assert not any('tools/updates' in p or 't26-isolated-target' in str(y[p])for p in y)
assert diffs['@templux/core']==['package/package.json', 'package/shared/copy.mjs', 'package/shared/copy.d.mts']
assert sorted(diffs['@templux/web'])==sorted(['package/package.json','package/apps/web/app/components/elements/copy-button.tsx','package/shared/copy.mjs','package/shared/copy.d.mts'])
result={'version':b['version'],'manifestSha256':sha(new/'manifest.json'),'sourceFiles':198,'changedFiles':changed,'archiveDifferences':diffs,'packages':b['packages'],'verifierMatches':True};(r/'test-results/t28/release-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
