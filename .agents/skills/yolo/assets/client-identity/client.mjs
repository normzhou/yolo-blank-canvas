import * as oauth from 'oauth4webapi';
export const ISSUER = 'https://login.yolo-dev.ai';
const server = {issuer:ISSUER,authorization_endpoint:ISSUER+'/api/auth/oauth2/authorize',
  token_endpoint:ISSUER+'/api/auth/oauth2/token',jwks_uri:ISSUER+'/api/auth/jwks',
  authorization_response_iss_parameter_supported:true,id_token_signing_alg_values_supported:['RS256']};
const prefix='/auth/yolo/';
const encoder=new TextEncoder();
export class InvalidLogin extends Error {}
export class IdentityUnavailable extends Error {}
const invalid=()=>{throw new InvalidLogin();};
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
const handle=()=>oauth.generateRandomState();
const validHandle=value=>/^[A-Za-z0-9_-]{43}$/.test(value || '');
export function configuration(env){
  const origin=new URL(env.PUBLIC_ORIGIN),app=origin.hostname.split('.')[0];
  if(env.CLIENT_IDENTITY_ENABLED!=='true'||origin.origin!==`https://${app}.yolo-dev.ai`||
    !/^[a-z](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(app)||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||
    !env.APP_DB||typeof env.APP_DB.prepare!=='function'||typeof env.APP_DB.batch!=='function')throw new IdentityUnavailable();
  return {origin:origin.origin,app,client:{client_id:'yolo-'+app,id_token_signed_response_alg:'RS256',[oauth.clockTolerance]:0},
    redirect:origin.origin+prefix+'callback',sessionCookie:`__Host-yolo-${app}-session`,loginCookie:`__Host-yolo-${app}-login`};
}
function cookie(request,name){
  const found=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.split('=')[0]===name);
  if(found.length>1)invalid();
  if(!found.length)return null;
  const value=found[0].slice(name.length+1);return validHandle(value)?value:null;
}
function setCookie(name,value,seconds){return `${name}=${value}; Max-Age=${seconds}; Path=/; Secure; HttpOnly; SameSite=Lax`;}
export function secured(response){
  const headers=new Headers(response.headers);headers.set('cache-control','private, no-store');headers.set('referrer-policy','no-referrer');headers.set('x-content-type-options','nosniff');
  for(const key of [...headers.keys()])if(/^access-control-|^x-yolo-|^cf-access-/i.test(key))headers.delete(key);
  return new Response(response.body,{status:response.status,headers,...(response.webSocket?{webSocket:response.webSocket}:{})});
}
function result(status,body,headers={}){return secured(new Response(body,{status,headers}));}
async function limitedFetch(url,options){
  if(![server.token_endpoint,server.jwks_uri].includes(String(url)))throw new IdentityUnavailable();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,redirect:'manual'});
    if(response.status>=500||response.status>=300&&response.status<400)throw new IdentityUnavailable();
    const reader=response.body?.getReader(),chunks=[];let length=0;
    if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536)throw new IdentityUnavailable();chunks.push(value);}}finally{reader.releaseLock();}
    const raw=new Uint8Array(length);let offset=0;for(const value of chunks){raw.set(value,offset);offset+=value.length;}
    return new Response(raw,{status:response.status,headers:response.headers});
  }catch(error){controller.abort();if(error instanceof IdentityUnavailable)throw error;throw new IdentityUnavailable();}
  finally{clearTimeout(timer);}
}
const network = {[oauth.customFetch]:limitedFetch};
async function session(request,env,config){
  const raw=cookie(request,config.sessionCookie);if(!raw)return {identity:null,expires:null};
  const key=await hash(raw);
  const row=await env.APP_DB.prepare('SELECT * FROM app_session WHERE handle_hash=? AND app=?').bind(key,config.app).first();
  if(!row)return {identity:null,expires:null};
  if(!Number.isSafeInteger(row.expires)||!Number.isSafeInteger(row.issued)||row.expires-row.issued!==3600000||
    row.issued>Date.now()||typeof row.subject!=='string'||!row.subject||typeof row.email!=='string'||!row.email)throw new IdentityUnavailable();
  if(row.expires<=Date.now()){
    await env.APP_DB.prepare('DELETE FROM app_session WHERE handle_hash=? AND app=?').bind(key,config.app).run();
    return {identity:null,expires:null};
  }
  return {identity:{issuer:ISSUER,subject:row.subject,email:row.email,emailVerified:true},expires:row.expires};
}
async function callback(request,env,config){
  const url=new URL(request.url),params=url.searchParams;
  if(url.search.length>4096||[...params.keys()].some(k=>!['code','state','iss','error','error_description'].includes(k)||params.getAll(k).length!==1))invalid();
  const browser=cookie(request,config.loginCookie),state=params.get('state');if(!browser||!validHandle(state))invalid();
  const row=await env.APP_DB.prepare('DELETE FROM app_login WHERE state_hash=? AND browser_hash=? AND app=? AND expires>? RETURNING *')
    .bind(await hash(state),await hash(browser),config.app,Date.now()).first();
  if(!row)invalid();
  const responseParams=oauth.validateAuthResponse(server,config.client,params,state);
  const response=await oauth.authorizationCodeGrantRequest(server,config.client,oauth.None(),responseParams,config.redirect,row.verifier,network);
  const tokens=await oauth.processAuthorizationCodeResponse(server,config.client,response,{expectedNonce:row.nonce,requireIdToken:true});
  // Claim processing alone uses authenticated TLS. Our accepted contract also
  // requires actual signature verification against the fixed issuer JWKS.
  await oauth.validateApplicationLevelSignature(server,response,network);
  const claims=oauth.getValidatedIdTokenClaims(tokens),now=Math.floor(Date.now()/1000);
  if(!claims||claims.iss!==ISSUER||claims.aud!==config.client.client_id||claims.email_verified!==true||
    typeof claims.sub!=='string'||!claims.sub||typeof claims.email!=='string'||claims.email.length>254||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||
    claims.iat>now||claims.exp<=claims.iat||claims.exp-claims.iat>180||claims.iat<now-180||claims.exp<=now)invalid();
  const token=handle(),issued=Date.now(),old=cookie(request,config.sessionCookie);
  const statements=[];
  if(old)statements.push(env.APP_DB.prepare('DELETE FROM app_session WHERE handle_hash=? AND app=?').bind(await hash(old),config.app));
  statements.push(env.APP_DB.prepare('INSERT INTO app_session(handle_hash,app,subject,email,issued,expires) VALUES(?,?,?,?,?,?)')
    .bind(await hash(token),config.app,claims.sub,claims.email,issued,issued+3600000));
  await env.APP_DB.batch(statements);
  const headers=new Headers({location:config.origin+'/'});headers.append('set-cookie',setCookie(config.sessionCookie,token,3600));headers.append('set-cookie',setCookie(config.loginCookie,'',0));
  return result(303,null,headers);
}
export async function identify(request,env){
  const config=configuration(env),path=new URL(request.url).pathname;
  try{
    if(path===prefix+'callback'){
      if(request.method!=='GET')return {response:result(405,'Method not allowed')};
      try{return {response:await callback(request,env,config)};}
      catch(error){
        const status=error instanceof InvalidLogin||[oauth.OperationProcessingError,oauth.ResponseBodyError,oauth.AuthorizationResponseError,oauth.UnsupportedOperationError].some(kind=>error instanceof kind)?400:503;
        return {response:result(status,'Login could not be completed',{'set-cookie':setCookie(config.loginCookie,'',0)})};
      }
    }
    const current=await session(request,env,config);
    if(path===prefix+'login'){
      if(request.method!=='POST'||request.headers.get('origin')!==config.origin)return {response:result(403,'Forbidden')};
      const state=handle(),browser=handle(),nonce=oauth.generateRandomNonce(),verifier=oauth.generateRandomCodeVerifier();
      await env.APP_DB.prepare('INSERT INTO app_login(state_hash,browser_hash,app,verifier,nonce,expires) VALUES(?,?,?,?,?,?)')
        .bind(await hash(state),await hash(browser),config.app,verifier,nonce,Date.now()+300000).run();
      const target=new URL(server.authorization_endpoint);target.search=new URLSearchParams({response_type:'code',client_id:config.client.client_id,redirect_uri:config.redirect,
        scope:'openid email',state,nonce,code_challenge:await oauth.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}).toString();
      return {response:result(303,null,{location:target.href,'set-cookie':setCookie(config.loginCookie,browser,300)})};
    }
    if(path===prefix+'logout'){
      if(request.method!=='POST'||request.headers.get('origin')!==config.origin)return {response:result(403,'Forbidden')};
      const old=cookie(request,config.sessionCookie);if(old)await env.APP_DB.prepare('DELETE FROM app_session WHERE handle_hash=? AND app=?').bind(await hash(old),config.app).run();
      return {response:result(204,null,{'set-cookie':setCookie(config.sessionCookie,'',0)})};
    }
    if(path===prefix+'session'){
      if(request.method!=='GET')return {response:result(405,'Method not allowed')};
      return {response:secured(Response.json(current))};
    }
    if(path.startsWith(prefix))return {response:result(404,'Not found')};
    return {...current,config};
  }catch(error){return {response:result(error instanceof InvalidLogin?400:503,'Identity unavailable')};}
}
