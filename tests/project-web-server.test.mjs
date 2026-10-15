import test from 'node:test';import assert from 'node:assert/strict';
import {startProjectWeb} from '../apps/web/project-server.mjs';
import {spawnSync} from 'node:child_process';
test('project Web server refuses a missing project directory instead of serving package internals',async()=>{await assert.rejects(startProjectWeb('/nonexistent-templux-project-directory'),/项目|directory/i);});
test('missing Web build leaves a structured diagnostic and nonzero startup',()=>{const r=spawnSync(process.execPath,['--input-type=module','-e',"import {startProjectWeb} from './apps/web/project-server.mjs';try{await startProjectWeb('/nonexistent-templux-project-directory')}catch{process.exitCode=1}"],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/web_start_failed/);});
