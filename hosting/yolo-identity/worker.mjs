import {identify,secured,IdentityUnavailable} from './client.mjs';
import {signBackendIdentity} from './backend.mjs';
import {originAuthorization,cleanRequestHeaders,cleanResponse,failure,withinDeadline}
  from './transport.mjs';
// Bound response acceptance even if application code or a database operation
// ignores cancellation. This cannot reverse a write already accepted by D1.
async function settleBy(deadline,task){
  let timer;
  try{return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new IdentityUnavailable()),Math.max(0,deadline-Date.now()));
  })]);}finally{clearTimeout(timer);}
}
function appHeaders(request,app){
  const headers=cleanRequestHeaders(request.headers);
  const cookie=(headers.get('cookie')||'').split(';').filter(v=>!v.trim().startsWith(`__Host-yolo-${app}-`)).join(';');
  if(cookie.trim())headers.set('cookie',cookie);else headers.delete('cookie');return headers;
}
export function createClientApp(application){return {async fetch(request,env){
  let authority;
  try{authority=await originAuthorization(request,env);if(!authority)return failure(403,'Forbidden');}catch{return failure(503,'Origin unavailable');}
  const url=new URL(request.url),supplied=request.headers.get('origin'),origin=env.PUBLIC_ORIGIN;
  if(['TRACE','CONNECT'].includes(request.method))return failure(405,'Method not allowed');
  if(supplied&&supplied!==origin||(!['GET','HEAD','OPTIONS'].includes(request.method)||request.headers.get('upgrade')?.toLowerCase()==='websocket')&&supplied!==origin)return failure(403,'Forbidden');
  let state;
  try{state=await settleBy(authority.deadline,()=>identify(request,env));}catch{return failure(503,'Identity unavailable');}
  if(state.response)return secured(state.response);
  const deadline=Math.min(authority.deadline,state.expires??Infinity);
  try{
    const clean=new Request(request,{headers:appHeaders(request,state.config.app)});
    if(env.BACKEND_ORIGIN&&(url.pathname==='/api'||url.pathname.startsWith('/api/'))){
      const backend=new URL(env.BACKEND_ORIGIN);
      if(backend.href!==`https://api-origin-${state.config.app}.yolo-dev.ai/`||!env.BACKEND_ACCESS_CLIENT_ID||!env.BACKEND_ACCESS_CLIENT_SECRET)throw new IdentityUnavailable();
      const target=new URL(backend.origin);target.pathname=url.pathname;target.search=url.search;
      const expiry=Math.min(deadline,Date.now()+30000),headers=new Headers(clean.headers);
      headers.set('x-yolo-app-identity',await signBackendIdentity(clean,state.config,env.APP_IDENTITY_SECRET,state.identity,expiry));
      headers.set('cf-access-client-id',env.BACKEND_ACCESS_CLIENT_ID);headers.set('cf-access-client-secret',env.BACKEND_ACCESS_CLIENT_SECRET);
      headers.set('x-forwarded-host',new URL(origin).host);headers.set('x-forwarded-proto','https');
      return secured(await withinDeadline(expiry,async signal=>cleanResponse(await fetch(new Request(target,new Request(clean,{headers,redirect:'manual',signal}))),backend.origin,origin)));
    }
    return secured(await withinDeadline(deadline,signal=>settleBy(deadline,()=>application(clean,env,state.identity,signal))));
  }catch{return failure(503,'Application unavailable');}
}};}
