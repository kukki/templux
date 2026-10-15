"""Explicit future independent deployment, only own restored database and network."""
import pathlib,json,subprocess,os,tempfile,shutil,urllib.request,urllib.error,time
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';source=pathlib.Path((o/'consumer-path.txt').read_text());env={k:v for k,v in os.environ.items()if not k.startswith(('TEMPLUX_','COMPOSE_','FEISHU_'))and k!='DATABASE_URL'};env.update(TEMPLUX_HOST_UID='0',TEMPLUX_HOST_GID='0')
def cli(project,*args,extra=None):
 p=subprocess.run([str(project/'templux'),*args,'--json'],cwd=project,env={**env,**(extra or{})},capture_output=True,text=True,timeout=120);assert p.returncode==0,'Own CLI failed; no secret diagnostics printed';return json.loads(p.stdout)
def req(port,path,cookie=None,body=None):
 h={'Origin':f'http://localhost:{port}'}
 if cookie:h['Cookie']=cookie
 if body is not None:h['Content-Type']='application/json'
 q=urllib.request.Request(f'http://localhost:{port}'+path,headers=h,data=json.dumps(body).encode()if body is not None else None)
 try:
  with urllib.request.urlopen(q,timeout=15)as f:return f.status,f.headers,f.read()
 except urllib.error.HTTPError as f:return f.code,f.headers,f.read()
def login(port,c):
 code,h,_=req(port,'/api/auth/password',body={k:c[k]for k in ['username','password']});assert code==200;return h['Set-Cookie'].split(';')[0]
creds=[json.loads((source/'credentials'/n).read_text())for n in ['person.json','agent.json']];old=[login(31329,c)for c in creds];backup=cli(source,'backup','--confirm');result=cli(source,'restore','--mode','independent','--target','env:T29_TARGET_URL','--archive',backup['directory']+'/archive.dump','--sha256',backup['sha256'],'--confirm','--overwrite',extra={'T29_TARGET_URL':'postgresql://templux:templux-local-only@database:5432/t29_restored'});assert result['restored']and result['stage']=='completed-offline';assert[req(31329,'/api/protected',c)[0]for c in old]==[200,200]
d=pathlib.Path(tempfile.mkdtemp(prefix='templux-t29-restored-',dir=r.parent));shutil.copytree(source,d,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.env','credentials','backups','node_modules','.next','dist'));(o/'restored-project-path.txt').write_text(str(d));network='t29-restored-runtime';subprocess.run(['docker','network','create',network],check=True,capture_output=True);subprocess.run(['docker','network','connect','--alias','restored-db',network,'t29-consumer-database-1'],check=True,capture_output=True);p=d/'compose.yaml';p.write_text(p.read_text()+'\nnetworks:\n  default:\n    external: true\n    name: t29-restored-runtime\n');f=d/'.env';f.write_text('TEMPLUX_PROJECT_NAME=t29-restored\nTEMPLUX_HTTP_PORT=31330\nTEMPLUX_API_PORT=31830\nAPP_PUBLIC_URL=http://localhost:31330\nDEPLOYMENT_ENV=DEV\nAGENT_LOGIN_ENABLED=true\nDATABASE_URL=postgresql://templux:templux-local-only@restored-db:5432/t29_restored\n');f.chmod(0o600)
base=['docker','compose','--project-directory',str(d),'-f',str(d/'compose.yaml')];q=subprocess.run(base+['up','-d','--wait','entry'],cwd=d,env=env,capture_output=True,text=True);assert q.returncode==0;assert req(31330,'/')[0]==503;state=cli(d,'maintenance-status')['state'];cli(d,'maintenance-resume','--expected-version',state['version'],'--confirm');assert[req(31330,'/api/protected',c)[0]for c in old]==[401,401];assert[req(31330,'/api/protected',login(31330,c))[0]for c in creds]==[200,200];assert[req(31329,'/api/protected',c)[0]for c in old]==[200,200]
proof={'explicitFutureTargetDeployment':True,'oldPersonAgent':[401,401],'newPersonAgent':[200,200],'sourceOldSessionsUnchanged':[200,200],'initialEntryClosed':503,'independentNoAutomaticConnectionSwitch':True,'sameAccountsRolesResponsibility':True};(o/'independent-deployment-proof.json').write_text(json.dumps(proof,indent=2));print(json.dumps(proof))
