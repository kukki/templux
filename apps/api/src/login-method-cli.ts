import {createInterface} from 'node:readline/promises';import {stdin,stderr} from 'node:process';
import {databasePool,OperationError} from './database.js';import {credentialFile} from './password-accounts.js';
import {createLoginRequest,listLoginRequests,completeLoginRequest,resetPersonPassword,managementId} from './login-methods.js';
export async function loginMethodCommand(command:'request-login-link'|'login-links'|'complete-login-link'|'reset-person',options:Map<string,string>,flags:Set<string>,interactive:boolean){
 const required=command==='request-login-link'?['--account','--method']:command==='complete-login-link'?['--request']:command==='reset-person'?['--account','--credential-file']:['--account'];
 const prompt=interactive?createInterface({input:stdin,output:stderr}):undefined;const pool=databasePool();const actor=`host-uid:${process.env.TEMPLUX_HOST_UID??process.getuid?.()??'unknown'}`;
 try{
 if(prompt)for(const key of required)if(!options.has(key)){const value=(await prompt.question(`${key}：`)).trim();if(value)options.set(key,value);}
 if(required.some(key=>!options.get(key)))throw new OperationError(`${command}缺少必填参数：${required.join('、')}。`);
 if(command==='login-links')return {ok:true,requests:await listLoginRequests(pool,actor,options.get('--account'))};
 if(command==='request-login-link'&&options.get('--method')==='password'&&!options.get('--username')){if(prompt){const value=(await prompt.question('--username：')).trim();if(value)options.set('--username',value);}if(!options.get('--username'))throw new OperationError('启用密码须指定--username。');}
 if(command==='complete-login-link'&&!options.get('--credential-file')){
 const link=(await pool.query<{method:string}>('SELECT method FROM templux.login_method_requests WHERE id=$1',[managementId(options.get('--request')!)])).rows[0];
 if(link?.method==='password'){if(prompt){const value=(await prompt.question('--credential-file：')).trim();if(value)options.set('--credential-file',value);}if(!options.get('--credential-file'))throw new OperationError('完成密码启用须指定新的--credential-file。');}
 }
 if(!flags.has('--confirm')){if(!prompt)throw new OperationError('须显式--confirm。');stderr.write(`操作：${command}\n目标账号：${options.get('--account')??'请求指定'}\n请求：${options.get('--request')??'新建'}\n方式：${options.get('--method')??'请求指定'}\n凭据文件：${options.get('--credential-file')??'未指定'}\n关联或重置将使目标所有旧方式会话失效，凭据只写受限文件。\n`);if((await prompt.question('输入yes确认：')).trim()!=='yes')throw new OperationError('已取消。');}
 const file=options.get('--credential-file');const delivery=file?(value:{username:string;password:string})=>({...credentialFile(file,value),file}):undefined;
 if(command==='reset-person')return await resetPersonPassword(pool,options.get('--account')!,undefined,actor,delivery);
 if(command==='complete-login-link')return await completeLoginRequest(pool,options.get('--request')!,actor,delivery);
 const account=(await pool.query<{auth_version:string}>('SELECT auth_version FROM templux.accounts WHERE id=$1',[options.get('--account')])).rows[0];if(!account)throw new OperationError('目标不存在。');
 return await createLoginRequest(pool,{accountId:options.get('--account')!,expectedVersion:account.auth_version,method:options.get('--method') as 'feishu'|'password',username:options.get('--username')},actor);
 }finally{prompt?.close();await pool.end();}
}
