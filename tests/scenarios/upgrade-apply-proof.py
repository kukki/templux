#!/usr/bin/env python3
"""Acceptance only: explicitly review/apply to a newly created disposable copy."""
import pathlib,tempfile,shutil,subprocess,json,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/t26'
def main():
 p=pathlib.Path((OUT/'current-path.txt').read_text().strip());proposal=OUT/'proposals/success-final';c=proposal/'candidate'
 assert json.loads((proposal/'report.json').read_text())['directlyApplicable']
 assert 'Quay project-owned build note preserved' in (c/'Dockerfile').read_text()
 assert 'RUN node tools/shared-version-check.mjs' in (c/'Dockerfile').read_text()
 for path in ['apps/api/src/server.ts','apps/web/app/business/page.tsx','config/presentation.json','config/roles.json','package.json']:assert (c/path).read_bytes()==(p/path).read_bytes()
 copy=pathlib.Path(tempfile.mkdtemp(prefix='templux-t26-reviewed-',dir=ROOT.parent));shutil.copytree(p,copy,dirs_exist_ok=True)
 command=['docker','run','--rm','--entrypoint','git','-v',str(copy)+':/reviewed','-v',str(proposal)+':/proposal:ro','-w','/reviewed','t26-upgrade-tools','apply']
 for args in [['--check','/proposal/changes.patch'],['/proposal/changes.patch']]:
  z=subprocess.run(command+args,capture_output=True,text=True);assert z.returncode==0,'reviewed patch did not apply'
 for item in json.loads((proposal/'vendor-replacements.json').read_text()):
  assert hashlib.sha256((c/'vendor'/item['file']).read_bytes()).hexdigest()==item['sha256'];shutil.copy2(c/'vendor'/item['file'],copy/'vendor'/item['file']);(copy/'vendor'/item['replaces']).unlink()
 for f in c.rglob('*'):
  if f.is_file():assert (copy/f.relative_to(c)).read_bytes()==f.read_bytes()
 (OUT/'reviewed-path.txt').write_text(str(copy)+'\n')
 (OUT/'reviewed-apply.json').write_text(json.dumps({'patchCheck':True,'patchAppliedOnlyToDisposableCopy':True,'vendorHashesVerified':True,'candidateMatchesAppliedCopy':True,'businessAndConfigPreserved':True,'directory':str(copy)},indent=2)+'\n')
if __name__=='__main__':main()
