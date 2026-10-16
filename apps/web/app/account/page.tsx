import {projectFeatures} from '../../../../shared/features.mjs';
import LoginMethodVerification from '../components/login-method-verification';
import SessionGuard from '../components/session-guard';
import Unavailable from '../components/unavailable';
import { connection } from 'next/server';
import { presentation } from '../../../../shared/presentation.mjs';
import ProjectShell from '../components/project-shell';
import CopyButton from '../components/elements/copy-button';
import elementsCopy from '../../../../config/elements-copy.json';
import { authCopy } from '../components/auth-copy';
import { profile } from '../components/session';
export default async function AccountPage() {
  await connection(); const config=presentation(); const copy=authCopy(); const account=await profile();
  const pending=account?.state==='pending';
  if(!account)return <Unavailable config={config} href="/account"/>;
  return <ProjectShell config={config} account={account}><SessionGuard seconds={account.heartbeatSeconds} accountId={account.id} version={account.authVersion}/><h1>{pending?copy.pendingTitle:account.roles.length?copy.activeTitle:copy.accountTitle}</h1>
    <p className="intro">{pending?copy.pendingIntro:account.roles.length?'':copy.zeroRoles}</p>
    <section className="status-panel"><h2>{copy.accountTitle}</h2><dl>
      <div><dt>{copy.accountId}</dt><dd>{account.id} <CopyButton value={account.id} label={elementsCopy.copyAccountId}/></dd></div><div><dt>{copy.accountName}</dt><dd>{account.name}</dd></div>
      <div><dt>{copy.accountKind}</dt><dd>{account.kind}</dd></div><div><dt>{copy.accountOwner}</dt><dd>{account.responsiblePersonId||'—'}</dd></div><div><dt>{copy.accountRoles}</dt><dd>{account.roles.join(', ')||'—'}</dd></div></dl></section>
    <LoginMethodVerification copy={copy}/><div className="auth-actions">{account.state==='active'&&account.permissions.includes('application:read')&&<><a className="action" href="/protected">{copy.protectedAction}</a>{projectFeatures().componentExamples&&<a className="action secondary-action" href="/examples">{copy.examplesAction}</a>}</>}
      {account.state==='active'&&account.permissions.includes('accounts:manage')&&<a className="action" href="/admin">{copy.adminAction}</a>}
      <a className="text-link" href="/login">{copy.relogin}</a></div>
  </ProjectShell>;
}
