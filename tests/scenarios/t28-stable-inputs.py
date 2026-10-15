"""Materialize only the formal source inventory, with original bytes/modes. No package build.
Destination must be fresh and is under test-results/t28; formal release remains readonly.
"""
import pathlib,json,hashlib,subprocess
root=pathlib.Path.cwd();m=json.loads((root/'test-results/t25/committed-releases/0.1.0/manifest.json').read_text());out=root/'test-results/t28/stable-inputs';out.mkdir();modes={}
for p,digest in m['source']['files'].items():
 assert not any(x in ['', '.', '..'] for x in p.split('/'));data=subprocess.check_output(['git','show',m['source']['commit']+':'+p]);assert hashlib.sha256(data).hexdigest()==digest;f=out/p;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(data);info=subprocess.check_output(['git','ls-tree',m['source']['commit'],'--',p],text=True);mode=int(info.split()[0],8)&511;f.chmod(mode);modes[p]=mode
assert len([f for f in out.rglob('*') if f.is_file()])==198
(root/'test-results/t28/stable-input-modes.json').write_text(json.dumps(modes,indent=2));print(json.dumps({'files':198,'source':m['source']['commit'],'directory':str(out),'noReleaseCreated':True}))
