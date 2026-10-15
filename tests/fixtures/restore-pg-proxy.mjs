import net from 'node:net';
// Test-only PostgreSQL wire fault: forward a real COMMIT/ALTER, then lose its ACK.
export async function restoreFaultProxy(host,port,mode){
 let fired=false;const sockets=new Set();
 const server=net.createServer(front=>{
  const back=net.connect({host,port});sockets.add(front);sockets.add(back);let first=true,requests=Buffer.alloc(0),responses=Buffer.alloc(0),psql=false,drop=false;
  front.on('data',chunk=>{
   requests=Buffer.concat([requests,chunk]);
   while(requests.length>=(first?4:5)){
    const size=first?requests.readInt32BE(0):1+requests.readInt32BE(1);if(size<4||requests.length<size)break;
    const message=requests.subarray(0,size);requests=requests.subarray(size);
    if(first){psql=message.includes(Buffer.from('templux-restore'));first=false;}
    else if(message[0]===81){const q=message.subarray(5).toString();if(!fired&&((mode==='commit'&&psql&&/^\s*COMMIT\b/i.test(q))||(mode==='reopen'&&/ALTER DATABASE .* ALLOW_CONNECTIONS true/i.test(q))||(mode==='fence'&&/ALTER DATABASE .* ALLOW_CONNECTIONS false/i.test(q))))drop=true;}
    back.write(message);
   }
  });
  back.on('data',chunk=>{responses=Buffer.concat([responses,chunk]);while(responses.length>=5){const size=1+responses.readInt32BE(1);if(responses.length<size)break;const message=responses.subarray(0,size);responses=responses.subarray(size);if(drop&&message[0]===67){fired=true;front.destroy();back.destroy();break;}front.write(message);}});
  for(const s of [front,back]){s.on('error',()=>{});s.on('close',()=>{sockets.delete(s);front.destroy();back.destroy();});}
 });
 await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
 return{port:server.address().port,fired:()=>fired,async close(){for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));}};
}
