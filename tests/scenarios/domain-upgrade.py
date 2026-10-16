#!/usr/bin/env python3
"""Real v2 catalog/propose/discovery and external disposable application; never live apply."""
import hashlib,json,os,pathlib,secrets,shutil,subprocess,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2];SET=os.environ.get('DOMAIN_RELEASE_SET','v2');assert SET in ['v2','v3'];OUT=ROOT/'test-results/domain-environment'/SET;proof=json.loads((OUT/'release-proof.json').read_text());IMAGE=proof['image'];releases=OUT/'releases';CURRENT_VERSION=proof['artifacts']['current']['version'];TARGET_VERSION=proof['artifacts']['target']['version'];current_release=releases/CURRENT_VERSION;target=releases/TARGET_VERSION
work=pathlib.Path(tempfile.mkdtemp(prefix='templux-domain-upgrade-',dir=ROOT.parent));work.chmod(0o700);records=[];marker='synthetic-private-'+secrets.token_hex(16)
def inventory(root,drop_private=False):
 return {str(p.relative_to(root)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':oct(p.stat().st_mode&0o777)}for p in sorted(root.rglob('*'))if p.is_file()and not(drop_private and str(p.relative_to(root))in['.env','.env.prod','.env.local'])}
def docker(args,mounts,entry='node',timeout=180):
 cmd=['docker','run','--rm']
 for host,inside,mode in mounts:cmd+=['-v',str(host)+':'+inside+':'+mode]
 return subprocess.run(cmd+['--entrypoint',entry,IMAGE,*args],text=True,capture_output=True,timeout=timeout)
def propose(cur,out):
 args=['tools/upgrade/cli.mjs','--current','/current','--target-release','/target','--target-version',TARGET_VERSION,'--target-sha256',proof['artifacts']['target']['manifestSha256'],'--output','/results/'+out.name,'--trust-project-code','--behavior','tools/domain-behavior.mjs','--timeout-ms','120000']
 p=docker(args,[(cur,'/current','ro'),(target,'/target','ro'),(work,'/results','rw')]);j=json.loads(p.stdout);return p,j,json.loads((out/'report.json').read_text())if(out/'report.json').exists()else None
try:
 cur=work/'current';shutil.copytree(current_release/'project',cur)
 sample=cur/'.env.example';sample.write_text(sample.read_text().replace('TEMPLUX_PROJECT_NAME=project-app','TEMPLUX_PROJECT_NAME=business-custom'))
 for name in ['.env','.env.prod','.env.local']:(cur/name).write_text('PROJECT_PRIVATE='+marker+'\n');(cur/name).chmod(0o600)
 business=cur/'config/domain-business.json';business.write_text('{"owned":"project-only"}\n')
 api=cur/'apps/api/src/server.ts';api.write_text(api.read_text()+'\n// project-only customization retained\n')
 behavior=cur/'tools/domain-behavior.mjs';behavior.write_text("import{readFileSync}from'node:fs';import assert from'node:assert/strict';const e=readFileSync('.env.example','utf8');assert(e.includes('TEMPLUX_PROJECT_NAME=business-custom'));assert(e.includes('HEARTBEAT_INTERVAL_SECONDS=45'));assert.equal(JSON.parse(readFileSync('config/domain-business.json')).owned,'project-only');assert(readFileSync('apps/api/src/server.ts','utf8').includes('project-only customization'));assert.equal(JSON.parse(readFileSync('package.json')).version,'1.0.0');\n")
 before=inventory(cur);out=work/'proposal';p,j,r=propose(cur,out)
 if not j['directlyApplicable']:(OUT/'proposal-failure.json').write_text(json.dumps(r,indent=2)+'\n')
 assert p.returncode==0 and j['directlyApplicable'],r.get('manual')or r.get('checks')
 assert len(r['checks'])==7 and all(x['status']=='passed'for x in r['checks']);assert r['patchValidation']['status']=='passed'
 assert inventory(cur)==before
 assert (out/'candidate/.env.example').exists()
 for file in (out).rglob('*'):
  if file.is_file():assert marker.encode()not in file.read_bytes()
 for private in ['.env','.env.prod','.env.local']:assert not(out/'candidate'/private).exists()
 records.append({'case':'real-CLI-seven-checks','exit':p.returncode,'directlyApplicable':True,'patchValidation':r['patchValidation'],'checks':r['checks'],'inputReadonly':True})
 # Outside the tool: review artifact in one-time copy and apply complete patch + exact vendor changes.
 applied=work/'applied';shutil.copytree(cur,applied)
 vendor=json.loads((out/'vendor-replacements.json').read_text())
 for file in vendor:
  src=out/'candidate/vendor'/file['file'];assert src.parent==out/'candidate/vendor';shutil.copy2(src,applied/'vendor'/file['file'])
  if file.get('replaces')and file['replaces']!=file['file']:(applied/'vendor'/file['replaces']).unlink()
 cmd=['sh','-c','git -C /applied apply --check /proposal/changes.patch && git -C /applied apply /proposal/changes.patch']
 q=docker(cmd[1:],[(applied,'/applied','rw'),(out,'/proposal','ro')],entry='sh');assert q.returncode==0,q.stderr
 assert inventory(applied,True)==inventory(out/'candidate')
 assert all((applied/name).read_text()=='PROJECT_PRIVATE='+marker+'\n'for name in ['.env','.env.prod','.env.local'])
 q=docker(['-c','cd /applied && node .templux/verify.mjs . && npm ci --ignore-scripts --no-audit --no-fund && npm run build --workspace apps/api && npm run build --workspace apps/web && npm run typecheck && node tools/domain-behavior.mjs'],[(applied,'/applied','rw')],entry='sh',timeout=180)
 safe=(q.stdout+q.stderr).replace(marker,'[redacted]');(OUT/'external-applied-build.log').write_text(safe);assert q.returncode==0,safe[-600:]
 records.append({'case':'external-reviewed-apply','byteModeEqual':True,'privateEnvPreserved':True,'buildApiWebTypesBehavior':q.returncode})
 # An unchanged public sample relative to target still has to be copied, not dropped.
 unchanged=work/'unchanged';shutil.copytree(cur,unchanged);(unchanged/'.env.example').write_text((unchanged/'.env.example').read_text().replace('HEARTBEAT_INTERVAL_SECONDS=30','HEARTBEAT_INTERVAL_SECONDS=45'))
 p,j,ur=propose(unchanged,work/'unchanged-out');assert p.returncode==0 and j['directlyApplicable']and( work/'unchanged-out/candidate/.env.example').exists();records.append({'case':'public-example-current-equals-target','directlyApplicable':True,'checks':len(ur['checks'])})
 for kind in ['conflict','deleted','symlink']:
  c=work/kind;shutil.copytree(cur,c)
  if kind=='conflict':(c/'.env.example').write_text((c/'.env.example').read_text().replace('HEARTBEAT_INTERVAL_SECONDS=30','HEARTBEAT_INTERVAL_SECONDS=60'))
  else:(c/'.env.example').unlink()
  if kind=='symlink':(c/'.env.example').symlink_to('/etc/passwd')
  p,j,rr=propose(c,work/(kind+'-out'))
  if kind=='symlink':assert p.returncode==1 and not j['directlyApplicable']and not(work/(kind+'-out')/'candidate').exists()
  else:assert p.returncode==2 and not j['directlyApplicable']and any(x.get('kind')=='merge'for x in rr['manual'])
  records.append({'case':'public-example-'+kind,'exit':p.returncode,'manual':rr['manual']if rr else['safe-input-rejected']})
 # No-from control: actual old candidate to new candidate, using the corrected tool.
 old=ROOT/'test-results/domain-environment/releases/0.1.3-domain.1/project';control=work/'no-from'
 q=docker(['tools/upgrade/cli.mjs','--current','/old','--target-release','/current-release','--target-version',CURRENT_VERSION,'--target-sha256',proof['artifacts']['current']['manifestSha256'],'--output','/results/no-from'],[(old,'/old','ro'),(current_release,'/current-release','ro'),(work,'/results','rw')]);rr=json.loads((control/'report.json').read_text());assert q.returncode==2 and rr['manual'][0]['kind']=='unsupported-path';records.append({'case':'no-from-still-rejected','exit':q.returncode,'kind':rr['manual'][0]['kind']})
 # Actual full catalog builder and discovery download/cumulative/real checks, not a hand-made catalog.
 catalog=work/'catalog';catalog.mkdir();shutil.copytree(current_release,catalog/'current');shutil.copytree(target,catalog/'target')
 q=docker(['tools/updates/cli.mjs','catalog','--root','/catalog','--release','current','--release','target','--output','/catalog/catalog.json'],[(catalog,'/catalog','rw')]);assert q.returncode==0,q.stderr
 cj=json.loads((catalog/'catalog.json').read_text());assert all('project/.env.example'in x['files']and'project/.templux/baseline/project/.env.example'in x['files']for x in cj['releases'])
 config=work/'updates.json';config.write_text(json.dumps({'schemaVersion':1,'source':{'kind':'directory','root':'/catalog'},'targetVersion':TARGET_VERSION,'allowPrerelease':True,'trustProjectCode':True,'behavior':'tools/domain-behavior.mjs','checkTimeoutMs':120000}))
 q=docker(['tools/updates/cli.mjs','check','--current','/current','--config','/work/updates.json','--state','/work/state','--output','/work/discovery'],[(cur,'/current','ro'),(catalog,'/catalog','ro'),(work,'/work','rw')],timeout=240);result=json.loads(q.stdout)
 (OUT/'discovery-result.json').write_text(json.dumps(result,indent=2)+'\n');assert q.returncode==0 and result['ok'],result
 records.append({'case':'full-catalog-and-discovery','exit':q.returncode,'status':result['status'],'publicSampleCataloged':True})
 # Keep safe review artifacts only; never the real config or build cache.
 keep=OUT/'reviewed-proposal';shutil.copytree(out,keep)
 for cache in ['node_modules','apps/web/.next','apps/api/dist']:
  p=keep/'candidate'/cache
  if p.exists():shutil.rmtree(p)
 (OUT/'upgrade-proof.json').write_text(json.dumps({'records':records,'sourceCommit':proof['sourceCommit'],'image':IMAGE,'candidateManifest':proof['artifacts']['current']['manifestSha256'],'targetManifest':proof['artifacts']['target']['manifestSha256'],'inputReadonly':inventory(cur)==before,'privateMarkerAbsent':True,'ownTemporaryRemoved':True},indent=2)+'\n');print('PASS',len(records),'real upgrade/catalog cases')
finally:shutil.rmtree(work)
