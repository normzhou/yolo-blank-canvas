import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,alice,bob} from './fixture.mjs';
import {createWorkBridge} from './dist/src/work.js';
import {createWorkClient} from './dist/src/work-client.js';
const id=()=>crypto.randomUUID();
const workView=(overrides={})=>({audience:'app',title:'A useful improvement',summary:'A deliberately shared summary.',next:'Verify the next slice.',stage:'Building',delivery:{state:'pending'},milestones:[{at:Date.now(),text:'Implementation started.'}],...overrides});
const requestView=(coverage=[],overrides={})=>({decision:'tracked',interpretation:'Improve the requested behavior.',reason:'This fits the app.',next:'Check the linked work.',coverage,...overrides});
async function run(action,tracking=true){
 const f=await fixture({work:true,tracking}),saved=globalThis.fetch,clock=Date.now;globalThis.fetch=f.github;
 const request=async(path,{principal=alice,body,context={}}={})=>f.bridge.fetch(new Request(f.env.PUBLIC_ORIGIN+'/yolo/api/v1/'+path,{method:body?'POST':'GET',headers:{Origin:f.env.PUBLIC_ORIGIN,'Content-Type':'application/json','X-Feedback-Visibility':'private','X-Feedback-Owner':await f.owner(principal)},...(body?{body:JSON.stringify(body)}:{})}),f.env,{principal,...context});
 const transport=(url,init)=>f.bridge.fetch(new Request(url,init),f.env,{});
 const client=createWorkClient({baseURL:f.env.PUBLIC_ORIGIN+'/yolo/api/v1',token:f.workerToken,fetch:transport});
 const seed=(number,overrides={})=>{f.issues.set(number,{number,title:'PRIVATE raw issue title',body:'PRIVATE internal plan',state:'open',locked:false,labels:[{name:'yolo:work'},{name:'yolo:state:active'}],...overrides});f.comments.set(number,[]);};
 const submit=async(principal=alice)=>{const value={id:id(),template:'yolo.question',input:{question:'Can this be improved?'}};assert.equal((await request('requests',{principal,body:value})).status,201);return value.id;};
 try{await action({f,client,request,transport,seed,submit});}finally{globalThis.fetch=saved;Date.now=clock;f.close();}
}
test('personal many-to-many progress and shared work separate decisions, execution and verified availability without private source leakage',()=>run(async({f,client,request,seed,submit})=>{
 const first=await submit(),duplicate=await submit(),bobRequest=await submit(bob);
 const w1=id(),w2=id(),hidden=id();seed(100,{state:'closed',state_reason:'completed',labels:[{name:'yolo:work'}]});seed(101);seed(102);
 const p1={id:id(),base:null,workId:w1,issue:100,view:workView({delivery:{state:'available',version:'release-1',verifiedAt:Date.now(),evidence:'PRIVATE operator delivery receipt'}})};
 await client.publishWork(p1);await client.publishWork({id:id(),base:null,workId:w2,issue:101,view:workView()});
 await client.publishWork({id:id(),base:null,workId:hidden,issue:102,view:workView({audience:'hidden',title:'PRIVATE hidden work'})});
 const link=(workId,scope)=>({workId,scope,disposition:'tracked'});
 await client.publishTracking({id:id(),base:null,requestId:first,view:requestView([link(w1,'First part'),link(w2,'Remaining part'),{workId:null,scope:'Another part',disposition:'declined'}])});
 await client.publishTracking({id:id(),base:null,requestId:duplicate,view:requestView([link(w1,'Same improvement')],{decision:'duplicate'})});
 await client.publishTracking({id:id(),base:null,requestId:bobRequest,view:requestView([link(w1,'Requested improvement')],{reason:'PRIVATE Bob discussion'})});
 const result=await(await request('tracking/requests/'+first)).json();
 assert.equal(result.progress.decision,'tracked');assert.equal(result.progress.coverage[0].work.delivery.state,'available');assert.equal(result.progress.coverage[1].work.state,'active');assert.equal(result.progress.coverage[1].work.delivery.state,'pending');assert.equal(result.progress.coverage[2].disposition,'declined');
 assert.equal((await(await request('tracking/requests/'+duplicate)).json()).progress.coverage[0].work.id,w1,'several requests share one work item');
 const before=f.calls.length;assert.equal((await request('tracking/requests/'+first,{principal:bob})).status,404);assert.equal(f.calls.length,before,'ownership is checked before GitHub reads');
 const bobView=await(await request('tracking/requests/'+bobRequest,{principal:bob})).json();assert.equal(bobView.progress.reason,'PRIVATE Bob discussion');assert.equal(bobView.progress.coverage[0].work,null,'app work policy also applies to linked summaries');
 const board=await(await request('tracking/work')).json();assert.deepEqual(new Set(board.work.map(w=>w.id)),new Set([w1,w2]));
 const publicText=JSON.stringify([board,result]);for(const secret of ['PRIVATE','api.github.com','fixture/client','"issue":','"email":'])assert.ok(!publicText.includes(secret),secret);
 assert.ok(board.work.every(w=>w.checkedAt&&w.updated));assert.equal(board.next,null);
 const clock=Date.now;Date.now=()=>clock()+31000;f.issues.get(100).state='open';f.issues.get(100).labels.push({name:'yolo:state:active'});
 const reopened=await(await request('tracking/work')).json();assert.equal(reopened.work.find(w=>w.id===w1).delivery.state,'unknown','a closed/released annotation cannot overrule reopening');
 f.issues.get(101).labels.push({name:'yolo:state:waiting'});Date.now=()=>clock()+62000;
 const conflict=await(await request('tracking/work')).json();assert.equal(conflict.work.find(w=>w.id===w2).state,'unknown');
 const rollback={...p1,id:id(),base:p1.id,view:workView({delivery:{state:'unavailable',version:'release-1',verifiedAt:Date.now(),evidence:'PRIVATE rollback receipt'}})};await client.publishWork(rollback);
 assert.equal((await(await request('tracking/work')).json()).work.find(w=>w.id===w1).delivery.state,'unavailable','rollback retains historical version while withdrawing current availability');
 await client.publishWork({...p1,id:id(),base:rollback.id,view:workView({audience:'hidden'})});
 const after=await(await request('tracking/requests/'+first)).json();assert.equal(after.progress.needsReconciliation,true);assert.ok(!JSON.stringify(after).includes(w1),'hidden linked work is removed without exposing its identifier');
 const noProgress=await submit();assert.equal((await(await request('tracking/requests/'+noProgress)).json()).progress,null);
 for(let n=0;n<25;n++){seed(200+n);await client.publishWork({id:id(),base:null,workId:id(),issue:200+n,view:workView({title:'Safe item '+n})});}
 const page=await(await request('tracking/work')).json();assert.equal(page.work.length,24);assert.match(page.next,/^[0-9a-f-]{36}$/);
 const page2=await(await request('tracking/work/page/'+page.next)).json();assert.equal(page2.next,null);assert.ok(page2.work.length>0);assert.ok(page2.work.every(w=>!page.work.some(previous=>previous.id===w.id)));

}));
test('tracking is opt-in and source-bound: old grants, denied viewers, reserved issues and unconfirmed inputs cannot publish or disclose',async()=>{
 await run(async({f,client,transport,request})=>{
  assert.ok(!(await client.session()).capabilities.includes('tracking:publish'));
  assert.ok(!(await(await request('session')).json()).capabilities.includes('work:read'));
  await assert.rejects(client.publishWork({id:id()}),/capability/);
  const response=await transport(f.env.PUBLIC_ORIGIN+'/yolo/api/v1/worker/tracking/work',{method:'POST',headers:{Authorization:'Bearer '+f.workerToken,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 },false);
 await run(async({f,client,request,seed,submit})=>{
  assert.ok((await client.session()).capabilities.includes('tracking:publish'));
  assert.ok(!(await(await request('session',{principal:bob})).json()).capabilities.includes('work:read'));
  const before=f.calls.length;assert.equal((await request('tracking/work',{principal:bob})).status,403);assert.equal(f.calls.length,before);
  assert.equal((await request('tracking/work',{context:{workRead:false}})).status,403,'trusted transport can narrow the app policy');
  for(const overrides of [{locked:true},{labels:[{name:'yolo:work'},{name:'yolo:manual'}]},{labels:[{name:'yolo:work'},{name:'yolo:control'}]},{pull_request:{}},{labels:[]},{locked:null}]){
   seed(100,overrides);await assert.rejects(client.publishWork({id:id(),base:null,workId:id(),issue:100,view:workView()}),/403/);
  }
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM yolo_tracking_publications').get().n,0);
  await assert.rejects(client.publishTracking({id:id(),base:null,requestId:id(),view:requestView()}),/404/);
  seed(100);const publication={id:id(),base:null,workId:id(),issue:100,view:workView()};
  await assert.rejects(client.publishWork({...publication,unknown:'ignored?'}),/400/);
  await assert.rejects(client.publishWork({...publication,view:{...publication.view,title:''}}),/400/);
  await assert.rejects(client.publishWork({...publication,view:{...publication.view,delivery:{state:'available',version:'r1',verifiedAt:Date.now()+300000,evidence:'Not yet verified'}}}),/400/);
  await client.publishWork(publication);
  const sent=await client.workRecord(publication.workId);assert.equal(sent.publication,publication.id);assert.equal(sent.issue,100);
  const foreign=createWorkBridge({repository:'fixture/client',responders:['writer'],authorize:()=>true,tracking:{appId:'other-app',authorizeWork:()=>true}});
  const foreignView=await foreign.fetch(new Request(f.env.PUBLIC_ORIGIN+'/yolo/api/v1/tracking/work'),f.env,{principal:alice});assert.deepEqual((await foreignView.json()).work,[],'another app profile cannot consume this tracking index');
  const otherActor=createWorkBridge({repository:'fixture/client',responders:['writer'],authorize:()=>true,tracking:{appId:'fixture',authorizeWork:()=>true},worker:{subject:'different-l1',expiresAt:Date.now()+60000,trackingPublish:true}});
  assert.equal((await otherActor.fetch(new Request(f.env.PUBLIC_ORIGIN+'/yolo/api/v1/worker/tracking/receipts/'+publication.id,{headers:{Authorization:'Bearer '+f.workerToken}}),f.env,{})).status,404,'incidental credential reuse does not transfer an existing publication receipt to another actor');

  f.comments.get(100)[0].body+=' Edited after confirmation';await assert.rejects(client.workRecord(publication.workId),/503/);
  const sourcePosts=f.calls.filter(c=>c.method==='POST').length;
  await assert.rejects(client.publishWork({...publication,id:id(),base:publication.id}),/503/);assert.equal(f.calls.filter(c=>c.method==='POST').length,sourcePosts);
  assert.throws(()=>createWorkBridge({repository:'fixture/client',responders:['writer'],authorize:()=>true,worker:{subject:'fixture-l1',expiresAt:Date.now()+10000,trackingPublish:true}}),/explicit app profile/);
  assert.throws(()=>createWorkBridge({repository:'fixture/client',responders:['writer'],authorize:()=>true,worker:{subject:'fixture-l1',expiresAt:Date.now()+10000,trackingPublish:'true'}}),/Invalid tracking grant/);
 });
});
test('publication intent and compare-and-set bases prevent replay, lost-ACK duplication, concurrent overwrite and incomplete recovery',()=>run(async({f,client,seed})=>{
 seed(100);seed(101);const workId=id(),first={id:id(),base:null,workId,issue:100,view:workView()};
 assert.equal((await client.publishWork(first)).phase,'sent');const postCount=()=>f.calls.filter(c=>c.method==='POST').length;
 const before=postCount(),clock=Date.now;Date.now=()=>clock()+1000;
 assert.equal((await client.publishWork(first)).phase,'sent');assert.equal(postCount(),before);
 await assert.rejects(client.publishWork({...first,view:workView({summary:'Changed'})}),/409/);
 await assert.rejects(client.publishWork({...first,id:id(),base:first.id,issue:101}),/409/);
 const updates=[0,1].map(n=>({...first,id:id(),base:first.id,view:workView({summary:'Concurrent '+n})}));
 const race=await Promise.allSettled(updates.map(p=>client.publishWork(p)));assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(postCount(),before+1);
 const current=await client.workRecord(workId);await assert.rejects(client.publishWork({...first,id:id(),base:first.id}),/409/);
 // Fail between intent persistence and write claim. Resumption uses the saved payload and rechecks its base.
 const original=f.env.APP_DB;let stop=true;
 f.env.APP_DB={prepare(sql){const statement=original.prepare(sql);return{bind(...args){const bound=statement.bind(...args);return{...bound,async run(){if(stop&&sql.includes("SET phase='writing'")){stop=false;throw new Error('Interrupted before effect');}return bound.run();}};}};}};
 const staged={...first,id:id(),base:current.publication,view:workView({summary:'Resume safely'})};
 await assert.rejects(client.publishWork(staged),/503/);assert.equal(postCount(),before+1);f.env.APP_DB=original;
 assert.equal((await client.publishWork(staged)).phase,'sent');assert.equal(postCount(),before+2);
 // An accepted write with no response stays uncertain while source reads are incomplete.
 const github=globalThis.fetch;let hide=true;
 globalThis.fetch=(url,init)=>hide&&init?.method!=='POST'&&new URL(url).pathname.endsWith('/comments')?Promise.resolve(Response.json([])):github(url,init);
 f.state.loseReply=true;const lost={...first,id:id(),base:staged.id,view:workView({summary:'Accepted despite lost acknowledgement'})};
 assert.equal((await client.publishWork(lost)).phase,'writing');const afterLost=postCount();
 assert.equal((await client.publishWork(lost)).phase,'writing');assert.equal(postCount(),afterLost);
 await assert.rejects(client.publishWork({...lost,id:id()}),/409/);
 hide=false;f.state.loseReply=false;globalThis.fetch=github;
 const realComment=f.comments.get(100).find(c=>c.body.includes(lost.id));const preceding=f.comments.get(100).filter(c=>c!==realComment);
 f.comments.set(100,[realComment,...Array.from({length:200},(_,n)=>({id:1000+n,body:'Unrelated',user:{login:'writer'}}))]);
 assert.equal((await client.publication(lost.id)).phase,'writing','a bounded two-page scan cannot claim unique confirmation when incomplete');
 f.comments.set(100,[...preceding,realComment]);assert.equal((await client.publication(lost.id)).phase,'sent');assert.equal(postCount(),afterLost,'receipt recovery is read-only');
 f.state.reject=true;const rejected={...first,id:id(),base:lost.id,view:workView({summary:'Known rejection'})};assert.equal((await client.publishWork(rejected)).phase,'rejected');f.state.reject=false;
 assert.equal((await client.workRecord(workId)).publication,lost.id,'a definite rejected publication cannot hide the confirmed source');
 assert.equal((await client.publishWork({...rejected,id:id()})).phase,'sent');
 assert.equal((await client.publishWork(rejected)).phase,'rejected','a rejected operation ID is not replayable');
}));
