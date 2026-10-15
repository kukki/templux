import test from 'node:test';import assert from 'node:assert/strict';
import {version,compare,findPath,available} from '../tools/updates/versions.mjs';
const records=[{version:'0.1.0',from:[]},{version:'0.2.0-t26.1',from:['0.1.0']},{version:'0.3.0-t27.1',from:['0.2.0-t26.1']},{version:'1.0.0',from:['0.1.0']}];
for(const bad of ['latest','^0.1.0','0.1','01.2.3','0.2.0-01','1.2.3+unlocked'])test('reject version '+bad,()=>assert.throws(()=>version(bad)));
test('semver order distinguishes exact prereleases',()=>{assert.equal(compare('0.2.0-t26.1','0.3.0-t27.1'),-1);assert.equal(compare('0.3.0-t27.1','0.3.0'),-1);});
test('cumulative path includes necessary intermediate, no implicit endpoint jump',()=>assert.deepEqual(findPath(records,'0.1.0','0.3.0-t27.1',true),['0.2.0-t26.1','0.3.0-t27.1']));
test('default prerelease/cross-major/missing edge unsupported, discovery never selects latest',()=>{assert.equal(findPath(records,'0.1.0','0.3.0-t27.1',false),null);assert.equal(findPath(records,'0.1.0','1.0.0',true),null);assert.deepEqual(available(records,'0.1.0',false),[]);assert.equal(available(records,'0.1.0',true).length,2);assert.equal(findPath(records.slice(0,1),'0.1.0','0.3.0-t27.1',true),null);});
