#!/usr/bin/env python3
"""Generate only the TL-authorized local new-consumer candidate, exclusive output."""
import hashlib,json,pathlib,subprocess,tarfile
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/domain-environment'
COMMIT='59ad67bbdddf888d705b7e5de12388f9d035bbe6';OVERLAY='22ca0e1cad60e5e34d1119279fcfde974caee3742d877905e8d2269c8540aea8'
source=OUT/'release-source';source.mkdir(mode=0o700);archive=OUT/'source.tar'
with archive.open('wb')as f:subprocess.run(['git','-c','tar.umask=0022','archive',COMMIT],cwd=ROOT,stdout=f,check=True)
with tarfile.open(archive)as tar:tar.extractall(source,filter='data')
overlay=OUT/'release-overlay.json';assert hashlib.sha256(overlay.read_bytes()).hexdigest()==OVERLAY
output=OUT/'releases';output.mkdir(mode=0o755)
def run(name,args,timeout=300):
 with(OUT/(name+'.log')).open('w')as f:p=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT,timeout=timeout)
 (OUT/(name+'.json')).write_text(json.dumps({'command':args,'exit':p.returncode},indent=2)+'\n');assert p.returncode==0,name
run('release-build',['docker','build','--progress=plain','--target','release-tools','-t','templux-domain-release-tools',str(source)])
image=subprocess.check_output(['docker','image','inspect','templux-domain-release-tools','--format','{{.Id}}'],text=True).strip()
run('release-generate',['docker','run','--rm','--name','templux-domain-release','-e','TEMPLUX_SOURCE_COMMIT='+COMMIT,'-v',str(overlay)+':/opt/templux/release.config.json:ro','-v',str(output)+':/release','--entrypoint','node',image,'tools/release/build.mjs','/release'])
release=output/'0.1.3-domain.1';manifest=json.loads((release/'manifest.json').read_text());assert 'upgrade'not in manifest
assert manifest['source']['commit']==COMMIT
files={str(p.relative_to(release)):hashlib.sha256(p.read_bytes()).hexdigest()for p in release.rglob('*')if p.is_file()}
for suffix in ['project/.env.example','project/compose.traefik.yaml','project/tools/environment.mjs']:assert suffix in files,suffix
for p in release.glob('*.tgz'):
 with tarfile.open(p)as tar:
  package=json.load(tar.extractfile('package/package.json'))
  assert all('./'+x in package['exports']for x in ['environment','environment-cli','environment-startup'])
(OUT/'release-proof.json').write_text(json.dumps({'sourceCommit':COMMIT,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'overlaySha256':OVERLAY,'image':image,'manifestSha256':files['manifest.json'],'noUpgradeFrom':True,'files':files},indent=2)+'\n')
print('PASS local candidate',files['manifest.json'])
