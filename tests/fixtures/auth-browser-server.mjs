// Test-owned external protocol simulation. Never copied into the production API image.
import { createApplication } from '../../apps/api/dist/application.js';
import { databasePool, migrate } from '../../apps/api/dist/database.js';
const pool=databasePool(); await migrate(pool);
const publicOrigin=process.env.TEST_AUTH_PUBLIC_URL??'http://localhost:31030';
const config={appId:'browser-fixture',appSecret:'browser-test-secret',tenantKey:'browser-tenant',redirectUri:publicOrigin+'/api/auth/feishu/callback',publicOrigin,secure:false,idleSeconds:600,maximumSeconds:43200};
const transport=async (url,init)=>{
  if(url==='https://accounts.feishu.cn/oauth/v3/token') return Response.json({code:0,access_token:'browser-test-runtime-token',token_type:'Bearer',expires_in:7200});
  if(url!=='https://open.feishu.cn/open-apis/authen/v1/user_info'||init.headers.Authorization!=='Bearer browser-test-runtime-token') throw new Error('Unexpected external request');
  return Response.json({code:0,data:{name:'浏览器验收人员',open_id:'browser-person',tenant_key:config.tenantKey}});
};
const app=await createApplication(pool,config,transport);
app.addHook('onSend',async(_request,reply,payload)=>{
  const location=reply.getHeader('location');
  if(typeof location==='string'&&location.startsWith('https://accounts.feishu.cn/open-apis/authen/v1/authorize?')) {
    const external=new URL(location); reply.header('location',`/api/fixture-authorize?state=${encodeURIComponent(external.searchParams.get('state'))}`);
  }
  if(typeof payload==='string'&&reply.getHeader('content-type')?.toString().includes('application/json')){
    const value=JSON.parse(payload);if(typeof value.url==='string'&&value.url.startsWith('https://accounts.feishu.cn/open-apis/authen/v1/authorize?')){const external=new URL(value.url);value.url=`/api/fixture-authorize?state=${encodeURIComponent(external.searchParams.get('state'))}`;return JSON.stringify(value);}
  }
  return payload;
});
app.get('/api/fixture-authorize',async(request,reply)=>{
  const state=request.query.state;
  if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state)) return reply.code(400).send('invalid test state');
  return reply.type('text/html; charset=utf-8').send(`<html lang="zh-CN"><title>测试环境 · 外部飞书授权模拟</title><body><h1>外部飞书协议模拟</h1><p>仅在隔离测试容器运行；本地账号、会话与权限使用真实数据库。</p><a href="/api/auth/feishu/callback?state=${state}&code=browser-fixture-code">确认测试授权</a></body></html>`);
});
app.addHook('onClose',async()=>pool.end());
for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>app.close());
await app.listen({host:'0.0.0.0',port:8080});
