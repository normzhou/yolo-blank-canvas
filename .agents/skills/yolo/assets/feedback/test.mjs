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
  const other=submission();await f.request('/api/requests',{method:'POST',body:other,principal:bob});
  const original=f.issues.get(1),list=async()=>{const before=f.calls.length;const response=await f.request('/api/requests');assert.equal(response.status,200);assert.deepEqual(f.calls.slice(before).map(c=>new URL(c.url).pathname),['/graphql'],'one bounded metadata read, no conversations/comments or per-item fan-out');return(await response.json()).requests;};
  for(const state of ['queued','active','waiting','deferred']){
    original.labels=[{name:'yolo:work'},{name:'yolo:state:'+state}];
    const rows=await list();assert.equal(rows.length,1,'only the signed-in owner’s input is projected');assert.equal(rows[0].id,unicode.id);assert.ok(rows[0].checkedAt);assert.deepEqual(rows[0].status,(await(await f.request('/api/requests/'+unicode.id)).json()).status);
  }
  original.state='closed';original.labels=[{name:'yolo:work'}];assert.equal((await list())[0].status.state,'closed');
  for(const change of [{locked:true},{pull_request:{}},{labels:[{name:'yolo:manual'}]},{labels:[{name:'yolo:control'}]},{labels:Array.from({length:101},(_,i)=>({name:'label'+i}))}]){
    Object.assign(original,{locked:false,pull_request:undefined,labels:[]},change);const rows=await list();assert.equal(rows[0].status,null,'restricted/type/incomplete source cannot leak work state');assert.equal(rows[0].checkedAt,undefined);
  }
  Object.assign(original,{locked:false,pull_request:undefined,labels:[]});
  f.state.statusResponse={data:{repository:{nameWithOwner:'other/repository',i0:{state:'OPEN'}}}};assert.equal((await list())[0].status,null,'cross-repository result refused');
  f.state.statusResponse={data:{repository:{nameWithOwner:'fixture/client',i0:null}},errors:[{path:['repository','i0'],message:'private source error'}]};assert.equal((await list())[0].status,null,'partial/missing source is not invented progress');
  f.state.statusResponse=null;f.state.statusError=true;const unavailable=await list();assert.equal(unavailable[0].status,null);assert.ok(!JSON.stringify(unavailable).includes('private provider'));
  f.state.statusError=false;assert.equal((await list())[0].status.state,'closed','fresh metadata recovers without cached stale status');

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

test('discussion cache keeps issue/owner checks fresh, revalidates ETags and clears across expiry, writes and credential changes',()=>withFixture(async f=>{
  const input=submission();await f.request('/api/requests',{method:'POST',body:input});
  const source=globalThis.fetch,clock=Date.now;let notModified=0,unbound=false;
  globalThis.fetch=async(url,init)=>{
    const r=await source(url,init);if((init?.method??'GET')!=='GET'||!r.ok)return r;
    const body=await r.text(),etag='"'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))].join('')+'"';
    if(unbound||new Headers(init.headers).get('If-None-Match')===etag){notModified++;return new Response(null,{status:304});}
    return new Response(body,{status:r.status,headers:{'Content-Type':'application/json',ETag:etag}});
  };
  const path='/api/requests/'+input.id;
  const comments=()=>f.calls.filter(c=>new URL(c.url).pathname.endsWith('/comments')&&c.method==='GET').length;
  const read=async headers=>{const r=await f.request(path,{headers:{'X-Yolo-Read-Cache':'v1',...headers}});return{status:r.status,cache:r.headers.get('X-Yolo-Cache'),timing:r.headers.get('Server-Timing'),body:await r.json()};};
  try{
    assert.equal((await read()).cache,'miss');const before=comments(),issues=f.calls.filter(c=>new URL(c.url).pathname.endsWith('/issues/1')).length;
    const cached=await read();assert.equal(cached.cache,'hit');assert.ok(cached.body.checkedAt);assert.match(cached.timing,/github;dur=/);assert.equal(comments(),before);assert.equal(f.calls.filter(c=>new URL(c.url).pathname.endsWith('/issues/1')).length,issues+1,'native reserved/credential checks remain live on a cache hit');assert.ok(notModified>0);
    const calls=f.calls.length;assert.equal((await f.request(path,{principal:bob})).status,404);assert.equal(f.calls.length,calls);
    await read(); // A refused owner read deliberately discards cached source state.
    const warmed=comments();
    f.comments.get(1).push({id:20,body:'<!-- yolo:public-feedback:v1 -->\n'+JSON.stringify({request_id:input.id,message:'A new response'}),user:{login:'maintainer'}});
    assert.equal((await read()).body.responses.length,0,'discussion cache has a bounded explicit freshness window');
    const fresh=await read({'Cache-Control':'no-cache'});assert.equal(fresh.cache,'revalidated');assert.equal(fresh.body.responses[0].message,'A new response');assert.equal(comments(),warmed+1);
    Date.now=()=>clock()+21000;assert.equal((await read()).cache,'miss');
    const reply={id:crypto.randomUUID(),message:'Confirmed follow-up'};f.state.loseReply=true;
    assert.equal((await data(await f.request(path+'/replies',{method:'POST',body:reply}))).body.phase,'writing');
    const recovered=await read();assert.equal(recovered.cache,'revalidated');assert.equal(recovered.body.replies[0].phase,'sent');assert.equal(f.calls.filter(c=>c.method==='POST').length,2,'cache/recovery cannot replay a write');f.state.loseReply=false;
    assert.equal((await read()).cache,'miss');assert.equal((await read()).cache,'hit');
    // A confirmed write clears the warm projection, then two overlapping opens share one discussion read.
    await f.request(path+'/replies',{method:'POST',body:{id:crypto.randomUUID(),message:'Before overlap'}});
    const etagFetch=globalThis.fetch;let release,started;const entered=new Promise(r=>started=r),hold=new Promise(r=>release=r);
    globalThis.fetch=async(url,init)=>{const response=await etagFetch(url,init);if((init?.method??'GET')==='GET'&&new URL(url).pathname.endsWith('/comments')){started();await hold;}return response;};
    const beforeOverlap=comments();let left,right;
    try{
      left=read();await entered;right=read();for(let n=0;n<20;n++)await new Promise(r=>setImmediate(r));
      assert.equal(comments(),beforeOverlap+1,'overlapping authorized readers share one discussion fetch');
      await f.request(path+'/replies',{method:'POST',body:{id:crypto.randomUUID(),message:'During overlap'}});
      release();await Promise.all([left,right]);
    }finally{release();globalThis.fetch=etagFetch;await Promise.allSettled([left,right]);}
    const afterOverlap=comments();assert.equal((await read()).cache,'miss');assert.equal(comments(),afterOverlap+1,'a pre-write read cannot refill the invalidated projection');
    f.issues.get(1).locked=true;assert.equal((await read()).status,403,'a cached discussion cannot bypass a newly locked source');f.issues.get(1).locked=false;
    f.env.FEEDBACK_GITHUB_TOKEN='rotated-private-fixture-token';const changed=await read();assert.equal(changed.cache,'miss');assert.equal(f.calls.at(-1).headers['If-None-Match'],undefined,'new credential scope cannot reuse an old conditional body');
    f.env.FEEDBACK_GITHUB_TOKEN='another-private-fixture-token';unbound=true;assert.equal((await read()).status,503,'304 without a matching body fails closed');
  }finally{Date.now=clock;globalThis.fetch=source;}
}));
