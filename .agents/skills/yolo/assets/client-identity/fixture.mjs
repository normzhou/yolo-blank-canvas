// Test-only synthetic issuer; never imported by example.mjs or production config.
let current={};
const enc=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.origin==='https://fixture.invalid'){
  current=await request.json();return Response.json({fixture:true});
 }
 if(url.origin!=='https://login.yolo-dev.ai')return new Response('Unexpected fixture destination',{status:500});
 if(url.pathname==='/api/auth/jwks')return Response.json({keys:[JSON.parse(env.FIXTURE_PUBLIC_KEY)]});
 if(url.pathname==='/api/auth/oauth2/token'){
  const params=new URLSearchParams(await request.text());
  if(params.get('client_id')!=='yolo-demo'||params.get('grant_type')!=='authorization_code'||params.get('redirect_uri')!=='https://demo.yolo-dev.ai/auth/yolo/callback'||!params.get('code_verifier'))return new Response('Invalid test exchange',{status:400});
  const now=Math.floor(Date.now()/1000),body=enc({iss:'https://login.yolo-dev.ai',aud:'yolo-demo',sub:'fixture-subject',email:'fixture@example.invalid',email_verified:true,
    iat:now,exp:now+180,nonce:current.badNonce?'wrong-nonce':current.nonce}),header=enc({alg:'RS256',kid:'fixture-key',typ:'JWT'});
  const key=await crypto.subtle.importKey('jwk',JSON.parse(env.FIXTURE_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(header+'.'+body)));
  const signature=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  return Response.json({token_type:'Bearer',access_token:'synthetic-discarded-access',expires_in:180,id_token:header+'.'+body+'.'+signature});
 }
 return new Response('Unexpected fixture route',{status:500});
}};
