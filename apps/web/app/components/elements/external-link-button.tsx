import type {ReactNode} from 'react';
import './elements.css';
export default function ExternalLinkButton({href,label,children}:{href:string;label:string;children:ReactNode}){
 if(typeof href!=='string'||!/^https?:\/\/\S+$/.test(href)||typeof label!=='string'||!label.trim()||label.length>200)throw new Error('外部链接按钮需要绝对地址与可识别名称。');
 return <a className="action secondary-action external-link-button" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><svg className="external-link-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg><span className="external-link-text">{children}</span></a>;
}
