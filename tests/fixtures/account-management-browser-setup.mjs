// Explicit CLI provisioning in the isolated tools database; no production HTTP test entry.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const database=process.env.TEST_AUTH_DATABASE_URL;
assert.ok(database?.endsWith('/templux_auth_test'));
function command(...args){
 const result=spawnSync(process.execPath,['apps/api/dist/manage.js',...args,'--non-interactive','--json'],{env:{...process.env,DATABASE_URL:database},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
const admin=command('create-person','--username','t06-browser-admin','--name','网页验收管理员','--credential-file','admin.json','--confirm');
const backup=command('create-person','--username','t06-browser-backup','--name','网页验收备用管理员','--credential-file','backup.json','--confirm');
const user=command('create-person','--username','t06-browser-user','--name','网页验收普通人员','--credential-file','user.json','--confirm');
const agent=command('create-agent','--username','t06-browser-agent','--name','网页验收独立Agent','--owner',user.accountId,'--credential-file','agent.json','--confirm');
for(const [account,roles] of [[admin,'admin'],[backup,'admin'],[user,'user']]) command('authorize','--account',account.accountId,'--roles',roles,'--confirm');
const ids={admin:admin.accountId,backup:backup.accountId,user:user.accountId,agent:agent.accountId};
writeFileSync(`${process.env.TEMPLUX_CREDENTIAL_DIR}/ids.json`,JSON.stringify(ids),{mode:0o600});
console.log(JSON.stringify({ok:true,ids,credentialFiles:['admin.json','backup.json','user.json','agent.json']}));
