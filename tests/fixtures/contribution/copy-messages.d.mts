export type CopyMessages=Readonly<{action:string;pending:string;succeeded:string;retry:string;empty:string;denied:string;unsupported:string;failed:string}>;
export function resolveCopyMessages(base:CopyMessages,overrides?:Partial<CopyMessages>):CopyMessages;
