#!/usr/bin/env python3
"""Destructive T24 proof confined to the generated t24-proof project.

Requires built t24-management/t24-migration/t24-checks and unchanged t21-web.
PG clients execute only in containers. Does not load the real project's .env.
Run: python3 tests/scenarios/upgrade-proof.py
Cleanup: python3 tests/scenarios/upgrade-proof.py --cleanup
"""
import hashlib, json, os, pathlib, shutil, subprocess, sys, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/t24'
PROJECT = OUT / 'compose'
PRIVATE = PROJECT / 'private'
BACKUPS = PRIVATE / 'approved backups'
PORT = 31245
ENV = {k:v for k,v in os.environ.items() if not k.startswith(('TEMPLUX_', 'COMPOSE_', 'T24_')) and k != 'DATABASE_URL'}
RESULTS = []

def compose(*args, env=None, expected=0, label=None, timeout=300):
    p = subprocess.run(['docker','compose','--project-directory',str(PROJECT),'-f',str(PROJECT/'compose.yaml'),*args],
                       env={**ENV, **(env or {})}, capture_output=True, text=True, timeout=timeout)
    if label:
        # CLI output has no credentials; still keep logs private and never dump on assertion.
        for suffix, text in [('stdout',p.stdout),('stderr',p.stderr)]:
            f=OUT/(label+'.'+suffix);f.write_text(text);f.chmod(0o600)
    assert p.returncode == expected, f'{label or args[0]} exit {p.returncode}, expected {expected}; inspect private evidence'
    return p.stdout

def record(case, **data):
    value={'case':case,**data};RESULTS.append(value)
    (OUT/'proof.json').write_text(json.dumps(RESULTS,indent=2)+'\n')
    print(json.dumps(value),flush=True)

def sql(query, db='t24_app', service='database'):
    return compose('exec','-T',service,'psql','-X','-At','-U','t24','-d',db,'-v','ON_ERROR_STOP=1','-c',query).strip()

def state(db='t24_app', service='database'):
    return json.loads(sql("SELECT json_build_object('history',(SELECT count(*) FROM public.templux_migrations),'accounts',(SELECT count(*) FROM templux.accounts),'sessions',(SELECT count(*) FROM templux.auth_sessions),'credentials',(SELECT count(*) FROM templux.password_credentials),'seedAudit',(SELECT count(*) FROM templux.audit_events WHERE event='t24_historical_seed'))",db,service))

def live():
    return compose('ps','--services','--status','running').split()

def request(path, cookie=None, body=None):
    headers={'Origin':f'http://localhost:{PORT}'}
    if cookie:headers['Cookie']=cookie
    if body is not None:headers['Content-Type']='application/json'
    req=urllib.request.Request(f'http://localhost:{PORT}'+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=10) as r:return r.status,r.headers,r.read()
    except urllib.error.HTTPError as r:return r.code,r.headers,r.read()

def protected(credentials):
    return [request('/api/protected',v['cookie'])[0] for v in credentials]

def cli(*args, env=None, expected=0, label=None):
    return json.loads(compose('run','--rm','--no-deps','management',*args,'--json',env=env,expected=expected,label=label))

def migration(*args, env=None, expected=0, label=None):
    return json.loads(compose('run','--rm','--no-deps','migrate',*args,'--json',env=env,expected=expected,label=label))

def archives():
    return sorted(p for p in BACKUPS.glob('backup-*/manifest.json'))

def reset(env=None, external=False):
    compose('stop','entry','web','api')
    service='external-database' if external else 'database'
    name='t24_external' if external else 't24_app'
    # Only the named disposable database, after stopping its sole application.
    sql(f'DROP DATABASE IF EXISTS {name} WITH (FORCE)', 'postgres', service)
    sql(f'CREATE DATABASE {name}', 'postgres', service)
    secret=PRIVATE/'credentials/upgrade.json'
    secret.unlink(missing_ok=True)
    compose('run','--rm','--no-deps','--entrypoint','node','management','tests/fixtures/upgrade-seed.mjs',env=env)
    return json.loads(secret.read_text())

def assert_not_started():
    assert not set(live()) & {'entry','web','api'}, 'migration failure started application'

def setup():
    PRIVATE.mkdir(parents=True,exist_ok=True);PRIVATE.chmod(0o700)
    for name in ['credentials','approved backups','config']:
        (PRIVATE/name).mkdir(exist_ok=True);(PRIVATE/name).chmod(0o700)
    for file in (ROOT/'config').glob('*.json'):
        if file.name!='presentation.json':shutil.copyfile(file,PRIVATE/'config'/file.name)
    shutil.copyfile(ROOT/'shared/default-presentation.json',PRIVATE/'config/presentation.json')
    local='postgresql://t24:isolated-t24-only@database:5432/t24_app'
    database_env={'DATABASE_URL':'${DATABASE_URL-'+local+'}'}
    policy={**database_env,'DEPLOYMENT_ENV':'DEV','AGENT_LOGIN_ENABLED':'true','PERSON_IDLE_TIMEOUT_SECONDS':'3600','AGENT_IDLE_TIMEOUT_SECONDS':'3600','APP_PUBLIC_URL':f'http://localhost:{PORT}','TEMPLUX_CONFIG_PATH':'/opt/templux/config/presentation.json','TEMPLUX_MAINTENANCE_RELEASE_FILE':'/opt/templux/maintenance/release.json'}
    configs=[str(PRIVATE/'config')+':/opt/templux/config:ro','maintenance:/opt/templux/maintenance:ro']
    tools={**database_env,'TEMPLUX_PROJECT_NAME':'t24-proof','TEMPLUX_BACKUP_DIR':'${T24_BACKUP_CONTAINER_PATH-/opt/templux/backups}','TEMPLUX_BACKUP_RETAIN':'5','TEMPLUX_HOST_UID':'0','TEMPLUX_HOST_GID':'0'}
    mounts=['${TEMPLUX_BACKUP_DIR-'+str(BACKUPS)+'}:/opt/templux/backups']
    fixture_migrations='${T24_MIGRATION_DIR-'+str(ROOT/'database/migrations')+'}:/opt/templux/database/migrations:ro'
    build=lambda target:{'context':str(ROOT),'target':target}
    db=lambda name:{'image':'postgres:18.6-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c','environment':{'POSTGRES_USER':'t24','POSTGRES_PASSWORD':'isolated-t24-only','POSTGRES_DB':name},'tmpfs':['/var/lib/postgresql'],'healthcheck':{'test':['CMD-SHELL','pg_isready -U t24 -d '+name],'interval':'1s','timeout':'3s','retries':30}}
    services={
      'database':db('t24_app'), 'external-database':{**db('t24_external'),'profiles':['external']},
      'migrate':{'image':'t24-migration','build':build('migration'),'entrypoint':['node','apps/api/dist/migrate.js'],'environment':tools,'volumes':mounts+[fixture_migrations],'profiles':['tools']},
      'api':{'image':'t24-api','build':build('api'),'environment':{**policy,'PASSWORD_PROXY_HOSTS':'web'},'volumes':configs,'healthcheck':{'test':['CMD','node','-e',"fetch('http://127.0.0.1:8080/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],'interval':'1s','timeout':'5s','retries':30}},
      'entry':{'image':'t24-api','build':build('api'),'command':['node','apps/api/dist/entry-server.js'],'environment':policy,'volumes':configs,'ports':[f'127.0.0.1:{PORT}:8080'],'healthcheck':{'test':['CMD','node','-e',"fetch('http://127.0.0.1:8080/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],'interval':'1s','timeout':'5s','retries':30}},
      # Web source is unchanged; reuse the previously standard-built production image.
      'web':{'image':'t21-web','environment':{'API_INTERNAL_URL':'http://api:8080','WEB_ENTRY_PROXY_HOSTS':'entry','TEMPLUX_CONFIG_PATH':'/opt/templux/config/presentation.json'},'volumes':configs[:1],'healthcheck':{'test':['CMD','node','-e',"fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],'interval':'1s','timeout':'5s','retries':30}},
      'management':{'image':'t24-management','environment':{**tools,**policy,'TEMPLUX_REQUIRE_AUTH_PROJECTION':'0','TEMPLUX_PROJECT_DIR':str(PROJECT),'TEMPLUX_HTTP_PORT':str(PORT),'TEMPLUX_CREDENTIAL_DIR':'/opt/templux/credentials','TEMPLUX_BACKUP_BIND_DIR':'${TEMPLUX_BACKUP_DIR-'+str(BACKUPS)+'}','T24_MIGRATION_DIR':'${T24_MIGRATION_DIR-'+str(ROOT/'database/migrations')+'}','T24_BACKUP_CONTAINER_PATH':'${T24_BACKUP_CONTAINER_PATH-/opt/templux/backups}'},'volumes':mounts+[str(PRIVATE/'credentials')+':/opt/templux/credentials',str(PRIVATE/'config')+':/opt/templux/config',str(ROOT)+':'+str(ROOT)+':ro','maintenance:/opt/templux/maintenance','/var/run/docker.sock:/var/run/docker.sock',str(ROOT/'tests/fixtures/upgrade-seed.mjs')+':/opt/templux/tests/fixtures/upgrade-seed.mjs:ro'],'profiles':['tools']}}
    (PROJECT/'compose.yaml').write_text(json.dumps({'name':'t24-proof','services':services,'volumes':{'maintenance':{}}},indent=2)+'\n')
    for kind in ['sql-fail','later-fail','postcheck-fail']:
        directory=PRIVATE/kind;directory.mkdir(exist_ok=True)
        for src in (ROOT/'database/migrations').glob('*.sql'):shutil.copyfile(src,directory/src.name)
        version='0009' if kind=='sql-fail' else '0010'
        dst=next(directory.glob(version+'*'))
        dst.write_text("CREATE TABLE public.t24_rollback_probe(value text); DO $$ BEGIN RAISE EXCEPTION 'isolated migration failure'; END $$;" if kind!='postcheck-fail' else 'SELECT 1;\n')

def run():
    setup();compose('up','-d','--wait','database')
    credentials=reset();before=state();assert before=={'history':8,'accounts':2,'sessions':2,'credentials':2,'seedAudit':1}
    manual=cli('backup','--confirm',label='manual-before-upgrade');assert manual['kind']=='manual'
    success=cli('start',label='upgrade-success');assert success['ok']
    after=state();assert after=={**before,'history':10};assert protected(credentials)==[200,200]
    auto=[p for p in archives() if json.loads(p.read_text())['payload']['kind']=='automatic'];assert len(auto)==1
    assert auto[0].stat().st_mode&0o777==0o600
    assert (auto[0].parent/'archive.dump').stat().st_mode&0o777==0o600
    record('standard-start-old0008-to0010',before=before,after=after,oldSessions=[200,200],approvedHostBackup=True,archiveMode='0600')
    compose('restart','api','web');
    for _ in range(60):
        try:
            if protected(credentials)==[200,200]:break
        except (OSError,TimeoutError):pass
        time.sleep(.25)
    assert protected(credentials)==[200,200];record('normal-restart-preserves-upgraded-sessions',protected=[200,200])
    previous=archives();assert cli('start',label='no-pending')['ok'];assert archives()==previous
    record('repeated-start-no-pending',newBackups=0,history=state()['history'])
    # Actually read/restore the pre-upgrade archive in a container, not SHA-only proof.
    sql('CREATE DATABASE t24_scratch','postgres')
    compose('run','--rm','--no-deps','--entrypoint','/opt/pg-tools/bin/pg_restore','-e','LD_LIBRARY_PATH=/opt/pg-tools/lib','-e','PGHOST=database','-e','PGUSER=t24','-e','PGPASSWORD=isolated-t24-only','migrate','--exit-on-error','--no-owner','--no-privileges','-d','t24_scratch','/opt/templux/backups/'+auto[0].parent.name+'/archive.dump')
    assert state('t24_scratch')==before;sql('DROP DATABASE t24_scratch','postgres')
    record('automatic-archive-scratch-restored',counts=before,history='0008')
    # Each failed start starts from stopped application services.
    reset();old=archives();bad={'T24_BACKUP_CONTAINER_PATH':'/proc/t24-forbidden'}
    assert cli('start',env=bad,expected=1,label='backup-failure')['ok'] is False
    assert_not_started();assert state()==before and archives()==old
    record('backup-failure-blocks-start-and-history',history=8,newBackups=0,appStarted=False)
    for label,version,expected_history in [('sql-fail','0009',8),('later-fail','0010',9),('postcheck-fail','0010',10)]:
        reset();e={'T24_MIGRATION_DIR':str(PRIVATE/label)}
        assert cli('start',env=e,expected=1,label=label)['ok'] is False
        assert_not_started();actual=state()['history'];assert actual==expected_history
        assert sql("SELECT to_regclass('public.t24_rollback_probe') IS NULL")=='t'
        record(label,history=actual,appStarted=False,failedTransactionObjectAbsent=True,wholeBatchRolledBack=False)
        if label=='later-fail':
            assert cli('start',label='later-fail-explicit-retry')['ok'];assert state()['history']==10
            record('explicit-retry-after-confirmed-sql-rollback',history=10,appliedRemaining=1)
    for kind in ['checksum','unknown']:
        reset()
        sql("UPDATE public.templux_migrations SET checksum=repeat('0',64) WHERE version='0008'" if kind=='checksum' else "INSERT INTO public.templux_migrations(version,checksum) VALUES('9999',repeat('0',64))")
        old=archives();result=cli('start',expected=1,label='history-'+kind);assert not result['ok'];assert_not_started();assert archives()==old
        record('history-'+kind+'-blocks-start',appStarted=False,newBackups=0)
    reset();old=archives();reference='synthetic-t24-snapshot-record'
    assert not cli('start','--external-backup-reference',reference,expected=1,label='external-missing-confirm')['ok'];assert_not_started()
    assert cli('start','--external-backup-reference',reference,'--confirm',label='external-reference')['ok']
    assert archives()==old
    records=list(BACKUPS.glob('external-*.json'));assert len(records)==1
    claim=json.loads(records[0].read_text())['payload'];assert claim['verified'] is False and claim['reference']==reference
    assert records[0].stat().st_mode&0o777==0o600
    assert all(reference not in (OUT/('external-reference.'+suffix)).read_text() for suffix in ['stdout','stderr'])
    record('explicit-external-reference',verified=False,privateMode='0600',referenceEchoed=False,newBackups=0)
    reset()
    # Real process holds each DB lock while the standard entry executes.
    for lock in ['templux:migrations','templux:backups']:
        holder=subprocess.Popen(['docker','compose','-f',str(PROJECT/'compose.yaml'),'exec','-T','database','psql','-X','-At','-U','t24','-d','t24_app','-c',f"SELECT pg_advisory_lock(hashtext('{lock}')); SELECT pg_sleep(8)"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=ENV)
        try:
            for _ in range(50):
                if sql(f"SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=(hashtext('{lock}')::bigint & 4294967295) AND granted)")=='t':break
                time.sleep(.1)
            assert not migration(expected=1,label='lock-'+lock.split(':')[1])['ok'];assert state()['history']==8
        finally:holder.wait(timeout=15)
        record('concurrent-'+lock.split(':')[1],history=8,nonzero=True)
    assert migration(label='after-lock-release')['applied']==2
    # Ordinary start must preserve both persistent offline and external restore fencing.
    compose('up','-d','--wait','api','web','entry')
    v=cli('maintenance-status')['state']['version'];cli('maintenance-halt','--expected-version',v,'--confirm',label='halt')
    gate=sql('SELECT gate_version FROM templux.maintenance_state')
    assert cli('start',label='offline-start')['ok'];assert request('/')[0]==503
    assert sql('SELECT phase FROM templux.maintenance_state')=='offline' and sql('SELECT gate_version FROM templux.maintenance_state')==gate
    compose('run','--rm','--no-deps','--entrypoint','node','management','-e',"require('node:fs').writeFileSync('/opt/templux/maintenance/release.json.restore-block',JSON.stringify({runId:'t24-isolated-block'}),{flag:'wx',mode:0o600})")
    assert cli('start',label='restore-block-start')['ok'];assert request('/')[0]==503
    v=cli('maintenance-status')['state']['version'];assert not cli('maintenance-resume','--expected-version',v,'--confirm',expected=1,label='blocked-resume')['ok']
    record('start-does-not-release-offline-or-restore-block',entry=503,gateUnchanged=True,explicitResumeRefused=True)
    # External configured target: same standard Compose launcher, different DB service.
    compose('run','--rm','--no-deps','--entrypoint','node','management','-e',"require('node:fs').unlinkSync('/opt/templux/maintenance/release.json.restore-block')")
    compose('up','-d','--wait','external-database')
    external={'DATABASE_URL':'postgresql://t24:isolated-t24-only@external-database:5432/t24_external'}
    ext_credentials=reset(env=external,external=True);local_history=state()['history']
    assert cli('start',env=external,label='external-target')['ok'];assert state('t24_external','external-database')['history']==10
    assert state()['history']==local_history and protected(ext_credentials)==[200,200]
    record('configured-external-target-no-default-fallback',externalHistory=10,localHistoryUnchanged=local_history,protected=[200,200])
    kinds=[json.loads(p.read_text())['payload']['kind'] for p in archives()]
    # Retention is per source; the external target contributes its own first auto.
    local_source=json.loads((BACKUPS/manual['id']/'manifest.json').read_text())['payload']['source']
    local_autos=[p for p in archives() if (lambda v:v['kind']=='automatic' and v['source']==local_source)(json.loads(p.read_text())['payload'])]
    assert len(local_autos)==5 and (BACKUPS/manual['id']/'archive.dump').exists()
    record('retention-after-multiple-upgrades',localSuccessfulAutomatic=5,manualRetained=True,externalClaimRetained=records[0].exists())
    controls()
    record('completed',cases=len(RESULTS)+1)

def controls():
    compose('stop','entry','web','api')
    sql('DROP DATABASE t24_app WITH (FORCE)','postgres');sql('CREATE DATABASE t24_app','postgres')
    compose('run','--rm','--no-deps','--entrypoint','node','management','-e',"for(const suffix of ['', '.restore-block'])require('node:fs').rmSync('/opt/templux/maintenance/release.json'+suffix,{force:true})")
    bad={'T24_BACKUP_CONTAINER_PATH':'/proc/t24-forbidden'};old=archives()
    assert cli('start',env=bad,label='empty-init')['ok']
    assert state()['history']==10 and state()['accounts']==0 and archives()==old
    record('true-empty-standard-start-skips-unusable-backup-path',history=10,newBackups=0)
    assert cli('start',env=bad,label='no-pending-unusable-path')['ok'];assert archives()==old
    record('no-pending-standard-start-skips-unusable-backup-path',history=10,newBackups=0)
    reset();assert not cli('start','--external-backup-reference','synthetic-unwritable-reference','--confirm',env=bad,expected=1,label='external-reference-write-failure')['ok']
    assert_not_started();assert state()['history']==8 and archives()==old
    record('external-reference-write-failure-blocks-migration-and-start',history=8,appStarted=False)
    login_proof()

def login_proof():
    credentials=json.loads((PRIVATE/'credentials/upgrade.json').read_text())
    assert cli('start',label='normal-password-upgrade')['ok']
    results=[]
    for value in credentials:
        code,headers,_=request('/api/auth/password',body={k:value[k] for k in ['username','password']})
        assert code==200
        cookie=headers['Set-Cookie'].split(';')[0]
        results.append(request('/api/protected',cookie)[0])
    assert results==[200,200] and protected(credentials)==[200,200]
    record('normal-password-person-and-agent-after-upgrade',newLoginProtected=results,historicalSessions=[200,200])

if __name__=='__main__':
    if sys.argv[1:]==['--cleanup']:
        assert json.loads((PROJECT/'compose.yaml').read_text())['name']=='t24-proof'
        compose('--profile','external','--profile','tools','down','-v','--remove-orphans')
        shutil.rmtree(PRIVATE)
        print('removed own containers/network/maintenance volume and private archives/credentials/key')
    elif sys.argv[1:]==['--controls']:
        RESULTS.extend(v for v in json.loads((OUT/'proof.json').read_text()) if v['case']!='completed')
        controls();record('completed',cases=len(RESULTS)+1)
    elif sys.argv[1:]==['--login-proof']:
        RESULTS.extend(v for v in json.loads((OUT/'proof.json').read_text()) if v['case']!='completed')
        login_proof();record('completed',cases=len(RESULTS)+1)
    else:
        assert not sys.argv[1:]
        run()
