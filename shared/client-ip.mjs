import {BlockList,isIP} from 'node:net';
export function canonicalIp(value) {
  if(typeof value!=='string'||value.length>64||value.includes('%')||!isIP(value))throw new Error('来源地址无效。');
  if(isIP(value)===4)return value;
  const ip=new URL(`http://[${value}]/`).hostname.slice(1,-1);
  if(ip.startsWith('::ffff:')){const words=ip.slice(7).split(':');if(words.length===2){const number=parseInt(words[0],16)*65536+parseInt(words[1],16);return [24,16,8,0].map(shift=>(number>>>shift)&255).join('.');}}
  return ip;
}
export function trustedProxyPolicy(value='') {
  if(typeof value!=='string'||value.length>2000)throw new Error('可信代理配置无效。');
  const entries=value===''?[]:value.split(',').map(item=>item.trim());
  if(entries.length>32||new Set(entries).size!==entries.length)throw new Error('可信代理配置无效。');
  const list=new BlockList();
  for(const entry of entries){const [address,prefix,...extra]=entry.split('/');const ip=canonicalIp(address);const family=isIP(ip)===4?'ipv4':'ipv6';
    if(extra.length||prefix!==undefined&&(!/^\d{1,3}$/.test(prefix)||Number(prefix)<1||Number(prefix)>(family==='ipv4'?32:128)))throw new Error('可信代理配置无效。');
    if(prefix===undefined)list.addAddress(ip,family);else list.addSubnet(ip,Number(prefix),family);
  }
  return address=>{const ip=canonicalIp(address);return list.check(ip,isIP(ip)===4?'ipv4':'ipv6');};
}
export function webClientIp(peer,forwarded,trusted) {
  let current=canonicalIp(peer);
  if(!trusted(current)||forwarded===undefined)return current;
  if(typeof forwarded!=='string'||forwarded.length>2048)throw new Error('代理来源链无效。');
  const chain=forwarded.split(',').map(item=>canonicalIp(item.trim()));
  if(!chain.length||chain.length>16)throw new Error('代理来源链无效。');
  for(let index=chain.length-1;index>=0&&trusted(current);index--)current=chain[index];
  return current;
}
export function passwordProxyHosts(value='') {
  if(typeof value!=='string'||value.length>2000)throw new Error('可信代理主机配置无效。');
  const hosts=value===''?[]:value.split(',').map(host=>host.trim());
  if(hosts.length>16)throw new Error('可信代理主机配置无效。');
  const normalized=hosts.map(host=>{
    if(isIP(host))return canonicalIp(host);
    if(/^(?:true|false|[0-9.]+)$/.test(host)||!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host)
      ||host.split('.').some(label=>!label||label.length>63||label.startsWith('-')||label.endsWith('-')))throw new Error('可信代理主机配置无效。');
    return host;
  });
  if(new Set(normalized).size!==normalized.length)throw new Error('可信代理主机配置无效。');
  return normalized;
}
