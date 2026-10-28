import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,alice,bob} from './fixture.mjs';
import {createWorkClient} from './dist/src/work-client.js';
const submission=()=>({id:crypto.randomUUID(),template:'yolo.question',input:{question:'How can we improve this?'}});
async function run(action){const f=await fixture({work:true}),saved=globalThis.fetch;globalThis.fetch=f.github;
 const requester=(path,options={})=>f.bridge.fetch(new Request(f.env.PUBLIC_ORIGIN+'/yolo/api/v1/'+path,{method:options.body?'POST':'GET',headers:{Origin:f.env.PUBLIC_ORIGIN,'Content-Type':'application/json','X-Feedback-Owner':options.owner??'','X-Feedback-Visibility':options.visibility??'private'},...(options.body?{body:JSON.stringify(options.body)}:{})}),f.env,{principal:options.principal??alice});
 const owner=await f.owner(alice);const request=(path,options={})=>requester(path,{owner,...options});
 const transport=async(url,init)=>f.bridge.fetch(new Request(url,init),f.env,{});
 const client=createWorkClient({baseURL:f.env.PUBLIC_ORIGIN+'/yolo/api/v1',token:f.workerToken,fetch:transport});
 try{await action({f,request,client,transport});}finally{globalThis.fetch=saved;f.close();}}
test('versioned requester visibility and distinct worker authority fail closed before effects',()=>run(async({f,request,client,transport})=>{
 const session=await(await request('session')).json();assert.equal(session.api,'yolo-work-api-v1');assert.equal(session.libraryVersion,'0.1.0-alpha.41');assert.equal(session.visibility,'private');assert.equal(session.forms.length,4);
 assert.equal((await client.session()).actor,'fixture-l1');assert.equal((await client.session()).libraryVersion,'0.1.0-alpha.41');
 for(const token of ['wrong-worker-token-1234567890abcdefgh','']){const response=await transport(f.env.PUBLIC_ORIGIN+'/yolo/api/v1/worker/requests',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,401);}
 const before=f.calls.length;assert.equal((await transport(f.env.PUBLIC_ORIGIN+'/yolo/api/v1/worker/requests',{headers:{Authorization:'Bearer '+f.workerToken,Origin:'https://evil.example'}})).status,403);assert.equal(f.calls.length,before);
 f.state.unknownVisibility=true;assert.equal((await request('requests',{body:submission()})).status,503);assert.equal(f.issues.size,0);f.state.unknownVisibility=false;
 f.state.private=false;
 const changed=await request('requests',{body:submission()});assert.equal(changed.status,409);assert.equal((await changed.json()).code,'visibility_changed');assert.equal(f.issues.size,0);
 const missing=await request('requests',{body:submission(),visibility:''});assert.equal(missing.status,409);assert.equal(f.issues.size,0);
 f.state.private=true;
 const input=submission();assert.equal((await request('requests',{body:input})).status,201);
 assert.equal((await request('requests/'+input.id,{principal:bob,owner:await f.owner(bob)})).status,404);
 const outsider=crypto.randomUUID();await assert.rejects(client.request(outsider),/404/);
 f.issues.get(1).labels=[{name:'yolo:control'}];await assert.rejects(client.request(input.id),/403/);await assert.rejects(client.respond(input.id,crypto.randomUUID(),'Cannot write here'),/403/);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 f.database.prepare('UPDATE yolo_feedback_bridge_identity SET repository=? WHERE singleton=1').run('different/repository');
 const bound=f.calls.length;await assert.rejects(client.requests(),/503/);assert.equal((await request('session')).status,503);assert.equal(f.calls.length,bound);
}));
test('L1 client reads requester input and publishes one durable intentional response with read-only uncertain recovery',()=>run(async({f,request,client})=>{
 const input=submission();await request('requests',{body:input});
 assert.equal((await client.requests()).requests[0].id,input.id);assert.equal((await client.request(input.id)).input.input.question,input.input.question);
 const operation=crypto.randomUUID();f.state.loseReply=true;
 const result=await client.respond(input.id,operation,'Please try this change.');assert.equal(result.phase,'writing');
 assert.equal((await client.receipt(input.id,operation)).phase,'sent');
 assert.equal((await client.respond(input.id,operation,'Please try this change.')).phase,'sent');
 await assert.rejects(client.respond(input.id,operation,'Different response'),/409/);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
 f.state.private=false;const changedReply=await request('requests/'+input.id+'/replies',{body:{id:crypto.randomUUID(),message:'Do not post with stale disclosure'}});assert.equal(changedReply.status,409);assert.equal(f.calls.filter(c=>c.method==='POST').length,2);f.state.private=true;
 f.comments.get(1).push({id:50,body:'PRIVATE INTERNAL NOTE',user:{login:'writer'}});
 const userThread=await(await request('requests/'+input.id)).json();assert.equal(userThread.responses[0].message,'Please try this change.');assert.ok(!JSON.stringify(userThread).includes('PRIVATE INTERNAL'));
 f.state.loseReply=false;const reply={id:crypto.randomUUID(),message:'That works, thanks.'};await request('requests/'+input.id+'/replies',{body:reply});
 assert.ok((await client.request(input.id)).comments.some(c=>c.body.includes('That works, thanks.')));
 const noAck=crypto.randomUUID();f.state.failBefore=true;await assert.rejects(client.respond(input.id,noAck,'Not posted'),/503/);f.state.failBefore=false;
 assert.equal(f.calls.filter(c=>c.method==='POST').length,3);
}));
test('headless transport refuses credential redirects and API mismatch without retrying a write',async()=>{
 assert.throws(()=>createWorkClient({baseURL:'http://example.test/yolo/api/v1',token:'a'.repeat(40)}),/HTTPS/);
 assert.throws(()=>createWorkClient({baseURL:'https://user:password@example.test',token:'a'.repeat(40)}),/HTTPS/);
 let calls=0,posts=0;const client=createWorkClient({baseURL:'https://example.test/yolo/api/v1',token:'a'.repeat(40),fetch:async(url,init)=>{calls++;assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');if(init.method==='GET')return Response.json({api:'yolo-work-api-v1',capabilities:['responses:write']});posts++;throw new Error('Lost response');}});
 await assert.rejects(client.respond(crypto.randomUUID(),crypto.randomUUID(),'Reply'),/Lost response/);assert.equal(calls,2);assert.equal(posts,1);
 const wrong=createWorkClient({baseURL:'http://127.0.0.1/yolo/api/v1',token:'a'.repeat(40),fetch:async()=>Response.json({api:'incompatible'})});await assert.rejects(wrong.session(),/Incompatible/);
});
