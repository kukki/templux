const finite=values=>!!values&&['x','y','width','height'].every(key=>Number.isFinite(values[key]));
function viewport(v){if(!v||!finite(v)||v.width<=0||v.height<=0)throw new Error('Invalid overlay viewport');return {...v};}
function bounds(v){const margin=Math.min(12,v.width/4,v.height/4);return {x:v.x+margin,y:v.y+margin,width:v.width-2*margin,height:v.height-2*margin};}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function placePopover(anchor,size,visual){const v=viewport(visual),b=bounds(v);if(!anchor||!finite(anchor)||!size||!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<=0||size.height<=0)throw new Error('Invalid popover geometry');if(anchor.width<=0||anchor.height<=0||anchor.x+anchor.width<b.x||anchor.x>b.x+b.width||anchor.y+anchor.height<b.y||anchor.y>b.y+b.height)return null;
 const below=Math.max(0,b.y+b.height-anchor.y-anchor.height-8),above=Math.max(0,anchor.y-8-b.y),side=below>=size.height||below>=above?'bottom':'top',width=Math.min(size.width,b.width),height=Math.min(size.height,side==='bottom'?below:above);if(height<=0)return null;
 return {x:clamp(anchor.x,b.x,b.x+b.width-width),y:side==='bottom'?anchor.y+anchor.height+8:anchor.y-8-height,width,height,side};
}
export function constrainPanel(rect,visual){const b=bounds(viewport(visual));if(!rect||!finite(rect))throw new Error('Invalid panel geometry');const width=clamp(rect.width,Math.min(280,b.width),b.width),height=clamp(rect.height,Math.min(180,b.height),b.height);return {x:clamp(rect.x,b.x,b.x+b.width-width),y:clamp(rect.y,b.y,b.y+b.height-height),width,height};}
export function createPanelController({settings,viewport:initialViewport={x:0,y:0,width:1024,height:768}}){
 if(!settings||!Number.isInteger(settings.width)||settings.width<280||settings.width>1200||!Number.isInteger(settings.height)||settings.height<180||settings.height>1200||typeof settings.draggable!=='boolean'||typeof settings.resizable!=='boolean')throw new Error('Invalid panel settings');
 const options=Object.freeze({...settings}),listeners=new Set();let visual=viewport(initialViewport),currentId=null,epoch=0,ended=false,preferred=null,boundary=null,unsubscribe=null,snapshot;
 const initial=()=>({x:visual.x+(visual.width-options.width)/2,y:visual.y+(visual.height-options.height)/2,width:options.width,height:options.height});
 const geometry=()=>{if(visual.width>640)return constrainPanel(preferred??initial(),visual);const b=bounds(visual),height=Math.min(b.height,Math.max(64,Math.min(options.height,visual.height*.6)));return {x:b.x,y:b.y+b.height-height,width:b.width,height};};
 const publish=()=>{snapshot=Object.freeze({currentId,epoch,ended,narrow:visual.width<=640,blocked:!!boundary?.getSnapshot().blocked,rect:Object.freeze(geometry()),viewport:Object.freeze({...visual}),settings:options});for(const fn of listeners)fn();};
 const release=()=>{unsubscribe?.();unsubscribe=null;boundary=null;};
 const transition=action=>{if(ended)return false;if(boundary){if(boundary.getSnapshot().blocked)return false;return boundary.request(action);}action();return true;};
 publish();
 return {getSnapshot:()=>snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  open(id,apply=()=>{}){if(typeof id!=='string'||!id.trim()||id.length>200)throw new Error('Panel identity required');if(ended)return false;if(currentId===id)return true;return transition(()=>{release();epoch++;currentId=id;preferred??=initial();apply();publish();});},
  close(apply=()=>{}){return transition(()=>{release();currentId=null;epoch++;apply();publish();});},
  registerClose(source,expectedEpoch){if(ended||!currentId||epoch!==expectedEpoch)return()=>{};if(boundary)throw new Error('One close boundary per panel');boundary=source;unsubscribe=source.subscribe(()=>{if(boundary===source)publish();});publish();return()=>{if(boundary===source){release();publish();}};},
  setViewport(next){const v=viewport(next);if(Object.keys(v).every(key=>v[key]===visual[key]))return;visual=v;publish();},
  move(dx,dy,expectedEpoch){if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new Error('Invalid panel delta');if(ended||!currentId||epoch!==expectedEpoch||snapshot.narrow||!options.draggable)return false;preferred=constrainPanel({...snapshot.rect,x:snapshot.rect.x+dx,y:snapshot.rect.y+dy},visual);publish();return true;},
  resize(dw,dh,expectedEpoch){if(!Number.isFinite(dw)||!Number.isFinite(dh))throw new Error('Invalid panel delta');if(ended||!currentId||epoch!==expectedEpoch||snapshot.narrow||!options.resizable)return false;const b=bounds(visual),r=snapshot.rect,maxWidth=b.x+b.width-r.x,maxHeight=b.y+b.height-r.y;preferred={...r,width:clamp(r.width+dw,Math.min(280,maxWidth),maxWidth),height:clamp(r.height+dh,Math.min(180,maxHeight),maxHeight)};publish();return true;},
  reset(expectedEpoch){if(ended||!currentId||epoch!==expectedEpoch||snapshot.narrow)return false;preferred=initial();publish();return true;},
  invalidate(){release();currentId=null;preferred=null;epoch++;publish();},
  end(){release();ended=true;currentId=null;preferred=null;epoch++;publish();},
 };
}
