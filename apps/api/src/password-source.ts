import {lookup} from 'node:dns/promises';
import type {FastifyRequest} from 'fastify';
import {canonicalIp,passwordProxyHosts} from '../../../shared/client-ip.mjs';
import {AuthError} from './auth-config.js';
import {OperationError} from './database.js';
export function passwordSource() {
  let hosts:string[];
  try{hosts=passwordProxyHosts(process.env.PASSWORD_PROXY_HOSTS??'');}catch{throw new OperationError('PASSWORD_PROXY_HOSTS须为明确受信代理主机名或IP，不接受全网、通配、布尔或跳数。');}
  return async(request:FastifyRequest):Promise<string>=>{
    const peer=canonicalIp(request.raw.socket.remoteAddress);
    const claim=request.headers['x-templux-client-ip'];
    if(hosts.length===0)return peer;
    let addresses:string[];
    try{addresses=(await Promise.all(hosts.map(host=>lookup(host,{all:true})))).flat().map(item=>canonicalIp(item.address));}catch{throw new AuthError('service_unavailable',503);}
    if(!addresses.includes(peer))return peer;
    if(claim===undefined)throw new AuthError('service_unavailable',503);
    try{return canonicalIp(claim);}catch{throw new AuthError('invalid_request',400);}
  };
}
