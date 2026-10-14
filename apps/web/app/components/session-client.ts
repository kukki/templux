'use client';
import { sessionReasons } from './session-reasons';
let ending = false;
export const sessionIsEnding = () => ending;
export function guardSessionNavigation() {
  const bypass = (event: BeforeUnloadEvent) => {
    if (ending) { window.onbeforeunload = null; event.stopImmediatePropagation(); event.returnValue = ''; }
  };
  window.addEventListener('beforeunload',bypass,true);
  return () => window.removeEventListener('beforeunload',bypass,true);
}
export function wakeSessionTabs(reason: string) {
  try { localStorage.setItem('templux:session-check',JSON.stringify({reason,nonce:crypto.randomUUID()})); } catch { /* Heartbeats still check server state. */ }
}
export function endSession(reason: string) {
  if (ending) return;
  ending = true;
  window.onbeforeunload = null;
  window.dispatchEvent(new CustomEvent('templux:session-ending',{detail:{reason}}));
  location.replace(`/login?reason=${encodeURIComponent(reason)}`);
}
export async function sessionFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input,{cache:'no-store',...init});
  if (response.status === 401) {
    const payload = await response.clone().json().catch(()=>null);
    if (payload && sessionReasons.has(payload.error)) endSession(payload.error);
  }
  return response;
}
