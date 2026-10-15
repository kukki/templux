export type ImageLoadResult={kind:'ready';width:number;height:number}|{kind:'failed'|'ended'};
export type ImageLoader=(source:string,signal:AbortSignal)=>Promise<ImageLoadResult>;
/** Native image loading can classify resource failure, not the HTTP authentication status. */
export const loadPreviewImage:ImageLoader=(source,signal)=>new Promise((resolve,reject)=>{
 const image=new Image();let finished=false,decoding=false;
 const clean=()=>{image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort);};
 const finish=(result:ImageLoadResult)=>{if(finished)return;finished=true;clean();resolve(result);};
 const abort=()=>{if(finished)return;finished=true;clean();image.removeAttribute('src');reject(new DOMException('Aborted','AbortError'));};
 const loaded=async()=>{if(finished||decoding)return;decoding=true;try{await image.decode();if(!finished)finish(image.naturalWidth>0&&image.naturalHeight>0?{kind:'ready',width:image.naturalWidth,height:image.naturalHeight}:{kind:'failed'});}catch{if(!finished)finish({kind:'failed'});}};
 image.referrerPolicy='no-referrer';image.decoding='async';image.onload=()=>void loaded();image.onerror=()=>finish({kind:'failed'});signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}image.src=source;if(image.complete)queueMicrotask(()=>{if(image.naturalWidth>0)void loaded();else finish({kind:'failed'});});
});
