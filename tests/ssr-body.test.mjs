import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';
const base=process.env.TEST_SSR_WEB_URL;assert.ok(base,'Run the isolated SSR fault Web via the container test entry.');
const copy=JSON.parse(readFileSync('config/auth-copy.json','utf8'));
const request=(path,mode)=>fetch(base+path,{headers:{Cookie:`templux_session=ssr-fixture-${mode}`},redirect:'manual',signal:AbortSignal.timeout(12000)});
async function ready(){for(let i=0;i<50;i++){try{const r=await request('/account','valid');await r.text();if(r.status===200)return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Isolated fault Web did not start.');}
test('real Next SSR response-body faults retain route, Cookie and project retry view',async t=>{
 await ready();
 for(const mode of ['truncated','bad-json','decode-error','timeout'])await t.test(`${mode} after successful headers shows route-specific retry`,async()=>{
  for(const path of ['/account','/protected','/admin']){
   const response=await request(path,mode);assert.equal(response.status,200);assert.equal(new URL(response.url).pathname,path);assert.equal(response.headers.get('location'),null);assert.equal(response.headers.get('set-cookie'),null);
   const html=await response.text();assert.ok(html.includes(copy.service_unavailable));assert.ok(html.includes(copy.sessionNetwork));assert.ok(html.includes(copy.retry));assert.ok(html.includes(`href="${path}"`));assert.ok(!html.includes('NEXT_REDIRECT'));
  }
 });
 await t.test('normal valid profile still renders each authenticated page',async()=>{
  for(const [path,label] of [['/account',copy.activeTitle],['/protected',copy.protectedTitle],['/admin',copy.adminTitle]]){const response=await request(path,'valid');assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);const html=await response.text();assert.ok(html.includes(label));assert.ok(html.includes('SSR协议验收元数据'));// Client component props include configured copy in RSC scripts; check rendered content.
    assert.ok(!html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').includes(copy.sessionNetwork));}
 });
 await t.test('explicit401 redirects to the persistent reason and is never caught as unavailable',async()=>{
  for(const path of ['/account','/protected','/admin']){const response=await request(path,'unauthorized');assert.equal(response.status,307);assert.equal(response.headers.get('location'),'/login?reason=authorization_changed');assert.equal(response.headers.get('set-cookie'),null);}
 });
 await t.test('business403 preserves the account redirect without becoming login failure',async()=>{
  for(const path of ['/protected','/admin']){const response=await request(path,'forbidden');assert.equal(response.status,307);assert.equal(response.headers.get('location'),'/account');assert.equal(response.headers.get('set-cookie'),null);}
  const account=await request('/account','forbidden');assert.equal(account.status,200);assert.equal(account.headers.get('location'),null);assert.ok((await account.text()).includes(copy.retry));
 });
});
