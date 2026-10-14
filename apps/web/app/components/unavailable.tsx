import type { Presentation } from '../../../../shared/presentation.mjs';
import ProjectShell from './project-shell';
import { authCopy } from './auth-copy';
export default function Unavailable({config,href}:{config:Presentation;href:string}) {
  const copy=authCopy();return <ProjectShell config={config}><h1>{copy.service_unavailable}</h1><p className="intro">{copy.sessionNetwork}</p><a className="action" href={href}>{copy.retry}</a></ProjectShell>;
}
