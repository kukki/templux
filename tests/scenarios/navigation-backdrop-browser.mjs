import assert from 'node:assert/strict';
// Tool-only React fixture; actual trusted mouse/CDP touch events, no DOM click.
export async function drawerBackdropGestures(page,url){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await page.goto(url);
 const state=()=>page.evaluate(()=>({open:!!document.querySelector('dialog[open]'),overflow:document.body.style.overflow,focus:document.activeElement?.className,value:document.querySelector('[name=fixtureName]')?.value,trace:window.gestureTrace}));
 await page.evaluate(()=>{window.gestureTrace=[];window.underlyingClicks=0;for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','click'])document.addEventListener(type,e=>{window.gestureTrace.push({type,target:e.target.className,id:e.pointerId,pointer:e.pointerType,x:e.clientX,y:e.clientY});if(type==='click'&&!e.target.closest('dialog')&&!e.target.closest('.nav-menu'))window.underlyingClicks++;},true);});
 const open=async()=>{if(!(await state()).open)await page.click('.nav-menu');await page.waitForSelector('dialog[open]');};
 const mouse=async(a,b,via)=>{await page.mouse.move(...a);await page.mouse.down();if(via)await page.mouse.move(...via,{steps:4});await page.mouse.move(...b,{steps:4});await page.mouse.up();};
 const outside=[385,300],inside=[150,40],results=[];
 for(const [name,a,b,via] of [['outside-inside',outside,inside],['inside-outside',inside,outside],['backdrop-drag',outside,[385,450]],['backtrack-drag',outside,outside,[385,450]]]){await open();await mouse(a,b,via);const s=await state();assert.equal(s.open,true,name);assert.equal(s.overflow,'hidden');results.push({name,open:s.open,trace:s.trace.slice(-3)});}
 await page.mouse.click(...outside);await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal((await state()).focus,'secondary-action nav-menu');results.push({name:'mouse-tap',open:false});
 await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const touch=(type,points)=>page.cdp('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:2,radiusY:2,force:1}))});
 for(const [name,a,b] of [['touch-outside-inside',outside,inside],['touch-inside-outside',inside,outside],['touch-backdrop-drag',outside,[385,450]]]){await open();await touch('touchStart',[[1,...a]]);await touch('touchMove',[[1,...b]]);await touch('touchEnd',[]);assert.equal((await state()).open,true,name);results.push({name,open:true});}
 await open();await touch('touchStart',[[1,...outside]]);await touch('touchCancel',[]);assert.equal((await state()).open,true);results.push({name:'native-touch-cancel',open:true});
 await touch('touchStart',[[1,...outside]]);await touch('touchStart',[[1,...outside],[2,...inside]]);await touch('touchEnd',[[1,...outside]]);await touch('touchEnd',[]);assert.equal((await state()).open,true);results.push({name:'touch-second-inside',open:true});
 await touch('touchStart',[[1,...outside]]);await touch('touchEnd',[]);await page.waitForFunction(()=>!document.querySelector('dialog[open]'));results.push({name:'touch-tap-after-all-up',open:false});
 // Actual capture acquisition then release while active; any ensuing native click must not close.
 await open();await page.evaluate(()=>{const d=document.querySelector('dialog');d.addEventListener('pointerdown',e=>d.setPointerCapture(e.pointerId),{once:true});});await page.mouse.move(...outside);await page.mouse.down();await page.mouse.move(384,300);await page.evaluate(()=>{const e=window.gestureTrace.findLast(e=>e.type==='pointerdown');document.querySelector('dialog').releasePointerCapture(e.id)});await page.mouse.move(...outside);await page.mouse.up();assert.equal((await state()).open,true);results.push({name:'active-lost-capture',open:true});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal((await state()).focus,'secondary-action nav-menu');
 await open();await page.cdp('Emulation.setDeviceMetricsOverride',{width:1024,height:844,deviceScaleFactor:1,mobile:false});await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal((await state()).overflow,'');await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await open();await page.mouse.click(...outside);await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 const final=await page.evaluate(()=>({underlyingClicks:window.underlyingClicks,value:document.querySelector('[name=fixtureName]').value,overflow:document.body.style.overflow}));assert.equal(final.underlyingClicks,0);assert.equal(final.value,'Initial');assert.equal(final.overflow,'');return {results,final};
}
export async function drawerGuardRegression(page,url){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await page.goto(url);await page.fill('[name=fixtureName]','Dirty preserved');await page.click('.nav-menu');
 for(let i=0;i<9;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);}
 const rejected=await page.click('dialog a[href="/protected"]');assert.ok(rejected.dialog);await page.dismissDialog();assert.equal(await page.evaluate(()=>document.querySelector('[name=fixtureName]').value),'Dirty preserved');assert.equal(await page.evaluate(()=>document.querySelector('dialog').open),true);
 const exit=await page.click('dialog .logout-actions button:nth-of-type(1)');assert.ok(exit.dialog);await page.dismissDialog();
 await page.mouse.click(385,300);await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await page.evaluate(()=>document.querySelector('[name=fixtureName]').value),'Dirty preserved');
 await page.click('.nav-menu');await page.mouse.move(385,300);await page.mouse.down();await page.keyboard.press('Escape');await page.mouse.up();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await page.click('.nav-menu');await page.mouse.click(385,300);await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 await page.fill('[name=fixtureName]','Initial');return {dirtyRouteRejected:true,dirtyLogoutRejected:true,backdropPreservedDraft:true,tabTrapNine:true,escapeDuringPointerCleared:true};
}
