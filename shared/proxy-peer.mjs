import {lookup} from 'node:dns/promises';import {canonicalIp,passwordProxyHosts} from './client-ip.mjs';
// Explicit deployment DNS peers, not a trusted hop count or a broad subnet.
export function trustedPeerSource(value=''){
 const hosts=passwordProxyHosts(value);
 return async(peer,claim,fallback)=>{
  const address=canonicalIp(peer);if(!hosts.length)return fallback();
  const addresses=(await Promise.all(hosts.map(host=>lookup(host,{all:true})))).flat().map(item=>canonicalIp(item.address));
  return addresses.includes(address)?canonicalIp(claim):fallback();
 };
}
