"""Host Docker regression: only six public T09 settings are reported.

Run after docker compose build api management checks. No deployment service is
started, migrated or stopped. API probes use an unreachable private database;
CLI config-check disables database recording. Rendered full config stays in RAM.
"""
import json
import os
from pathlib import Path
import subprocess

KEYS = ['AUDIT_RETENTION_DAYS', 'AUDIT_CLEANUP_BATCH_SIZE',
        'AUDIT_CLEANUP_MAX_BATCHES', 'AUDIT_CLEANUP_INTERVAL_SECONDS',
        'RUNTIME_LOG_MAX_BYTES', 'RUNTIME_LOG_MAX_FILES']
DEFAULTS = dict(zip(KEYS, ['90', '1000', '10', '3600', '10485760', '10']))
VALID = dict(zip(KEYS, ['30', '200', '3', '120', '32768', '4']))
INVALID = dict(zip(KEYS, ['3651', '10001', '101', '9', '16383', '31']))
BASE = {k: v for k, v in os.environ.items() if k not in KEYS}
COMPOSE = ['docker', 'compose', '--env-file', '/dev/null', '--profile', 'tools']
OUT = Path('test-results')
OUT.mkdir(exist_ok=True)
PROBE = """
import pg from 'pg';
import {createApplication} from './apps/api/dist/application.js';
import {auditSettings} from './apps/api/dist/audit-settings.js';
import {runtimePolicy,runtimeRecord} from './shared/runtime-log.mjs';
const pool = new pg.Pool({connectionString:'postgresql://probe:probe@127.0.0.1:1/probe',connectionTimeoutMillis:100});
let app;
try {
 app = await createApplication(pool,null);
 await app.listen({host:'127.0.0.1',port:0});
 const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/health/live');
 if(!response.ok)throw new Error();
 const audit=auditSettings(),runtime=runtimePolicy();
 console.log(JSON.stringify(Object.fromEntries(['AUDIT_RETENTION_DAYS','AUDIT_CLEANUP_BATCH_SIZE','AUDIT_CLEANUP_MAX_BATCHES','AUDIT_CLEANUP_INTERVAL_SECONDS','RUNTIME_LOG_MAX_BYTES','RUNTIME_LOG_MAX_FILES'].map((key,i)=>[key,String([audit.days,audit.batchSize,audit.maximumBatches,audit.intervalSeconds,runtime.maximumBytes,runtime.maximumFiles][i])]))));
} catch {
 runtimeRecord('api','error','application_start_failed');process.exitCode=1;
} finally {await app?.close();await pool.end();}
"""

def render(values):
    run = subprocess.run(COMPOSE + ['config', '--format', 'json'],
                         env={**BASE, **values}, text=True, capture_output=True, check=True)
    services = json.loads(run.stdout)['services']
    api = {key: services['api']['environment'][key] for key in KEYS}
    for key in KEYS:
        assert services['management']['environment'].get(key) == api[key], key
    for name, service in services.items():
        for key, option in [('RUNTIME_LOG_MAX_BYTES', 'max-size'),
                            ('RUNTIME_LOG_MAX_FILES', 'max-file')]:
            assert service['logging']['options'][option] == api[key], (name, key)
            if key in service.get('environment', {}):
                assert service['environment'][key] == api[key], (name, key)
    return api


def probe(values, service, application_only=False):
    args = COMPOSE + ['run', '--rm', '--no-deps', '-e', 'DATABASE_URL=']
    if application_only:
        for key, value in values.items():
            args += ['-e', key + '=' + value]
    args += [service]
    args += ['node', '--input-type=module', '-e', PROBE] if service == 'api' else ['config-check', '--json', '--non-interactive']
    run = subprocess.run(args, env=BASE if application_only else {**BASE, **values}, capture_output=True, text=True, timeout=30)
    # Safe classes only; raw Docker stderr/config and other environment are not saved.
    result = {'exit': run.returncode,
              'engineRejected': 'failed to initialize logging driver' in run.stderr,
              'safeFailure': 'application_start_failed' in run.stderr if service == 'api' else 'management_failed' in run.stderr,
              'diagnosticsOnStderr': bool(run.stderr)}
    if run.returncode == 0:
        payload = json.loads(run.stdout)
        if service == 'api':
            assert payload == render(values)
        else:
            assert payload == {'ok': True, 'command': 'config-check'}
    else:
        assert result['engineRejected'] or result['safeFailure'], result
        if service == 'management' and not result['engineRejected']:
            assert json.loads(run.stdout)['ok'] is False
    return result


results = {}
for name, values, expected in [('unset', {}, DEFAULTS), ('valid', VALID, VALID)]:
    rendered = render(values)
    assert rendered == expected, (name, rendered)
    entry = {'rendered': rendered, 'api': probe(values, 'api'), 'cli': probe(values, 'management')}
    assert entry['api']['exit'] == entry['cli']['exit'] == 0
    results[name] = entry
for kind in ['empty', 'invalid', 'malformed']:
    for key in KEYS:
        values = {key: '' if kind == 'empty' else 'not-an-integer' if kind == 'malformed' else INVALID[key]}
        rendered = render(values)
        assert rendered[key] == values[key], (kind, key, rendered)
        entry = {'rendered': rendered, 'api': probe(values, 'api'), 'cli': probe(values, 'management')}
        assert entry['api']['exit'] != 0 and entry['cli']['exit'] != 0, (kind, key, entry)
        results[kind + ':' + key] = entry
for key in KEYS[-2:]:
    # Engine log options remain valid here; prove application validation as well.
    entry = {'input': {key: ''}, 'api': probe({key: ''}, 'api', True),
             'cli': probe({key: ''}, 'management', True)}
    assert entry['api']['safeFailure'] and entry['cli']['safeFailure']
    assert not entry['api']['engineRejected'] and not entry['cli']['engineRejected']
    results['application-empty:' + key] = entry
start = subprocess.run(COMPOSE + ['run', '--rm', '--no-deps', '-e', 'DATABASE_URL=',
                        'management', 'start', '--json', '--non-interactive'],
                       env={**BASE, 'AUDIT_RETENTION_DAYS': ''}, capture_output=True,
                       text=True, timeout=30)
assert start.returncode != 0
assert json.loads(start.stdout) == {'ok': False, 'error': '审计留存配置无效。'}
assert 'management_failed' in start.stderr
results['start-empty'] = {'exit': start.returncode, 'rejectedBeforeCompose': True}
OUT.joinpath('t09-fix-config-regression.json').write_text(json.dumps(results, indent=2))
print(json.dumps({'cases': len(results), 'entryChecks': (len(results) - 1) * 2 + 1, 'passed': True}))
