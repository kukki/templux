import test from 'node:test';import assert from 'node:assert/strict';
import {mergeEntry} from '../tools/upgrade/merge.mjs';
const e=(text,mode=0o644)=>({bytes:Buffer.from(text),mode});
test('three-way preserves independent customization',()=>{const r=mergeEntry(e('one\ntwo\nthree\nfour\n'),e('mine\ntwo\nthree\nfour\n'),e('one\ntwo\nthree\ntarget\n'));assert.equal(r.status,'merged');assert.equal(r.entry.bytes.toString(),'mine\ntwo\nthree\ntarget\n');});
test('same-line conflict remains manual',()=>assert.equal(mergeEntry(e('base\n'),e('mine\n'),e('theirs\n')).status,'conflict'));
for(const [name,b,c,t,status,value]of [
 ['target deletion',e('a'),e('a'),null,'merged',null],['current deletion retained',e('a'),null,e('a'),'unchanged',null],['delete modify',e('a'),null,e('b'),'conflict',null],['add',null,null,e('new'),'merged','new'],['add add',null,e('mine'),e('other'),'conflict',null],['current customization',e('base'),e('mine'),e('base'),'unchanged','mine'],['binary collision',e('a\0'),e('b\0'),e('c\0'),'conflict',null],['mode target',e('a'),e('a'),e('a',0o755),'merged','a']
])test(name,()=>{const r=mergeEntry(b,c,t);assert.equal(r.status,status);if(status!=='conflict')assert.equal(r.entry?.bytes.toString()??null,value);});
test('binary target-only change still requires manual review, not an incomplete text patch',()=>assert.equal(mergeEntry(e('a\0'),e('a\0'),e('b\0')).status,'conflict'));
