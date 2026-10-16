#!/usr/bin/env python3
import json,os,pathlib,secrets,shutil,subprocess,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parents[2];out=ROOT/'test-results/domain-environment';name='tdomain-security-'+secrets.token_hex(4)
private=pathlib.Path(tempfile.mkdtemp(prefix='templux-domain-security-',dir=ROOT.parent));private.chmod(0o700)
def run(args,timeout=120):return subprocess.run(args,text=True,capture_output=True,timeout=timeout)
password=secrets.token_hex(24)
try:
 db=private/'db.env';db.write_text('POSTGRES_USER=templux_test\nPOSTGRES_DB=templux_auth_test\nPOSTGRES_PASSWORD='+password+'\n');db.chmod(0o600)
 test=private/'test.env';test.write_text('TEST_AUTH_DATABASE_URL=postgresql://templux_test:'+password+'@database:5432/templux_auth_test\nTEST_WEB_URL=http://web:3000\n');test.chmod(0o600)
 assert run(['docker','network','create',name]).returncode==0
 p=run(['docker','run','-d','--name',name+'-db','--network',name,'--network-alias','database','--env-file',str(db),'--tmpfs','/var/lib/postgresql','postgres:18.6-bookworm']);assert p.returncode==0,p.stderr
 for _ in range(40):
  if run(['docker','exec',name+'-db','pg_isready','-U','templux_test','-d','templux_auth_test']).returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError('own PG not ready')
 p=run(['docker','run','-d','--name',name+'-web','--network',name,'--network-alias','web','templux-domain-web']);assert p.returncode==0
 for _ in range(40):
  if run(['docker','exec',name+'-web','node','-e',"fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]).returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError('own Web not ready')
 command=['docker','run','--rm','--name',name+'-checks','--network',name,'--env-file',str(test),'--entrypoint','sh','templux-domain-checks','-c','node --test --test-concurrency=1 tests/environment.test.mjs tests/maintenance-http.test.mjs tests/password-limit.test.mjs tests/password.test.mjs && npm run typecheck']
 p=run(command);safe=(p.stdout+p.stderr).replace(password,'[redacted]');assert password not in safe;(out/'security-tests.log').write_text(safe)
 (out/'security-tests.json').write_text(json.dumps({'command':command,'exit':p.returncode,'image':run(['docker','image','inspect','templux-domain-checks','--format','{{.Id}}']).stdout.strip(),'sourceCommit':run(['git','rev-parse','HEAD']).stdout.strip()},indent=2)+'\n');assert p.returncode==0,safe[-700:]
 print('PASS security SQL/HTTP + types')
finally:
 for container in [name+'-checks',name+'-web',name+'-db']:run(['docker','rm','-f',container])
 run(['docker','network','rm',name]);shutil.rmtree(private)
