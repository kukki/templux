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
  return <html lang={config.language}><body style={style}>{children}</body></html>;
}
