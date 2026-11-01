// Server-only bounded caches. They never establish identity, ownership or write authority.
export function boundedCache(ttl) {
  const values=new Map();let bytes=0;
  function remove(key){const old=values.get(key);if(old){bytes-=old.size;values.delete(key);}}
  return {
    get(key){const v=values.get(key);if(!v)return;if(v.until<=Date.now()){remove(key);return;}return v.value;},
    delete:remove,
    clear(){values.clear();bytes=0;},
    set(key,value){remove(key);const size=new TextEncoder().encode(JSON.stringify(value)).length;if(size>32768)return;while(values.size>=16||bytes+size>262144)remove(values.keys().next().value);values.set(key,{value,size,until:Date.now()+ttl});bytes+=size;}
  };
}
export function conditionalReads(){
  const cache=boundedCache(300000);let previous,revision=0;
  return {
    scope(db,origin,credential){if(!previous||previous.db!==db||previous.origin!==origin||previous.credential!==credential){previous={db,origin,credential};cache.clear();revision++;return true;}return false;},
    clear(){cache.clear();revision++;},
    async read(key,fetcher,parse,method='GET'){
      const version=revision,old=method==='GET'?cache.get(key):undefined;
      const response=await fetcher(old?.etag);
      if(response.status===304){if(!old||method!=='GET')throw new Error('Unbound conditional response');return JSON.parse(old.json);}
      if(!response.ok){cache.delete(key);const error=new Error('Repository unavailable');error.status=response.status;throw error;}
      const value=await parse(response.body),etag=response.headers.get('ETag');
      if(method==='GET'&&etag&&etag.length<=512&&version===revision)cache.set(key,{etag,json:JSON.stringify(value)});
      return value;
    }
  };
}
export function timings(name){
  const started=performance.now(),values=new Map();
  /** @template T @param {string} key @param {()=>Promise<T>} action */
  async function time(key,action){const start=performance.now();try{return await action();}finally{values.set(key,(values.get(key)??0)+performance.now()-start);}}
  function finish(response){if(!response)return response;const h=new Headers(response.headers);const spans=[...values,name?[name,performance.now()-started]:null].filter(Boolean).map(([k,v])=>k+';dur='+Number(v).toFixed(1));h.set('Server-Timing',[h.get('Server-Timing'),...spans].filter(Boolean).join(', '));return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});}
  return {time,finish};
}
