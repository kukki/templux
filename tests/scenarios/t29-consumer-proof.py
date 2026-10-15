"""Reuse the actual T25 artifact-only public CLI/HTTP flow in a new T29 project.
Only task-owned project/env/db; never an original deployment. No secrets printed.
"""
import pathlib,json,subprocess,os,sys
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/t29';PROJECT=pathlib.Path((OUT/'consumer-path.txt').read_text().strip());assert PROJECT.parent==ROOT.parent and PROJECT.name.startswith('templux-t29-consumer-')
source=(ROOT/'tests/scenarios/release-consumer-proof.py').read_text();source=source.replace("ROOT/'test-results/t25'","ROOT/'test-results/t29'").replace("startswith('templux-t25-consumer-')","startswith('templux-t29-consumer-')").replace("=='0.1.0'","=='0.1.2-t29.1'").replace("sharedVersion='0.1.0'","sharedVersion='0.1.2-t29.1'").replace('t25-consumer','t29-consumer').replace('31325','31329').replace('31825','31829').replace("orientation='horizontal'","orientation=json.loads((PROJECT/'config/presentation.json').read_text())['navigation']['orientation']").replace('Quay','Delta').replace('quay.','delta.').replace('t25_restored','t29_restored').replace('T25_TARGET_URL','T29_TARGET_URL');scope={'__name__':'t29_reused_flow','__file__':str(ROOT/'tests/scenarios/release-consumer-proof.py')};exec(compile(source,'reused-release-consumer-proof.py','exec'),scope);scope['main']()
# Additional final integration: normal restart contrast + original restore old person/Agent sessions.
cli,req,login,compose,sql,record=[scope[x]for x in ['cli','req','login','compose','sql','record']]
credentials=[json.loads((PROJECT/'credentials'/n).read_text())for n in ['person.json','agent.json']];cookies=[login(c)for c in credentials];assert[req('/api/protected',c)[0]for c in cookies]==[200,200]
compose('restart','api','web')
import time
for _ in range(100):
 if req('/api/status')[0]==200:break
 time.sleep(.2)
assert[req('/api/protected',c)[0]for c in cookies]==[200,200];record('normal-restart-person-agent',protected=[200,200])
backup=cli('backup','--confirm',label='delivery-original-backup');restore_args=['restore','--mode','original','--target','current','--archive',backup['directory']+'/archive.dump','--sha256',backup['sha256'],'--confirm','--overwrite'];bad=cli(*[('a'*64 if x==backup['sha256']else x)for x in restore_args],expect=1,label='delivery-original-bad-hash');assert bad['stage']=='preflight'and req('/api/protected',cookies[0])[0]==200
restored=cli(*restore_args,label='delivery-original-restore');assert restored['restored']and restored['stage']=='completed-offline';assert req('/')[0]==503
state=cli('maintenance-status')['state'];cli('maintenance-resume','--expected-version',state['version'],'--confirm');assert[req('/api/protected',c)[0]for c in cookies]==[401,401];assert[req('/api/protected',login(c))[0]for c in credentials]==[200,200];record('original-restore-old-session-rejected-new-login',old=[401,401],new=[200,200],offlineBeforeResume=503)
# Independent target already restored by reused flow: deploy API on that target only; never switch source.
assert sql("SELECT count(*) FROM templux.auth_sessions",'t29_restored')=='0';assert sql("SELECT count(*) FROM templux.audit_events WHERE event='database_restored'",'t29_restored')=='1'
record('independent-target-closed-and-revoked',phase=sql('SELECT phase FROM templux.maintenance_state','t29_restored'),oldSessions=0)
# Persist only own browser credentials in a private directory; values never enter stdout.
private=OUT/'private';private.mkdir(exist_ok=True,mode=0o700);private.chmod(0o700);f=private/'browser.json';f.write_text(json.dumps({'username':credentials[0]['username'],'password':credentials[0]['password'],'accountId':'1'}));f.chmod(0o600)
