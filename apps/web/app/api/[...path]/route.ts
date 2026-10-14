import type { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
async function forward(request: NextRequest) {
  const path = new URL(request.url);
  const target = new URL(path.pathname + path.search, process.env.API_INTERNAL_URL ?? 'http://api:8080');
  const headers = new Headers();
  for (const key of ['cookie','origin','content-type','x-templux-client-ip']) { const value = request.headers.get(key); if (value) headers.set(key,value); }
  try {
    const response = await fetch(target, { method: request.method, headers, redirect:'manual', cache:'no-store',
      signal:AbortSignal.timeout(20000), ...(request.method === 'POST' ? {body:await request.text()} : {}) });
    const output = new Headers();
    for (const key of ['content-type','location','cache-control','referrer-policy','retry-after']) { const value=response.headers.get(key); if(value) output.set(key,value); }
    for (const value of response.headers.getSetCookie()) output.append('set-cookie',value);
    return new Response(response.body,{status:response.status,headers:output});
  } catch { return Response.json({ok:false,error:'service_unavailable'},{status:503}); }
}
export const GET = forward;
export const POST = forward;
