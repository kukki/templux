import {createProjectApplication,databasePool} from '@templux/core';
const pool=databasePool();
const app=await createProjectApplication(pool,{routes:[{method:'GET',path:'/api/business/greeting',permission:'records:read',scope:async({account,query})=>{const target=(query as Record<string,unknown>)?.accountId;return target===undefined||target===account.id;},handle:({account})=>({ok:true,greeting:'Project-owned business extension',name:account.name,accountId:account.id,businessVersion:process.env.BUSINESS_VERSION??'1.0.0'})}]});
await app.listen({host:'0.0.0.0',port:8080});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>void app.close().then(()=>pool.end()));
