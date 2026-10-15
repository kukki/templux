import assert from 'node:assert/strict';
export async function controlledEditor(page){
 const state=()=>page.evaluate(()=>JSON.parse(document.querySelector('output[aria-label="editor state"]').textContent));
 const calls=()=>page.evaluate(()=>JSON.parse(document.querySelector('output[aria-label="save calls"]').textContent));
 const log=[];const check=async name=>{const value=await state();log.push({name,state:value,calls:await calls()});return value;};
 await page.fill('input[name=fixtureName]','');assert.deepEqual((await check('before blur')).errors,{});
 await page.click('text="Submit"');assert.equal((await check('submit validates all')).errors.name,'Required');assert.equal((await calls()).length,0);
 await page.fill('input[name=fixtureName]','Beta');assert.deepEqual((await check('error revalidates')).errors,{});
 await page.click('text="Reset"');await page.fill('input[name=fixtureName]','');await page.press('input[name=fixtureName]','Tab');assert.equal((await check('first blur validates')).errors.name,'Required');
 await page.fill('input[name=fixtureName]',' Alpha ');assert.equal((await check('normalized revert')).dirty,false);
 await page.fill('input[name=fixtureName]','Beta');await page.click('text="Submit"');assert.equal((await check('controlled pending')).saving,true);assert.equal((await calls()).length,1);
 await page.fill('input[name=fixtureName]','Gamma');await page.click('text="Resolve 1"');const newer=await check('late success preserves newer edits');assert.equal(newer.values.name,'Gamma');assert.equal(newer.dirty,true);assert.notEqual(newer.status,'saved');
 await page.click('text="Submit"');await page.click('text="Fields 2"');assert.equal((await check('field response')).errors.name,'Taken');await page.fill('input[name=fixtureName]','Beta');assert.deepEqual((await state()).errors,{});
 await page.click('text="Submit"');await page.click('text="Reject 3"');assert.equal((await check('form response')).formError,'Rejected');assert.equal((await state()).dirty,false); // value matches acknowledged Beta baseline
 await page.fill('input[name=fixtureName]','Delta');await page.click('text="Submit"');await page.click('text="Reset"');await page.click('text="Resolve 4"');assert.equal((await check('reset invalidates pending')).values.name,'Beta');assert.notEqual((await state()).status,'saved');
 await page.fill('input[name=fixtureName]','Delta');await page.click('text="Submit"');await page.click('text="挂载切换"');await page.click('text="挂载切换"');assert.equal((await check('unmount makes a fresh editor')).values.name,'Alpha');assert.equal((await calls()).length,0);
 return log;
}
