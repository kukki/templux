"""Read-only T27 evidence audit; container builds/checks are separate recorded commands.
Run from repository root after the isolated scenario. No credentials or database access.
"""
import argparse, hashlib, io, json, pathlib, subprocess, tarfile
p=argparse.ArgumentParser();p.add_argument('--evidence',default='test-results/t27');p.add_argument('--image',required=True);a=p.parse_args();b=pathlib.Path(a.evidence);root=pathlib.Path.cwd()
def sha(data):return hashlib.sha256(data).hexdigest()
def inventory(directory):return {str(f.relative_to(directory)):{'sha256':sha(f.read_bytes()),'mode':f.stat().st_mode&511} for f in sorted(directory.rglob('*')) if f.is_file()}
current=pathlib.Path((b/'current-path.txt').read_text().strip());before=json.loads((b/'inputs-before.json').read_text());names={'original':root.parent/'templux-t25-consumer-hjjpjxc4','previous':root.parent/'templux-t26-current-e0o8hffl','current':current}
# Previous evidence revisions used the label t26 rather than previous.
if 't26' in before:names['t26']=names.pop('previous')
for name,files in before.items():assert inventory(names[name])==files,name
producer=json.loads((b/'source-image.json').read_text());files={}
for f in producer['files']:
 host=sha((root/f).read_bytes());data=subprocess.run(['docker','run','--rm','--entrypoint','cat',a.image,'/opt/templux/'+f],capture_output=True,check=True).stdout;assert sha(data)==host,f;files[f]=host
source={'commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'image':a.image,'files':files};(b/'final-source-image.json').write_text(json.dumps(source,indent=2)+'\n')
def archive(path):
 with tarfile.open(path,'r:gz') as t:return {m.name:sha(t.extractfile(m).read()) for m in t.getmembers() if m.isfile()}
releases={};changed={}
for v in ['0.1.0','0.2.0-t26.1','0.3.0-t27.1']:
 d=b/'releases'/v;m=json.loads((d/'manifest.json').read_text());releases[v]={'manifestSha256':sha((d/'manifest.json').read_bytes()),'packages':{x['name']:x['sha256'] for x in m['packages']}}
 for package in m['packages']:assert sha((d/package['file']).read_bytes())==package['sha256']
for version,original in [('0.1.0',root/'test-results/t25/committed-releases/0.1.0'),('0.2.0-t26.1',root/'test-results/t26/releases/0.2.0-t26.1')]:
 assert inventory(b/'releases'/version)==inventory(original),version
base=b/'releases/0.1.0';target=b/'releases/0.3.0-t27.1'
for x,y in zip(json.loads((base/'manifest.json').read_text())['packages'],json.loads((target/'manifest.json').read_text())['packages']):
 old=archive(base/x['file']);new=archive(target/y['file']);diff=sorted(k for k in old.keys()|new.keys() if old.get(k)!=new.get(k));changed[x['name']]=diff
 # Public interface/version labels are deliberate test fixture deltas; auth/ops stay unchanged.
 assert not any(any(s in k for s in ['/auth','/session','/database','/maintenance','/backup','/restore']) for k in diff),diff
for path in [b/'proposals',b/'state',b/'menu-state',b/'menu-proposals',b/'schedule-state',b/'schedule-proposals']:
 assert not list(path.rglob('check.lock')),path
 for f in path.rglob('*'):
  if f.is_file():assert not any(s in f.read_bytes() for s in [b'SYNTHETIC_PRIVATE_TOKEN',b'OWN_T27_SECRET_SENTINEL',b'SYNTHETIC_WRAPPER_PRIVATE_TOKEN']),str(f)
result={'readonly':{name:len(v) for name,v in before.items()},'releases':releases,'packageFileChanges':changed,'syntheticTokenScan':'no matches in retained proposal/state trees','ownLocks':0,'sourceImageFiles':len(files)};(b/'final-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
