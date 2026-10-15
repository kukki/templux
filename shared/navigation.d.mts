export type NavigationSettings={orientation:string;initialExpanded:boolean;allowCollapse:boolean;projectKey:string};
export type NavigationItem={href:string;label:'account'|'workspace'|'admin'|'audit'|'examples';icon:string};
export type NavigationPreference={key:string;getSnapshot:()=>boolean;getServerSnapshot:()=>boolean;subscribe:(fn:()=>void)=>()=>void;hydrate:()=>void;toggle:()=>boolean;receive:(key:string|null,raw:string|null)=>void;end:()=>void};
export function navigationKey(identity:{projectKey:string;projectName:string;accountId:string}):string;
export function createNavigationPreference(options:{settings:NavigationSettings;projectKey:string;projectName:string;accountId:string;storage?:Pick<Storage,'getItem'|'setItem'>}):NavigationPreference;
export function navigationItems(account:{state:string;permissions:string[]},examples:boolean):NavigationItem[];
