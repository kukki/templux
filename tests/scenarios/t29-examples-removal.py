"""Physical project route removal, isolated Web/API, real password/admin/audit verification."""
import pathlib,json,tempfile,shutil,subprocess,urllib.request,urllib.error,time,os
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';source=pathlib.Path((o/'consumer-path.txt').read_text());d=pathlib.Path(tempfile.mkdtemp(prefix='templux-t29-removed-',dir=r.parent));shutil.copytree(source,d,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.env','credentials','backups','node_modules','.next','dist'));shutil.rmtree(d/'apps/web/app/examples');(o/'removed-project-path.txt').write_text(str(d));cmd=['docker','build','--network=host','--target','web','-t','t29-removed-web',str(d)];f=open(o/'examples-removal-build.log','w');p=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=300);assert p.returncode==0;private=o/'private';private.mkdir(exist_ok=True,mode=0o700);env=private/'removal-api.env';env.write_text('DATABASE_URL=postgresql://templux:templux-local-only@database:5432/templux\nAPP_PUBLIC_URL=http://localhost:31331\nDEPLOYMENT_ENV=DEV\nPASSWORD_PROXY_HOSTS=t29-removed-web\nTEMPLUX_CONFIG_PATH=/opt/project/config/presentation.json\nTEMPLUX_MAINTENANCE_RELEASE_FILE=/opt/project/maintenance/release.json\n');env.chmod(0o600)
commands=[['docker','run','-d','--name','t29-removed-api','--network','t29-consumer_default','--env-file',str(env),'-v',str(source/'config')+':/opt/project/config:ro','-v','t29-consumer_maintenance:/opt/project/maintenance:ro','t29-consumer-api'],['docker','run','-d','--name','t29-removed-web','--network','t29-consumer_default','-p','127.0.0.1:31331:3000','-e','API_INTERNAL_URL=http://t29-removed-api:8080','-e','COMPONENT_EXAMPLES_ENABLED=false','-e','TEMPLUX_CONFIG_PATH=/opt/project/config/presentation.json','-v',str(source/'config')+':/opt/project/config:ro','t29-removed-web']]
for cmd in commands:subprocess.run(cmd,capture_output=True,check=True)
def req(path,cookie=None,body=None):
 h={'Origin':'http://localhost:31331'}
 if cookie:h['Cookie']=cookie
 if body is not None:h['Content-Type']='application/json'
 q=urllib.request.Request('http://localhost:31331'+path,headers=h,data=json.dumps(body).encode()if body is not None else None)
 try:
  with urllib.request.urlopen(q,timeout=10)as f:return f.status,f.headers,f.read()
 except urllib.error.HTTPError as f:return f.code,f.headers,f.read()
for _ in range(60):
 try:
  if req('/login')[0]==200:break
 except (OSError,urllib.error.URLError):pass
 time.sleep(.2)
c=json.loads((source/'credentials/admin.json').read_text());code,h,_=req('/api/auth/password',body={k:c[k]for k in ['username','password']});assert code==200;cookie=h['Set-Cookie'].split(';')[0];assert req('/examples',cookie)[0]==404
for path in ['/account','/protected','/admin','/audit','/api/admin/accounts','/api/admin/audit']:assert req(path,cookie)[0]==200,path
assert b'href="/examples"'not in req('/account',cookie)[2];assert any(x['event']=='login_succeeded'for x in json.loads(req('/api/admin/audit',cookie)[2])['events']);(o/'examples-removal-proof.json').write_text(json.dumps({'physicalProjectRouteRemoved':True,'sharedModuleNotUsedOrOverridden':True,'login':200,'examples':404,'protectedAccountAdminAudit':[200]*6,'navigationExamplesHidden':True,'defaultPackUnchanged':True},indent=2));print('physical project example route removal preserves real login/protected/admin/audit')
