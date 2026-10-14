export interface SelectOption {value:string;label:string}
export function validateOptions(options:readonly SelectOption[],values:readonly string[]):void;
export function matchingOptions(options:readonly SelectOption[],term:string):SelectOption[];
export function selectMatching(options:readonly SelectOption[],values:readonly string[],visible:readonly SelectOption[],checked:boolean):string[];
