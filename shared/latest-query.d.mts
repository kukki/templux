export type ListResult<Row>={status:'success';rows:readonly Row[]}|{status:'error'}|{status:'forbidden'};
export type ListState<Row>=ListResult<Row>|{status:'loading'}|{status:'waiting'};
export type SearchRequest={term:string;signal:AbortSignal};
export function createLatestQuery<Row>(publish:(state:ListState<Row>)=>void):{run:(load:(request:SearchRequest)=>Promise<ListResult<Row>>,term:string)=>void;invalidate:()=>void;close:()=>void};
