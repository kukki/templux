import test from 'node:test';import assert from 'node:assert/strict';import {checked} from '../tools/upgrade/checks.mjs';
test('checks distinguish unavailable, failure and timeout and discard raw output',async()=>{
 assert.equal((await checked('not-an-installed-command',[],{cwd:'/tmp',timeout:100})).status,'unavailable');
 const fail=await checked('node',['-e','console.log("PRIVATE_SENTINEL");process.exit(7)'],{cwd:'/tmp',timeout:1000});assert.equal(fail.status,'failed');assert.equal(fail.exitCode,7);assert.doesNotMatch(JSON.stringify(fail),/PRIVATE/);
 assert.equal((await checked('node',['-e','setInterval(()=>{},100)'],{cwd:'/tmp',timeout:100})).status,'timeout');
});
import {spawnSync} from 'node:child_process';
for(const args of [[],['--current'],['--current','--target-release','x'],['--current','x','--current','y'],['--output','x','--unknown']])test('CLI invalid inputs fail one JSON stdout without values: '+JSON.stringify(args),()=>{const p=spawnSync('node',['tools/upgrade/cli.mjs',...args],{encoding:'utf8'});assert.equal(p.status,1);assert.equal(JSON.parse(p.stdout).directlyApplicable,false);assert.equal(p.stdout.trim().split('\n').length,1);assert.match(p.stderr,/upgrade_proposal_failed/);});
test('checks do not force a development NODE_ENV onto production Next builds',async()=>assert.equal((await checked('node',['-e','process.exit(process.env.NODE_ENV===undefined?0:21)'],{cwd:'/tmp',timeout:1000})).status,'passed'));
