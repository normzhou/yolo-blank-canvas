// Client-owned identity transport; separate from the operator origin key.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const encode=value=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function decode(value){if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error();return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function key(secret){if(!/^[a-f0-9]{64}$/.test(secret||''))throw Error('Identity transport unavailable');return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signBackendIdentity(request,config,secret,identity,deadline){
  const url=new URL(request.url),now=Math.floor(Date.now()/1000),exp=Math.min(now+30,Math.floor(deadline/1000));
  if(exp<=now)throw Error('Authorization ended');
  const body=encode(encoder.encode(JSON.stringify({v:1,app:config.app,origin:config.origin,method:request.method,path:url.pathname+url.search,iat:now,exp,identity})));
  return body+'.'+encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body))));
}
export async function verifyBackendIdentity(request,config,secret,now=Math.floor(Date.now()/1000)){
  const raw=request.headers.get('x-yolo-app-identity');if(!raw||raw.length>4096)throw Error('Identity unavailable');
  const parts=raw.split('.');if(parts.length!==2||!await crypto.subtle.verify('HMAC',await key(secret),decode(parts[1]),encoder.encode(parts[0])))throw Error('Identity unavailable');
  const data=JSON.parse(decoder.decode(decode(parts[0]))),url=new URL(request.url);
  if(data.v!==1||data.app!==config.app||data.origin!==config.origin||data.method!==request.method||data.path!==url.pathname+url.search||
    !Number.isInteger(data.iat)||!Number.isInteger(data.exp)||data.iat>now||data.exp<=now||data.exp<=data.iat||data.exp-data.iat>30)throw Error('Identity unavailable');
  const p=data.identity;
  if(p!==null&&(!p||Object.keys(p).sort().join(',')!=='email,emailVerified,issuer,subject'||p.issuer!=='https://login.yolo-dev.ai'||
    p.emailVerified!==true||typeof p.subject!=='string'||!p.subject||typeof p.email!=='string'||!p.email))throw Error('Identity unavailable');
  return {identity:p,expires:data.exp*1000};
}
