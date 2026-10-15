"""Delete only task-owned runtime/secrets/cache, retaining safe delivery/proposal evidence."""
import pathlib,subprocess,json,shutil,os
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True).splitlines();removed=[]
for n in names:
 if n.startswith(('t29-consumer-management-run-','t29-consumer-auth-config-probe-run-'))or n in ['t29-removed-api','t29-removed-web']:
  subprocess.run(['docker','rm','-f',n],capture_output=True,check=True);removed.append(n)
for pointer,expected in [('restored-project-path.txt','templux-t29-restored-'),('consumer-path.txt','templux-t29-consumer-')]:
 d=pathlib.Path((o/pointer).read_text());assert d.parent==r.parent and d.name.startswith(expected)
 q=subprocess.run(['docker','compose','--profile','tools','--project-directory',str(d),'-f',str(d/'compose.yaml'),'down','-v','--remove-orphans'],cwd=d,capture_output=True,text=True);(o/(pointer+'.down.log')).write_text(q.stdout+q.stderr);assert q.returncode==0
# External target network was created only here. DB removal already disconnected its endpoint.
q=subprocess.run(['docker','network','inspect','t29-restored-runtime'],capture_output=True)
if q.returncode==0:subprocess.run(['docker','network','rm','t29-restored-runtime'],capture_output=True,check=True)
subprocess.run(['python3',str(r/'tests/scenarios/t29-suite.py'),'down'],check=True,capture_output=True)
projects=[]
for pointer in ['source-path.txt','consumer-path.txt','restored-project-path.txt','upgrade-current-path.txt','upgrade-applied-path.txt','scheduler-current-path.txt','removed-project-path.txt']:
 d=pathlib.Path((o/pointer).read_text());assert d.parent==r.parent and d.name.startswith('templux-t29-')
 for relative in ['.env','credentials','backups','node_modules','apps/web/.next','apps/api/dist','apps/web/tsconfig.tsbuildinfo']:
  f=d/relative
  if f.is_dir():shutil.rmtree(f)
  elif f.exists():f.unlink()
 projects.append(str(d))
for p in ['private','scheduler-state','scheduler-output','compose-scheduler-state','compose-scheduler-output']:
 f=o/p
 if f.exists():shutil.rmtree(f)
remaining=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True).splitlines();assert not any(n.startswith('t29-')for n in remaining),remaining
for directory in [r/'tests/scenarios/__pycache__']:
 if directory.exists():
  for f in directory.glob('t29-*.pyc'):f.unlink()
  if not list(directory.iterdir()):directory.rmdir()
proof={'removedOneOffAndVariantContainers':removed,'ownProjectsSafeSourceRetained':projects,'secretsAndDumpsRemoved':True,'ownCachesRemoved':True,'ownRuntimeRemaining':[],'otherContainersUntouched':remaining,'safeCandidateSourceVendorProposalsLogsRetained':True};(o/'cleanup.json').write_text(json.dumps(proof,indent=2));print(json.dumps(proof))
