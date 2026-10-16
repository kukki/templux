#!/usr/bin/env python3
import hashlib,json,pathlib,subprocess,tarfile
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/domain-environment/v2';COMMIT='412d1c759f75cd93f8bb81b56d11c5360407ca0c'
plan=json.loads((OUT/'plan.json').read_text());assert plan['sourceCommit']==COMMIT
for name,sha in plan['overlays'].items():assert hashlib.sha256((OUT/name).read_bytes()).hexdigest()==sha,name
source=OUT/'source';source.mkdir(mode=0o700);archive=OUT/'source.tar'
with archive.open('wb')as f:subprocess.run(['git','-c','tar.umask=0022','archive',COMMIT],cwd=ROOT,stdout=f,check=True)
with tarfile.open(archive)as t:t.extractall(source,filter='data')
output=OUT/'releases';output.mkdir()
def run(name,args):
 with(OUT/(name+'.log')).open('w')as f:p=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT,timeout=300)
 (OUT/(name+'.json')).write_text(json.dumps({'command':args,'exit':p.returncode},indent=2)+'\n');assert p.returncode==0,name
run('tools-build',['docker','build','--progress=plain','--target','updates-tools','-t','templux-domain-v2-tools',str(source)])
image=subprocess.check_output(['docker','image','inspect','templux-domain-v2-tools','--format','{{.Id}}'],text=True).strip();artifacts={}
for kind,version,config in [('current','0.1.3-domain.2','current-release.json'),('target','0.1.4-domain.1','target-release.json')]:
 args=['docker','run','--rm','--name','templux-domain-v2-release-'+kind,'-e','TEMPLUX_SOURCE_COMMIT='+COMMIT,'-v',str(OUT/config)+':/opt/templux/release.config.json:ro','-v',str(output)+':/release']
 if kind=='target':
  args+=['-v',str(OUT/'target-root.env.example')+':/opt/templux/.env.example:ro','-v',str(OUT/'target-project.env.example')+':/opt/templux/project-template/.env.example:ro']
 args+=['--entrypoint','node',image,'tools/release/build.mjs','/release'];run(kind+'-generate',args)
 release=output/version;manifest=json.loads((release/'manifest.json').read_text());assert manifest['source']['commit']==COMMIT
 if kind=='current':assert 'upgrade'not in manifest
 else:assert manifest['upgrade']['from']==['0.1.3-domain.2'] and'HEARTBEAT_INTERVAL_SECONDS=45'in(release/'project/.env.example').read_text()
 artifacts[kind]={'version':version,'manifestSha256':hashlib.sha256((release/'manifest.json').read_bytes()).hexdigest(),'files':{str(p.relative_to(release)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':oct(p.stat().st_mode&0o777)}for p in release.rglob('*')if p.is_file()}}
(OUT/'release-proof.json').write_text(json.dumps({'sourceCommit':COMMIT,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'image':image,'overlays':plan['overlays'],'artifacts':artifacts},indent=2)+'\n');print('PASS v2 local artifacts')
