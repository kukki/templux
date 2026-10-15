export type NoticeLevel='info'|'success'|'warning'|'error';
export type NoticeInput={title:string;message:string;level?:NoticeLevel;key?:string;durationMs?:number};
export type Notice=Readonly<Required<Omit<NoticeInput,'key'>>&{key?:string;id:string;remainingMs:number;count:number;pauses:readonly ('hover'|'focus')[]}>;
export type NoticeSnapshot=Readonly<{visible:readonly Notice[];waiting:readonly Notice[];suspended:readonly Notice[];omitted:number;ended:boolean}>;
export type NotificationStore={getSnapshot:()=>NoticeSnapshot;subscribe:(listener:()=>void)=>()=>void;push:(input:NoticeInput)=>string|null;tick:()=>void;pause:(id:string,reason:'hover'|'focus',paused:boolean)=>boolean;close:(id:string)=>boolean;setLimit:(limit:number)=>void;clear:()=>void;end:()=>void};
export function createNotifications(options?:{durationMs?:number;visible?:number;queueCapacity?:number;now?:()=>number}):NotificationStore;
