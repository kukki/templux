import test from 'node:test';
import assert from 'node:assert/strict';
import {ownershipError} from '../apps/api/dist/backup.js';
const settings=(uid,gid)=>({directory:'/tmp/backups',project:'templux',retain:5,uid,gid});
const dir=(mode,uid,gid)=>({isDirectory:()=>true,mode,uid,gid});
test('macOS bind-mount 0:0 root is refused with the explicit override guidance',()=>{
 const message=ownershipError(dir(0o700,0,0),settings(501,20));
 assert.match(message,/备份目录须为指定宿主属主/);
 assert.match(message,/macOS/);
 assert.match(message,/TEMPLUX_HOST_UID=0 TEMPLUX_HOST_GID=0/);
});
test('an exact owner/mode match passes and other mismatches keep the generic refusal',()=>{
 assert.equal(ownershipError(dir(0o700,501,20),settings(501,20)),undefined);
 assert.equal(ownershipError(dir(0o700,0,0),settings(0,0)),undefined);
 assert.doesNotMatch(ownershipError(dir(0o755,501,20),settings(501,20)),/macOS/);
 assert.doesNotMatch(ownershipError(dir(0o700,1001,1001),settings(501,20)),/macOS/);
 assert.doesNotMatch(ownershipError({isDirectory:()=>false,mode:0o700,uid:0,gid:0},settings(501,20)),/macOS/);
});
