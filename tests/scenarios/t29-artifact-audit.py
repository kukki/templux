"""Bounded source/image/package/exports inventory for the complete local candidate."""
import pathlib,json,subprocess,hashlib,tarfile,io,re
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';s=pathlib.Path((o/'source-path.txt').read_text());d=o/'releases/0.1.2-t29.1';sha=lambda b:hashlib.sha256(b).hexdigest();load=lambda p:json.loads(p.read_text());m=load(d/'manifest.json');image=subprocess.check_output(['docker','image','inspect','t29-tools','--format','{{.Id}}'],text=True).strip();assert m['source']['commit']=='c02ac42859b7140a5e76f7b4126b18973bbdd84f';assert len(m['source']['files'])==201;assert m['upgrade']['from']==['0.1.0','0.1.1-t28.1'];assert load(d/'complete.json')['manifestSha256']==sha((d/'manifest.json').read_bytes())
for f,h in m['source']['files'].items():assert sha((s/f).read_bytes())==h,f
payload=subprocess.check_output(['docker','run','--rm','--entrypoint','tar',image,'-cf','-','tools','apps/api/dist','release.config.json'])
with tarfile.open(fileobj=io.BytesIO(payload))as t:toolFiles={x.name:{'sha256':sha(t.extractfile(x).read()),'mode':x.mode}for x in t if x.isfile()}
for p,e in toolFiles.items():
 if p.startswith('tools/'):assert sha((s/p).read_bytes())==e['sha256'],p
archiveSource={}
with tarfile.open(o/'source.tar')as t:
 for x in t:
  if x.isfile():
   assert not x.issym()and not x.islnk();data=t.extractfile(x).read();assert data==(s/x.name).read_bytes();assert x.mode==((s/x.name).stat().st_mode&511);archiveSource[x.name]={'sha256':sha(data),'mode':x.mode}
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',m['source']['commit']],cwd=r,text=True).splitlines();assert set(archiveSource)==set(tracked)
assert not any(p=='.env'or p.startswith('test-results/')or p.startswith('credentials/')for p in archiveSource)
archives={};exports={}

for p in m['packages']:
 assert sha((d/p['file']).read_bytes())==p['sha256'];contents={}
 with tarfile.open(d/p['file'])as t:
  for x in t:
   assert not x.issym()and not x.islnk();assert x.isfile()or x.isdir();assert not x.name.startswith('/')and '..'not in pathlib.PurePosixPath(x.name).parts
   assert not any(part in ['tests','test-results','credentials','backups','.git','node_modules','.next']or part=='.env'or part.startswith('.env.')for part in pathlib.PurePosixPath(x.name).parts)
   if x.isfile():contents[x.name]={'sha256':sha(t.extractfile(x).read()),'mode':x.mode}
  pkg=json.loads(t.extractfile('package/package.json').read());exports[p['name']]=pkg['exports'];assert pkg['version']==m['version'];assert t.extractfile('package/config/presentation.json').read()==(s/'shared/default-presentation.json').read_bytes()
 if p['name']=='@templux/core':
  for f,e in contents.items():
   if f.startswith('package/apps/api/dist/'):assert e['sha256']==toolFiles[f.removeprefix('package/')]['sha256'],f
  for f in(s/'database/migrations').glob('*.sql'):assert contents['package/database/migrations/'+f.name]['sha256']==sha(f.read_bytes())
 archives[p['name']]=contents
stable=r/'test-results/t25/committed-releases/0.1.0';sm=load(stable/'manifest.json');changes={p:('add'if p not in sm['source']['files']else'change')for p,h in m['source']['files'].items()if sm['source']['files'].get(p)!=h};assert len(changes)==8;assert not set(sm['source']['files'])-set(m['source']['files'])
for old in [stable,r/'test-results/t28/releases/0.1.1-t28.1']:
 om=load(old/'manifest.json');assert sha((old/'manifest.json').read_bytes())==('bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc'if old==stable else'9f5b0e2578cc3eb3d7b0d515365e12af43d0c126a04cd5c3d98ade47ef286b06')
 for p in om['packages']:assert sha((old/p['file']).read_bytes())==p['sha256']
routes={}
for f in(s/'apps/api/src').glob('*.ts'):
 paths=sorted(set(re.findall(r"['\"](/api/[a-zA-Z0-9_/:.-]+)['\"]",f.read_text())))
 if paths:routes[str(f.relative_to(s))]=paths
proof={'sourceCommit':m['source']['commit'],'sourceArchiveSha256':sha((o/'source.tar').read_bytes()),'metadataOverlay':load(o/'release-overlay.json'),'overlaySha256':sha((o/'release-overlay.json').read_bytes()),'sourceFiles':201,'formal01Diff':changes,'manifestSha256':sha((d/'manifest.json').read_bytes()),'packages':m['packages'],'toolImage':image,'fullSourceArchiveFiles':archiveSource,'toolAndCompiledFiles':toolFiles,'archiveFiles':archives,'exports':exports,'apiLiteralInventoryNotExhaustive':routes,'sourceDockerfileSha256':sha((s/'Dockerfile').read_bytes()),'priorPackagesUnchanged':True};(o/'artifact-inventory.json').write_text(json.dumps(proof,indent=2));print(json.dumps({k:v for k,v in proof.items()if k not in ['fullSourceArchiveFiles','toolAndCompiledFiles','archiveFiles','exports','apiLiteralInventoryNotExhaustive']}))
