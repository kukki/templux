import SessionGuard from '../components/session-guard';
import Unavailable from '../components/unavailable';
import { connection } from 'next/server';
import { presentation } from '../../../../shared/presentation.mjs';
import ProjectShell from '../components/project-shell';
import { authCopy } from '../components/auth-copy';
import { profile } from '../components/session';
export default async function ProtectedPage() {
  await connection(); const config=presentation(); const copy=authCopy(); const account=await profile(true);
  if(!account)return <Unavailable config={config} href="/protected"/>;
  return <ProjectShell config={config} account={account}><SessionGuard seconds={account.heartbeatSeconds} accountId={account.id} version={account.authVersion}/><h1>{copy.protectedTitle}</h1><p className="intro">{copy.protectedIntro}</p>
    <section className="status-panel"><dl><div><dt>{copy.accountName}</dt><dd>{account.name}</dd></div>
      <div><dt>{copy.accountRoles}</dt><dd>{account.roles.join(', ')}</dd></div></dl></section>
    <div className="auth-actions"><a className="text-link" href="/account">{copy.accountTitle}</a></div>
  </ProjectShell>;
}
