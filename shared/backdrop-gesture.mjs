// A click's common ancestor is insufficient: both pointer endpoints must qualify.
export function createBackdropGesture(){
 const active=new Set();let candidate=null,ready=null,blocked=false;
 const same=(a,b)=>a.pointerId===b.pointerId&&a.pointerType===b.pointerType;
 const near=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)<=5;
 const reset=()=>{active.clear();candidate=null;ready=null;blocked=false;};
 return {
  down(event,onBackdrop){ready=null;active.add(event.pointerId);if(active.size>1||!event.isPrimary){blocked=true;candidate=null;return;}candidate=!blocked&&onBackdrop&&event.button===0?{pointerId:event.pointerId,pointerType:event.pointerType,clientX:event.clientX,clientY:event.clientY}:null;},
  move(event){if(candidate&&same(candidate,event)&&!near(candidate,event))candidate=null;},
  up(event,onBackdrop){ready=candidate&&same(candidate,event)&&near(candidate,event)&&onBackdrop&&event.button===0&&!blocked&&active.size===1?candidate:null;candidate=null;active.delete(event.pointerId);if(!active.size)blocked=false;},
  cancel(event){active.delete(event.pointerId);candidate=null;ready=null;if(!active.size)blocked=false;},
  // Implicit capture is normally released AFTER pointerup, before touch click.
  lost(event){if(active.has(event.pointerId)){candidate=null;ready=null;blocked=true;}},
  click(event,onBackdrop){const accepted=!!ready&&onBackdrop&&event.button===0&&same(ready,event)&&near(ready,event);ready=null;return accepted;},
  reset
 };
}
