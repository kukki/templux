export type SearchField<Row>={key:string;label:string;read:(row:Row)=>string|number|null|undefined};
export function normalizeSearch(value:string):string;
export function validateSearchFields<Row>(fields:readonly SearchField<Row>[]):void;
export function containsFields<Row>(row:Row,term:string,fields:readonly SearchField<Row>[]):boolean;
