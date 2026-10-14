import type { ReactNode } from 'react';
import type { Presentation } from '../../../../shared/presentation.mjs';
export default function ProjectShell({ config, children }: { config: Presentation; children: ReactNode }) {
  return <div className="shell">
    {config.header.visible && <header>
      {config.header.showBrand && <a className="wordmark" href="/" aria-label={`${config.project.name} ${config.copy.home}`}>
        {config.brand.logo ? <img className="logo" src={config.brand.logo} alt="" /> : config.brand.mark && <span className="mark" aria-hidden="true">{config.brand.mark}</span>}
        {config.brand.wordmark}</a>}
      {config.header.note && <span className="header-note">{config.header.note}</span>}
    </header>}
    <main>{children}</main>
    {config.footer.visible && <footer><span>{config.footer.text}{config.footer.copyright && <span className="copyright">{config.footer.copyright}</span>}</span>
      {config.footer.showVersion && <span>{config.copy.version} {config.project.version}</span>}</footer>}
  </div>;
}
