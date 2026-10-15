import {maintenanceReleased,maintenanceReleasePath} from './maintenance-release.js';
import {createServer,request as proxyRequest,type IncomingHttpHeaders} from 'node:http';
import type pg from 'pg';
import type {Presentation} from '../../../shared/presentation.mjs';
import {maintenancePage} from '../../../shared/maintenance.mjs';
import {trustedProxyPolicy,webClientIp} from '../../../shared/client-ip.mjs';
import {readMaintenance} from './maintenance.js';
import {runtimeRecord} from '../../../shared/runtime-log.mjs';
function headersWithoutHop(input:IncomingHttpHeaders){const headers={...input};for(const key of ['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade',...String(input.connection??'').toLowerCase().split(',').map(s=>s.trim())])delete headers[key];return headers;}
export function createMaintenanceEntry(pool:pg.Pool,config:Presentation,upstream=new URL('http://web:3000'),trusted=trustedProxyPolicy(process.env.ENTRY_TRUSTED_PROXY_CIDRS??'')){
 maintenanceReleasePath();return createServer(async(req,res)=>{
  const path=req.url??'/';res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(path==='/health/live'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"status":"alive"}');return;}
  const unavailable=(state:Awaited<ReturnType<typeof readMaintenance>>|null)=>{if(res.headersSent){res.destroy();return;}res.writeHead(503,{'Content-Type':'text/html; charset=utf-8','Retry-After':'30','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});res.end(maintenancePage(config,state));};
  let state;try{state=await readMaintenance(pool);}catch{runtimeRecord('entry','warn','maintenance_state_unknown');unavailable(null);return;}
  if(path==='/api/maintenance'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,state:{...state,accessReady:maintenanceReleased(state)}}));return;}
  if(state.phase!=='online'){unavailable(state);return;}
  if(!maintenanceReleased(state)){unavailable(null);return;}
  if(!path.startsWith('/')||path.startsWith('//')){res.writeHead(400);res.end();return;}
  const headers=headersWithoutHop(req.headers);for(const key of ['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip','x-templux-client-ip'])delete headers[key];
  try{headers['x-templux-client-ip']=webClientIp(req.socket.remoteAddress,req.headers['x-forwarded-for'],trusted);}catch{res.writeHead(400);res.end();return;}
  const proxy=proxyRequest({hostname:upstream.hostname,port:upstream.port||80,path,method:req.method,headers},response=>{res.writeHead(response.statusCode??502,headersWithoutHop(response.headers));response.on('error',()=>res.destroy());response.pipe(res);});
  proxy.on('error',()=>{runtimeRecord('entry','warn','maintenance_upstream_unavailable');unavailable(null);});proxy.setTimeout(30000,()=>proxy.destroy());req.on('aborted',()=>proxy.destroy());res.on('close',()=>{if(!res.writableFinished)proxy.destroy();});req.pipe(proxy);
 });
}
