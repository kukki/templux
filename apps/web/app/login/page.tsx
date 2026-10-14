import { connection } from 'next/server';
import { presentation } from '../../../../shared/presentation.mjs';
import ProjectShell from '../components/project-shell';
import { authCopy } from '../components/auth-copy';
export default async function Login({searchParams}:{searchParams:Promise<{reason?:string}>}) {
  await connection(); const config=presentation(); const copy=authCopy(); const {reason}=await searchParams;
  let enabled=false;
  try { const response=await fetch(`${process.env.API_INTERNAL_URL??'http://api:8080'}/api/auth/config`,{cache:'no-store',signal:AbortSignal.timeout(6000)}); enabled=response.ok&&(await response.json()).enabled===true; } catch { /* Show unavailable entry. */ }
  const message=reason&&Object.hasOwn(copy,reason)?copy[reason as keyof typeof copy]:undefined;
  return <ProjectShell config={config}><h1>{copy.loginTitle}</h1><p className="intro">{copy.loginIntro}</p>
    {message&&<p className="auth-message" role="alert">{message}</p>}
    {enabled?<a className="action" href="/api/auth/feishu/start">{copy.loginAction}</a>:<p className="auth-message">{copy.loginUnavailable}</p>}
    <p><a className="text-link" href="/">{copy.home}</a></p>
  </ProjectShell>;
}
