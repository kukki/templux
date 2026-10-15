import assert from 'node:assert/strict';
// Called with an Ego Page at the isolated fixture route; never mounts a production route.
export async function combinedState(page,{baseURL='http://127.0.0.1:31043',expectWaiting=true}={}){
 await page.goto(baseURL+'/t12-component');
 await page.waitForFunction(()=>document.querySelector('output')?.textContent.startsWith('[{'));
 await page.evaluate(()=>{for(const button of document.querySelectorAll('main>div button'))if(button.textContent.startsWith('成功'))button.click();});
 await page.waitForFunction(()=>document.querySelector('.readonly-list-table tbody').textContent.includes('Alpha'));
 await page.fill('input[name=query]','alpha');
 await page.evaluate(()=>{document.querySelector('.multi-select-trigger').click();document.querySelector('.multi-select-options input[value="display"]').click();window.combinedSamples=[];const start=performance.now(),baseline=JSON.parse(document.querySelector('output').textContent).length;for(const at of [450,1100])setTimeout(()=>window.combinedSamples.push({elapsed:performance.now()-start,title:document.querySelector('.list-message strong')?.textContent,busy:document.querySelector('.readonly-list-table').getAttribute('aria-busy'),calls:JSON.parse(document.querySelector('output').textContent).slice(baseline)}),at);});
 await page.waitForFunction(()=>window.combinedSamples.length===2);
 const samples=await page.evaluate(()=>window.combinedSamples);
 assert.equal(samples[0].title,expectWaiting?'等待输入完成':'正在读取');assert.equal(samples[0].busy,expectWaiting?'false':'true');assert.equal(samples[0].calls.length,0);
 assert.equal(samples[1].title,'正在读取');assert.equal(samples[1].busy,'true');assert.equal(samples[1].calls.length,1);assert.equal(samples[1].calls[0].term,'alpha');assert.deepEqual(samples[1].calls[0].selected,['test']);
 await page.evaluate(()=>{const calls=JSON.parse(document.querySelector('output').textContent);[...document.querySelectorAll('main>div button')].find(button=>button.textContent==='成功 '+calls.at(-1).id).click();});
 await page.waitForFunction(()=>document.querySelector('.list-message strong')?.textContent==='没有匹配记录');
 return {samples,final:await page.evaluate(()=>({title:document.querySelector('.list-message strong').textContent,busy:document.querySelector('.readonly-list-table').getAttribute('aria-busy')}))};
}
async function ready(page,baseURL,settle=true){
 await page.goto(baseURL+'/t12-component');await page.waitForFunction(()=>document.querySelector('output')?.textContent.startsWith('[{'));
 if(settle){await page.evaluate(()=>{for(const b of document.querySelectorAll('main>div button'))if(b.textContent.startsWith('成功'))b.click();});await page.waitForFunction(()=>document.querySelector('.readonly-list-table tbody').textContent.includes('Alpha'));}
}
async function finishLatest(page){await page.evaluate(()=>{const c=JSON.parse(document.querySelector('output').textContent);[...document.querySelectorAll('main>div button')].find(b=>b.textContent==='成功 '+c.at(-1).id).click();});}
export async function directCases(page,{baseURL='http://127.0.0.1:31043'}={}){
 const out={};
 for(const mode of ['search','filter','close','late-success','late-error']){
  await ready(page,baseURL,!mode.startsWith('late-'));
  await page.evaluate(()=>{window.directSamples=[];window.directBaseline=JSON.parse(document.querySelector('output').textContent).length;});
  if(mode!=='filter')await page.fill('input[name=query]','alpha');
  await page.evaluate(mode=>{
   if(mode!=='search'){document.querySelector('.multi-select-trigger').click();document.querySelector('.multi-select-options input[value="display"]').click();}
   const start=performance.now();
   const sample=()=>({elapsed:performance.now()-start,title:document.querySelector('.list-message strong')?.textContent,busy:document.querySelector('.readonly-list-table').getAttribute('aria-busy'),calls:JSON.parse(document.querySelector('output').textContent).slice(window.directBaseline)});
   const times=mode==='search'?[450]:mode==='close'?[450,650]:mode.startsWith('late-')?[700,1100]:[450,1100];
   for(const at of times)setTimeout(()=>window.directSamples.push(sample()),at);
   if(mode==='close')setTimeout(()=>document.querySelector('button[aria-label="关闭选项"]').click(),500);
   if(mode.startsWith('late-'))setTimeout(()=>{for(const b of document.querySelectorAll('main>div button'))if(b.textContent.startsWith(mode==='late-error'?'失败':'成功'))b.click();},500);
  },mode);
  await page.waitForFunction(n=>window.directSamples.length===n,mode==='search'?1:2);
  const samples=await page.evaluate(()=>window.directSamples);const waiting=mode!=='search';if(waiting){assert.equal(samples[0].title,'等待输入完成',mode);assert.equal(samples[0].busy,'false',mode);assert.equal(samples[0].calls.length,0,mode);}
  const reading=samples.at(-1);assert.equal(reading.title,'正在读取',mode);assert.equal(reading.busy,'true',mode);assert.equal(reading.calls.length,1,mode);assert.equal(reading.calls[0].term,mode==='filter'?'':'alpha',mode);assert.deepEqual(reading.calls[0].selected,mode==='search'?['display','test']:['test'],mode);
  await finishLatest(page);await page.waitForFunction(mode=>mode==='search'?document.querySelector('.readonly-list-table tbody').textContent.includes('Alpha'):document.querySelector('.list-message strong')?.textContent==='没有匹配记录',mode);
  out[mode]={samples,final:await page.evaluate(()=>({title:document.querySelector('.list-message strong')?.textContent??'success rows',busy:document.querySelector('.readonly-list-table').getAttribute('aria-busy')}))};
 }
 return out;
}
