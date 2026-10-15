"""Clean only named T28 exercise resources; preserve safe review inputs and outputs."""
import pathlib,subprocess,shutil,json
r=pathlib.Path.cwd();out=r/'test-results/t28';names=['t28-project-a-web','t28-components-prod','t28-project-b-web','t28-project-b-old-web'];removed=[]
for name in names:
 exists=subprocess.run(['docker','container','inspect',name],capture_output=True).returncode==0
 if exists:subprocess.run(['docker','rm','-f',name],check=True,capture_output=True);removed.append(name)
projects=[p for p in r.parent.glob('templux-t28-*')if p.is_dir()and p.parent==r.parent and p.name.startswith(('templux-t28-a-','templux-t28-b-'))];cleaned=[]
for p in projects:
 for relative in ['node_modules','apps/web/.next','apps/web/tsconfig.tsbuildinfo','apps/api/dist']:
  f=p/relative
  if f.is_dir():shutil.rmtree(f)
  elif f.exists():f.unlink()
 assert not list(p.glob('.env*'))
 cleaned.append(str(p))
for f in (r/'tests/scenarios/__pycache__').glob('t28-*.pyc'):f.unlink()
cache=r/'tests/scenarios/__pycache__'
if cache.exists()and not list(cache.iterdir()):cache.rmdir()
proof={'removedContainers':removed,'cleanedOwnProjects':cleaned,'originalDeploymentUntouched':True,'safeSourceVendorProposalReleaseLogsRetained':True};(out/'cleanup.json').write_text(json.dumps(proof,indent=2));print(json.dumps(proof))
