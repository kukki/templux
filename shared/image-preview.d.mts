export type PreviewImage=Readonly<{id:string;alt:string;sources:readonly string[]}>;
export type ImageGallery={enabled:boolean;images:readonly PreviewImage[]};
export type ImageGroup=Readonly<{images:readonly PreviewImage[];initialIndex:number;gallery:boolean}>;
export type ImageResource=Readonly<{status:'idle'|'loading'|'ready'|'failed';sourceIndex:number;token:number;src?:string;width:number;height:number}>;
export type PreviewSnapshot=ImageGroup&Readonly<{index:number;open:boolean;ended:boolean;zoomPan:boolean;maxScale:number;geometry:Readonly<{fitWidth:number;fitHeight:number;scale:number;x:number;y:number;maxX:number;maxY:number}>;resources:Readonly<Record<string,ImageResource>>}>;
export type PreviewStore={getSnapshot:()=>PreviewSnapshot;subscribe:(listener:()=>void)=>()=>void;start:(id?:string)=>void;loaded:(id:string,token:number,width:number,height:number)=>boolean;failed:(id:string,token:number)=>boolean;open:()=>boolean;close:()=>void;select:(index:number)=>boolean;resize:(width:number,height:number)=>void;zoom:(scale:number)=>void;pan:(dx:number,dy:number)=>void;invalidate:()=>void;end:()=>void};
export function prepareImageGroup(image:PreviewImage,gallery?:ImageGallery):ImageGroup;
export function createImagePreview(options:{image:PreviewImage;gallery?:ImageGallery;zoomPan?:boolean;maxScale?:number}):PreviewStore;
