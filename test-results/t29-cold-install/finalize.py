#!/usr/bin/env python3
"""Inspect own images without launching product, then remove only own tags/context."""
import importlib.util,json,pathlib,subprocess,shutil,hashlib
p=pathlib.Path(__file__).with_name('diagnose.py').resolve();spec=importlib.util.spec_from_file_location('diag',p);d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
w=pathlib.Path(json.loads((d.OUT/'work.json').read_text())['path'])
assert w.parent==d.ROOT.parent and w.name.startswith('templux-t29-cold-')
js='''const fs=require('node:fs');const dir='/root/.npm/_logs';let text=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.endsWith('.log')).map(x=>fs.readFileSync(dir+'/'+x,'utf8')).join('\\n'):'';console.log(JSON.stringify({logs:fs.existsSync(dir)?fs.readdirSync(dir).length:0,cacheMisses:(text.match(/cache miss/g)||[]).length,cacheHits:(text.match(/cache hit/g)||[]).length,fetch200:(text.match(/http fetch GET 200/g)||[]).length,fetchHostCounts:Object.fromEntries(['registry.npmjs.org'].map(h=>[h,text.split('\\n').filter(l=>l.includes('http fetch')&&l.includes(h)).length]))}));'''
proof={}
for target in ['management','web']:
    image='t29-cold-default-'+target
    proof[target]={'imageId':d.capture(['docker','image','inspect',image,'--format','{{.Id}}']).strip(),'npmLog':json.loads(d.capture(['docker','run','--rm','--name','t29-cold-inspect-'+target,'--entrypoint','node',image,'-e',js]))}
proof['base']=json.loads(d.capture(['docker','run','--rm','--name','t29-cold-base-proof','--entrypoint','node','node:24.21.0-bookworm-slim','-e','const f=require("node:fs");console.log(JSON.stringify({npmCacheExists:f.existsSync("/root/.npm"),projectExists:f.existsSync("/opt/project"),node:process.version}));']))
proof['dockerfileHasCacheMount']='--mount' in (w/'project/Dockerfile').read_text()
proof['sourceUnchanged']=d.inventory(d.SOURCE)==json.loads((d.OUT/'input-inventory.json').read_text())
proof['workingCopyUnchanged']=d.inventory(w/'project')==d.inventory(d.SOURCE)
proof['noDependencyCacheInContext']=not any(p.name in ['node_modules','.npm','.next'] for p in (w/'project').rglob('*'))
proof['fixedFiles']={str(p.relative_to(d.ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [d.SOURCE/'Dockerfile',d.SOURCE/'compose.yaml',d.SOURCE/'package-lock.json',d.SOURCE/'templux.lock.json',d.SOURCE.parent/'manifest.json',d.ROOT/'test-results/t29/delivery.json']}
# Render only build routing: never persist all Compose environment/secrets.
render=json.loads(subprocess.check_output(['docker','compose','--env-file','/dev/null','-p','t29-cold-default','config','--format','json'],cwd=w/'project',text=True))
proof['effectiveBuild']={name:{'build':v.get('build'),'image':v.get('image')} for name,v in render['services'].items() if v.get('build')}
d.save('cold-proof.json',proof)
cleanup=[]
for name in ['t29-cold-default-management','t29-cold-default-web']:
    cleanup.append(d.run('remove-'+name,['docker','image','rm',name],20))
# The diagnostic's exact untagged output ID, not any shared/dangling image selection.
probe=(d.OUT/'default-network-probe.log').read_text();import re
ids=re.findall(r'exporting manifest list (sha256:[0-9a-f]{64})',probe)
if ids: cleanup.append(d.run('remove-probe-image',['docker','image','rm',ids[-1]],20))
shutil.rmtree(w)
for cache in [d.OUT/'__pycache__']:
    if cache.exists():shutil.rmtree(cache)
d.save('cleanup.json',{'commands':cleanup,'ownWorkRemoved':not w.exists(),'builderCreated':False,'networkCreated':False,'dbCreated':False,'contextAfter':d.capture(['docker','context','show']).strip(),'remainingContainers':d.capture(['docker','ps','--format','{{.Names}}']).splitlines(),'sharedBuildCachePruned':False})
print(json.dumps(proof,indent=2))
