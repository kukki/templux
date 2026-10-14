import { connection } from 'next/server';
import { presentation } from '../../../../shared/presentation.mjs';
import ProjectShell from '../components/project-shell';
import { authCopy } from '../components/auth-copy';
import { profile } from '../components/session';
export default async function AdminAccess() {
  await connection(); const config=presentation(); const copy=authCopy(); const account=await profile('admin');
  return <ProjectShell config={config}><h1>{copy.adminTitle}</h1><p className="intro">{copy.protectedIntro}</p><section className="status-panel"><h2>{copy.accountTitle}</h2><p>{account.name}</p><p>{account.roles.join(', ')}</p></section><p><a className="text-link" href="/account">{copy.accountTitle}</a></p></ProjectShell>;
}
