import { libraryAssets } from '../library-assets.mjs';
import { text, type Principal } from './contract.js';
export const MANAGED_API = 'yolo-managed-feedback-v1';
export const managedRoute = (path: string, method: string) =>
  (method === 'GET' && /^\/yolo\/api\/v1\/(?:session|requests(?:\/[0-9a-f-]{36})?|tracking\/(?:requests\/[0-9a-f-]{36}|work(?:\/page\/[0-9a-f-]{36})?)|worker\/(?:session|requests(?:\/[0-9a-f-]{36}(?:\/responses\/[0-9a-f-]{36})?)?|tracking\/(?:requests\/[0-9a-f-]{36}|receipts\/[0-9a-f-]{36}|work(?:\/(?:[0-9a-f-]{36}|page\/[0-9a-f-]{36}))?)))$/.test(path)) ||
  (method === 'POST' && /^\/yolo\/api\/v1\/(?:requests(?:\/[0-9a-f-]{36}\/replies)?|worker\/(?:requests\/[0-9a-f-]{36}\/responses|tracking\/(?:work|requests)))$/.test(path));
export const managedJSON = (error: string, status: number, code?: string) => Response.json({error,...(code?{code}:{})}, {status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function httpsOrigin(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && u.origin === value && !u.username && !u.password; } catch { return false; }
}
export async function boundedText(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  const reader = stream?.getReader(); if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {value,done} = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('Body too large'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const v of chunks) {bytes.set(v,offset);offset+=v.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export interface ManagedClientEnvironment { MANAGED_FEEDBACK_TOKEN: string; PUBLIC_ORIGIN: string }
/** This adapter runs only inside the client's verified identity/transport wrapper. */
export function createManagedWorkBridge(config: {appId: string; serviceOrigin: string; authorize: (p: Principal) => boolean | Promise<boolean>; authorizeWork?: (p: Principal) => boolean | Promise<boolean>}) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(config.appId) || !httpsOrigin(config.serviceOrigin) || typeof config.authorize !== 'function' || config.authorizeWork!==undefined&&typeof config.authorizeWork!=='function') throw new Error('Invalid managed feedback configuration');
  return {async fetch(request: Request, env: ManagedClientEnvironment, context: {principal?: Principal | null; signal?: AbortSignal} = {}): Promise<Response | null> {
    const url = new URL(request.url), asset = libraryAssets[url.pathname];
    if (asset && request.method === 'GET') return new Response(asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    if (!url.pathname.startsWith('/yolo/api/v1')) return null;
    if (!managedRoute(url.pathname,request.method) || url.search) return managedJSON('Unsupported feedback operation',404);
    if (!httpsOrigin(env.PUBLIC_ORIGIN) || url.origin !== env.PUBLIC_ORIGIN) return managedJSON('Invalid feedback origin',403);
    const origin = request.headers.get('Origin'), worker = url.pathname.startsWith('/yolo/api/v1/worker/');
    if ((origin && origin !== env.PUBLIC_ORIGIN) || (!worker && request.method === 'POST' && !origin)) return managedJSON('Invalid feedback origin',403);
    let principal: Principal | null = null, workRead=false;
    if (!worker) {
      const p = context.principal;
      if (!p) return managedJSON('Sign in to share feedback.',403,'login_required');
      if (!text(p.issuer,2048) || !text(p.subject,512) || p.emailVerified !== true) return managedJSON('Feedback is unavailable for this account.',403,'feedback_forbidden');
      try {if (await config.authorize(p) !== true)return managedJSON('Feedback is unavailable for this account.',403,'feedback_forbidden');}
      catch {return managedJSON('Feedback authorization is unavailable',503);}
      principal = {issuer:p.issuer,subject:p.subject,emailVerified:true};
      try {workRead=!!config.authorizeWork&&await config.authorizeWork(principal)===true;}
      catch {return managedJSON('Work authorization is unavailable',503);}
    }
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(env.MANAGED_FEEDBACK_TOKEN ?? '')) return managedJSON('Managed feedback is not configured',503);
    if (request.method === 'POST' && !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? '')) return managedJSON('JSON required',415);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),30000);
    const signal = context.signal ?? request.signal, abort = () => controller.abort(); signal.addEventListener('abort',abort,{once:true});
    try {
      if (signal.aborted) controller.abort();
      const body = request.method === 'POST' ? await boundedText(request.body,65536) : null;
      const response = await fetch(config.serviceOrigin+'/v1/apps/'+config.appId+'/feedback', {method:'POST',redirect:'manual',signal:controller.signal,headers:{Authorization:'Bearer '+env.MANAGED_FEEDBACK_TOKEN,'Content-Type':'application/json','X-Yolo-Managed-API':MANAGED_API,...(workRead?{'X-Yolo-Shared-Work':'true'}:{})},body:JSON.stringify({method:request.method,path:url.pathname,principal,body,headers:{owner:request.headers.get('X-Feedback-Owner'),visibility:request.headers.get('X-Feedback-Visibility'),authorization:worker?request.headers.get('Authorization'):null}})});
      if (!worker && response.status === 401) return managedJSON('The app feedback connection needs maintainer attention. Keep your draft.',503);
      if (response.status < 200 || response.status >= 600 || response.status >= 300 && response.status < 400) return managedJSON('Managed feedback is unavailable',503);
      if (!response.headers.get('Content-Type')?.startsWith('application/json')) return managedJSON('Managed feedback is unavailable',503);
      const result = await boundedText(response.body,1024*1024);
      return new Response(result,{status:response.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    } catch { return managedJSON('Feedback is temporarily unavailable. Keep your draft and check its status before sending again.',503); }
    finally {clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }};
}
