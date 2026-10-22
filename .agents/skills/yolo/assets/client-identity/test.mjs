// Native local development acceptance; no Google, Cloudflare or Oracle request.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {signOriginRequest} from './transport.mjs';
import {signBackendIdentity,verifyBackendIdentity} from './backend.mjs';
const root=dirname(fileURLToPath(import.meta.url)),origin='https://demo.yolo-dev.ai',issuer='https://login.yolo-dev.ai';
const settings={PUBLIC_ORIGIN:origin,CLIENT_IDENTITY_ENABLED:'true',YOLO_GATEWAY_SECRET:randomBytes(32).toString('hex'),APP_ALLOWED_EMAILS:'["fixture@example.invalid"]'};
let mf,db,client,network,directory;
const cookie=r=>r.headers.getSetCookie().map(v=>v.split(';')[0]).filter(v=>!v.endsWith('=')).join('; ');
before(async()=>{
 directory=await mkdtemp('/private/tmp/yolo-portable-identity-');
 const pair=generateKeyPairSync('rsa',{modulusLength:2048});
 const pub={...pair.publicKey.export({format:'jwk'}),kid:'fixture-key',alg:'RS256',use:'sig'},priv=pair.privateKey.export({format:'jwk'});
 mf=new Miniflare(convertV4MiniflareOptions({rootPath:root,host:'127.0.0.1',port:0,resourcePersistencePath:directory,resourceTmpPath:resolve(directory,'tmp'),workers:[
  {name:'entry',modules:true,compatibilityDate:'2026-10-19',serviceBindings:{CLIENT:'client',DISABLED:'disabled'},script:`export default {fetch(request,env){const headers=new Headers(request.headers);headers.set('host',new URL(request.url).host);if(headers.has('x-fixture-origin')){headers.set('origin',headers.get('x-fixture-origin'));headers.delete('x-fixture-origin');}const surface=headers.get('x-fixture-surface')||'CLIENT';headers.delete('x-fixture-surface');return env[surface].fetch(new Request(request,{headers}));}}`},
  ...['client','disabled'].map(name=>({name,modules:true,scriptPath:resolve(root,'.wrangler/dry-run/example.js'),compatibilityDate:'2026-10-19',bindings:{...settings,CLIENT_IDENTITY_ENABLED:name==='disabled'?'false':'true'},d1Databases:{APP_DB:'fixture'},outboundService:'network'})),
  {name:'network',modules:true,script:await readFile(resolve(root,'fixture.mjs'),'utf8'),compatibilityDate:'2026-10-19',bindings:{FIXTURE_PUBLIC_KEY:JSON.stringify(pub),FIXTURE_PRIVATE_KEY:JSON.stringify(priv)}},
 ]}));
 try{await mf.ready;client=await mf.getWorker('entry');network=await mf.getWorker('network');db=await mf.getD1Database('APP_DB','client');await db.exec(await readFile(resolve(root,'schema.sql'),'utf8'));}
 catch(error){await mf.dispose();throw error;}
});
after(async()=>{await mf?.dispose();if(directory)await rm(directory,{recursive:true,force:true});});
async function request(path,options={},signed=true,surface='CLIENT'){
 let r=new Request(origin+path,options);if(signed)r=await signOriginRequest(r,settings);
 const headers=new Headers(r.headers);if(headers.has('origin')){headers.set('x-fixture-origin',headers.get('origin'));headers.delete('origin');}headers.set('x-fixture-surface',surface);
 return client.fetch(new Request(r,{headers,redirect:'manual'}));
}
async function start(badNonce=false){
 const r=await request('/auth/yolo/login',{method:'POST',headers:{origin}});assert.equal(r.status,303);
 const target=new URL(r.headers.get('location'));assert.equal(target.origin,issuer);assert.equal(target.searchParams.get('client_id'),'yolo-demo');assert.equal(target.searchParams.get('code_challenge_method'),'S256');
 await network.fetch('https://fixture.invalid/set',{method:'POST',body:JSON.stringify({nonce:target.searchParams.get('nonce'),badNonce})});
 return {cookie:cookie(r),path:'/auth/yolo/callback?'+new URLSearchParams({iss:issuer,code:'synthetic-code',state:target.searchParams.get('state')})};
}
test('portable native example: guarded anonymous page, private denial, isolated login/session and logout',async()=>{
 assert.equal((await request('/',{},false)).status,403);assert.equal((await request('/',{},true,'DISABLED')).status,503);
 assert.match(await (await request('/')).text(),/Public page/);assert.equal((await request('/api/public')).status,200);
 assert.equal((await request('/api/private',{headers:{'x-yolo-viewer-email':'fixture@example.invalid'}})).status,403);
 const flow=await start(),response=await request(flow.path,{headers:{cookie:flow.cookie}});assert.equal(response.status,303);
 const sessionCookie=cookie(response);assert.match(sessionCookie,/__Host-yolo-demo-session=/);for(const c of response.headers.getSetCookie()){assert.match(c,/Secure/);assert.match(c,/HttpOnly/);assert.doesNotMatch(c,/Domain=/i);}
 assert.equal((await request(flow.path,{headers:{cookie:flow.cookie}})).status,400);
 const session=await (await request('/auth/yolo/session',{headers:{cookie:sessionCookie}})).json();
 assert.deepEqual(session.identity,{issuer,subject:'fixture-subject',email:'fixture@example.invalid',emailVerified:true});
 const row=await db.prepare('SELECT * FROM app_session WHERE subject=?').bind('fixture-subject').first();
 const raw=sessionCookie.split('=')[1];assert.equal(row.handle_hash,createHash('sha256').update(raw).digest('hex'));assert.ok(!JSON.stringify(row).includes(raw));
 assert.equal((await request('/api/private',{headers:{cookie:sessionCookie}})).status,200);
 await db.prepare('UPDATE app_session SET email=?').bind('other@example.invalid').run();assert.equal((await request('/api/private',{headers:{cookie:sessionCookie}})).status,403);
 assert.equal((await request('/auth/yolo/logout',{method:'POST',headers:{origin,cookie:sessionCookie}})).status,204);
 assert.equal((await request('/api/private',{headers:{cookie:sessionCookie}})).status,403);
 const bad=await start(true);assert.equal((await request(bad.path,{headers:{cookie:bad.cookie}})).status,400);
 assert.equal((await request(bad.path,{headers:{cookie:bad.cookie}})).status,400);
});
test('portable Oracle assertion verifies in JavaScript and Python before app permissions',async()=>{
 const secret=randomBytes(32).toString('hex'),config={app:'demo',origin},identity={issuer,subject:'fixture-subject',email:'fixture@example.invalid',emailVerified:true};
 const r=new Request(origin+'/api/private?paper=1',{method:'POST'}),value=await signBackendIdentity(r,config,secret,identity,Date.now()+20000);
 const signed=new Request(r,{headers:{'x-yolo-app-identity':value}});assert.deepEqual((await verifyBackendIdentity(signed,config,secret)).identity,identity);
 await assert.rejects(verifyBackendIdentity(new Request(origin+'/api/other',{headers:signed.headers}),config,secret));
 const script=`import json,sys\nfrom backend_identity import verify_identity,InvalidIdentity\nv=json.load(sys.stdin)\nsettings=dict(app='demo',origin='https://demo.yolo-dev.ai',secret=v['secret'],method='POST',path='/api/private?paper=1')\nassert verify_identity(v['value'],**settings)==v['identity']\ntry:\n verify_identity(v['value'],**{**settings,'method':'GET'})\n raise AssertionError('Expected refusal')\nexcept InvalidIdentity:pass\nprint('verified-minimum-identity')`;
 const out=spawnSync('python3',['-c',script],{cwd:root,input:JSON.stringify({secret,value,identity}),encoding:'utf8',env:{PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(out.status,0,out.stdout+out.stderr);assert.match(out.stdout,/verified-minimum-identity/);
});
