import { connection } from 'next/server';
import { presentation } from '../../../../shared/presentation.mjs';
import ProjectShell from '../components/project-shell';
import { authCopy } from '../components/auth-copy';
import { profile } from '../components/session';
import Logout from '../components/logout';
export default async function ProtectedPage() {
  await connection(); const config=presentation(); const copy=authCopy(); const account=await profile(true);
  return <ProjectShell config={config}><h1>{copy.protectedTitle}</h1><p className="intro">{copy.protectedIntro}</p>
    <section className="status-panel"><dl><div><dt>{copy.accountName}</dt><dd>{account.name}</dd></div>
      <div><dt>{copy.accountRoles}</dt><dd>{account.roles.join(', ')}</dd></div></dl></section>
    <div className="auth-actions"><a className="text-link" href="/account">{copy.accountTitle}</a><Logout label={copy.logout} failed={copy.logoutFailed}/></div>
  </ProjectShell>;
}
