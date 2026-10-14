export function runtimePolicy():{maximumBytes:number;maximumFiles:number};
export function runtimeRecord(service:string,level:string,event:string,fields?:Record<string,unknown>,destination?:{write(value:string):unknown}):boolean;
export function pinoDestination(service:string):{write(line:string):void};
export function installRuntimeConsole(service:string):void;
