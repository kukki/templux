// Consumer-supplied semantic behavior check; no DB/env/network needed.
import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {sharedReleaseLabel} from '@templux/core';
assert.equal(sharedReleaseLabel(),'t26-isolated-target');
const brand=JSON.parse(readFileSync('config/presentation.json'));assert.equal(brand.project.name,'Quay Lab');
assert.match(readFileSync('apps/api/src/server.ts','utf8'),/Quay-owned business extension/);
assert.ok(JSON.parse(readFileSync('config/roles.json')).roles.reviewer);
