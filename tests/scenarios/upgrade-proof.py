#!/usr/bin/env python3
"""Own nonsecret source variants; proposal Docker has no socket/DB/env access."""
import pathlib,json,subprocess,hashlib,shutil,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/t26'
def inventory(p):return {str(f.relative_to(p)):{'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'mode':oct(f.stat().st_mode&0o777)} for f in sorted(p.rglob('*')) if f.is_file()}
def main():
 current=pathlib.Path((OUT/'current-path.txt').read_text().strip());target=OUT/'releases/0.2.0-t26.1';sha=hashlib.sha256((target/'manifest.json').read_bytes()).hexdigest();results=[]
 for case in ['missing-baseline','conflict','semantic-failure']:
  variant=pathlib.Path(tempfile.mkdtemp(prefix='templux-t26-'+case+'-',dir=ROOT.parent));shutil.copytree(current,variant,dirs_exist_ok=True)
  try:
   if case=='missing-baseline':(variant/'.templux/baseline.json').unlink()
   if case=='conflict':
    p=variant/'Dockerfile';p.write_text(p.read_text().replace('RUN npm run build --workspace project-api','RUN echo custom-conflict'))
   if case=='semantic-failure':
    p=variant/'package.json';v=json.loads(p.read_text());v['scripts']['typecheck']='node -e "process.exit(23)"';p.write_text(json.dumps(v,indent=2)+'\n')
   before=inventory(variant)
   args=['docker','run','--rm','--init','--cap-drop=ALL','--security-opt=no-new-privileges','-v',str(variant)+':/input/current:ro','-v',str(target)+':/input/target:ro','-v',str(OUT/'proposals')+':/output','t26-upgrade-tools','--current','/input/current','--target-release','/input/target','--target-version','0.2.0-t26.1','--target-sha256',sha,'--output','/output/'+case,'--trust-project-code','--behavior','tools/upgrade-behavior.mjs']
   p=subprocess.run(args,capture_output=True,text=True,timeout=600);(OUT/(case+'.stdout')).write_text(p.stdout);(OUT/(case+'.stderr')).write_text(p.stderr)
   report=json.loads((OUT/'proposals'/case/'report.json').read_text());assert p.returncode==2 and not report['directlyApplicable'];assert before==inventory(variant)
   if case=='missing-baseline':assert report['manual'][0]['kind']=='baseline'
   if case=='conflict':assert any(x['kind']=='merge' for x in report['manual'])
   if case=='semantic-failure':assert report['checks'][-1]['name']=='semantic' and report['checks'][-1]['exitCode']==23
   results.append({'case':case,'exit':p.returncode,'manual':report['manual'],'checks':report['checks'],'inputUnchanged':True})
  finally:shutil.rmtree(variant)
 (OUT/'negative-proof.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
if __name__=='__main__':main()
