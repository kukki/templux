"""Own CLI/Compose scheduling and read-only/source audit. No business service or DB.
Requires prior T27 public evidence and an explicitly chosen locally built tools image.
"""
import argparse,pathlib,json,subprocess,os,hashlib,shutil
p=argparse.ArgumentParser();p.add_argument('--image',required=True);a=p.parse_args();root=pathlib.Path.cwd();b=root/'test-results/t27-fix';b.mkdir(exist_ok=True);old=root/'test-results/t27';current=pathlib.Path((old/'current-path.txt').read_text().strip());image=subprocess.check_output(['docker','image','inspect',a.image,'--format','{{.Id}}'],text=True).strip();paths=list(json.loads((old/'source-image.json').read_text())['files'])
js="import{readFileSync}from'node:fs';import{createHash}from'node:crypto';console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,createHash('sha256').update(readFileSync('/opt/templux/'+p)).digest('hex')]))))"
actual=json.loads(subprocess.check_output(['docker','run','--rm','--entrypoint','node',image,'--input-type=module','-e',js,json.dumps(paths)],text=True));assert actual=={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths};(b/'source-audit.json').write_text(json.dumps({'image':image,'commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'files':actual},indent=2))
config=b/'run-config.json';config.write_text(json.dumps({'schemaVersion':1,'source':{'kind':'directory','root':'/source'},'intervalSeconds':1,'allowPrerelease':True}))
state=b/'cli-state';output=b/'cli-output';state.mkdir();output.mkdir();volumes=['-v',str(current)+':/input/current:ro','-v',str(old/'releases')+':/source:ro','-v',str(config)+':/input/run.json:ro','-v',str(state)+':/state','-v',str(output)+':/output'];commands=[]
def run(name,args):
 cmd=['docker','run','--rm',*volumes,image,*args,'--config','/input/run.json'];commands.append(cmd);r=subprocess.run(cmd,capture_output=True,text=True);(b/(name+'.stdout')).write_text(r.stdout);(b/(name+'.stderr')).write_text(r.stderr);assert r.returncode==0,r.stderr;return [json.loads(line) for line in r.stdout.splitlines()]
rows=run('cli-double',['schedule','--max-runs','2']);assert len(rows)==2 and rows[1]['attemptedAt']>=rows[0]['attemptedAt']+1000
manual=run('cli-manual',['check','--json'])[0];assert manual['attemptedAt']<rows[1]['attemptedAt']+1000
restart=run('cli-restart',['schedule','--max-runs','1'])[0];assert restart['attemptedAt']>=manual['attemptedAt']+1000
cs=b/'compose-state';co=b/'compose-output';cs.mkdir();co.mkdir();env=os.environ.copy();env.update(TEMPLUX_UPDATE_IMAGE=image,TEMPLUX_UPDATE_CURRENT=str(current),TEMPLUX_UPDATE_STATE_DIR=str(cs),TEMPLUX_UPDATE_OUTPUT_DIR=str(co),TEMPLUX_UPDATE_SOURCE_DIR=str(old/'releases'),TEMPLUX_UPDATE_PROJECT_NAME='t27-fix-owned-scheduler');base=['docker','compose','--env-file','/dev/null','-f',str(root/'project-template/tools/updates.compose.yaml')]
try:
 cmd=base+['run','--rm','--no-deps','-v',str(config)+':/input/run.json:ro','scheduler','schedule','--config','/input/run.json','--max-runs','2'];commands.append(cmd);r=subprocess.run(cmd,env=env,capture_output=True,text=True);(b/'compose-double.stdout').write_text(r.stdout);(b/'compose-double.stderr').write_text(r.stderr);assert r.returncode==0;cr=[json.loads(line) for line in r.stdout.splitlines()];assert len(cr)==2 and cr[1]['attemptedAt']>=cr[0]['attemptedAt']+1000
finally:subprocess.run(base+['down'],env=env,capture_output=True,check=True)
def inv(d):return {str(f.relative_to(d)):{'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'mode':f.stat().st_mode&511} for f in sorted(d.rglob('*')) if f.is_file()}
inputs={'original':root.parent/'templux-t25-consumer-hjjpjxc4','previous':root.parent/'templux-t26-current-e0o8hffl','current':current};before=json.loads((old/'inputs-before.json').read_text());assert all(inv(inputs[name])==v for name,v in before.items())
for version,origin in [('0.1.0',root/'test-results/t25/committed-releases/0.1.0'),('0.2.0-t26.1',root/'test-results/t26/releases/0.2.0-t26.1')]:assert inv(old/'releases'/version)==inv(origin)
assert hashlib.sha256((old/'releases/0.3.0-t27.1/manifest.json').read_bytes()).hexdigest()=='462ec2f1200a5b58bdf62b454446f5dd7d1bd1c6fc23be071b385cf652c92a98'
for d in [state,cs]:assert not list(d.rglob('check.lock'));assert not list((d/'cache').glob('*')) if (d/'cache').exists() else True
result={'cliAttemptGapMs':rows[1]['attemptedAt']-rows[0]['attemptedAt'],'manualImmediateGapMs':manual['attemptedAt']-rows[1]['attemptedAt'],'restartGapMs':restart['attemptedAt']-manual['attemptedAt'],'composeGapMs':cr[1]['attemptedAt']-cr[0]['attemptedAt'],'readonlyFiles':{k:len(v) for k,v in before.items()},'imageSourceFiles':len(actual),'locks':0};
for directory in [state,output,cs,co]:shutil.rmtree(directory)
result['ownStateAndOutputRemoved']=True
(b/'container-proof.json').write_text(json.dumps(result,indent=2));(b/'commands.json').write_text(json.dumps(commands,indent=2));print(json.dumps(result,indent=2))
