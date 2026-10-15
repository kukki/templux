// Screenshot fallback: a fresh headless Chrome profile, driven over its own CDP.
// Run with an existing tool Node runtime (ego-browser nodejs < this file).
// No personal browser/profile or source repository application runtime is used.
const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),cp=await import('node:child_process');
const root='/Users/jkoo/git/Templux',out=path.join(root,'test-results/t25'),project=(await fs.readFile(path.join(out,'consumer-path.txt'),'utf8')).trim();
if(!project.startsWith('/Users/jkoo/git/templux-t25-consumer-'))throw new Error('Wrong disposable project');
const secret=JSON.parse(await fs.readFile(path.join(out,'private/browser.json'),'utf8'));
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'templux-t25-browser-'));
const browser=cp.spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket;const pending=new Map();let sequence=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check){for(let i=0;i<200;i++){if(await check())return;await sleep(100);}throw new Error('Browser condition timed out');}
async function command(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
const evaluate=async expression=>(await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
async function click(selector){const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',...box,button:'left',clickCount:1});await command('Input.dispatchMouseEvent',{type:'mouseReleased',...box,button:'left',clickCount:1});}
async function go(url){await command('Page.navigate',{url});await until(()=>evaluate("document.readyState==='complete'"));await sleep(400);}
async function capture(name){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const data=await command('Page.captureScreenshot',{format:'png',fromSurface:true});await fs.writeFile(path.join(out,name),Buffer.from(data.data,'base64'));}
try{
 await until(async()=>{try{return (await fs.stat(path.join(profile,'DevToolsActivePort'))).isFile();}catch{return false;}});
 const port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:31325/login`,{method:'PUT'})).json();
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});socket.onmessage=event=>{const data=JSON.parse(event.data),p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(new Error(data.error.message)):p.resolve(data.result);};
 await command('Page.enable');await command('Runtime.enable');await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await go('http://localhost:31325/login');
 await evaluate("document.querySelector('input[name=username]').focus()");await command('Input.insertText',{text:secret.username});
 await evaluate("document.querySelector('input[name=password]').focus()");await command('Input.insertText',{text:secret.password});await click('form button');
 await until(()=>evaluate("location.pathname==='/account'"));
 await go('http://localhost:31325/business');await until(()=>evaluate("document.body.innerText.includes('Quay-owned business extension')"));
 await capture('business-desktop.png');
 const desktop=await evaluate("({route:location.pathname,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,table:!!document.querySelector('table'),brand:document.body.innerText.includes('Quay Lab')})");
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('business-narrow.png');
 const narrow=await evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,table:!!document.querySelector('table')})");if(narrow.scrollWidth>390)throw new Error('Narrow page overflow');
 await go('http://localhost:31325/examples');await capture('examples-narrow.png');
 const examples=await evaluate("({route:location.pathname,searchInputs:document.querySelectorAll('input[type=search]').length,buttons:document.querySelectorAll('button').length})");if(examples.searchInputs<1)throw new Error('Package examples did not render');
 const result=cp.spawnSync(path.join(project,'templux'),['authorize','--account','1','--roles','user','--confirm','--json'],{env:{...process.env,TEMPLUX_HOST_UID:'0',TEMPLUX_HOST_GID:'0'},encoding:'utf8',timeout:60000});if(result.status!==0)throw new Error('Own CLI revoke failed');
 await evaluate("window.dispatchEvent(new Event('online'))");await until(()=>evaluate("location.pathname==='/login'&&location.search.includes('authorization_changed')"));await capture('revoked-login.png');
 await fs.writeFile(path.join(out,'browser-proof.json'),JSON.stringify({tool:'dedicated headless Chrome CDP fallback',normalFormLogin:true,desktop,narrow,examples,forcedReauthentication:'authorization_changed',personalProfileUsed:false},null,2)+'\n');console.log('browser login, desktop/narrow screenshots, examples and revoked reauthentication passed');
}finally{socket?.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser closed'));}pending.clear();browser.kill('SIGTERM');await new Promise(r=>{if(browser.exitCode!==null)r();else{browser.once('exit',r);setTimeout(r,3000);}});await fs.rm(profile,{recursive:true,force:true});}
