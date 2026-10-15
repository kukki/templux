import assert from 'node:assert/strict';
export async function hashLinks(page,{assertFixed=true}={}){
 const results=[];
 for(const [text,hash] of [['Native hash','#native-target'],['Relative hash','#local-target'],['Full hash','#full-target'],['Object hash','#object-target']]){
  await page.fill('[name=fixtureName]','Hash draft');await page.waitForFunction(()=>JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent).values.name==='Hash draft');
  await page.evaluate(()=>{window.t14ConfirmCount=0;window.confirm=()=>{window.t14ConfirmCount++;return true;};});
  await page.click('text="'+text+'"');await page.waitForFunction(hash=>location.hash===hash,hash);
  const observed=await page.evaluate(()=>({confirmations:window.t14ConfirmCount,...JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent)}));results.push({text,...observed});
  if(assertFixed){assert.equal(observed.confirmations,0,text);assert.equal(observed.values.name,'Hash draft',text);assert.equal(observed.dirty,true,text);}
 }
 return results;
}
export async function newerValidation(page){
 const read=()=>page.evaluate(()=>({state:JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent),invalid:document.querySelector('[name=fixtureName]').getAttribute('aria-invalid'),message:document.querySelector('.field-error')?.textContent}));
 await page.click('text="Reset"');await page.fill('[name=fixtureName]','Beta');await page.click('text="Submit"');await page.fill('[name=fixtureName]','');await page.press('[name=fixtureName]','Tab');const before=await read();assert.equal(before.state.errors.name,'Required');assert.equal(before.invalid,'true');
 await page.click('text="Resolve 1"');const after=await read();assert.equal(after.state.errors.name,'Required');assert.equal(after.invalid,'true');assert.equal(after.message,'Required');assert.equal(after.state.values.name,'');assert.equal(after.state.dirty,true);assert.equal(after.state.saving,false);
 await page.fill('[name=fixtureName]','Gamma');const corrected=await read();assert.deepEqual(corrected.state.errors,{});assert.equal(corrected.invalid,'false');return {before,after,corrected};
}
export async function leavingBoundaries(page){
 const observations=[];
 const policy=async accept=>page.evaluate(accept=>{window.t14ConfirmCount=0;window.confirm=()=>{window.t14ConfirmCount++;return accept;};},accept);
 const observe=async text=>{const result=await page.evaluate(()=>({confirmations:window.t14ConfirmCount,state:JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent),url:location.href}));observations.push({text,...result});return result;};
 for(const text of ['Next Link 离开','Search leave','External leave']){await policy(false);await page.click('text="'+text+'"');const result=await observe(text+' cancel');assert.equal(result.confirmations,1);assert.equal(result.state.values.name,'Gamma');assert.equal(result.state.dirty,true);}
 for(const text of ['Download leave','Target leave']){await policy(false);await page.click('text="'+text+'"');const result=await observe(text);assert.equal(result.confirmations,0);assert.equal(result.state.dirty,true);}
 await policy(false);await page.keyboard.down('Meta');try{await page.click('text="Modified leave"');}finally{await page.keyboard.up('Meta');}const modified=await observe('modifier');assert.equal(modified.confirmations,0);assert.equal(modified.state.dirty,true);
 await policy(true);await page.click('text="Search leave"');await page.waitForFunction(()=>location.search==='?leave=1');const accepted=await observe('search accepted');assert.equal(accepted.confirmations,1);assert.equal(accepted.state.values.name,'Beta');assert.equal(accepted.state.dirty,false);
 return observations;
}
