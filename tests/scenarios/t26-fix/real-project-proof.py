#!/usr/bin/env python3
"""Final tooling only, readonly T26 current/release, own exclusive proposals; no DB/socket."""
import pathlib,json,subprocess,hashlib,tempfile,shutil
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=ROOT/'test-results/t26-fix';CURRENT=pathlib.Path((ROOT/'test-results/t26/current-path.txt').read_text().strip());TARGET=ROOT/'test-results/t26/releases/0.2.0-t26.1'
def inventory(p):return {str(f.relative_to(p)):{'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'mode':f.stat().st_mode&0o777} for f in sorted(p.rglob('*')) if f.is_file()}
def main():
 (OUT/'proposals').mkdir(exist_ok=True);results=[];h=hashlib.sha256((TARGET/'manifest.json').read_bytes()).hexdigest()
 for case in ['success','missing-baseline','conflict','semantic-failure']:
  current=CURRENT
  if case!='success':
   current=pathlib.Path(tempfile.mkdtemp(prefix='templux-t26-fix-'+case+'-',dir=ROOT.parent));shutil.copytree(CURRENT,current,dirs_exist_ok=True)
  try:
   if case=='missing-baseline':(current/'.templux/baseline.json').unlink()
   if case=='conflict':
    p=current/'Dockerfile';p.write_text(p.read_text().replace('RUN npm run build --workspace project-api','RUN echo custom-conflict'))
   if case=='semantic-failure':
    p=current/'package.json';v=json.loads(p.read_text());v['scripts']['typecheck']='node -e "process.exit(23)"';p.write_text(json.dumps(v)+'\n')
   before=inventory(current)
   a=['docker','run','--rm','--init','--cap-drop=ALL','--security-opt=no-new-privileges','-v',str(current)+':/input/current:ro','-v',str(TARGET)+':/input/target:ro','-v',str(OUT/'proposals')+':/output','--entrypoint','sh','t26-fix-tools','-c','cp -R /root/.npm /tmp/templux-npm-cache; exec node tools/upgrade/cli.mjs "$@"','proposal','--current','/input/current','--target-release','/input/target','--target-version','0.2.0-t26.1','--target-sha256',h,'--output','/output/'+case,'--trust-project-code','--behavior','tools/upgrade-behavior.mjs']
   z=subprocess.run(a,capture_output=True,text=True,timeout=600);(OUT/(case+'.stdout')).write_text(z.stdout);(OUT/(case+'.stderr')).write_text(z.stderr);report=json.loads((OUT/'proposals'/case/'report.json').read_text());assert before==inventory(current)
   assert z.returncode==(0 if case=='success' else 2)
   if case=='success':
    assert report['directlyApplicable'] and len(report['checks'])==7 and all(x['status']=='passed' for x in report['checks']);assert report['patchValidation']['status']=='passed';actual=inventory(OUT/'proposals/success/candidate');assert actual==report['final']['files'];assert hashlib.sha256(json.dumps(report['final']['files'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==report['final']['treeSha256']
   else:assert not report['directlyApplicable']
   if case=='missing-baseline':assert report['manual'][0]['kind']=='baseline'
   if case=='conflict':assert any(x['kind']=='merge' for x in report['manual'])
   if case=='semantic-failure':assert report['checks'][-1]['name']=='semantic' and report['checks'][-1]['exitCode']==23
   results.append({'case':case,'exit':z.returncode,'manual':report['manual'],'checks':report['checks'],'patchValidation':report.get('patchValidation'),'inputUnchanged':True});print(json.dumps(results[-1]),flush=True)
  finally:
   if current!=CURRENT:shutil.rmtree(current)
 (OUT/'real-project-proof.json').write_text(json.dumps(results,indent=2)+'\n')
if __name__=='__main__':main()
