export type CopyStatus='idle'|'pending'|'copied'|'denied'|'unsupported'|'failed';
export type CopySettings={feedbackMs:number;emptyMode:'hide'|'disable'};
export type CopyWriter=(value:string)=>Promise<void>;
export type CopySnapshot=Readonly<{status:CopyStatus;empty:boolean;hidden:boolean;ended:boolean}>;
export type CopyStore={getSnapshot:()=>CopySnapshot;subscribe:(listener:()=>void)=>()=>void;copy:()=>void;invalidate:()=>void;end:()=>void};
export function createCopyFeedback(options:{value:string|null|undefined;label:string;write:CopyWriter;emptyMode?:'hide'|'disable';feedbackMs?:number}):CopyStore;

export type CopyMessages=Readonly<{action:string;pending:string;succeeded:string;retry:string;empty:string;denied:string;unsupported:string;failed:string}>;
export function resolveCopyMessages(base:CopyMessages,overrides?:Partial<CopyMessages>):CopyMessages;
