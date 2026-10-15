"""Actual precise-target proposal, negative reports and disposable review/application.
Uses formal 0.1.0 current source; target is T29 candidate, not .2/.3 overlays.
"""
import pathlib,tempfile,shutil,json,hashlib,subprocess,os
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';target=o/'releases/0.1.2-t29.1';image=subprocess.check_output(['docker','image','inspect','t29-tools','--format','{{.Id}}'],text=True).strip();current=pathlib.Path(tempfile.mkdtemp(prefix='templux-t29-upgrade-',dir=r.parent));shutil.copytree(r/'test-results/t25/committed-releases/0.1.0/project',current,dirs_exist_ok=True);p=current/'config/presentation.json';v=json.loads(p.read_text());v['project']['name']='Juniper Lab';p.write_text(json.dumps(v,indent=2)+'\n');p=current/'apps/api/src/server.ts';p.write_text(p.read_text().replace('Project-owned business extension','Juniper-owned business extension'));(current/'config/project-owned.json').write_text('{"owner":"Juniper","synthetic":true}\n');(current/'tools/delivery-check.mjs').write_text("import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{resolveCopyMessages}from'@templux/web/state/copy';assert.equal(typeof resolveCopyMessages,'function');assert.equal(JSON.parse(readFileSync('package.json')).version,'1.0.0');assert.equal(JSON.parse(readFileSync('config/presentation.json')).project.name,'Juniper Lab');assert.match(readFileSync('apps/api/src/server.ts','utf8'),/Juniper-owned business extension/);console.log('project behavior verified');\n");(o/'upgrade-current-path.txt').write_text(str(current));outputs=o/'upgrade';outputs.mkdir();digest=hashlib.sha256((target/'manifest.json').read_bytes()).hexdigest();results=[]
def inventory(d):return{str(f.relative_to(d)):{'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'mode':f.stat().st_mode&511}for f in sorted(d.rglob('*'))if f.is_file()}
for case in ['success','missing-baseline','conflict','semantic-failure']:
 d=current if case=='success'else pathlib.Path(tempfile.mkdtemp(prefix='templux-t29-upgrade-case-',dir=r.parent))
 if d!=current:shutil.copytree(current,d,dirs_exist_ok=True)
 try:
  if case=='missing-baseline':(d/'.templux/baseline.json').unlink()
  if case=='conflict':(d/'check-updates').write_text('#!/bin/sh\n# Project-owned competing launcher; never overwrite silently.\nexit 7\n');(d/'check-updates').chmod(0o755)
  if case=='semantic-failure':
   p=d/'package.json';v=json.loads(p.read_text());v['scripts']['typecheck']='node -e "process.exit(23)"';p.write_text(json.dumps(v,indent=2)+'\n')
  before=inventory(d);cmd=['docker','run','--rm','--name','t29-upgrade-'+case,'-v',str(d)+':/input/current:ro','-v',str(target)+':/input/target:ro','-v',str(outputs)+':/output','--entrypoint','sh',image,'-c','cp -R /root/.npm /tmp/templux-npm-cache; exec node tools/upgrade/cli.mjs --current /input/current --target-release /input/target --target-version 0.1.2-t29.1 --target-sha256 '+digest+' --output /output/'+case+' --trust-project-code --behavior tools/delivery-check.mjs'];(o/('upgrade-'+case+'-command.json')).write_text(json.dumps(cmd,indent=2));p=subprocess.run(cmd,capture_output=True,text=True,timeout=600);(o/('upgrade-'+case+'.stdout')).write_text(p.stdout);(o/('upgrade-'+case+'.stderr')).write_text(p.stderr);report=json.loads((outputs/case/'report.json').read_text());assert inventory(d)==before
  if case=='success':assert p.returncode==0 and report['directlyApplicable']and len(report['checks'])==7
  else:
   assert p.returncode==2 and not report['directlyApplicable']
   if case=='missing-baseline':assert report['manual'][0]['kind']=='baseline'
   if case=='conflict':assert any(x['kind']=='merge'for x in report['manual'])
   if case=='semantic-failure':assert report['checks'][-1]['name']=='semantic'and report['checks'][-1]['exitCode']==23
  results.append({'case':case,'exit':p.returncode,'directlyApplicable':report['directlyApplicable'],'manual':report['manual'],'checks':report['checks'],'originalReadonly':True});print(case,p.returncode,flush=True)
 finally:
  if d!=current:shutil.rmtree(d)
(o/'upgrade-proof.json').write_text(json.dumps(results,indent=2));report=json.loads((outputs/'success/report.json').read_text());p=outputs/'success';applied=pathlib.Path(tempfile.mkdtemp(prefix='templux-t29-applied-',dir=r.parent));shutil.copytree(current,applied,dirs_exist_ok=True)
# Explicit author review before this task-owned disposable application; no live apply product command.
assert report['target']['manifestSha256']==digest and not report['manual'];(o/'upgrade-author-review.json').write_text(json.dumps({'independent':False,'decision':'reviewed-disposable-copy-only','target':report['target']['version'],'manifestSha256':digest,'patchSha256':report['patchValidation']['patchSha256']},indent=2))
for args in [['apply','--check',str(p/'changes.patch')],['apply',str(p/'changes.patch')]]:subprocess.run(['git',*args],cwd=applied,check=True)
for v in report['vendor']:
 shutil.copy2(p/'candidate/vendor'/v['file'],applied/'vendor'/v['file'])
 if v.get('replaces')and v['replaces']!=v['file']:(applied/'vendor'/v['replaces']).unlink()
assert inventory(applied)==report['final']['files'];(o/'upgrade-applied-path.txt').write_text(str(applied));(o/'upgrade-application.json').write_text(json.dumps({'fullInventoryEqual':True,'files':len(report['final']['files']),'treeSha256':report['final']['treeSha256'],'businessAndConfigPreserved':True},indent=2));print('reviewed full patch/vendor applied with exact inventory')
