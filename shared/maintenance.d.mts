import type {Presentation} from './presentation.mjs';
export type MaintenanceState={version:string;gateVersion:string;accessReady?:boolean;phase:'online'|'offline';active:boolean;plannedAt:string|null;message:string;serverNow:string};
export function validateMaintenanceStart(input:{at:unknown;message:unknown}):{at:string;message:string};
export function maintenanceCountdown(at:string,now:number):number;
export function maintenancePage(config:Presentation,state:Pick<MaintenanceState,'phase'|'active'|'plannedAt'|'message'>|null):string;
