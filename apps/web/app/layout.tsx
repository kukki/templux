import MaintenanceNotice from './components/maintenance-notice';
import type {MaintenanceState} from '../../../shared/maintenance.mjs';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { connection } from 'next/server';
import { presentation } from '../../../shared/presentation.mjs';
import './style.css';

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const config = presentation();
  return { title: `${config.project.name} · ${config.copy.title}`, description: config.copy.description };
}
export default async function Layout({ children }: { children: ReactNode }) {
  await connection();
  const config = presentation();
  const style = Object.fromEntries(Object.entries(config.theme).map(([key, value]) =>
    [key === 'colorScheme' ? 'colorScheme' : `--${key}`, value])) as CSSProperties;
  let maintenance:MaintenanceState|null=null;try{const response=await fetch(`${process.env.API_INTERNAL_URL??'http://api:8080'}/api/maintenance`,{cache:'no-store',signal:AbortSignal.timeout(2500)});if(response.ok)maintenance=(await response.json()).state??null;}catch{}
  return <html lang={config.language}><body style={style}><MaintenanceNotice initial={maintenance} timeZone={config.time.timeZone}/>{children}</body></html>;
}
