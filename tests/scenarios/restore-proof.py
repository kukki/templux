#!/usr/bin/env python3
"""Destructive proof ONLY for self-owned t23-proof/t23-independent Compose projects.
Run after creating the documented test-results/t23/compose fixture and standard image.
No credentials, cookies, archive bytes or original deployment commands are printed.
"""
import json, os, pathlib, subprocess, time, urllib.request, urllib.error
root=pathlib.Path(__file__).resolve().parents[2]
fixture=root/'test-results/t23/compose'
assert fixture.name=='compose' and fixture.parent.name=='t23'
evidence=[]
def compose(directory,*args,env=None,expect=0):
    p=subprocess.run(['docker','compose','-f',str(directory/'compose.yaml'),*args],capture_output=True,text=True,env=env)
    if p.returncode!=expect:
        # Do not dump command argv or stdout: these may include delivery metadata.
        raise AssertionError(f'Compose operation {args[0]} exit {p.returncode}, expected {expect}; inspect private service state')
    return p.stdout
projection=None
def cli(directory,*args,env=None,expect=0):
    global projection
    extra=[]
    if projection: extra=['-e','TEMPLUX_AUTH_AVAILABILITY_JSON='+projection]
    if env and 'T23_EXTERNAL_URL' in env:extra+=['-e','T23_EXTERNAL_URL']
    data=compose(directory,'run','--rm','--no-deps',*extra,'management',*args,'--json',env=env,expect=expect)
    return json.loads(data)
def req(port,path,cookie=None,body=None):
    headers={}
    if cookie:headers['Cookie']=cookie
    if body is not None:headers.update({'Content-Type':'application/json','Origin':f'http://localhost:{port}'})
    r=urllib.request.Request(f'http://localhost:{port}'+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
    try:
        with urllib.request.urlopen(r,timeout=10) as s:return s.status,s.headers,s.read()
    except urllib.error.HTTPError as s:return s.code,s.headers,s.read()
def login(port,credential):
    status,headers,_=req(port,'/api/auth/password',body=credential);assert status==200,status
    return headers['Set-Cookie'].split(';')[0]
def status(cookie,port=31243):return req(port,'/api/protected',cookie)[0]
def record(case,**fields):evidence.append(dict(case=case,**fields));print(json.dumps(evidence[-1]))
compose(fixture,'up','-d','--wait','database')
compose(fixture,'run','--rm','--no-deps','--entrypoint','node','management','apps/api/dist/migrate.js','--json')
projection=compose(fixture,'run','--rm','--no-deps','--entrypoint','node','management','apps/api/dist/auth-config-probe.js').strip()
person=cli(fixture,'create-person','--username','t23.person','--name','Synthetic restore person','--credential-file','person.json','--confirm')
cli(fixture,'authorize','--account',person['accountId'],'--roles','user','--confirm')
agent=cli(fixture,'create-agent','--username','t23.agent','--name','Synthetic restore agent','--owner',person['accountId'],'--credential-file','agent.json','--confirm')
cli(fixture,'authorize','--account',agent['accountId'],'--roles','user','--confirm')
credentials=[json.loads((fixture/'private/credentials'/n).read_text()) for n in ['person.json','agent.json']]
compose(fixture,'up','-d','--wait','api','web','entry')
for _ in range(30):
    if req(31243,'/api/status')[0]==200:break
    time.sleep(.2)
cookies=[login(31243,c) for c in credentials]
assert [status(c) for c in cookies]==[200,200]
compose(fixture,'restart','api','web')
for _ in range(60):
    if req(31243,'/api/status')[0]==200:break
    time.sleep(.3)
assert [status(c) for c in cookies]==[200,200]
record('normal-restart-retains-person-and-agent',protected=[200,200])
backup=cli(fixture,'backup','--confirm')
# Preflight mismatch must leave live service and old sessions unchanged.
bad=cli(fixture,'restore','--mode','original','--target','current','--archive',backup['directory']+'/archive.dump','--sha256','a'*64,'--confirm','--overwrite',expect=1)
assert bad['stage']=='preflight' and bad['connectionsClosed'] is False
assert [status(c) for c in cookies]==[200,200]
record('bad-hash-original-no-halt',stage=bad['stage'],protected=[200,200])
human=compose(fixture,'run','--rm','--no-deps','management','restore','--mode','original','--target','current','--archive',backup['directory']+'/archive.dump','--sha256',backup['sha256'],'--confirm','--overwrite')
assert human.startswith('恢复结果：\n')
restored=json.loads(human.split('\n',1)[1])
assert restored['restored'] and restored['stage']=='completed-offline'
assert req(31243,'/')[0]==503
record('original-restored-entry-still-closed',stage=restored['stage'],entry=503,sessionsRevoked=restored['sessionsRevoked'],runId=restored['runId'])
state=cli(fixture,'maintenance-status')['state']
cli(fixture,'maintenance-resume','--expected-version',state['version'],'--confirm')
assert [status(c) for c in cookies]==[401,401]
assert [status(login(31243,c)) for c in credentials]==[200,200]
record('original-explicit-resume',old=[401,401],new=[200,200])
# Restore-only strong audit fault. All SQL is confined to this script's named own DB.
def sql(database,query):
    return compose(fixture,'exec','-T','database','psql','-X','-U','t23','-d',database,'-v','ON_ERROR_STOP=1','-c',query)
sql('t23_app',"CREATE FUNCTION templux.t23_fail_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='database_restored' THEN RAISE EXCEPTION 'isolated restore audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER t23_fail_restore BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.t23_fail_restore()")
fault_archive=cli(fixture,'backup','--confirm')
sql('t23_app','DROP TRIGGER t23_fail_restore ON templux.audit_events;DROP FUNCTION templux.t23_fail_restore()')
failed=cli(fixture,'restore','--mode','original','--target','current','--archive',fault_archive['directory']+'/archive.dump','--sha256',fault_archive['sha256'],'--confirm','--overwrite',expect=1)
assert failed['connectionsClosed'] is True and failed['entryBlocked'] is True and failed['dataCommitted'] is False
assert req(31243,'/')[0]==503
blocked=cli(fixture,'maintenance-resume','--expected-version','0','--confirm',expect=1)
assert '阻断' in blocked['error']
record('original-audit-failure-and-resume-block',entry=503,stage=failed['stage'],connectionsClosed=True,ordinaryResumeRefused=True)
# Explicit host recovery, with business stopped and persistent entry block retained.
sql('postgres','ALTER DATABASE t23_app ALLOW_CONNECTIONS true')
sql('t23_app',f"BEGIN;SELECT pg_advisory_xact_lock(hashtext('templux:business-writes'));UPDATE templux.maintenance_state SET phase='online' WHERE singleton;DELETE FROM templux.auth_sessions;DELETE FROM templux.oauth_requests;DELETE FROM templux.login_method_requests;UPDATE templux.maintenance_state SET phase='offline',version=version+1,gate_version=gate_version+1 WHERE singleton;INSERT INTO templux.audit_events(source,actor,event,actor_assurance,details) VALUES('cli','host-uid:0','database_restore_recovery_verified','host_claim',jsonb_build_object('restoreRunId','{failed['runId']}'));COMMIT;")
compose(fixture,'run','--rm','--no-deps','--entrypoint','node','management','-e',"require('node:fs').unlinkSync('/opt/templux/maintenance/release.json.restore-block')")
state=cli(fixture,'maintenance-status')['state'];cli(fixture,'maintenance-resume','--expected-version',state['version'],'--confirm')
assert [status(c) for c in cookies]==[401,401]
assert [status(login(31243,c)) for c in credentials]==[200,200]
record('explicit-original-host-recovery',old=[401,401],new=[200,200])
compose(fixture,'exec','-T','database','psql','-U','t23','-d','postgres','-v','ON_ERROR_STOP=1','-c','CREATE DATABASE t23_independent')
env={**os.environ,'T23_EXTERNAL_URL':'postgresql://t23:t23-isolated-only@database:5432/t23_independent'}
independent=cli(fixture,'restore','--mode','independent','--target','env:T23_EXTERNAL_URL','--archive',backup['directory']+'/archive.dump','--sha256',backup['sha256'],'--confirm','--overwrite',env=env)
assert independent['restored'] and independent['state']['phase']=='offline'
assert req(31243,'/api/status')[0]==200
record('independent-restored-current-unaffected',runId=independent['runId'],current=200)
other=fixture.parent/'independent';other.mkdir(exist_ok=True)
for p in ['private/backups','private/credentials']:(other/p).mkdir(parents=True,exist_ok=True);(other/p).chmod(0o700)
text=(fixture/'compose.yaml').read_text().replace('name: t23-proof','name: t23-independent').replace('/t23_app','/t23_independent').replace('31243','31244').replace(str(fixture),str(other)).replace('TEMPLUX_PROJECT_NAME: t23-proof','TEMPLUX_PROJECT_NAME: t23-independent')
(other/'compose.yaml').write_text(text)
# Establish only the new entry/network, then attach the OWN existing DB to that network.
compose(other,'up','-d','entry')
db=compose(fixture,'ps','-q','database').strip()
subprocess.run(['docker','network','connect','--alias','database','t23-independent_default',db],check=True,capture_output=True)
state=cli(other,'maintenance-status')['state'];assert req(31244,'/')[0]==503
cli(other,'maintenance-resume','--expected-version',state['version'],'--confirm')
assert [status(c,31244) for c in cookies]==[401,401]
assert [status(login(31244,c),31244) for c in credentials]==[200,200]
record('independent-explicit-later-hookup',old=[401,401],new=[200,200],personAgentOwnershipPreserved=True)
(root/'test-results/t23/compose-proof.json').write_text(json.dumps(evidence,indent=2)+'\n')
