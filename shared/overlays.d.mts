import type {CloseBoundary} from './editor.mjs';
export type OverlayViewport={x:number;y:number;width:number;height:number};
export type OverlayRect=OverlayViewport;
export type PanelSettings={width:number;height:number;draggable:boolean;resizable:boolean};
export type PanelSnapshot=Readonly<{currentId:string|null;epoch:number;ended:boolean;narrow:boolean;blocked:boolean;rect:Readonly<OverlayRect>;viewport:Readonly<OverlayViewport>;settings:Readonly<PanelSettings>}>;
export type PanelController={getSnapshot:()=>PanelSnapshot;subscribe:(fn:()=>void)=>()=>void;open:(id:string,apply?:()=>void)=>boolean;close:(apply?:()=>void)=>boolean;registerClose:(source:CloseBoundary,epoch:number)=>()=>void;setViewport:(v:OverlayViewport)=>void;move:(dx:number,dy:number,epoch:number)=>boolean;resize:(dw:number,dh:number,epoch:number)=>boolean;reset:(epoch:number)=>boolean;invalidate:()=>void;end:()=>void};
export function placePopover(anchor:OverlayRect,size:{width:number;height:number},viewport:OverlayViewport):null|(OverlayRect&{side:'top'|'bottom'});
export function constrainPanel(rect:OverlayRect,viewport:OverlayViewport):OverlayRect;
export function createPanelController(options:{settings:PanelSettings;viewport?:OverlayViewport}):PanelController;
