import { connection } from 'next/server';
import { presentation, formatManagementTime } from '../../../shared/presentation.mjs';

async function readStatus() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? 'http://api:8080'}/api/status`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('status' in value) || value.status !== 'ready'
      || !('schemaVersion' in value) || typeof value.schemaVersion !== 'string') return null;
    return { schemaVersion: value.schemaVersion };
  } catch { return null; }
}

export default async function Page() {
  await connection();
  const config = presentation();
  const copy = config.copy;
  const status = await readStatus();
  const checkedAt = new Date().toISOString();
  return <div className="shell">
    {config.header.visible && <header>
      {config.header.showBrand && <a className="wordmark" href="/" aria-label={`${config.project.name} ${copy.home}`}>
        {config.brand.logo ? <img className="logo" src={config.brand.logo} alt="" />
          : config.brand.mark && <span className="mark" aria-hidden="true">{config.brand.mark}</span>}
        {config.brand.wordmark}</a>}
      {config.header.note && <span className="header-note">{config.header.note}</span>}
    </header>}
    <main>
      {copy.eyebrow && <p className="eyebrow">{config.project.name} / {copy.eyebrow}</p>}
      <h1>{copy.heading}</h1>
      <p className="intro">{copy.intro}</p>
      <section aria-labelledby="status-title" className="status-panel">
        <div className="panel-heading"><h2 id="status-title">{copy.statusTitle}</h2><span className={status ? 'badge ready' : 'badge failed'}>
          <span aria-hidden="true" className="dot" />{status ? copy.ready : copy.unavailable}</span></div>
        <dl><div><dt>{copy.frontend}</dt><dd>{copy.connected}</dd></div><div><dt>{copy.backend}</dt><dd>{status ? copy.connected : copy.recovering}</dd></div>
          <div><dt>{copy.schemaVersion}</dt><dd>{status?.schemaVersion ?? '—'}</dd></div><div><dt>{copy.version}</dt><dd>{config.project.version}</dd></div>
          <div><dt>{copy.checkedAt}</dt><dd><time dateTime={checkedAt}>{formatManagementTime(checkedAt, config)}</time></dd></div></dl>
        <p className="panel-note">{status ? copy.readyNote : copy.unavailableNote}</p>
      </section>
      {copy.scopeNote && <p className="scope-note">{copy.scopeNote}</p>}
    </main>
    {config.footer.visible && <footer><span>{config.footer.text}{config.footer.copyright && <span className="copyright">{config.footer.copyright}</span>}</span>
      {config.footer.showVersion && <span>{copy.version} {config.project.version}</span>}</footer>}
  </div>;
}
