import assert from 'node:assert/strict';
export async function cancelledNavigation(page,{assertFixed=true}={}){
 await page.fill('[name=fixtureName]','Prevented draft');await page.waitForFunction(()=>JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent).dirty);
 await page.evaluate(()=>{window.t14ConfirmCount=0;window.confirm=()=>{window.t14ConfirmCount++;return true;};});const before=await page.url();await page.click('text="Prevented route"');await page.waitForFunction(()=>JSON.parse(document.querySelector('output[aria-label="consumer calls"]').textContent).prevented===1);
 const after=await page.evaluate(()=>({url:location.href,confirmations:window.t14ConfirmCount,state:JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent),calls:JSON.parse(document.querySelector('output[aria-label="consumer calls"]').textContent)}));
 if(assertFixed){assert.equal(after.confirmations,0);assert.equal(after.state.values.name,'Prevented draft');assert.equal(after.state.dirty,true);assert.equal(after.url,before);assert.equal(after.calls.prevented,1);}return {before,after};
}
export async function consumerOrdering(page){
 const observations=[{name:'prevented click',...await cancelledNavigation(page)}];
 const policy=async accept=>page.evaluate(accept=>{window.t14ConfirmCount=0;window.confirm=()=>{window.t14ConfirmCount++;return accept;};},accept);
 const read=()=>page.evaluate(()=>({confirmations:window.t14ConfirmCount,url:location.href,state:JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent),calls:JSON.parse(document.querySelector('output[aria-label="consumer calls"]').textContent)}));
 for(const [text,key] of [['Prevented native','native'],['Prevented navigation','navigate']]){await policy(true);await page.click('text="'+text+'"');await page.waitForFunction(key=>JSON.parse(document.querySelector('output[aria-label="consumer calls"]').textContent)[key]===1,key);const result=await read();assert.equal(result.confirmations,0,text);assert.equal(result.state.values.name,'Prevented draft');assert.equal(result.state.dirty,true);observations.push({name:text,...result});}
 for(const text of ['Native leave','External replace']){await policy(false);await page.click('text="'+text+'"');const result=await read();assert.equal(result.confirmations,1);assert.equal(result.state.values.name,'Prevented draft');assert.equal(result.state.dirty,true);observations.push({name:text+' cancelled',...result});}
 await policy(false);await page.click('text="Forwarded search"');let result=await read();assert.equal(result.calls.forwarded,1);assert.equal(result.confirmations,1);assert.equal(result.state.dirty,true);assert.equal(result.state.values.name,'Prevented draft');observations.push({name:'forwarded refused',...result});
 await policy(true);await page.click('text="Forwarded search"');await page.waitForFunction(()=>location.search==='?forward=1');result=await read();assert.equal(result.calls.forwarded,2);assert.equal(result.confirmations,1);assert.equal(result.state.dirty,false);assert.equal(result.state.values.name,'Alpha');observations.push({name:'forwarded accepted',...result});
 return observations;
}
export async function forcedEnding(page){
 await page.fill('[name=fixtureName]','Ending draft');await page.evaluate(()=>{sessionStorage.setItem('t14-f3:confirms','0');window.confirm=()=>{sessionStorage.setItem('t14-f3:confirms',String(Number(sessionStorage.getItem('t14-f3:confirms'))+1));return false;};document.querySelectorAll('button').forEach(button=>{if(button.textContent==='Force session ending')button.scrollIntoView({block:'center'});});});
 await page.click('text="Force session ending"');await page.waitForURL('**/login?reason=authorization_changed');const count=await page.evaluate(()=>{const value=Number(sessionStorage.getItem('t14-f3:confirms'));sessionStorage.removeItem('t14-f3:confirms');return value;});assert.equal(count,0);return {url:await page.url(),confirmations:count,source:'actual endSession in isolated fixture, not a backend authentication test'};
}
