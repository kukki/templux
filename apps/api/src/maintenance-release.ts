import {constants,openSync,closeSync,readFileSync,fstatSync,fchmodSync,writeFileSync,fsyncSync,renameSync,unlinkSync,mkdirSync,lstatSync} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';import {randomUUID} from 'node:crypto';
import type {MaintenanceState} from '../../../shared/maintenance.mjs';import {OperationError} from './database.js';
export function maintenanceReleasePath(){const value=process.env.TEMPLUX_MAINTENANCE_RELEASE_FILE??'/opt/templux/maintenance/release.json';if(!isAbsolute(value)||value.length>4096||value.includes('\0'))throw new OperationError('维护入口释放文件须为有效绝对路径。');return value;}
const path=maintenanceReleasePath;
export function restoreBlockPath(){return `${path()}.restore-block`;}
export function assertNoRestoreBlock(){try{lstatSync(restoreBlockPath());}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw new OperationError('恢复阻断状态无法确认；入口保持关闭。');}throw new OperationError('恢复阻断仍存在；先按恢复报告核验，不允许普通resume绕过。');}
export function maintenanceReleased(state:MaintenanceState){
 if(state.phase!=='online')return false;try{assertNoRestoreBlock();}catch{return false;}let fd:number|undefined;
 try{const file=path();if(!isAbsolute(file))return false;fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW);const st=fstatSync(fd);if(!st.isFile()||st.size>256)return false;const value=JSON.parse(readFileSync(fd,'utf8'));return value.schemaVersion===1&&Object.keys(value).length===2&&typeof value.gateVersion==='string'&&value.gateVersion===state.gateVersion;}
 catch(error){return (error as NodeJS.ErrnoException).code==='ENOENT'&&state.gateVersion==='0';}finally{if(fd!==undefined)closeSync(fd);}
}
export function publishMaintenanceRelease(state:MaintenanceState){
 assertNoRestoreBlock();const file=path();if(!isAbsolute(file)||state.phase!=='online'||!/^\d{1,19}$/.test(state.gateVersion))throw new OperationError('维护入口释放配置无效。');let temporary:string|undefined,fd:number|undefined,created=false;
 try{mkdirSync(dirname(file),{recursive:true,mode:0o755});temporary=`${file}.${randomUUID()}.tmp`;fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o644);created=true;fchmodSync(fd,0o644);writeFileSync(fd,JSON.stringify({schemaVersion:1,gateVersion:state.gateVersion})+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temporary,file);temporary=undefined;fd=openSync(dirname(file),constants.O_RDONLY);fsyncSync(fd);closeSync(fd);fd=undefined;}
 catch{throw new OperationError('数据库维护状态已提交，但入口释放未确认。请核对状态和共享卷，不要假定已恢复或自动重试。');}finally{if(fd!==undefined)closeSync(fd);if(temporary&&created)try{unlinkSync(temporary);}catch{/* Preserve failure. */}}
}
