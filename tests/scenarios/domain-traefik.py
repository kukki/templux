#!/usr/bin/env python3
"""Real own Traefik Docker-provider + TLS + standard wrapper/SQL/entry exercise."""
import hashlib,http.client,json,os,pathlib,secrets,shutil,socket,ssl,subprocess,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/domain-environment';OUT.mkdir(parents=True,exist_ok=True)
nonce=secrets.token_hex(4);name='tdomain-'+nonce;network=name+'-edge';proxy=name+'-proxy'
work=pathlib.Path(tempfile.mkdtemp(prefix='templux-domain-real-',dir=ROOT.parent));os.chmod(work,0o700)
records=[];secret_values=[];context=ssl._create_unverified_context();projectA=name+'-a';projectB=name+'-b'
def call(args,cwd=None,env=None,allow=False,timeout=180):
 p=subprocess.run(args,cwd=cwd,env=env,text=True,capture_output=True,timeout=timeout)
 if p.returncode and not allow:raise RuntimeError('command failed '+str(args[:3])+' '+p.stderr[-1200:])
 return p

def dc(project,*args,allow=False):
 return call(['docker','compose','--project-directory',str(project),'-f',str(project/'compose.yaml'),'-f',str(project/'compose.traefik.yaml'),*args],allow=allow)

def cli(*args,allow=False):
 p=call(['./templux',*map(str,args),'--json'],cwd=work/'a',env={**os.environ,'TEMPLUX_TRAEFIK':'1','TEMPLUX_HOST_UID':'0','TEMPLUX_HOST_GID':'0'},allow=allow)
 try:j=json.loads(p.stdout)
 except:raise RuntimeError('CLI stdout not single JSON: '+p.stdout[:200]+' '+p.stderr[-500:])
 if not allow:assert p.returncode==0 and j['ok'],j
 records.append({'case':'cli '+str(args[0]),'exit':p.returncode,'ok':j.get('ok')});return j
class Connection(http.client.HTTPSConnection):
 def connect(self):self.sock=context.wrap_socket(socket.create_connection(('127.0.0.1',port),timeout=8),server_hostname=self.host)
def req(host,path='/',body=None,cookie=None,origin=None,headers=None):
 c=Connection(host,443,timeout=10);h={'Host':host,**(headers or{})}
 if origin:h['Origin']=origin
 if cookie:h['Cookie']=cookie
 data=None
 if body is not None:data=json.dumps(body);h['Content-Type']='application/json'
 c.request('POST'if body is not None else'GET',path,body=data,headers=h);r=c.getresponse();value=r.read();head=dict(r.getheaders());status=r.status;c.close();return status,head,value

def write_env(path,host,db,peer,password):
 text=(ROOT/'.env.example').read_text();values={'TEMPLUX_PROJECT_NAME':projectA if path.name=='a'else projectB,'DEPLOYMENT_ENV':'UAT','TEMPLUX_DB_PASSWORD':password,'DATABASE_URL':db,'APP_PUBLIC_URL':'https://'+host,'TEMPLUX_ACCESS_MODE':'traefik','APP_HOST':host,'DOMAIN_NAME':'example.test','NETWORK_NAME':network,'ENTRY_TRUSTED_PROXY_CIDRS':peer+'/32'}
 import re
 for k,v in values.items():text=re.sub(r'^'+k+r'=.*$',lambda m:k+'='+v,text,flags=re.M)
 (path/'.env').write_text(text);(path/'.env').chmod(0o600)

def copy_source(to):
 to.mkdir();paths=set(call(['git','ls-files'],cwd=ROOT).stdout.splitlines())
 paths.update(['compose.traefik.yaml','shared/environment.mjs','shared/environment-cli.mjs','shared/environment-startup.mjs','project-template/.env.example','project-template/compose.traefik.yaml','project-template/tools/environment.mjs'])
 for name_ in sorted(paths):
  p=ROOT/name_
  if not p.is_file()or name_.startswith(('test-results/','docs/'))or p.name=='.env':continue
  dest=to/name_;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 cfg=json.loads((ROOT/'shared/default-presentation.json').read_text());cfg['project']['name']='Synthetic Domain '+to.name.upper();cfg['brand']['wordmark']='domain-'+to.name;(to/'config/presentation.json').write_text(json.dumps(cfg))

try:
 call(['docker','network','create',network])
 image=call(['docker','image','inspect','traefik:latest','--format','{{.Id}}']).stdout.strip()
 call(['docker','run','-d','--name',proxy,'--network',network,'-p','127.0.0.1::443','-v','/var/run/docker.sock:/var/run/docker.sock:ro',image,'--entryPoints.websecure.address=:443','--providers.docker=true','--providers.docker.exposedByDefault=false',"--providers.docker.constraints=Label(`templux.test`, `"+name+"`)"])
 raw=json.loads(call(['docker','inspect',proxy]).stdout)[0];peer=raw['NetworkSettings']['Networks'][network]['IPAddress'];port=int(raw['NetworkSettings']['Ports']['443/tcp'][0]['HostPort'])
 a=work/'a';b=work/'b';copy_source(a);copy_source(b)
 password=secrets.token_hex(20);secret_values.append(password)
 write_env(a,'a.example.test',f'postgresql://templux:{password}@database:5432/templux',peer,password)
 write_env(b,'b.example.test','postgresql://unused:unused@127.0.0.1:1/unavailable',peer,password)
 for p in [a,b]:
  with (p/'compose.traefik.yaml').open('a')as f:f.write('\n')
  # add own provider constraint label to entry; no production proxy watches test-owned services.
  s=(p/'compose.traefik.yaml').read_text().replace('      - traefik.enable=true','      - templux.test='+name+'\n      - traefik.enable=true');(p/'compose.traefik.yaml').write_text(s)
 source_files={str(p.relative_to(a)):hashlib.sha256(p.read_bytes()).hexdigest() for p in a.rglob('*') if p.is_file() and p.name!='.env'}
 (OUT/'real-source-inventory.json').write_text(json.dumps(source_files,indent=2)+'\n')
 # Direct Compose cannot launch a service when required effective URL is blank.
 saved=(a/'.env').read_text();(a/'.env').write_text(saved.replace('APP_PUBLIC_URL=https://a.example.test',"APP_PUBLIC_URL='   '"))
 invalid=dc(a,'up','--build','-d','api',allow=True);assert invalid.returncode!=0
 state=json.loads(dc(a,'ps','--format','json','api').stdout or'[]');assert not state
 records.append({'case':'direct-compose-blank-no-api','exit':invalid.returncode,'apiContainers':0})
 # --no-deps does not bypass the service preload either.
 bypass=dc(a,'run','--rm','--no-deps','api','node','-e','console.log("BUSINESS_STARTED")',allow=True);assert bypass.returncode!=0 and'BUSINESS_STARTED'not in bypass.stdout
 records.append({'case':'direct-run-preload-reject','exit':bypass.returncode})
 (a/'.env').write_text(saved);(a/'.env').chmod(0o600)
 cli('env-check');cli('env-list');started=cli('start');assert started['url']=='https://a.example.test'
 images=json.loads(dc(a,'images','--format','json').stdout);records.append({'case':'runtime-images','images':[{k:x.get(k)for k in ['Service','ID','Repository','Tag']}for x in images]})
 for _ in range(30):
  try:
   if req('a.example.test','/login')[0]==200:break
  except Exception:pass
  time.sleep(.5)
 else:raise RuntimeError('Traefik route did not become ready')
 status,_,html=req('a.example.test','/login');assert status==200 and b'Synthetic Domain A'in html
 assert req('unknown.example.test')[0]==404
 records.append({'case':'real-TLS-Host-login','status':status,'unknownHost':404,'tls':'self-signed default certificate, verification disabled only test client','proxyImage':image})
 person=cli('create-person','--username','synthetic.person','--name','Synthetic Person','--credential-file','person.json','--confirm')
 credential=json.loads((a/'credentials/person.json').read_text());secret_values.append(credential['password'])
 def login(origin='https://a.example.test'):
  return req('a.example.test','/api/auth/password',{k:credential[k]for k in ['username','password']},origin=origin)
 assert login('https://evil.example.test')[0]==403
 status,head,_=login();assert status==200;cookie=head['Set-Cookie'].split(';')[0];assert 'Secure'in head['Set-Cookie']
 assert req('a.example.test','/api/protected',cookie=cookie)[0]==403
 cli('authorize','--account',person['accountId'],'--roles','user','--confirm');assert req('a.example.test','/api/protected',cookie=cookie)[0]==401
 cookie=login()[1]['Set-Cookie'].split(';')[0];assert req('a.example.test','/api/protected',cookie=cookie)[0]==200
 records.append({'case':'domain-real-password-origin-cookie','wrongOrigin':403,'secureCookie':True,'zeroRoles':403,'oldRevoked':401,'authorized':200})
 state=cli('maintenance-status')['state'];cli('maintenance-halt','--expected-version',state['version'],'--confirm');assert req('a.example.test')[0]==503
 records.append({'case':'domain-maintenance-halt','status':503,'entryLive':req('a.example.test','/health/live')[0]})
 state=cli('maintenance-status')['state'];cli('maintenance-resume','--expected-version',state['version'],'--confirm');assert req('a.example.test','/api/protected',cookie=cookie)[0]==200
 # B reuses precisely A's compiled API artifact; distinct config/env/router and no business backend.
 api_image=call(['docker','image','inspect',projectA+'-api','--format','{{.Id}}']).stdout.strip()
 override=b/'test-image.yaml';override.write_text('services:\n  entry:\n    image: '+api_image+'\n  environment:\n    image: '+api_image+'\n')
 call(['docker','compose','--project-directory',str(b),'-f',str(b/'compose.yaml'),'-f',str(b/'compose.traefik.yaml'),'-f',str(override),'up','--no-build','-d','entry'])
 for _ in range(25):
  st,_,body=req('b.example.test')
  if st==503 and b'Synthetic Domain B'in body:break
  time.sleep(.5)
 else:raise RuntimeError('B namespace route failed')
 assert req('a.example.test','/login')[0]==200
 records.append({'case':'two-projects-no-route-crossing','A':200,'B':503,'BdistinctBrand':True})
except Exception as e:
 message=str(e)
 for value in secret_values:message=message.replace(value,'[redacted]')
 (OUT/'real-traefik-failure.txt').write_text(message+'\n');raise RuntimeError(message)from None
finally:
 cleanup=[]
 for p in [work/'a',work/'b']:
  if(p/'compose.yaml').exists():
   r=dc(p,'down','--volumes','--remove-orphans','--rmi','local',allow=True);cleanup.append({'project':p.name,'exit':r.returncode})
 call(['docker','rm','-f',proxy],allow=True);call(['docker','network','rm',network],allow=True)
 # Do not publish .env, account files, cookies, credentials, dumps or daemon configuration.
 for r in records:
  for value in secret_values:assert value not in json.dumps(r)
 (OUT/'real-traefik.json').write_text(json.dumps({'records':records,'cleanup':cleanup,'workRemoved':True,'sourceCommit':call(['git','rev-parse','HEAD'],cwd=ROOT).stdout.strip()},indent=2)+'\n')
 shutil.rmtree(work)
 print('Own integration finished:',len(records),'records')
