"""Real Compose + Web/CLI feature matrix. Touches only named disposable containers."""
import json,os,subprocess,time
from pathlib import Path
BASE={k:v for k,v in os.environ.items() if k not in ['DEPLOYMENT_ENV','COMPONENT_EXAMPLES_ENABLED']}
COMPOSE=['docker','compose','--env-file','/dev/null','--profile','tools']
CASES=[('unset',{},404),('dev',{'DEPLOYMENT_ENV':'DEV'},307),('uat',{'DEPLOYMENT_ENV':'UAT'},307),('prod',{'DEPLOYMENT_ENV':'PROD'},404),('prod-true',{'DEPLOYMENT_ENV':'PROD','COMPONENT_EXAMPLES_ENABLED':'true'},307),('dev-false',{'DEPLOYMENT_ENV':'DEV','COMPONENT_EXAMPLES_ENABLED':'false'},404),('environment-empty',{'DEPLOYMENT_ENV':''},None),('environment-invalid',{'DEPLOYMENT_ENV':'TEST'},None),('empty',{'COMPONENT_EXAMPLES_ENABLED':''},None),('invalid',{'COMPONENT_EXAMPLES_ENABLED':'yes'},None)]
results={}
for label,values,expected in CASES:
 env={**BASE,**values}
 doc=json.loads(subprocess.check_output(COMPOSE+['config','--format','json'],env=env,text=True))
 public={key:doc['services']['web']['environment'][key] for key in ['DEPLOYMENT_ENV','COMPONENT_EXAMPLES_ENABLED']}
 assert public['COMPONENT_EXAMPLES_ENABLED']==values.get('COMPONENT_EXAMPLES_ENABLED','auto')
 assert public['DEPLOYMENT_ENV']==values.get('DEPLOYMENT_ENV','PROD')
 assert doc['services']['management']['environment']['COMPONENT_EXAMPLES_ENABLED']==public['COMPONENT_EXAMPLES_ENABLED']
 cli=subprocess.run(COMPOSE+['run','--rm','--no-deps','-e','DATABASE_URL=','management','config-check','--json','--non-interactive'],env=env,capture_output=True,text=True)
 assert (cli.returncode==0)==(expected is not None)
 name='templux-t10-config-'+label
 try:
  subprocess.run(COMPOSE+['run','-d','--no-deps','--name',name,'-e','API_INTERNAL_URL=http://password-api:8080','web'],env=env,capture_output=True,text=True,check=True)
  response=None
  for attempt in range(100):
   state=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .State}}',name],text=True))
   if not state['Running']:break
   probe=subprocess.run(['docker','exec',name,'node','-e',"fetch('http://localhost:3000/examples',{redirect:'manual'}).then(async r=>console.log(JSON.stringify({status:r.status,location:r.headers.get('location'),hasSample:(await r.text()).includes('示例条目 A')}))).catch(()=>process.exitCode=1)"],capture_output=True,text=True)
   if probe.returncode==0:response=json.loads(probe.stdout);break
   time.sleep(.1)
  if expected is None:
   assert not state['Running'] and state['ExitCode']!=0
   logs=subprocess.check_output(['docker','logs',name],stderr=subprocess.STDOUT,text=True)
   assert 'web_start_failed' in logs
  else:
   assert response and response['status']==expected,(label,response)
   assert response['hasSample'] is False
  results[label]={'config':public,'cliExit':cli.returncode,'webExit':state['ExitCode'] if expected is None else None,'response':response}
 finally:
  subprocess.run(['docker','rm','-f',name],capture_output=True,check=True)
Path('test-results/t10-config-matrix.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'cases':len(results),'passed':True}))
