import {mkdtempSync,mkdirSync,chmodSync,readFileSync,writeFileSync,readdirSync,rmSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve,relative} from 'node:path';import {spawnSync} from 'node:child_process';
import {sha} from './verify.mjs';
const root=resolve(new URL('../..',import.meta.url).pathname),config=JSON.parse(readFileSync(join(root,'release.config.json'))),out=resolve(process.argv[2]??'/release'),commit=process.env.TEMPLUX_SOURCE_COMMIT;
const stage=mkdtempSync(join(tmpdir(),'templux-release-'));let destination;
const excluded=p=>p.split('/').some(name=>['node_modules','.next','.git','test-results','credentials','backups','secrets','logs'].includes(name)||/^\.env(?:\.|$)/.test(name))||/\.(map|tsbuildinfo|log)$/.test(p);
function copyAbsolute(source,to){
 if(excluded(source))return;const stat=lstatSync(source);if(stat.isSymbolicLink())throw new Error('发布输入不允许符号链接。');
 if(stat.isDirectory()){mkdirSync(to,{recursive:true,mode:0o755});for(const name of readdirSync(source))copyAbsolute(join(source,name),join(to,name));}
 else{writeFileSync(to,readFileSync(source),{mode:stat.mode&0o777});chmodSync(to,stat.mode&0o777);}
}
const copy=(from,to)=>copyAbsolute(join(root,from),to);
const write=(p,value)=>writeFileSync(p,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o644});
const typed=p=>({types:p.replace(/\.js$/,'.d.ts'),default:p});
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>excluded(join(dir,e.name))?[]:e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]).sort();}
try{
 if(!/^[a-f0-9]{40}$/.test(commit??'')||config.version!=='0.1.0')throw new Error('发布须显式传入40位源码基线，版本须为受支持版本。');
 for(const [command,args]of [['npm',['run','typecheck']],['node',['--test','tests/project-interface.test.mjs','tests/release.test.mjs','tests/project-web-server.test.mjs']]]){const checked=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});if(checked.status!==0)throw new Error('发布前类型/接口检查失败。');}
 mkdirSync(out,{recursive:true});if(lstatSync(out).isSymbolicLink())throw new Error('发布目录不允许链接。');destination=join(out,config.version);mkdirSync(destination,{mode:0o755});
 const api=JSON.parse(readFileSync(join(root,'apps/api/package.json'))),web=JSON.parse(readFileSync(join(root,'apps/web/package.json')));
 const packages=[];
 for(const kind of ['core','web']){
  const directory=join(stage,kind);mkdirSync(directory);copy('shared',join(directory,'shared'));copy('config',join(directory,'config'));copyAbsolute(join(root,'shared/default-presentation.json'),join(directory,'config/presentation.json'));
  let exports,dependencies,peerDependencies;
  if(kind==='core'){
   copy('apps/api/dist',join(directory,'apps/api/dist'));copy('database',join(directory,'database'));
   exports={'.':typed('./apps/api/dist/project-interface.js'),'./presentation':{types:'./shared/presentation.d.mts',default:'./shared/presentation.mjs'}};
   for(const name of ['manage','migrate','entry-server','auth-config-probe'])exports['./'+name]='./apps/api/dist/'+name+'.js';
   dependencies=api.dependencies;
  }else{
   copy('apps/web/app',join(directory,'apps/web/app'));copy('apps/web/public',join(directory,'apps/web/public'));copy('apps/web/project-server.mjs',join(directory,'apps/web/project-server.mjs'));
   exports={'./layout':'./apps/web/app/layout.tsx','./server':'./apps/web/project-server.mjs','./proxy':'./apps/web/app/api/[...path]/route.ts','./presentation':{types:'./shared/presentation.d.mts',default:'./shared/presentation.mjs'}};
   for(const [name,path]of Object.entries({home:'page',account:'account/page',login:'login/page',protected:'protected/page',admin:'admin/page',audit:'audit/page',examples:'examples/page'}))exports['./pages/'+name]='./apps/web/app/'+path+'.tsx';
   for(const [name,path]of Object.entries({shell:'project-shell',profile:'session',guard:'session-guard',unavailable:'unavailable'}))exports['./server/'+name]='./apps/web/app/components/'+path+'.tsx';
   exports['./server/profile']='./apps/web/app/components/session.ts';
   for(const file of readdirSync(join(directory,'apps/web/app/components/elements')).filter(f=>/\.(tsx|ts)$/.test(f)))exports['./elements/'+file.replace(/\.(tsx|ts)$/,'')]='./apps/web/app/components/elements/'+file;
   for(const file of readdirSync(join(directory,'shared')).filter(f=>f.endsWith('.mjs')&&!['presentation.mjs','runtime-log.mjs','features.mjs','proxy-peer.mjs','client-ip.mjs'].includes(f)))exports['./state/'+file.slice(0,-4)]={types:'./shared/'+file.replace('.mjs','.d.mts'),default:'./shared/'+file};
   peerDependencies=web.dependencies;
  }
  write(join(directory,'package.json'),{name:'@templux/'+kind,version:config.version,type:'module',private:true,files:kind==='core'?['apps/api/dist','database','shared','config']:['apps/web','shared','config'],exports,dependencies,peerDependencies,engines:{node:'>=24 <25'}});
  const result=spawnSync('npm',['pack','--ignore-scripts','--json','--pack-destination',destination],{cwd:directory,encoding:'utf8',timeout:30000});if(result.status!==0)throw new Error('npm pack失败，未发布成功清单。');
  const packed=JSON.parse(result.stdout)[0],bytes=readFileSync(join(destination,packed.filename));packages.push({name:'@templux/'+kind,version:config.version,file:packed.filename,sha256:sha(bytes),integrity:'sha512-'+sha(bytes,'sha512')});
 }
 const inventory={};for(const dir of ['apps/api/src','apps/web','shared','config','database','tools/release','project-template'])for(const path of files(join(root,dir)).filter(p=>!p.includes('/.next/')&&!p.includes('/dist/')&&!p.includes('/node_modules/')))inventory[relative(root,path)]=sha(readFileSync(path));
 const source={commit,treeSha256:sha(JSON.stringify(inventory)),files:inventory};
 const manifest={schemaVersion:1,version:config.version,compatibility:config.compatibility,source,packages};write(join(destination,'manifest.json'),manifest);
 const project=join(destination,'project');copy('project-template',project);mkdirSync(join(project,'vendor'));for(const p of packages)copyAbsolute(join(destination,p.file),join(project,'vendor',p.file));copyAbsolute(join(destination,'manifest.json'),join(project,'vendor/manifest.json'));
 for(const [i,kind]of ['core','web'].entries()){const path=join(project,'apps',kind==='core'?'api':'web','package.json'),value=JSON.parse(readFileSync(path));value.dependencies['@templux/'+kind]='file:../../vendor/'+packages[i].file;writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
 mkdirSync(join(project,'.templux'),{recursive:true});copyAbsolute(join(root,'tools/release/verify.mjs'),join(project,'.templux/verify.mjs'));
 write(join(project,'templux.lock.json'),{schemaVersion:1,version:config.version,manifestSha256:sha(readFileSync(join(destination,'manifest.json'))),packages});
 mkdirSync(join(project,'.templux/baseline'));copy('project-template',join(project,'.templux/baseline/project'));write(join(project,'.templux/baseline.json'),{schemaVersion:1,source,manifestSha256:sha(readFileSync(join(destination,'manifest.json')))});
 copy('config',join(project,'config'));copyAbsolute(join(root,'shared/default-presentation.json'),join(project,'config/presentation.json'));
 copy('project-template/config',join(project,'config'));
 copyAbsolute(join(project,'config'),join(project,'.templux/baseline/project/config'));
 const baseline=JSON.parse(readFileSync(join(project,'.templux/baseline.json'),'utf8'));baseline.files=Object.fromEntries(files(join(project,'.templux/baseline/project')).map(p=>[relative(join(project,'.templux/baseline/project'),p),sha(readFileSync(p))]));writeFileSync(join(project,'.templux/baseline.json'),JSON.stringify(baseline,null,2)+'\n');
 const install=spawnSync('npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],{cwd:project,encoding:'utf8',timeout:180000});if(install.status!==0)throw new Error('项目依赖锁生成失败。');
 write(join(destination,'complete.json'),{version:config.version,manifestSha256:sha(readFileSync(join(destination,'manifest.json')))});
 console.log(JSON.stringify({ok:true,version:config.version,directory:destination,packages}));
}catch(error){console.error(JSON.stringify({event:'release_failed',message:error.message}));console.log(JSON.stringify({ok:false,error:'共享发布未完成，不使用缺少complete标记的产物。'}));process.exitCode=1;}finally{rmSync(stage,{recursive:true,force:true});}
