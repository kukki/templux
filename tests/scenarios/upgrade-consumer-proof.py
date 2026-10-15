#!/usr/bin/env python3
"""Reviewed disposable copy only; normal host wrapper, real SQL/password/session."""
import pathlib,json,os,subprocess,urllib.request,urllib.error,time
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/t26';PROJECT=pathlib.Path((OUT/'reviewed-path.txt').read_text().strip())
assert PROJECT.parent==ROOT.parent and PROJECT.name.startswith('templux-t26-reviewed-')
assert json.loads((PROJECT/'templux.lock.json').read_text())['version']=='0.2.0-t26.1'
ENV={k:v for k,v in os.environ.items() if not k.startswith(('TEMPLUX_','COMPOSE_','FEISHU_')) and k!='DATABASE_URL'}
ENV.update(TEMPLUX_PROJECT_NAME='t26-reviewed',TEMPLUX_HTTP_PORT='31326',TEMPLUX_API_PORT='31826',APP_PUBLIC_URL='http://localhost:31326',DEPLOYMENT_ENV='DEV',AGENT_LOGIN_ENABLED='true',TEMPLUX_HOST_UID='0',TEMPLUX_HOST_GID='0',PERSON_IDLE_TIMEOUT_SECONDS='3600',AGENT_IDLE_TIMEOUT_SECONDS='3600')
RESULTS=[]
def record(case,**kw):
 RESULTS.append({'case':case,**kw});(OUT/'consumer-proof.json').write_text(json.dumps(RESULTS,indent=2)+'\n');print(json.dumps(RESULTS[-1]),flush=True)
def run(args,label=None,expect=0):
 p=subprocess.run(args,cwd=PROJECT,env=ENV,capture_output=True,text=True,timeout=600)
 if label:
  for suffix,content in [('stdout',p.stdout),('stderr',p.stderr)]:
   q=OUT/(label+'.'+suffix);q.write_text(content);q.chmod(0o600)
 assert p.returncode==expect,f'{label or args[0]} returned {p.returncode}; own diagnostics retained'
 return p.stdout
def cli(*args,**kw):return json.loads(run([str(PROJECT/'templux'),*args,'--json'],**kw))
def compose(*args,**kw):return run(['docker','compose','-f',str(PROJECT/'compose.yaml'),*args],**kw)
def request(path,cookie=None,body=None):
 headers={'Origin':ENV['APP_PUBLIC_URL']}
 if cookie:headers['Cookie']=cookie
 if body is not None:headers['Content-Type']='application/json'
 r=urllib.request.Request(ENV['APP_PUBLIC_URL']+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
 try:
  with urllib.request.urlopen(r,timeout=15) as z:return z.status,z.headers,z.read()
 except urllib.error.HTTPError as z:return z.code,z.headers,z.read()
def login(c):
 status,headers,_=request('/api/auth/password',body={k:c[k] for k in ['username','password']});assert status==200;return headers['Set-Cookie'].split(';')[0]
def main():
 keys=['TEMPLUX_PROJECT_NAME','TEMPLUX_HTTP_PORT','TEMPLUX_API_PORT','APP_PUBLIC_URL','DEPLOYMENT_ENV','AGENT_LOGIN_ENABLED','PERSON_IDLE_TIMEOUT_SECONDS','AGENT_IDLE_TIMEOUT_SECONDS']
 p=PROJECT/'.env';assert not p.exists();p.write_text('\n'.join(k+'='+ENV[k] for k in keys)+'\n');p.chmod(0o600)
 assert cli('start',label='reviewed-start')['ok']
 schema=compose('exec','-T','database','psql','-X','-At','-U','templux','-d','templux','-c','SELECT max(version) FROM public.templux_migrations').strip();assert schema=='0010'
 record('reviewed-copy-standard-start',schema=schema,sharedVersion='0.2.0-t26.1',businessVersion='1.0.0')
 person=cli('create-person','--username','upgrade.person','--name','Synthetic Upgrade Person','--credential-file','person.json','--confirm',label='create-person');cred=json.loads((PROJECT/'credentials/person.json').read_text());cookie=login(cred);assert request('/api/protected',cookie)[0]==403
 cli('authorize','--account',person['accountId'],'--roles','user,reviewer','--confirm');assert request('/api/protected',cookie)[0]==401;cookie=login(cred)
 s,_,b=request('/api/business/greeting',cookie);assert s==200 and json.loads(b)['greeting']=='Quay-owned business extension'
 assert request('/api/business/greeting?accountId=999999',cookie)[0]==403 and request('/api/admin/accounts',cookie)[0]==403
 record('person-normal-password-business-scope',zeroRole=403,roleChangeOldSession=401,business=200,scope=403,admin=403)
 agent=cli('create-agent','--username','upgrade.agent','--name','Synthetic Upgrade Agent','--owner',person['accountId'],'--credential-file','agent.json','--confirm');agentcred=json.loads((PROJECT/'credentials/agent.json').read_text());acookie=login(agentcred);assert request('/api/protected',acookie)[0]==403
 cli('authorize','--account',agent['accountId'],'--roles','reviewer','--confirm');assert request('/api/protected',acookie)[0]==401;acookie=login(agentcred);assert request('/api/business/greeting',acookie)[0]==200
 record('agent-real-password',zeroRole=403,authorized=200,oldSession=401)
 for page in ['/business','/examples','/account']:
  s,_,html=request(page,cookie);assert s==200 and b'Quay Lab' in html
 assert request('/api/fixture-authorize')[0]==404
 record('project-brand-pages-elements',pages=3,brand='Quay Lab',productionFixture=404)
 compose('restart','api','web',label='normal-restart')
 for _ in range(50):
  try:
   if request('/api/business/greeting',cookie)[0]==200:break
  except Exception:pass
  time.sleep(1)
 else:raise AssertionError('restart session did not recover')
 assert request('/api/business/greeting',acookie)[0]==200
 cli('authorize','--account',person['accountId'],'--roles','user','--confirm');assert request('/api/protected',cookie)[0]==401;cookie=login(cred);assert request('/api/business/greeting',cookie)[0]==403
 record('session-restart-and-revocation',restartPerson=200,restartAgent=200,revokedOld=401,newRestrictedBusiness=403)
 assert json.loads(compose('run','--rm','--no-deps','migrate','--check','--json'))['schemaVersion']=='0010'
 record('packaged-operation-resources',migrationCheck='0010')
if __name__=='__main__':main()
