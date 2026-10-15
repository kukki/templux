#!/usr/bin/env python3
"""Normal host wrapper + public HTTP against an artifact-only disposable project.
Requires consumer-path.txt from the documented manual release/project copy.
Secrets remain in own 0700 credential/evidence directories, never stdout.
"""
import json,os,pathlib,subprocess,urllib.request,urllib.error,hashlib,time
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/t25'
PROJECT=pathlib.Path((OUT/'consumer-path.txt').read_text().strip())
assert PROJECT.parent==ROOT.parent and PROJECT.name.startswith('templux-t25-consumer-')
assert json.loads((PROJECT/'templux.lock.json').read_text())['version']=='0.1.0'
ENV={k:v for k,v in os.environ.items() if not k.startswith(('TEMPLUX_','COMPOSE_','FEISHU_')) and k!='DATABASE_URL'}
ENV.update(TEMPLUX_PROJECT_NAME='t25-consumer',TEMPLUX_HTTP_PORT='31325',TEMPLUX_API_PORT='31825',APP_PUBLIC_URL='http://localhost:31325',DEPLOYMENT_ENV='DEV',AGENT_LOGIN_ENABLED='true',TEMPLUX_HOST_UID='0',TEMPLUX_HOST_GID='0',PERSON_IDLE_TIMEOUT_SECONDS='3600',AGENT_IDLE_TIMEOUT_SECONDS='3600')
RESULTS=[]
def record(case,**data):
 RESULTS.append({'case':case,**data});(OUT/'consumer-proof.json').write_text(json.dumps(RESULTS,indent=2)+'\n');print(json.dumps(RESULTS[-1]),flush=True)
def run(args,expect=0,label=None,env=None):
 p=subprocess.run(args,cwd=PROJECT,env={**ENV,**(env or {})},capture_output=True,text=True,timeout=300)
 if label:
  for kind,data in [('stdout',p.stdout),('stderr',p.stderr)]:
   f=OUT/(label+'.'+kind);f.write_text(data);f.chmod(0o600)
 assert p.returncode==expect,f'{label or args[0]} returned {p.returncode}; inspect private diagnostics'
 return p.stdout
def cli(*args,expect=0,label=None,env=None):return json.loads(run([str(PROJECT/'templux'),*args,'--json'],expect,label,env))
def compose(*args,**kw):return run(['docker','compose','-f',str(PROJECT/'compose.yaml'),*args],**kw)
def req(path,cookie=None,body=None):
 headers={'Origin':ENV['APP_PUBLIC_URL']}
 if cookie:headers['Cookie']=cookie
 if body is not None:headers['Content-Type']='application/json'
 r=urllib.request.Request(ENV['APP_PUBLIC_URL']+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
 try:
  with urllib.request.urlopen(r,timeout=15) as response:return response.status,response.headers,response.read()
 except urllib.error.HTTPError as response:return response.code,response.headers,response.read()
def login(credential):
 status,headers,_=req('/api/auth/password',body={k:credential[k] for k in ['username','password']});assert status==200,status;return headers['Set-Cookie'].split(';')[0]
def sql(query,database='templux'):return compose('exec','-T','database','psql','-X','-At','-U','templux','-d',database,'-v','ON_ERROR_STOP=1','-c',query).strip()
def main():
 # Runtime settings live in the owned project's private file, which nested Compose
 # reads too. Shell-only settings not projected to management are not a substitute.
 keys=['TEMPLUX_PROJECT_NAME','TEMPLUX_HTTP_PORT','TEMPLUX_API_PORT','APP_PUBLIC_URL','DEPLOYMENT_ENV','AGENT_LOGIN_ENABLED','PERSON_IDLE_TIMEOUT_SECONDS','AGENT_IDLE_TIMEOUT_SECONDS']
 configured='\n'.join(key+'='+ENV[key] for key in keys)+'\n';envfile=PROJECT/'.env'
 if envfile.exists():assert envfile.read_text()==configured,'only the own fixture environment may be used'
 else:envfile.write_text(configured);envfile.chmod(0o600)
 assert cli('start',label='consumer-final-start')['ok']
 record('artifact-only-standard-start',schema=sql('SELECT max(version) FROM public.templux_migrations'),businessVersion=json.loads((PROJECT/'package.json').read_text())['version'],sharedVersion='0.1.0')
 person=cli('create-person','--username','quay.person','--name','Synthetic Quay Person','--credential-file','person.json','--confirm',label='consumer-create-person')
 credential=json.loads((PROJECT/'credentials/person.json').read_text());cookie=login(credential)
 assert req('/api/protected',cookie)[0]==403
 cli('authorize','--account',person['accountId'],'--roles','user','--confirm');assert req('/api/protected',cookie)[0]==401
 cookie=login(credential);assert req('/api/protected',cookie)[0]==200 and req('/api/business/greeting',cookie)[0]==403
 cli('authorize','--account',person['accountId'],'--roles','user,reviewer','--confirm');assert req('/api/protected',cookie)[0]==401
 cookie=login(credential);status,_,data=req('/api/business/greeting',cookie);value=json.loads(data);assert status==200 and value['greeting']=='Quay-owned business extension' and value['businessVersion']=='1.0.0'
 assert req('/api/business/greeting?accountId=999999',cookie)[0]==403
 assert req('/api/admin/accounts',cookie)[0]==403
 record('project-owned-route-role-union-scope',zeroRole=403,userOnly=403,reviewerUnion=200,scopeDenied=403,oldSessionAfterRoleChange=401,ordinaryAdminApi=403)
 agent=cli('create-agent','--username','quay.agent','--name','Synthetic Quay Agent','--owner',person['accountId'],'--credential-file','agent.json','--confirm')
 agent_credential=json.loads((PROJECT/'credentials/agent.json').read_text());old_agent=login(agent_credential);assert req('/api/protected',old_agent)[0]==403
 cli('authorize','--account',agent['accountId'],'--roles','reviewer','--confirm');assert req('/api/protected',old_agent)[0]==401
 agent_cookie=login(agent_credential);assert req('/api/business/greeting',agent_cookie)[0]==200
 record('independent-agent-real-password',zeroRole=403,authorized=200,oldSession=401,responsiblePerson=person['accountId'])
 admin=cli('create-person','--username','quay.admin','--name','Synthetic Quay Admin','--credential-file','admin.json','--confirm');cli('authorize','--account',admin['accountId'],'--roles','admin','--confirm')
 admin_cookie=login(json.loads((PROJECT/'credentials/admin.json').read_text()));assert req('/api/admin/accounts',admin_cookie)[0]==200 and req('/api/admin/audit',admin_cookie)[0]==200
 for path in ['/account','/examples','/business']:
  status,_,html=req(path,cookie);assert status==200 and b'Quay Lab' in html
 assert req('/api/fixture-authorize')[0]==404
 record('packaged-pages-elements-and-real-admin',pages=['account','examples','business'],brand='Quay Lab',orientation='horizontal',adminAccounts=200,adminAudit=200,fixture=404)
 check=json.loads(compose('run','--rm','--no-deps','migrate','--check','--json'));assert check['schemaVersion']=='0010'
 backup=cli('backup','--confirm',label='consumer-backup');assert backup['backupSucceeded']
 archive=PROJECT/'backups'/backup['id']/'archive.dump';assert archive.exists() and archive.stat().st_mode&0o777==0o600
 assert hashlib.sha256(archive.read_bytes()).hexdigest()==backup['sha256']
 record('packaged-migration-backup-resources',schema='0010',backup=True,hostBind=True,archiveMode='0600')
 sql('CREATE DATABASE t25_restored','postgres')
 restored=cli('restore','--mode','independent','--target','env:T25_TARGET_URL','--archive',backup['directory']+'/archive.dump','--sha256',backup['sha256'],'--confirm','--overwrite',env={'T25_TARGET_URL':'postgresql://templux:templux-local-only@database:5432/t25_restored'},label='consumer-restore')
 assert restored['restored'] and restored['stage']=='completed-offline'
 assert sql('SELECT count(*) FROM templux.auth_sessions','t25_restored')=='0' and sql('SELECT count(*) FROM templux.accounts','t25_restored')=='3'
 assert req('/api/protected',cookie)[0]==200
 record('packaged-independent-restore-resources',stage=restored['stage'],restoredAccounts=3,restoredSessions=0,currentConnectionUnchanged=200)
 state=cli('maintenance-status')['state'];cli('maintenance-start','--expected-version',state['version'],'--at','2026-01-01T00:00:00Z','--message','Synthetic package maintenance','--confirm')
 assert json.loads(req('/api/maintenance')[2])['state']['active']
 state=cli('maintenance-status')['state'];cli('maintenance-cancel','--expected-version',state['version'],'--confirm')
 state=cli('maintenance-status')['state'];cli('maintenance-halt','--expected-version',state['version'],'--confirm');assert req('/')[0]==503
 state=cli('maintenance-status')['state'];cli('maintenance-resume','--expected-version',state['version'],'--confirm');assert req('/api/protected',cookie)[0]==200
 record('packaged-maintenance-entry-and-release',noticePersisted=True,haltEntry=503,resumeProtected=200)
 private=OUT/'private';private.mkdir(exist_ok=True,mode=0o700);private.chmod(0o700)
 f=private/'browser.json';f.write_text(json.dumps({'username':credential['username'],'password':credential['password'],'cookie':cookie}));f.chmod(0o600)
 record('complete',cases=len(RESULTS)+1)
if __name__=='__main__':main()
