export function canonicalIp(value: unknown): string;
export function trustedProxyPolicy(value?: string): (address: string) => boolean;
export function webClientIp(peer: string | undefined, forwarded: string | string[] | undefined, trusted: (address: string) => boolean): string;
export function passwordProxyHosts(value?: string): string[];
