import {projectFeatures} from '../../shared/features.mjs';
import {installRuntimeConsole,runtimeRecord} from '../../shared/runtime-log.mjs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import next from 'next';
import {trustedProxyPolicy,webClientIp} from '../../shared/client-ip.mjs';
try {
installRuntimeConsole('web');projectFeatures();
const trusted=trustedProxyPolicy(process.env.WEB_TRUSTED_PROXY_CIDRS??'');
const app=next({dir:fileURLToPath(new URL('.',import.meta.url)),dev:false,hostname:'0.0.0.0',port:3000});const handle=app.getRequestHandler();await app.prepare();
const server=createServer((request,response)=>{
  try{
    const ip=webClientIp(request.socket.remoteAddress,request.headers['x-forwarded-for'],trusted);
    // Overwrite the caller's claim before Next constructs a NextRequest. API trusts only this server's peer address.
    request.headers['x-templux-client-ip']=ip;
    delete request.headers['x-forwarded-for'];delete request.headers['x-real-ip'];delete request.headers.forwarded;
  }catch{runtimeRecord('web','warn','web_source_rejected');response.writeHead(400,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({ok:false,error:'invalid_request'}));return;}
  void handle(request,response).catch(()=>{runtimeRecord('web','error','web_request_failed');if(!response.headersSent)response.writeHead(503);response.end();});
});
server.listen(3000,'0.0.0.0',()=>runtimeRecord('web','info','server_started'));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>process.exit(0)));

}catch{runtimeRecord('web','error','web_start_failed');process.exitCode=1;}
