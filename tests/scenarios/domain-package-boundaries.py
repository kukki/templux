#!/usr/bin/env python3
"""Controlled packaging negatives and old-upgrade rejection, no stable artifact writes."""
import hashlib,json,pathlib,secrets,shutil,subprocess,tarfile,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/domain-environment';IMAGE=json.loads((OUT/'release-proof.json').read_text())['image'];COMMIT='59ad67bbdddf888d705b7e5de12388f9d035bbe6'
work=pathlib.Path(tempfile.mkdtemp(prefix='templux-domain-package-',dir=ROOT.parent));work.chmod(0o700)
results=[]
try:
 target=OUT/'releases/0.1.3-domain.1';manifest=json.loads((target/'manifest.json').read_text());sha=hashlib.sha256((target/'manifest.json').read_bytes()).hexdigest()
 # Product CLI uses actual old and new release artifacts, mounted read-only.
 old=ROOT/'test-results/t29/releases/0.1.2-t29.1/project';proposal=work/'proposal'
 command=['docker','run','--rm','-v',str(old)+':/old:ro','-v',str(target)+':/target:ro','-v',str(work)+':/result','--entrypoint','node',IMAGE,'tools/upgrade/cli.mjs','--current','/old','--target-release','/target','--target-version',manifest['version'],'--target-sha256',sha,'--output','/result/proposal']
 p=subprocess.run(command,text=True,capture_output=True,timeout=30);j=json.loads(p.stdout);assert p.returncode!=0 and not j['directlyApplicable']
 report=json.loads((proposal/'report.json').read_text());assert not report['directlyApplicable']and not(proposal/'candidate').exists()
 results.append({'case':'real-propose-old-to-new','exit':p.returncode,'manual':report['manual'],'noCandidate':True})
 code="""import {buildCatalog}from './tools/updates/catalog.mjs';import {findPath}from './tools/updates/versions.mjs';import {readFileSync}from'node:fs';const m=JSON.parse(readFileSync('/target/manifest.json'));if(findPath([{version:m.version,from:m.upgrade?.from??[]}],'0.1.2-t29.1',m.version,true)!==null)process.exit(3);try{buildCatalog('/artifacts',['new']);process.exit(4)}catch(e){console.log(JSON.stringify({noDeclaredPath:true,catalogRejected:e.code??'error'}));}"""
 p=subprocess.run(['docker','run','--rm','-v',str(target)+':/target:ro','-v',str(target.parent)+':/artifacts:ro','--entrypoint','node',IMAGE,'--input-type=module','-e',code.replace("['new']","['0.1.3-domain.1']")],text=True,capture_output=True,timeout=30);assert p.returncode==0,p.stderr
 result=json.loads(p.stdout);assert result['noDeclaredPath']and result['catalogRejected']!='error';results.append({'case':'discovery-no-edge-and-catalog-refuses-env-example','exit':p.returncode,**result})
 for kind in ['excluded','symlink']:
  output=work/kind;output.mkdir();marker='synthetic-not-for-artifact-'+secrets.token_hex(8)
  if kind=='excluded':
   setup="""import{mkdirSync,writeFileSync}from'node:fs';for(const p of ['shared/.env','shared/.env.prod','project-template/.env.local','project-template/secrets/private.key','project-template/credentials/password.json']){mkdirSync(p.slice(0,p.lastIndexOf('/')),{recursive:true});writeFileSync(p,process.env.TEST_MARKER)}await import('./tools/release/build.mjs');"""
  else:setup="""import{symlinkSync}from'node:fs';symlinkSync('/etc/passwd','shared/release-unsafe-link.txt');await import('./tools/release/build.mjs');"""
  # A fake test marker is delivered by environment, never ordinary outputs. These are fixture copies only.
  envfile=work/'fixture.env';envfile.write_text('TEMPLUX_SOURCE_COMMIT='+COMMIT+'\nTEST_MARKER='+marker+'\n');envfile.chmod(0o600)
  p=subprocess.run(['docker','run','--rm','--env-file',str(envfile),'-v',str(OUT/'release-overlay.json')+':/opt/templux/release.config.json:ro','-v',str(output)+':/release','--entrypoint','node',IMAGE,'--input-type=module','-e',setup,'/release'],text=True,capture_output=True,timeout=180)
  if kind=='excluded':
   assert p.returncode==0,p.stderr
   files=[p for p in output.rglob('*')if p.is_file()];assert files
   for file in files:
    assert marker.encode()not in file.read_bytes()
    if file.suffix=='.tgz':
     with tarfile.open(file)as tar:
      for member in tar.getmembers():
       assert member.name.rsplit('/',1)[-1]not in ['.env','.env.prod','.env.local','private.key','password.json']
       if member.isfile():assert marker.encode()not in tar.extractfile(member).read()
   assert (output/'0.1.3-domain.1/project/.env.example').is_file()
  else:assert p.returncode!=0 and not(output/'0.1.3-domain.1/complete.json').exists()
  assert marker not in p.stdout+p.stderr
  results.append({'case':'archive-'+kind,'exit':p.returncode,'markerAbsent':True,'fixtureOutputDeleted':True})
 (OUT/'package-boundaries.json').write_text(json.dumps(results,indent=2)+'\n');print('PASS',len(results),'package boundaries')
finally:shutil.rmtree(work)
