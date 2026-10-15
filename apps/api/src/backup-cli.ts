import {createInterface} from 'node:readline/promises';
import {stdin,stderr} from 'node:process';
import {backupDatabase,backupSettings} from './backup.js';
import {databasePool,OperationError} from './database.js';
export async function backupCommand(options:Map<string,string>,flags:Set<string>,interactive:boolean){
 if(options.size||flags.has('--overwrite'))throw new OperationError('backup 参数无效；使用配置的专用目录，不支持覆盖。');
 const settings=backupSettings();if(!flags.has('--confirm')){if(!interactive)throw new OperationError('backup 需要显式 --confirm。');const p=createInterface({input:stdin,output:stderr});try{stderr.write(`仅备份当前配置数据库；项目 ${settings.project}；容器目标 ${settings.directory}；不含配置/密钥/文件。\n`);if((await p.question('输入 yes 确认：')).trim()!=='yes')throw new OperationError('已取消备份。');}finally{p.close();}}
 const pool=databasePool();try{return{ok:true,command:'backup',...await backupDatabase(pool,{kind:'manual',connectionString:process.env.DATABASE_URL!})};}finally{await pool.end();}
}
