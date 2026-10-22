// Development only: no Google authentication, cloud calls or production secrets.
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {WebSocketServer} from 'ws';
import {signOriginRequest} from './transport.mjs';

export async function startPreview({port = 4174, backend = 'http://127.0.0.1:3000', assets} = {}) {
  const directory = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(await readFile(resolve(directory, 'wrangler.json'), 'utf8'));
  const localBackend = new URL(backend);
  if (localBackend.protocol !== 'http:' || localBackend.hostname !== '127.0.0.1' || localBackend.pathname !== '/' ||
      localBackend.username || localBackend.password || localBackend.search || localBackend.hash) throw Error('Use a loopback HTTP backend origin');
  const env = {...config.vars, YOLO_GATEWAY_SECRET: randomBytes(32).toString('hex'),
    BACKEND_ACCESS_CLIENT_ID: 'local-fixture-only', BACKEND_ACCESS_CLIENT_SECRET: 'local-fixture-only'};
  const mf = new Miniflare(convertV4MiniflareOptions({host: '127.0.0.1', port: 0,
    resourcePersistencePath: resolve(directory, '.wrangler/state'), resourceTmpPath: resolve(directory, '.wrangler/tmp'),
    workers: [{name: 'client',
    modulesRoot: directory,
    modules: ['worker.mjs', 'transport.mjs'].map(name => ({type: 'ESModule', path: resolve(directory, name)})),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags, bindings: env,
    assets: {directory: resolve(directory, assets || config.assets.directory), binding: 'ASSETS', run_worker_first: true,
      routerConfig: {has_user_worker: true},
      assetConfig: {not_found_handling: 'single-page-application'}},
    outboundService: 'local-backend'}, {name: 'local-backend', modules: true,
      script: 'export default {fetch(request, env) {return env.LOCAL_BACKEND.fetch(request)}}',
      serviceBindings: {LOCAL_BACKEND: {external: {address: localBackend.host, http: {}}}}}]}));
  try {await mf.ready;} catch (error) {await mf.dispose(); throw error;}
  const hostAllowed = request => {
    const host = `127.0.0.1:${server.address().port}`;
    return request.headers.host === host && (!request.headers.origin || request.headers.origin === `http://${host}`);
  };
  async function dispatch(request) {
    const init = {method: request.method, headers: request.headers, redirect: 'manual'};
    if (!['GET', 'HEAD'].includes(request.method)) Object.assign(init, {body: Readable.toWeb(request), duplex: 'half'});
    const signed = await signOriginRequest(new Request(`http://127.0.0.1${request.url}`, init), env);
    return mf.dispatchFetch(signed.url, {method: signed.method, headers: [...signed.headers],
      ...(signed.body ? {body: signed.body, duplex: 'half'} : {}), redirect: 'manual'});
  }
  const server = createServer(async (request, response) => {
    if (!hostAllowed(request)) {response.writeHead(403).end('Forbidden'); return;}
    try {
      const result = await dispatch(request);
      const headers = Object.fromEntries(result.headers);
      if (result.headers.getSetCookie().length) headers['set-cookie'] = result.headers.getSetCookie();
      response.writeHead(result.status, headers);
      if (result.body) {
        const stream = Readable.fromWeb(result.body);
        response.on('close', () => stream.destroy());
        stream.on('error', () => response.destroy());
        stream.pipe(response);
      } else response.end();
    } catch {response.writeHead(502).end('Local backend unavailable');}
  });
  server.on('upgrade', async (request, socket, head) => {
    if (!hostAllowed(request)) {socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;}
    try {
      const result = await dispatch(request);
      if (result.status !== 101 || !result.webSocket) {socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'); return;}
      const remote = result.webSocket;
      remote.accept();
      const wss = new WebSocketServer({noServer: true, handlesProtocols: () => result.headers.get('sec-websocket-protocol') || false});
      wss.handleUpgrade(request, socket, head, local => {
        local.on('message', (data, binary) => remote.send(binary ? data : data.toString()));
        remote.addEventListener('message', event => {if (local.readyState === 1) local.send(event.data);});
        remote.addEventListener('close', event => local.close([1005, 1006].includes(event.code) ? 1011 : event.code));
        local.on('close', code => remote.close([1005, 1006].includes(code) ? 1011 : code));
        local.on('error', () => remote.close(1011));
        remote.addEventListener('error', () => local.close(1011));
      });
    } catch {socket.destroy();}
  });
  await new Promise((done, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', done);});
  return {url: `http://127.0.0.1:${server.address().port}`, client: mf, close: async () => {
    server.closeAllConnections(); server.close(); await mf.dispose();
  }};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preview = await startPreview({port: Number(process.env.YOLO_PREVIEW_PORT || 4174),
    backend: process.env.YOLO_LOCAL_BACKEND || 'http://127.0.0.1:3000', assets: process.env.YOLO_ASSETS_DIR});
  console.log(`Local development preview: ${preview.url}; backend is local only. No live hosting or Google authentication.`);
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, async () => {await preview.close(); process.exit(0);});
}
