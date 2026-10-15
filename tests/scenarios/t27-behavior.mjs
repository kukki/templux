// Project-owned cumulative acceptance consumer; no source writes or credentials.
import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {sharedReleaseLabel} from '@templux/core';
const v=JSON.parse(readFileSync('templux.lock.json')).version;
assert.equal(sharedReleaseLabel(),v==='0.2.0-t26.1'?'t26-isolated-target':'t27-final-target');
assert.ok(existsSync('tools/shared-version-check.mjs'));
if(v==='0.3.0-t27.1'){const {sharedReleaseCapabilities}=await import('@templux/core');assert.ok(sharedReleaseCapabilities().includes('cumulative-proposals'));assert.ok(existsSync('tools/final-release-check.mjs'));assert.ok(existsSync('check-updates'));}
assert.equal(JSON.parse(readFileSync('config/presentation.json')).project.name,'Quay Lab');assert.match(readFileSync('apps/api/src/server.ts','utf8'),/Quay-owned business extension/);assert.ok(JSON.parse(readFileSync('config/roles.json')).roles.reviewer);
