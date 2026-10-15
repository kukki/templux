export type Values = Record<string,string>;
export type SaveResult<T extends Values> = {kind:'saved';values:T}|{kind:'fields';errors:Partial<Record<keyof T,string>>}|{kind:'error'|'forbidden';message:string}|{kind:'ended'};
export type EditorOptions<T extends Values> = {initial:T;normalize:(values:Readonly<T>)=>T;validate:(values:Readonly<T>)=>Partial<Record<keyof T,string>>;failureMessage:string};
export type EditorSnapshot<T extends Values> = {values:Readonly<T>;errors:Readonly<Partial<Record<keyof T,string>>>;formError:string;dirty:boolean;saving:boolean;status:'idle'|'saving'|'saved'|'error'};
export type Editor<T extends Values> = {getSnapshot:()=>EditorSnapshot<T>;subscribe:(listener:()=>void)=>()=>void;change:(key:keyof T,value:string)=>void;blur:(key:keyof T)=>void;cancel:()=>void;reset:(values?:T)=>void;submit:(save:(values:Readonly<T>,signal:AbortSignal)=>Promise<SaveResult<T>>)=>Promise<void>};
export function createEditor<T extends Values>(options:EditorOptions<T>):Editor<T>;
