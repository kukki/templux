import { connection } from 'next/server';

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
  const status = await readStatus();
  return <div className="shell">
    <header><a className="wordmark" href="/" aria-label="Templux 首页"><span className="mark" aria-hidden="true">t.</span>templux</a>
      <span className="header-note">通用模板项目</span></header>
    <main>
      <p className="eyebrow">TEMPLUX / SYSTEM</p>
      <h1>从一个可靠的起点开始。</h1>
      <p className="intro">独立运行，按需扩展。这里展示当前安装的真实服务状态。</p>
      <section aria-labelledby="status-title" className="status-panel">
        <div className="panel-heading"><h2 id="status-title">服务状态</h2><span className={status ? 'badge ready' : 'badge failed'}>
          <span aria-hidden="true" className="dot" />{status ? '运行正常' : '暂时不可用'}</span></div>
        <dl><div><dt>前端</dt><dd>已连接</dd></div><div><dt>后端与数据库</dt><dd>{status ? '已连接' : '等待恢复'}</dd></div>
          <div><dt>数据库结构版本</dt><dd>{status?.schemaVersion ?? '—'}</dd></div><div><dt>应用版本</dt><dd>0.1.0</dd></div></dl>
        <p className="panel-note">{status ? '容器启动与数据库结构校验已通过。' : '后端或数据库暂时不可用，请检查容器状态。'}</p>
      </section>
      <p className="scope-note">认证、账号管理与控件示例将随对应任务接入。当前页面仅展示公开运行状态。</p>
    </main>
    <footer><span>Templux</span><span>版本 0.1.0</span></footer>
  </div>;
}
