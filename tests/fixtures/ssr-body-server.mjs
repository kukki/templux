// Test-only upstream response faults. No login, session issuance or role mutation.
import { createServer } from 'node:http';
const paths=new Set(['/api/auth/session','/api/protected','/api/admin/access']);
const account={id:'900',name:'SSR协议验收元数据',state:'active',roles:['admin','user'],permissions:['application:read','accounts:manage'],kind:'person',responsiblePersonId:null,authVersion:'1'};
const server=createServer((request,response)=>{
 if(!paths.has(request.url)){response.writeHead(404);response.end();return;}
 const mode=request.headers.cookie?.match(/(?:^|;\s*)templux_session=ssr-fixture-([a-z-]+)/)?.[1]??'valid';
 if(mode==='unauthorized'){response.writeHead(401,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'authorization_changed'}));return;}
 if(mode==='forbidden'){response.writeHead(403,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'permission_denied'}));return;}
 response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...(mode==='decode-error'?{'Content-Encoding':'gzip'}:{})});
 response.flushHeaders();
 if(mode==='truncated'){response.write('{"account":');setTimeout(()=>response.destroy(),100);return;}
 if(mode==='timeout'){response.write('{"account":');return;}
 if(mode==='bad-json'){response.end('not valid JSON');return;}
 if(mode==='decode-error'){response.end('invalid gzip stream');return;}
 response.end(JSON.stringify({ok:true,account,heartbeatSeconds:30}));
});
server.listen(8080,'0.0.0.0');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
