import { sessionReasons } from './session-reasons';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export type Profile = { id:string; name:string; state:string; roles:string[]; permissions:string[]; kind:string; responsiblePersonId:string|null; authVersion:string; heartbeatSeconds:number };
export async function profile(protectedAccess: boolean | 'admin' | 'audit' = false): Promise<Profile | null> {
  const cookie = (await cookies()).get('templux_session')?.value;
  let response: Response;
  try {
    response=await fetch(`${process.env.API_INTERNAL_URL ?? 'http://api:8080'}/api/${protectedAccess==='audit'?'admin/audit-access':protectedAccess==='admin'?'admin/access':protectedAccess?'protected':'auth/session'}`, {
      headers:cookie?{Cookie:`templux_session=${cookie}`}:{},cache:'no-store',signal:AbortSignal.timeout(6000),
    });
  } catch { return null; }
  if(response.status===403&&protectedAccess) redirect('/account');
  if(!response.ok) { const value=await response.json().catch(()=>null); if(response.status===401&&value&&sessionReasons.has(value.error))redirect(`/login?reason=${encodeURIComponent(value.error)}`); return null; }
  const value=await response.json().catch(()=>null);
  if(value===null)return null;
  return {...value.account,heartbeatSeconds:value.heartbeatSeconds};
}
