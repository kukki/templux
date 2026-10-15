const services=new Set(['api','web','entry','management','migrate']);
const errorCodes=new Set(['ECONNREFUSED','ETIMEDOUT','EPIPE','EADDRINUSE','ERR_HTTP_HEADERS_SENT','ERR_INVALID_ARG_TYPE','MODULE_NOT_FOUND','FSTDEP023']);
export function runtimePolicy(){
 const integer=(key,fallback,min,max)=>{const raw=process.env[key]??String(fallback);if(!/^[1-9][0-9]*$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)<min||Number(raw)>max)throw new Error('运行日志容量配置无效。');return Number(raw);};
 return {maximumBytes:integer('RUNTIME_LOG_MAX_BYTES',10485760,16384,104857600),maximumFiles:integer('RUNTIME_LOG_MAX_FILES',10,1,30)};
}
export function runtimeRecord(service,level,event,fields={},destination=process.stderr){
 const value={time:new Date().toISOString(),service:services.has(service)?service:'api',level:['info','warn','error'].includes(level)?level:'info',event:typeof event==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(event)?event:'framework_runtime'};
 for(const key of ['removed','retentionDays','statusCode','httpStatus','providerCode'])if(Number.isSafeInteger(fields[key])&&fields[key]>=0&&fields[key]<=2147483647)value[key]=fields[key];
 if(['token','user_info'].includes(fields.stage))value.stage=fields.stage;
 if(errorCodes.has(fields.errorCode)||typeof fields.errorCode==='string'&&/^[0-9A-Z]{5}$/.test(fields.errorCode))value.errorCode=fields.errorCode;
 if(['success','denied','failed'].includes(fields.result))value.result=fields.result;
 if(['start','stop','init','test','typecheck','config-check','maintenance-halt','maintenance-resume','maintenance-rescue','logs'].includes(fields.command))value.command=fields.command;
 try{destination.write(JSON.stringify(value)+'\n');return true;}catch{return false;}
}
export function pinoDestination(service){return {write(line){try{const value=JSON.parse(line);runtimeRecord(service,value.level>=50?'error':value.level>=40?'warn':'info',value.event??'framework_runtime',value);}catch{runtimeRecord(service,'error','runtime_record_invalid');}}};}
export function installRuntimeConsole(service){
 runtimePolicy();for(const [name,level] of [['log','info'],['info','info'],['warn','warn'],['error','error']])console[name]=(...args)=>{const error=args.find(value=>value instanceof Error);runtimeRecord(service,level,'framework_runtime',{errorCode:error?.code});};
 process.on('warning',warning=>runtimeRecord(service,'warn','runtime_warning',{errorCode:warning.code}));process.stderr.on('error',()=>{});
}
