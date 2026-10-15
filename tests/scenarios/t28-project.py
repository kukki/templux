"""Create one independent 0.1.0 consumer with an optional project-only prototype.
No credentials, .env, SQL or prior project modifications. Destination is exclusive.
"""
import pathlib,shutil,tempfile,json,argparse,hashlib
p=argparse.ArgumentParser();p.add_argument('name',choices=['a','b']);a=p.parse_args();root=pathlib.Path.cwd();destination=pathlib.Path(tempfile.mkdtemp(prefix='templux-t28-'+a.name+'-',dir=root.parent));release=root/'test-results/t25/committed-releases/0.1.0';shutil.copytree(release/'project',destination,dirs_exist_ok=True)
config=destination/'config/presentation.json';v=json.loads(config.read_text());v['project']['name']='Harbor Lab' if a.name=='a' else 'Meadow Lab';config.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
# Project data never enters candidate/shared package. Values are deliberately synthetic.
(destination/'config/project-owned.json').write_text(json.dumps({'owner':'Harbor' if a.name=='a' else 'Meadow','syntheticReference':'HARBOR-DEMO-0042' if a.name=='a' else 'MEADOW-DEMO-0091'})+'\n')
if a.name=='a':
 route=destination/'apps/web/app/contribution-demo';shutil.copytree(root/'tests/fixtures/contribution',route)
b=root/'test-results/t28';b.mkdir(exist_ok=True);(b/('project-'+a.name+'-path.txt')).write_text(str(destination));files={str(f.relative_to(destination)):{'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'mode':f.stat().st_mode&511} for f in sorted(destination.rglob('*')) if f.is_file()};(b/('project-'+a.name+'-before.json')).write_text(json.dumps(files,indent=2));print(json.dumps({'project':a.name,'directory':str(destination),'files':len(files),'stableVersion':'0.1.0'}))
