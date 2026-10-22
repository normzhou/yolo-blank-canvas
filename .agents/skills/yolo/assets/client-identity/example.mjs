import {createClientApp} from './worker.mjs';
export default createClientApp(async(request,env,identity)=>{
  const path=new URL(request.url).pathname;
  if(path==='/api/public')return Response.json({public:true});
  if(['/api/private','/api/events','/api/ws'].includes(path)){
    // This private setting belongs to this app alone, never the YOLO operator.
    let allowed;try{allowed=JSON.parse(env.APP_ALLOWED_EMAILS);}catch{return new Response('App policy unavailable',{status:503});}
    if(!Array.isArray(allowed))return new Response('App policy unavailable',{status:503});
    if(!identity||!allowed.includes(identity.email))return new Response('App permission required',{status:403});
    if(path==='/api/events')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: authorized\n\n'));},cancel(){}}),{headers:{'content-type':'text/event-stream'}});
    if(path==='/api/ws'){
      const pair=new WebSocketPair();pair[1].accept();pair[1].addEventListener('message',event=>pair[1].send('authorized:'+event.data));
      return new Response(null,{status:101,webSocket:pair[0]});
    }
    return Response.json({private:true,user:identity.subject});
  }
  if(path==='/')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Client-owned access</title><main><h1>Public page</h1><p>The app owns its permissions.</p><form method="post" action="/auth/yolo/login"><button>Sign in</button></form><form method="post" action="/auth/yolo/logout"><button>Sign out of this app</button></form></main></html>',{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; form-action 'self' https://login.yolo-dev.ai; base-uri 'none'; frame-ancestors 'none'"}});
  return new Response('Not found',{status:404});
});
