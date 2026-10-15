"""Apply an inspected T26 proposal only to a new disposable copy; assert all bytes/modes."""
import pathlib,json,shutil,subprocess,hashlib,tempfile
r=pathlib.Path.cwd();b=pathlib.Path((r/'test-results/t28/project-b-path.txt').read_text());p=r/'test-results/t28/b-upgrade/proposal-verified';report=json.loads((p/'report.json').read_text());assert report['directlyApplicable']and not report['manual'];assert report['patchValidation']['status']=='passed';assert len(report['checks'])==7 and all(c['status']=='passed'for c in report['checks'])
# Review boundary: fixed approved target, dependencies only; no project source/config/version changes.
assert report['target']['version']=='0.1.1-t28.1';assert report['target']['manifestSha256']=='9f5b0e2578cc3eb3d7b0d515365e12af43d0c126a04cd5c3d98ade47ef286b06'
assert {c['path'] for c in report['changes']}=={'apps/api/package.json','apps/web/package.json'}
assert hashlib.sha256((p/'changes.patch').read_bytes()).hexdigest()==report['patchValidation']['patchSha256']
review={'decision':'reviewed-for-disposable-application','independent':False,'scope':'Author review of B proposal under TL authorized exercise; final independent review follows','reportSha256':hashlib.sha256((p/'report.json').read_bytes()).hexdigest(),'patchSha256':report['patchValidation']['patchSha256'],'checks':report['checks']};(r/'test-results/t28/b-proposal-review.json').write_text(json.dumps(review,indent=2))
a=pathlib.Path(tempfile.mkdtemp(prefix='templux-t28-b-applied-',dir=r.parent));shutil.copytree(b,a,dirs_exist_ok=True)
for args in [['apply','--check',str(p/'changes.patch')],['apply',str(p/'changes.patch')]]:subprocess.run(['git',*args],cwd=a,check=True)
for v in report['vendor']:
 shutil.copy2(p/'candidate/vendor'/v['file'],a/'vendor'/v['file'])
 if v.get('replaces')and v['replaces']!=v['file']:(a/'vendor'/v['replaces']).unlink()
def inv(root):return {str(f.relative_to(root)):{'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'mode':f.stat().st_mode&511}for f in sorted(root.rglob('*'))if f.is_file()}
assert inv(a)==report['final']['files'];assert inv(p/'candidate')==report['final']['files'];assert inv(b)==json.loads((r/'test-results/t28/project-b-input.json').read_text());(r/'test-results/t28/project-b-applied-path.txt').write_text(str(a));(r/'test-results/t28/b-application-proof.json').write_text(json.dumps({'applied':str(a),'files':len(inv(a)),'fullBytesModesEqual':True,'originalUnchanged':True,'treeSha256':report['final']['treeSha256'],'review':review},indent=2));print(a)
