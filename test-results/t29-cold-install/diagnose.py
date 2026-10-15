#!/usr/bin/env python3
"""Bounded own-context diagnostic. No daemon mutation, host npm, secrets, or DB."""
import hashlib,json,os,pathlib,shutil,signal,subprocess,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path(os.environ.get('T29_COLD_OUTPUT',str(pathlib.Path(__file__).resolve().parent))).resolve()
OUT.mkdir(mode=0o700,parents=True,exist_ok=True)
SOURCE=ROOT/'test-results/t29/releases/0.1.2-t29.1/project'
def save(name,value): (OUT/name).write_text(json.dumps(value,indent=2)+'\n')
def capture(args): return subprocess.check_output(args,text=True)
def run(name,args,timeout,cwd=None):
    start=time.monotonic()
    with (OUT/(name+'.log')).open('w') as log:
        p=subprocess.Popen(args,cwd=cwd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        timed=False
        try: code=p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed=True;os.killpg(p.pid,signal.SIGINT)
            try: code=p.wait(timeout=12)
            except subprocess.TimeoutExpired: os.killpg(p.pid,signal.SIGKILL);code=p.wait()
    result=dict(command=args,timeoutSeconds=timeout,timedOut=timed,exitCode=code,elapsedSeconds=round(time.monotonic()-start,3))
    save(name+'.json',result); print(name,json.dumps(result),flush=True);return result

def inventory(root):
    return {str(p.relative_to(root)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':oct(p.stat().st_mode&0o777)} for p in sorted(root.rglob('*')) if p.is_file()}

if __name__=='__main__':
    if (OUT/'work.json').exists(): raise SystemExit('Use a fresh T29_COLD_OUTPUT; existing evidence is preserved')
    work=pathlib.Path(tempfile.mkdtemp(prefix='templux-t29-cold-',dir=ROOT.parent));os.chmod(work,0o700)
    save('work.json',{'path':str(work)})
    shutil.copytree(SOURCE,work/'project')
    before=inventory(SOURCE);save('input-inventory.json',before)
    infos=json.loads(capture(['docker','info','--format','{{json .}}']))
    # Presence only for proxy strings. Never save raw daemon/client configuration.
    meta={k:infos.get(k) for k in ['ServerVersion','OperatingSystem','OSType','Architecture','KernelVersion','Driver','NCPU','MemTotal']}
    meta['proxyPresent']={k:bool(infos.get(k)) for k in ['HttpProxy','HttpsProxy','NoProxy']}
    meta['context']=capture(['docker','context','show']).strip()
    rows=[json.loads(x) for x in capture(['docker','buildx','ls','--format','{{json .}}']).splitlines() if x]
    meta['builders']=[{'name':r['Name'],'current':r['Current'],'driver':r['Driver'],'nodes':[{'name':n['Name'],'version':n.get('Version'),'status':n.get('Status'),'network':n.get('Labels',{}).get('org.mobyproject.buildkit.worker.network')} for n in r.get('Nodes',[])]} for r in rows]
    meta['hostProxyEnvironmentPresent']={k:k in os.environ for k in ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','BUILDX_BUILDER','COMPOSE_BAKE']}
    config=pathlib.Path.home()/'.docker/config.json'
    if config.exists():
        data=json.loads(config.read_text());meta['clientProxyProfilesPresent']=bool(data.get('proxies'));meta['clientProxyFields']=sorted({k for v in data.get('proxies',{}).values() for k in v})
    save('environment.json',meta)
    probe=work/'probe';probe.mkdir()
    (probe/'probe.mjs').write_text('''import {lookup} from 'node:dns/promises';import {readFileSync} from 'node:fs';
console.log(JSON.stringify({resolv:readFileSync('/etc/resolv.conf','utf8'),proxyPresent:Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','NO_PROXY'].map(k=>[k,!!process.env[k]]))}));
try{console.log('DNS',JSON.stringify(await lookup('registry.npmjs.org',{all:true})));}catch(e){console.log('DNS_ERROR',e.code)}
for(const url of ['https://registry.npmjs.org/next','https://registry.npmjs.org/next/-/next-16.4.0.tgz']){let t=Date.now();try{let r=await fetch(url,{signal:AbortSignal.timeout(8000)});let b=await r.arrayBuffer();console.log(JSON.stringify({url,status:r.status,bytes:b.byteLength,ms:Date.now()-t}));}catch(e){console.log(JSON.stringify({url,error:e.name,code:e.cause?.code,ms:Date.now()-t}));}}
''')
    (probe/'Dockerfile').write_text('FROM node:24.21.0-bookworm-slim\nCOPY probe.mjs /probe.mjs\nRUN node /probe.mjs\n')
    run('default-network-probe',['docker','build','--no-cache','--progress=plain',str(probe)],40)
    # Exact candidate Compose/Dockerfile. No modified network, prepared image, cache mount, or npm flags.
    run('default-compose-cold',['docker','compose','--env-file','/dev/null','-p','t29-cold-default','--progress','plain','build','--no-cache','management'],150,work/'project')
    save('input-unchanged.json',{'unchanged':before==inventory(SOURCE),'copiedProjectUnchanged':before==inventory(work/'project')})
    print('WORK',work,flush=True)
