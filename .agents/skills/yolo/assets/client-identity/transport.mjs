// Shared origin transport, not end-user authentication. The operator must
// authenticate before signing; preview.mjs is deliberately loopback-only.
const encoder = new TextEncoder();
const TIME = 'x-yolo-gateway-time';
const SIGNATURE = 'x-yolo-gateway-signature';

export function publicOrigin(env) {
  const url = new URL(env.PUBLIC_ORIGIN);
  if (url.protocol !== 'https:' || !/^[a-z][a-z0-9-]*\.yolo-dev\.ai$/.test(url.hostname) ||
      url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Invalid public origin');
  return url.origin;
}

async function key(secret) {
  if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)) throw Error('Missing origin secret');
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}

// One atomic private binding; a malformed key set never falls back to a legacy
// key. The 15-minute overlap is our transport ceiling, not a provider policy.
export function originKeys(env) {
  const valid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (env.YOLO_GATEWAY_KEYS === undefined) {
    if (!valid(env.YOLO_GATEWAY_SECRET)) throw Error('Missing origin secret');
    return {current: env.YOLO_GATEWAY_SECRET};
  }
  const raw = env.YOLO_GATEWAY_KEYS;
  if (typeof raw !== 'string' || raw.length > 1024) throw Error('Invalid origin key set');
  const keys = JSON.parse(raw);
  if (!keys || Array.isArray(keys) || keys.version !== 1 || !valid(keys.current) ||
      Object.keys(keys).some(name => !['version', 'current', 'previous'].includes(name))) throw Error('Invalid origin key set');
  if ('previous' in keys) {
    const p = keys.previous;
    if (!p || Array.isArray(p) || Object.keys(p).sort().join(',') !== 'notAfter,notBefore,secret' ||
        !valid(p.secret) || p.secret === keys.current || !Number.isSafeInteger(p.notBefore) ||
        !Number.isSafeInteger(p.notAfter) || p.notBefore < 1 || p.notAfter > 9_999_999_999 ||
        p.notAfter <= p.notBefore || p.notAfter - p.notBefore > 900) throw Error('Invalid origin overlap');
  }
  return keys;
}

function message(request, origin, stamp) {
  const url = new URL(request.url);
  return encoder.encode(JSON.stringify(['yolo-origin-v1', origin, stamp, request.method, url.pathname + url.search]));
}

export async function signOriginRequest(request, env, now = Date.now()) {
  const stamp = String(Math.floor(now / 1000));
  const signature = await crypto.subtle.sign('HMAC', await key(originKeys(env).current), message(request, publicOrigin(env), stamp));
  const headers = cleanRequestHeaders(request.headers);
  headers.set(TIME, stamp);
  headers.set(SIGNATURE, Array.from(new Uint8Array(signature), n => n.toString(16).padStart(2, '0')).join(''));
  return new Request(request, {headers, redirect: 'manual'});
}

export async function verifyOriginRequest(request, env, now = Date.now()) {
  return Boolean(await originAuthorization(request, env, now));
}

export async function originAuthorization(request, env, now = Date.now()) {
  const keys = originKeys(env);
  const stamp = request.headers.get(TIME);
  const signature = request.headers.get(SIGNATURE);
  if (!/^\d{10}$/.test(stamp || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const age = Math.floor(now / 1000) - Number(stamp);
  if (age < -5 || age > 30) return false;
  const bytes = Uint8Array.from(signature.match(/../g), n => parseInt(n, 16));
  const data = message(request, publicOrigin(env), stamp);
  const deadline = Math.min(now + 60_000, (Number(stamp) + 60) * 1000);
  if (await crypto.subtle.verify('HMAC', await key(keys.current), bytes, data)) return {deadline};
  const p = keys.previous;
  if (!p || now < p.notBefore * 1000 || now >= p.notAfter * 1000) return false;
  return await crypto.subtle.verify('HMAC', await key(p.secret), bytes, data)
    ? {deadline: Math.min(deadline, p.notAfter * 1000)} : false;
}

function bridgeWebSocket(response, deadline) {
  const pair = new WebSocketPair();
  const local = pair[1], remote = response.webSocket;
  local.accept(); remote.accept();
  let closed = false;
  const close = (code = 1000) => {
    if (closed) return;
    closed = true; clearTimeout(timer);
    const safe = [1005, 1006, 1015].includes(code) ? 1011 : code;
    for (const socket of [local, remote]) {
      try {socket.close(safe, 'Reconnect for authorization');} catch { /* Peer may already be closed. */ }
    }
  };
  const timer = setTimeout(() => close(), Math.max(1, deadline - Date.now()));
  local.addEventListener('message', event => {if (!closed) remote.send(event.data);});
  remote.addEventListener('message', event => {if (!closed) local.send(event.data);});
  for (const socket of [local, remote]) {
    socket.addEventListener('close', event => close(event.code));
    socket.addEventListener('error', () => close(1011));
  }
  return new Response(null, {status: 101, headers: response.headers, webSocket: pair[0]});
}

// Applies to headers, streaming bodies and upgrades. A signature accepted just
// before its previous-key cutoff cannot keep a stream open beyond that cutoff.
export async function withinDeadline(deadline, task, unavailableStatus = 502) {
  if (deadline <= Date.now()) return failure(504, 'Authorization window ended');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), Math.max(1, deadline - Date.now()));
  try {
    const response = await task(abort.signal);
    if (abort.signal.aborted || deadline <= Date.now()) throw Error('Deadline exceeded');
    if (response.webSocket) {
      clearTimeout(timer);
      return bridgeWebSocket(response, deadline);
    }
    if (!response.body) {clearTimeout(timer); return response;}
    const stream = new TransformStream();
    response.body.pipeTo(stream.writable, {signal: abort.signal})
      .finally(() => clearTimeout(timer)).catch(() => {});
    return new Response(stream.readable, {status: response.status, statusText: response.statusText, headers: response.headers});
  } catch {
    clearTimeout(timer);
    return failure(abort.signal.aborted || deadline <= Date.now() ? 504 : unavailableStatus, 'Upstream unavailable');
  }
}

export function cleanRequestHeaders(input) {
  const headers = new Headers(input);
  for (const name of [...headers.keys()]) {
    if (/^(cf-|x-yolo-|x-forwarded-)/i.test(name) || ['host', 'forwarded', 'proxy-authorization', 'proxy-authenticate'].includes(name)) headers.delete(name);
  }
  const cookies = (headers.get('cookie') || '').split(';').filter(value => {
    const name = value.trim().split('=')[0];
    return name && !/^(CF_Authorization|CF_AppSession|CF_Session)$/i.test(name);
  });
  if (cookies.length) headers.set('cookie', cookies.join(';')); else headers.delete('cookie');
  return headers;
}

export function cleanResponse(response, privateOrigin, browserOrigin) {
  const headers = new Headers(response.headers);
  for (const name of [...headers.keys()]) if (/^(cf-access-|x-yolo-)/i.test(name)) headers.delete(name);
  const location = headers.get('location');
  if (location) {
    const url = new URL(location, privateOrigin);
    if (url.origin === privateOrigin) headers.set('location', browserOrigin + url.pathname + url.search + url.hash);
  }
  // Force app cookies to the public app host; never grant a sibling-app Domain.
  const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : response.headers.getAll('set-cookie');
  headers.delete('set-cookie');
  for (const cookie of cookies) headers.append('set-cookie', cookie.replace(/;\s*domain\s*=\s*[^;]*/ig, ''));
  headers.set('cache-control', 'private, no-store');
  headers.set('referrer-policy', 'same-origin');
  headers.set('x-content-type-options', 'nosniff');
  // Passing the WebSocket through keeps native workerd upgrade semantics.
  return new Response(response.body, {status: response.status, statusText: response.statusText,
    headers, ...(response.webSocket ? {webSocket: response.webSocket} : {})});
}

export function failure(status, message) {
  return new Response(message, {status, headers: {'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8'}});
}
