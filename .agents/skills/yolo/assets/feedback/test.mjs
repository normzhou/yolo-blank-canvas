import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,alice,bob } from './fixture.mjs';
const submission=()=>({id:crypto.randomUUID(),template:'yolo.feedback',input:{message:'Keep <script>alert(1)</script> as text.'}});
async function withFixture(run){const f=await fixture(), original=globalThis.fetch;globalThis.fetch=f.github;try{await run(f);}finally{globalThis.fetch=original;f.close();}}
const data=async response=>({status:response.status,body:await response.json()});
test('verified principal, owner/origin binding, schema and private-route denial precede repository access',()=>withFixture(async f=>{
  for(const principal of [null,{...alice,emailVerified:false},{...alice,subject:'outsider'}]) assert.equal((await f.request('/api/session',{principal})).status,403);
  assert.equal((await f.request('',{principal:null})).status,401);
  const input=submission();
  for(const headers of [{'Origin':'https://evil.test'},{'Origin':'null'},{'Content-Type':'text/plain'},{'X-Feedback-Owner':await f.owner(bob)}])assert.ok([403,409].includes((await f.request('/api/requests',{method:'POST',body:input,headers})).status));
  for(const body of [{...input,repository:'other/repo'},{...input,input:{message:'',labels:['yolo:control']}},{...input,template:'yolo.hosting'},{...input,input:{message:'a'.repeat(4001)}},{...input,id:'not-a-uuid'},{...input,id:[input.id]}])assert.equal((await f.request('/api/requests',{method:'POST',body})).status,400);
  assert.equal((await f.request('/api/requests/'+crypto.randomUUID())).status,404);
  assert.equal((await f.request('/api/requests/123/replies',{method:'POST',body:{}})).status,404);
  assert.equal(f.calls.length,0);
  const unicode=submission();unicode.input.message='🦊'.repeat(4000);assert.equal((await f.request('/api/requests',{method:'POST',body:unicode})).status,201);
  const html=await f.request('');assert.match(html.headers.get('Content-Security-Policy'),/script-src 'self'/);assert.equal(html.headers.get('Referrer-Policy'),'same-origin');
}));
test('durable create claim, repeat/concurrent writes, rate limit and uncertain read-only recovery',()=>withFixture(async f=>{
  const input=submission();
  const results=await Promise.all([f.request('/api/requests',{method:'POST',body:input}),f.request('/api/requests',{method:'POST',body:input})]);
  assert.ok(results.every(r=>[201,202].includes(r.status)));assert.equal(f.issues.size,1);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.equal((await f.request('/api/requests',{method:'POST',body:{...input,input:{message:'Changed'}}})).status,409);
  const before=f.calls.length;assert.equal((await f.request('/api/requests/'+input.id,{principal:bob})).status,404);assert.equal(f.calls.length,before);
  assert.equal((await data(await f.request('/api/requests',{principal:bob}))).body.requests.length,0);
  f.state.loseCreate=true;const lost=submission();assert.equal((await data(await f.request('/api/requests',{method:'POST',body:lost}))).body.phase,'writing');
  f.state.searchIncomplete=true;assert.equal((await data(await f.request('/api/requests/'+lost.id))).body.phase,'writing');
  f.state.searchIncomplete=false;assert.equal((await data(await f.request('/api/requests/'+lost.id))).body.phase,'sent');
  await f.request('/api/requests',{method:'POST',body:lost});assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
  f.state.loseCreate=false;f.state.failBefore=true;const unknown=submission();await f.request('/api/requests',{method:'POST',body:unknown});f.state.failBefore=false;
  assert.equal((await data(await f.request('/api/requests/'+unknown.id))).body.phase,'writing');
  await f.request('/api/requests',{method:'POST',body:unknown});assert.equal(f.calls.filter(c=>c.method==='POST').length,3);
  f.state.reject=true;const rejected=submission();const rejection=await data(await f.request('/api/requests',{method:'POST',body:rejected}));assert.equal(rejection.body.phase,'rejected');assert.ok(!JSON.stringify(rejection).includes('upstream secret'));f.state.reject=false;
  for(let n=0;n<6;n++)await f.request('/api/requests',{method:'POST',body:submission()});
  assert.equal((await f.request('/api/requests',{method:'POST',body:submission()})).status,429);
  assert.equal((await f.request('/api/requests',{method:'POST',body:input})).status,201);
  assert.ok(f.calls.every(c=>c.headers.Authorization==='Bearer fixture-secret-never-public'&&c.headers['X-GitHub-Api-Version']==='2026-03-10'));
}));
test('own replies recover without replay, private comments stay private and restricted issues cannot be used',()=>withFixture(async f=>{
  const input=submission();await f.request('/api/requests',{method:'POST',body:input});
  const reply={id:crypto.randomUUID(),message:'A follow-up <img src=x onerror=alert(1)>'};f.state.loseReply=true;
  assert.equal((await data(await f.request('/api/requests/'+input.id+'/replies',{method:'POST',body:reply}))).body.phase,'writing');
  const marker='<!-- yolo:public-feedback:v1 -->\n';
  f.comments.get(1).push({id:2,body:'INTERNAL PRIVATE NOTES',user:{login:'maintainer'}},{id:3,body:marker+JSON.stringify({request_id:input.id,message:'Forged response'}),user:{login:'writer'}},{id:4,body:marker+JSON.stringify({request_id:input.id,message:'<b>Fixed in version 2</b>'}),user:{login:'maintainer'}});
  const thread=(await data(await f.request('/api/requests/'+input.id))).body;
  assert.equal(thread.replies[0].phase,'sent');assert.deepEqual(thread.responses,[{message:'<b>Fixed in version 2</b>'}]);assert.ok(!JSON.stringify(thread).includes('PRIVATE'));assert.ok(!JSON.stringify(thread).includes('fixture-secret'));
  await f.request('/api/requests/'+input.id+'/replies',{method:'POST',body:reply});assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
  assert.equal((await f.request('/api/requests/'+input.id+'/replies',{method:'POST',body:reply,principal:bob})).status,404);
  for(const changes of [{labels:[{name:'yolo:manual'}]},{labels:[{name:'yolo:control'}]},{locked:true},{pull_request:{url:'private'}}]){
    Object.assign(f.issues.get(1),{labels:[],locked:false,pull_request:undefined},changes);
    assert.ok([403,503].includes((await f.request('/api/requests/'+input.id)).status));
    const posts=f.calls.filter(c=>c.method==='POST').length;
    assert.ok([403,503].includes((await f.request('/api/requests/'+input.id+'/replies',{method:'POST',body:{id:crypto.randomUUID(),message:'Denied'}})).status));
    assert.equal(f.calls.filter(c=>c.method==='POST').length,posts);
  }
}));
