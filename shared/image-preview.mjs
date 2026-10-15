/** Pure source policy and per-instance preview state; loading and DOM belong to the adopter. */
export function prepareImageGroup(image,gallery){
 const normalize=value=>{
  if(!value||typeof value.id!=='string'||!value.id.trim()||value.id.length>200||typeof value.alt!=='string'||!value.alt.trim()||value.alt.length>2000||!Array.isArray(value.sources)||value.sources.length>20)throw new Error('Image ID, alt and bounded source list are required');
  const sources=[];for(const raw of value.sources){if(typeof raw!=='string'||raw.length>8000||/[\u0000-\u001f\u007f\\]/u.test(raw))throw new Error('Invalid image source');const src=raw.trim();if(!src)continue;let canonical;if(src.startsWith('/')&&!src.startsWith('//')){const u=new URL(src,'https://templux.invalid');canonical=u.pathname+u.search+u.hash;}else{let u;try{u=new URL(src);}catch{throw new Error('Invalid image source');}if(u.protocol!=='https:'||u.username||u.password)throw new Error('Images require local root paths or credential-free HTTPS');canonical=u.href;}if(!sources.includes(canonical))sources.push(canonical);}
  return Object.freeze({id:value.id,alt:value.alt,sources:Object.freeze(sources)});
 };
 const selected=normalize(image);if(gallery&&typeof gallery.enabled!=='boolean')throw new Error('Gallery enable must be explicit');
 if(!gallery?.enabled)return Object.freeze({images:Object.freeze([selected]),initialIndex:0,gallery:false});
 if(!Array.isArray(gallery.images)||!gallery.images.length||gallery.images.length>100)throw new Error('Enabled gallery requires 1–100 project images');
 const images=gallery.images.map(normalize),index=images.findIndex(value=>value.id===selected.id);
 if(new Set(images.map(value=>value.id)).size!==images.length||index<0||JSON.stringify(images[index])!==JSON.stringify(selected))throw new Error('Gallery requires unique IDs and an unambiguous selected image');
 return Object.freeze({images:Object.freeze(images),initialIndex:index,gallery:true});
}
export function createImagePreview({image,gallery,zoomPan=false,maxScale=4}){
 if(typeof zoomPan!=='boolean'||!Number.isInteger(maxScale)||maxScale<1||maxScale>8)throw new Error('Invalid image zoom configuration');
 const group=prepareImageGroup(image,gallery),listeners=new Set(),resources=new Map(group.images.map(value=>[value.id,{status:value.sources.length?'idle':'failed',sourceIndex:0,token:0,src:undefined,width:0,height:0}]));
 let index=group.initialIndex,open=false,ended=false,sequence=0,viewport={width:0,height:0},transform={scale:1,x:0,y:0},snapshot;
 const geometry=()=>{const r=resources.get(group.images[index].id),fit=r.width&&r.height?Math.min(1,viewport.width/r.width,viewport.height/r.height):0,fitWidth=r.width*fit,fitHeight=r.height*fit;return {fitWidth,fitHeight,...transform,maxX:Math.max(0,(fitWidth*transform.scale-viewport.width)/2),maxY:Math.max(0,(fitHeight*transform.scale-viewport.height)/2)};};
 const reset=()=>{transform={scale:1,x:0,y:0};};
 const publish=()=>{snapshot=Object.freeze({...group,index,open,ended,zoomPan,maxScale,geometry:Object.freeze(geometry()),resources:Object.freeze(Object.fromEntries([...resources].map(([id,r])=>[id,Object.freeze({...r})])))});for(const listener of listeners)listener();};
 const cancel=id=>{const r=resources.get(id);if(r?.status==='loading'){r.status='idle';r.src=undefined;r.token=++sequence;}};
 const start=id=>{const r=resources.get(id),item=group.images.find(value=>value.id===id);if(ended||!r||r.status!=='idle')return false;r.status='loading';r.src=item.sources[r.sourceIndex];r.token=++sequence;return true;};
 const pan=(x,y)=>{const g=geometry();transform.x=Math.max(-g.maxX,Math.min(g.maxX,x));transform.y=Math.max(-g.maxY,Math.min(g.maxY,y));};
 publish();
 return {
  getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  start(id=group.images[group.initialIndex].id){if(start(id))publish();},
  loaded(id,token,width,height){const r=resources.get(id);if(ended||r?.status!=='loading'||r.token!==token||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return false;Object.assign(r,{status:'ready',width,height});if(group.images[index].id===id)reset();publish();return true;},
  failed(id,token){const r=resources.get(id),item=group.images.find(value=>value.id===id);if(ended||!r||!['loading','ready'].includes(r.status)||r.token!==token)return false;r.sourceIndex++;r.token=++sequence;r.width=0;r.height=0;if(r.sourceIndex>=item.sources.length){r.status='failed';r.src=undefined;}else{r.status='loading';r.src=item.sources[r.sourceIndex];}if(group.images[index].id===id)reset();publish();return true;},
  open(){if(ended||resources.get(group.images[group.initialIndex].id).status!=='ready')return false;index=group.initialIndex;open=true;reset();publish();return true;},
  close(){cancel(group.images[index].id);open=false;index=group.initialIndex;reset();publish();},
  select(next){if(ended||!open||!group.gallery||!Number.isInteger(next)||next<0||next>=group.images.length||next===index)return false;cancel(group.images[index].id);index=next;reset();start(group.images[index].id);publish();return true;},
  resize(width,height){if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;if(viewport.width===width&&viewport.height===height)return;viewport={width,height};reset();publish();},
  zoom(scale){if(!Number.isFinite(scale))throw new Error('Invalid scale');if(ended||!open||!zoomPan||resources.get(group.images[index].id).status!=='ready')return;const next=Math.max(1,Math.min(maxScale,scale)),ratio=next/transform.scale;transform.scale=next;pan(transform.x*ratio,transform.y*ratio);publish();},
  pan(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new Error('Invalid pan');if(ended||!open||!zoomPan||transform.scale===1)return;pan(transform.x+dx,transform.y+dy);publish();},
  invalidate(){for(const id of resources.keys())cancel(id);open=false;reset();publish();},
  end(){ended=true;open=false;reset();for(const r of resources.values())Object.assign(r,{status:'failed',src:undefined,width:0,height:0,token:++sequence});publish();},
 };
}
