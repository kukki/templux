import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export type Profile = { id:string; name:string; state:string; roles:string[]; permissions:string[] };
export async function profile(protectedAccess = false): Promise<Profile> {
  const cookie = (await cookies()).get('templux_session')?.value;
  let response: Response;
  try {
    response=await fetch(`${process.env.API_INTERNAL_URL ?? 'http://api:8080'}/api/${protectedAccess?'protected':'auth/session'}`, {
      headers:cookie?{Cookie:`templux_session=${cookie}`}:{},cache:'no-store',signal:AbortSignal.timeout(6000),
    });
  } catch { redirect('/login?reason=service_unavailable'); }
  if(response.status===403&&protectedAccess) redirect('/account');
  if(!response.ok) { const value=await response.json().catch(()=>({error:'service_unavailable'})); redirect(`/login?reason=${encodeURIComponent(typeof value.error==='string'?value.error:'service_unavailable')}`); }
  const value=await response.json();
  return value.account;
}
