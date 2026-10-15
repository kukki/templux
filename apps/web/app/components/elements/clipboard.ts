import type {CopyWriter} from '../../../../../shared/copy.mjs';
/** Called directly by a user action; no permission preflight or legacy fallback. */
export const writeClipboard:CopyWriter=value=>{
 if(!globalThis.isSecureContext||!globalThis.navigator?.clipboard?.writeText)return Promise.reject(new DOMException('Clipboard unavailable','NotSupportedError'));
 return navigator.clipboard.writeText(value);
};
