#!/usr/bin/env python3
"""Linux tmpfs models Ubuntu UID ownership without touching a host private file."""
import pathlib,subprocess,json
ROOT=pathlib.Path(__file__).resolve().parents[2];out=ROOT/'test-results/domain-environment'
script="""mkdir -p /env; cp /source/.env.example /env/.env.example; printf 'PROJECT_PRIVATE=synthetic-only\\n' >/env/.env; chmod 600 /env/.env; chown 1001:1001 /env/.env; exec node /source/shared/environment-cli.mjs check --json"""
cmd=['docker','run','--rm','--tmpfs','/env','-v',str(ROOT)+':/source:ro','-e','TEMPLUX_ENV_DIR=/env','-e','TEMPLUX_PROJECT_NAME=uid-test','-e','DEPLOYMENT_ENV=UAT','-e','APP_HOST=uid-test.example.test','-e','APP_PUBLIC_URL=https://uid-test.example.test','-e','NETWORK_NAME=uid-edge','-e','ENTRY_TRUSTED_PROXY_CIDRS=172.30.0.2/32','-e','DATABASE_URL=postgresql://u:synthetic@external:5432/db','node:24.21.0-bookworm-slim','sh','-c',script]
control=cmd[:-1]+[script.replace('exec node /source/shared/environment-cli.mjs check --json',"exec su -s /bin/sh node -c 'node /source/shared/environment-cli.mjs check --json'")]
r=subprocess.run(control,text=True,capture_output=True,timeout=20);assert r.returncode==1 and any(e['key']=='.env' and e['code']=='unreadable' for e in json.loads(r.stdout)['errors'])
p=subprocess.run(cmd,text=True,capture_output=True,timeout=20);assert p.returncode==0,p.stderr;assert json.loads(p.stdout)['ok']
runtime=cmd[:-1]+[script.replace('exec node /source/shared/environment-cli.mjs check --json',"mkdir /env/public; cp /source/.env.example /env/public/.env.example; TEMPLUX_ENV_DIR=/env/public TEMPLUX_ENV_SCOPE=api exec su -s /bin/sh node -c 'node --import /source/shared/environment-startup.mjs -e \"console.log(process.getuid())\"'")]
a=subprocess.run(runtime,text=True,capture_output=True,timeout=20);assert a.returncode==0 and a.stdout.strip()=='1000',a.stderr

# The deployment's actual diagnostic container must use the controlled root role, not app UID1000.
for source in [ROOT/'compose.yaml',ROOT/'project-template/compose.yaml']:
 text=source.read_text().split('  environment:\n',1)[1].split('  database:\n',1)[0]
 assert 'user: "0:0"'in text and '- .:/run/templux-env:ro'not in text and 'source: ./.env' in text and 'create_host_path: false'in text,str(source)
(out/'environment-permissions.json').write_text(json.dumps({'linuxTmpfsOwner':1001,'mode':'0600','diagnosticEffectiveUid':0,'applicationPreloadUid':1000,'applicationDoesNotReadPrivateDotenv':True,'exit':p.returncode,'scope':'read-only controlled environment check; app services stay non-root'},indent=2)+'\n');print('PASS private dotenv ownership')
