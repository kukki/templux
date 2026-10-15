"""Read-only final ownership and immutable artifact proof; generated caches excluded."""
import pathlib,json,hashlib,subprocess
r=pathlib.Path.cwd();out=r/'test-results/t28';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();load=lambda p:json.loads(p.read_text())
assert sha(out/'candidate/approval.json')=='a7a76de70dbf9e5aba2a68096fcaec4b57018e6e60df78a079ca8a5ef314a56f';assert sha(r/'tests/scenarios/t28-target.mjs')=='8622e6d0ee5bcc688202352f7f361244c8ffb13443d2782bb0aa559f71eba2ee'
b=pathlib.Path((out/'project-b-path.txt').read_text());expected=load(out/'project-b-input.json');actual={str(f.relative_to(b)):{'sha256':sha(f),'mode':f.stat().st_mode&511}for f in b.rglob('*')if f.is_file()};assert actual==expected
stable=r/'test-results/t25/committed-releases/0.1.0';assert sha(stable/'manifest.json')=='bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc'
for p in load(stable/'manifest.json')['packages']:assert sha(stable/p['file'])==p['sha256']
a=pathlib.Path((out/'project-a-path.txt').read_text());old=load(out/'project-a-before.json');changed=[]
for p,e in old.items():
 f=a/p
 if not f.is_file()or sha(f)!=e['sha256']or f.stat().st_mode&511!=e['mode']:changed.append(p)
assert changed==['apps/web/next-env.d.ts'] # Recorded Next production-build generated declarations only.
applied=pathlib.Path((out/'project-b-applied-path.txt').read_text());report=load(out/'b-upgrade/proposal-verified/report.json');bad=[]
for p,e in report['final']['files'].items():
 f=applied/p
 if sha(f)!=e['sha256']or f.stat().st_mode&511!=e['mode']:bad.append(p)
assert not bad
assert load(applied/'package.json')['version']=='1.0.0';assert load(applied/'config/project-owned.json')['owner']=='Meadow';assert 'Meadow planning board extension'in(applied/'apps/api/src/server.ts').read_text();assert load(applied/'.templux/baseline/project/config/presentation.json')['project']['name']!='Meadow Lab'
paths=['tools/upgrade/'+p+'.mjs'for p in['cli','propose','delivery','checks','files','merge']]+['tools/release/verify.mjs'];image='t28-semver-final';toolProof={}
for p in paths:
 x=subprocess.check_output(['docker','run','--rm','--entrypoint','sha256sum',image,p],text=True).split()[0];assert x==sha(r/p);toolProof[p]={'imageSha256':x,'currentSha256':sha(r/p),'matchesCurrent':x==sha(r/p)}
result={'originalBReadonly':True,'businessVersion':'1.0.0','brand':'Meadow Lab','businessApiPreserved':True,'baselinePristine':True,'applicationFinalSourceMatches':True,'formal01ArtifactsUnchanged':True,'projectAOriginalFiles':len(old),'projectAGeneratedOnly':changed,'producerApprovalUnchanged':True,'toolImage':subprocess.check_output(['docker','image','inspect',image,'--format','{{.Id}}'],text=True).strip(),'toolSourceHashes':toolProof};(out/'final-ownership-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
