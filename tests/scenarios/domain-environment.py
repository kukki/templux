#!/usr/bin/env python3
"""Own temp config/Node-container integration; no host Node/npm, no deployment env."""
import hashlib,json,os,pathlib,shutil,subprocess,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results/domain-environment';OUT.mkdir(parents=True,exist_ok=True)
work=pathlib.Path(tempfile.mkdtemp(prefix='templux-domain-env-',dir=ROOT.parent));os.chmod(work,0o700)
results=[]
def run(name,args,env=None,ok=0):
 p=subprocess.run(args,text=True,capture_output=True,env=env,timeout=90)
 assert p.returncode==ok,(name,p.returncode,p.stderr[-500:])
 results.append({'name':name,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr});return p
base={'TEMPLUX_PROJECT_NAME':'review-uat','DEPLOYMENT_ENV':'UAT','APP_PUBLIC_URL':'https://review.example.test','APP_HOST':'review.example.test','NETWORK_NAME':'review-edge','ENTRY_TRUSTED_PROXY_CIDRS':'172.29.0.2/32','DATABASE_URL':'postgresql://test:synthetic-never-log@external:5432/app'}
try:
 for file in ['.env.example','compose.yaml']:shutil.copyfile(ROOT/file,work/file)
 (work/'.env').write_text('\n'.join(f'{k}={v}'for k,v in base.items())+'\nUNKNOWN_SYNTHETIC=do-not-print\n')
 env={k:v for k,v in os.environ.items() if not k.startswith(('FEISHU_','TEMPLUX_','APP_','DOMAIN_','NETWORK_','DATABASE_'))}
 # Effective Compose projections are inspected in memory; never publish full secret-bearing config.
 for location in [ROOT,ROOT/'project-template']:
  e={**env,**base,'DOMAIN_NAME':'example.test'}
  args=['docker','compose','--env-file',str(work/'.env'),'-p','review-uat','-f',str(location/'compose.yaml')]
  p=subprocess.run(args+['config','--format','json'],env=e,text=True,capture_output=True,timeout=20);assert p.returncode==0,p.stderr
  j=json.loads(p.stdout);entry=j['services']['entry'];api=j['services']['api']
  assert 'service_completed_successfully'==api['depends_on']['environment']['condition']
  assert api['environment']['APP_PUBLIC_URL']==e['APP_PUBLIC_URL'] # shell override beats file
  assert not entry.get('ports') and not api.get('ports')
  labels=entry['labels'];prefix='traefik.http.routers.review-uat-UAT-entry'
  assert labels[prefix+'.rule']=='Host(`review.example.test`)'
  assert labels[prefix+'.service']=='review-uat-UAT-entry'
  assert labels[prefix+'.tls']=='true' and labels['traefik.http.services.review-uat-UAT-entry.loadbalancer.server.port']=='8080'
  assert j['networks']['edge']['external'] and j['networks']['edge']['name']=='review-edge'
  results.append({'name':str(location.relative_to(ROOT)or'.')+'-render','exit':0,'publicOrigin':e['APP_PUBLIC_URL'],'hostPortsRemoved':True})
 def command(extra,script):
  args=['docker','run','--rm','-v',f'{ROOT}:/source:ro','-v',f'{work}:/env:ro','-w','/source','-e','TEMPLUX_ENV_DIR=/env']
  for k,v in {**base,**extra}.items():args+=['-e',f'{k}={v}']
  return args+['node:24.21.0-bookworm-slim','node',*script]
 p=run('json-list-no-values',command({},['shared/environment-cli.mjs','list','--json']));j=json.loads(p.stdout);assert j['ok'] and 'synthetic-never-log'not in p.stdout and 'do-not-print'not in p.stdout
 for value in ['', ' \t\n ']:
  run('required-blank-preload',command({'TEMPLUX_ENV_SCOPE':'api','APP_PUBLIC_URL':value},['--import','./shared/environment-startup.mjs','-e','console.log("BUSINESS_STARTED")']),ok=1)
  assert 'BUSINESS_STARTED'not in results[-1]['stdout']
 run('valid-preload',command({'TEMPLUX_ENV_SCOPE':'api'},['--import','./shared/environment-startup.mjs','-e','console.log("BUSINESS_STARTED")']))
 p=run('management-preload-single-error-json',command({'TEMPLUX_ENV_SCOPE':'management','TEMPLUX_PROJECT_NAME':''},['--import','./shared/environment-startup.mjs','-e','console.log(\"BUSINESS_STARTED\")','--','--json']),ok=1);assert json.loads(p.stdout)['ok'] is False
 (work/'.env').write_text('TEMPLUX_PROJECT_NAME=a\nTEMPLUX_PROJECT_NAME=b\n')
 run('duplicate-file-safe-json',command({},['shared/environment-cli.mjs','check','--json']),ok=1)
 (work/'.env').write_text('UNKNOWN_SYNTHETIC=\'$(touch /tmp/never-execute)\'\n')
 (work/'.env.example').write_text((ROOT/'.env.example').read_text().replace('# @env APP_PUBLIC_URL required public\n',''))
 p=run('example-drift-startup-reject',command({'TEMPLUX_ENV_SCOPE':'api'},['--import','./shared/environment-startup.mjs','-e','console.log(\"BUSINESS_STARTED\")']),ok=1);assert 'example_drift'in p.stderr and'BUSINESS_STARTED'not in p.stdout
 for result in results:
  assert 'synthetic-never-log'not in result.get('stdout','')+result.get('stderr','')
 (OUT/'configuration-integration.json').write_text(json.dumps(results,indent=2)+'\n');print('PASS',len(results),'config/container cases')
finally:shutil.rmtree(work)
