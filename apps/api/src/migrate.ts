import {backupDatabase,BackupResultError,recordExternalBackupReference} from './backup.js';
import { databasePool, migrate, OperationError, schemaVersion, migrations } from './database.js';

let pool: ReturnType<typeof databasePool> | undefined;
try {
  pool = databasePool();
  const args = process.argv.slice(2);
  const options=new Map<string,string>(); const flags=new Set<string>();
  for(let i=0;i<args.length;i++){const a=args[i]!;if(['--json','--check','--confirm'].includes(a)){if(flags.has(a))throw new OperationError('迁移参数重复。');flags.add(a);}else if(a==='--external-backup-reference'){const v=args[++i];if(options.has(a)||!v||v.startsWith('--'))throw new OperationError('缺少外部备份参考。');options.set(a,v);}else throw new OperationError('迁移参数无效。');}
  const reference=options.get('--external-backup-reference');if((reference&&!flags.has('--confirm'))||(flags.has('--check')&&(reference||flags.has('--confirm'))))throw new OperationError('外部备份参考须显式 --confirm，不适用于 --check。');
  const result = args.includes('--check')
    ? { schemaVersion: await schemaVersion(pool, await migrations()), applied: 0 }
    : await migrate(pool,async()=>{const result=reference?await recordExternalBackupReference(reference):await backupDatabase(pool!,{kind:'automatic',connectionString:process.env.DATABASE_URL!});console.error(JSON.stringify({event:reference?'external_backup_reference_recorded':'migration_backup_complete',...result}));});
  console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
  if(error instanceof BackupResultError)console.error(JSON.stringify({event:'migration_backup_retention_failed',...error.result}));
  console.error(JSON.stringify({ event: 'migration_failed', message: error instanceof OperationError
    ? error.message : '数据库连接或迁移失败，部署已中止。' }));
  console.log(JSON.stringify({ok:false,error:error instanceof OperationError?error.message:'数据库连接或迁移失败，部署已中止。',...(error instanceof BackupResultError?error.result:{})}));
  process.exitCode = 1;
} finally {
  await pool?.end();
}
