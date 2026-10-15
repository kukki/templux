"""Build standard independent consumer targets with explicit local network workaround.
Only owned project Compose is changed to consume prepared images; runtime source unchanged.
"""
import pathlib,subprocess,re,json
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';d=pathlib.Path((o/'consumer-path.txt').read_text());assert d.name.startswith('templux-t29-consumer-');commands=[]
for target in ['api','web','migration','management']:
 cmd=['docker','build','--network=host','--target',target,'-t','t29-consumer-'+target,str(d)];commands.append(cmd);f=open(o/('consumer-target-'+target+'.log'),'w');p=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=300);print(target,p.returncode,flush=True);assert p.returncode==0
p=d/'compose.yaml';s=p.read_text();pattern=r'    build:\n      context: \.\n(?:      network: host\n)?      target: (api|web|migration|management)';s,count=re.subn(pattern,lambda m:'    image: t29-consumer-'+m[1],s);assert count==6,count;p.write_text(s);(o/'consumer-image-commands.json').write_text(json.dumps(commands,indent=2));(o/'consumer-image-deployment.json').write_text(json.dumps({'standardDockerfileUnchanged':True,'independentTargets':['api','web','migration','management'],'buildNetwork':'host','runtimeCompose':'project-owned prepared images; wrapper --build no-op for image-only service','defaultBuildNetworkPassed':False,'reason':'default BuildKit npm install stalled; Compose bake requests unsupported automatic network.host entitlement'},indent=2))
