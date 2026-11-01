// LOCAL TEST FIXTURE ONLY. Its synthetic principal and GitHub double are never a production adapter.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createFeedbackBridge } from './server.mjs';
export const alice={issuer:'https://login.example.test',subject:'alice',emailVerified:true};
export const bob={...alice,subject:'bob'};
export async function fixture(options={}) {
  const database=new DatabaseSync(':memory:'); database.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  database.prepare('INSERT INTO yolo_feedback_bridge_identity(singleton,repository) VALUES(1,?)').run('fixture/client');
  const db={prepare(sql){return{bind(...args){return{
    async first(){return database.prepare(sql).get(...args)??null;},
    async all(){return{results:database.prepare(sql).all(...args)};},
    async run(){return{meta:{changes:Number(database.prepare(sql).run(...args).changes)}};}
  };}};}};
  const issues=new Map(), comments=new Map(), calls=[];
  const state={loseCreate:false,loseReply:false,searchIncomplete:false,reject:false,failBefore:false};
  const env={APP_DB:db,FEEDBACK_GITHUB_TOKEN:'fixture-secret-never-public',PUBLIC_ORIGIN:'https://app.example.test'};
  const workerToken='fixture-worker-token-1234567890abcdefgh';
  env.WORK_BRIDGE_TOKEN_SHA256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(workerToken)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const factory=options.work?(await import('./dist/src/work.js')).createWorkBridge:createFeedbackBridge;
  const bridge=factory({repository:'fixture/client',responders:options.work?['writer']:['maintainer'],authorize:p=>['alice','bob'].includes(p.subject),worker:{subject:'fixture-l1',expiresAt:Date.now()+3600000,trackingPublish:options.tracking===true},...(options.tracking?{tracking:{appId:'fixture',authorizeWork:p=>p.subject==='alice'}}:{})});
  async function github(url,init={}){
    const u=new URL(url);if(u.origin!=='https://api.github.com')throw new Error('Fixture forbids external request');
    calls.push({url:u.href,method:init.method??'GET',headers:init.headers});
    if(state.failBefore) throw new Error('No connection');
    if(state.reject&&init.method==='POST')return Response.json({message:'private upstream secret'},{status:403});
    if(u.pathname==='/repos/fixture/client') return Response.json(state.unknownVisibility?{}:{full_name:'fixture/client',private:state.private!==false});
    if(u.pathname==='/search/issues')return Response.json({incomplete_results:state.searchIncomplete,items:[...issues.values()].filter(i=>u.searchParams.get('q').includes(/yolo-feedback:([^\]]+)/.exec(i.title)[1]))});
    if(u.pathname==='/repos/fixture/client/issues'&&init.method==='POST'){
      const n=issues.size+1, issue={...JSON.parse(init.body),number:n,state:'open',labels:[],locked:false,created_at:new Date().toISOString()}; issues.set(n,issue);comments.set(n,[]);
      if(state.loseCreate)throw new Error('Accepted but acknowledgement lost');return Response.json(issue,{status:201});
    }
    const commentRoute=/^\/repos\/fixture\/client\/issues\/comments\/(\d+)$/.exec(u.pathname);
    if(commentRoute){const found=[...comments.values()].flat().find(c=>c.id===Number(commentRoute[1]));return Response.json(found??{},{status:found?200:404});}
    const route=/^\/repos\/fixture\/client\/issues\/(\d+)(\/comments)?$/.exec(u.pathname);
    if(!route)return Response.json({message:'Missing'},{status:404});const n=Number(route[1]);
    if(!route[2])return Response.json(issues.get(n)??{},{status:issues.has(n)?200:404});
    if(init.method==='POST'){
      const item={id:([0,...[...comments.values()].flat().map(c=>c.id)].reduce((a,b)=>Math.max(a,b),0)+1),issue_url:'https://api.github.com/repos/fixture/client/issues/'+n,body:JSON.parse(init.body).body,user:{login:'writer'},created_at:new Date().toISOString()};comments.get(n).push(item);
      if(state.loseReply)throw new Error('Reply accepted but acknowledgement lost');return Response.json(item,{status:201});
    }
    const page=Number(u.searchParams.get('page')??1);return Response.json((comments.get(n)??[]).slice((page-1)*100,page*100));
  }
  async function owner(principal){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`fixture/client\0${principal.issuer}\0${principal.subject}`)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
  async function request(path='',options={}){
    const principal=Object.hasOwn(options,'principal')?options.principal:alice;
    const headers={'Origin':env.PUBLIC_ORIGIN,'Content-Type':'application/json',...(principal?{'X-Feedback-Owner':await owner(principal)}:{}),...options.headers};
    return bridge.fetch(new Request(env.PUBLIC_ORIGIN+'/feedback'+path,{method:options.method??'GET',headers,...(options.body?{body:JSON.stringify(options.body)}:{})}),env,{principal});
  }
  return{database,db,env,bridge,workerToken,state,issues,comments,calls,github,request,owner,close:()=>database.close()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const f=await fixture({work:process.argv.includes('--work'),tracking:process.argv.includes('--tracking')});globalThis.fetch=f.github;
  const server=createServer(async(req,res)=>{try{
    if(process.argv.includes('--work') && req.url==='/auth/yolo/login' && req.method==='POST') {res.writeHead(303,{'Location':'/library-preview','Set-Cookie':'fixture-viewer=alice; Path=/; SameSite=Lax'});res.end();return;}
    if(process.argv.includes('--work') && req.url==='/auth/yolo/logout' && req.method==='POST') {res.writeHead(204,{'Set-Cookie':'fixture-viewer=anonymous; Path=/; SameSite=Lax'});res.end();return;}
    if(req.url==='/library-preview') {res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'self'"});res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic feedback integration</title><button id="account">Change synthetic account</button><p id="activity">App activity</p><div id="mount"></div><script type="module" src="/__preview.mjs"></script>');return;}
    if(req.url==='/__preview.mjs') {res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`import {mountFeedbackLauncher} from '/yolo/feedback/browser.js'; const feedback=mountFeedbackLauncher(document.querySelector('#mount'),{app:{id:'fixture',name:'Demo fixture'}});document.querySelector('#account').onclick=()=>{const next=document.cookie.includes('fixture-viewer=anonymous')?'alice':document.cookie.includes('fixture-viewer=bob')?'anonymous':'bob';document.cookie='fixture-viewer='+next+'; path=/';};let count=0;setInterval(()=>document.querySelector('#activity').textContent='App activity '+(++count),100);window.feedback=feedback;`);return;}
    const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const response=await f.bridge.fetch(new Request(f.env.PUBLIC_ORIGIN+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{})}),f.env,{principal:req.headers.cookie?.includes('fixture-viewer=anonymous')?null:req.headers.cookie?.includes('fixture-viewer=bob')?bob:alice});res.writeHead(response?.status??404,Object.fromEntries(response?.headers??[]));res.end(response?Buffer.from(await response.arrayBuffer()):'Not found');}catch{res.writeHead(500);res.end('Fixture error');}});
  server.listen(0,'127.0.0.1',()=>{f.env.PUBLIC_ORIGIN=`http://127.0.0.1:${server.address().port}`;console.log('Synthetic local preview: '+f.env.PUBLIC_ORIGIN+(process.argv.includes('--work')?'/library-preview':'/feedback'));});
  process.on('SIGTERM',()=>{server.closeAllConnections();server.close(()=>{f.close();process.exit(0);});});
}
