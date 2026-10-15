export type Values = Record<string,string>;
export type SaveResult<T extends Values> = {kind:'saved';values:T}|{kind:'fields';errors:Partial<Record<keyof T,string>>}|{kind:'error'|'forbidden';message:string}|{kind:'ended'}|{kind:'unconfirmed';message?:string};
export type Verification<T extends Values> = {kind:'saved';values:T}|{kind:'not-applied'}|{kind:'unknown'};
export type SaveAttempt={attemptId:string};
export type Save<T extends Values>=(values:Readonly<T>,signal:AbortSignal,attempt:SaveAttempt)=>Promise<SaveResult<T>>;
export type EditorOptions<T extends Values> = {initial:T;normalize:(values:Readonly<T>)=>T;validate:(values:Readonly<T>)=>Partial<Record<keyof T,string>>;failureMessage:string;timeoutMs?:number;timeoutMessage?:string;lockWhileSaving?:boolean};
export type EditorSnapshot<T extends Values> = {values:Readonly<T>;errors:Readonly<Partial<Record<keyof T,string>>>;formError:string;dirty:boolean;saving:boolean;blocked:boolean;uncertain:Readonly<{attemptId:string;values:Readonly<T>}>|null;status:'idle'|'saving'|'saved'|'error'|'unconfirmed'};
export type Editor<T extends Values> = {getSnapshot:()=>EditorSnapshot<T>;subscribe:(listener:()=>void)=>()=>void;change:(key:keyof T,value:string)=>boolean;blur:(key:keyof T)=>void;cancel:()=>void;reset:(values?:T)=>boolean;reconcile:(attemptId:string,result:Verification<T>)=>boolean;submit:(save:Save<T>)=>Promise<SaveResult<T>|{kind:'unconfirmed';attemptId:string}|undefined>};
export function createEditor<T extends Values>(options:EditorOptions<T>):Editor<T>;
