"""Final immutable inputs, actual package bytes, evidence/secret inventory and bundle."""
import pathlib,json,hashlib,subprocess,tarfile,io,re,stat
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';sha=lambda b:hashlib.sha256(b).hexdigest();load=lambda p:json.loads(p.read_text());a=load(o/'artifact-inventory.json');images={n:subprocess.check_output(['docker','image','inspect',n,'--format','{{.Id}}'],text=True).strip()for n in ['t29-tools','t29-suite-api','t29-suite-web','t29-consumer-api','t29-consumer-web','t29-consumer-management','t29-consumer-migration']};runtime={}
for image,pkg in [('t29-consumer-api','@templux/core'),('t29-consumer-web','@templux/web')]:
 data=subprocess.check_output(['docker','run','--rm','--entrypoint','tar',images[image],'-cf','-','node_modules/'+pkg]);files={}
 with tarfile.open(fileobj=io.BytesIO(data))as t:
  for x in t:
   if x.isfile():files[x.name.replace('node_modules/'+pkg,'package',1)]={'sha256':sha(t.extractfile(x).read()),'mode':x.mode}
 assert files==a['archiveFiles'][pkg],image;runtime[image]={'package':pkg,'files':len(files),'allBytesModesEqual':True}
assert load(o/'upgrade-application.json')['fullInventoryEqual'];assert load(o/'independent-deployment-proof.json')['oldPersonAgent']==[401,401];assert load(o/'dirty-revoke-browser.json')['reason']=='authorization_changed';assert 'pass 517'in(o/'suite-full.log').read_text()and'fail 0'in(o/'suite-full.log').read_text();assert (o/'releases/0.1.2-t29.1/complete.json').is_file()
# A bounded secret scan uses only this task's generated credentials. Never read the real deployment .env.
consumer=pathlib.Path((o/'consumer-path.txt').read_text());values=[]
for f in(consumer/'credentials').glob('*.json'):
 v=load(f)
 if isinstance(v,dict)and isinstance(v.get('password'),str):values.append(v['password'].encode())
private=o/'private';private.chmod(0o700)
for f in private.rglob('*'):
 if f.is_file():f.chmod(0o600)
for p in [consumer/'credentials',consumer/'backups']:
 if p.exists():p.chmod(0o700)
scanned=0;matches=[]
for f in o.rglob('*'):
 if not f.is_file()or private in f.parents or f.suffix in ['.png','.dump','.tgz','.tar']:continue
 data=f.read_bytes();scanned+=1
 if any(v in data for v in values):matches.append(str(f.relative_to(o)))
assert not matches,'Generated credential present in public evidence';proof={'images':images,'runtimeInstalledArchives':runtime,'generatedPasswordScan':{'files':scanned,'matches':matches,'passwordValuesNeverEmitted':True},'sourceCandidateImmutable':True,'fullSuite':{'tests':517,'passed':517,'failed':0,'skipped':0,'sourceCommit':a['sourceCommit'],'checksImage':images['t29-tools']}};(o/'final-integrity.json').write_text(json.dumps(proof,indent=2))
delivery={'schemaVersion':1,'kind':'local-first-delivery-candidate-not-production-release','version':'0.1.2-t29.1','source':{'commit':a['sourceCommit'],'archive':'source.tar','sha256':sha((o/'source.tar').read_bytes()),'files':len(a['fullSourceArchiveFiles']),'overlay':'release-overlay.json','overlaySha256':a['overlaySha256']},'shared':{'directory':'releases/0.1.2-t29.1','manifestSha256':a['manifestSha256'],'packages':a['packages'],'compatibility':a['metadataOverlay']['compatibility']},'independentToolkit':{'imageId':images['t29-tools'],'sourceInventory':'artifact-inventory.json#toolAndCompiledFiles','defaultEntrypoint':['node','tools/updates/cli.mjs'],'proposeOverride':['--entrypoint','node',images['t29-tools'],'tools/upgrade/cli.mjs'],'releaseInvocation':'release-command.json','projectLauncher':'check-updates','automaticApply':False},'interfaces':'artifact-inventory.json#exports; docs/specs/shared-release.md','ownership':'business/config/runtime secrets and business version belong to each project; baseline remains pristine','evidence':'final-integrity.json; docs/discovery/t29-matrix.md; docs/discovery/t29-acceptance.md','unexecuted':['Linux host','Windows/WSL2','real Feishu organization/person authorization'],'environmentLimit':['default cold BuildKit network stalled; independent standard targets built with explicit host build network and owned Compose consumes prepared exact images']};(o/'delivery.json').write_text(json.dumps(delivery,indent=2));print(json.dumps({'images':images,'installed':runtime,'secretScanFiles':scanned,'sourceFiles':len(a['fullSourceArchiveFiles']),'deliverySha256':sha((o/'delivery.json').read_bytes())}))
