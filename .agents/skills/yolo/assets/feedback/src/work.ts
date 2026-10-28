import { createFeedbackBridge } from '../server.mjs';
import { libraryAssets } from '../library-assets.mjs';
import { API, LIBRARY_VERSION, UUID, exact, text, digest, type Environment, type Principal, type RequestRow, type ResponseRow } from './contract.js';
const PREFIX = '/yolo/api/v1';
const assets: Record<string, { body: string; type: string }> = libraryAssets;
const MARKER = '<!-- yolo:public-feedback:v1 -->\n';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
class Failure extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
function fail(status: number, message: string): never { throw new Failure(status, message); }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
async function decode(stream: ReadableStream<Uint8Array> | null, max: number): Promise<unknown> {
  const reader = stream?.getReader(); if (!reader) fail(400, 'Missing body.');
  let count = 0; const chunks: Uint8Array[] = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; count += value.length; if (count > max) fail(413, 'Body too large.'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(count); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return fail(400, 'Invalid JSON.'); }
}
async function readJSON(request: Request): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? '')) fail(415, 'JSON required.');
  return decode(request.body, 65536);
}
interface Config {
  repository: string; responders: string[]; authorize: (p: Principal) => boolean | Promise<boolean>;
  worker?: { subject: string; expiresAt: number };
}
interface Context { principal?: Principal | null; signal?: AbortSignal }
/** One app-owned bridge. Mount worker routes inside the existing transport guard, before interactive login. */
export function createWorkBridge(config: Config) {
  const legacy = createFeedbackBridge(config);
  if (config.worker && (!text(config.worker.subject, 128) || !Number.isSafeInteger(config.worker.expiresAt))) throw new Error('Invalid worker configuration.');
  return { async fetch(request: Request, env: Environment, context: Context = {}): Promise<Response | null> {
    const url = new URL(request.url), path = url.pathname;
    if (assets[path] && request.method === 'GET') {
      const asset = assets[path];
      return new Response(asset.body, { headers: { ...JSON_HEADERS, 'Content-Type': asset.type } });
    }
    if (path !== PREFIX && !path.startsWith(PREFIX + '/')) return (await legacy.fetch(request, env, context)) ?? null;
    try {
      const worker = path.startsWith(PREFIX + '/worker/');
      if (!env.APP_DB) fail(503, 'Bridge database is not configured.');
      const binding = await env.APP_DB.prepare('SELECT repository FROM yolo_feedback_bridge_identity WHERE singleton=1').bind().first<{ repository: string }>();
      if (binding?.repository.toLowerCase() !== config.repository.toLowerCase()) fail(503, 'Bridge repository binding requires client-owner reconciliation.');
      const github = async (resource: string, init: RequestInit = {}) => {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
        const abort = () => controller.abort(); context.signal?.addEventListener('abort', abort, { once: true });
        try {
          if (context.signal?.aborted) controller.abort();
          const response = await fetch('https://api.github.com' + resource, { ...init, signal: controller.signal, redirect: 'manual', headers: {
            Authorization: `Bearer ${env.FEEDBACK_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'yolo-work-bridge', 'Content-Type': 'application/json'
          } });
          if (!response.ok) { const e = new Failure(response.status, 'Repository unavailable.'); throw e; }
          return await decode(response.body, 1024 * 1024) as any;
        } finally { clearTimeout(timer); context.signal?.removeEventListener('abort', abort); }
      };
      if (!worker) {
        // Preserve the existing principal/origin/claim enforcement before metadata reads.
        const mapped = new URL(url); mapped.pathname = '/feedback/api' + path.slice(PREFIX.length);
        if (request.method === 'POST') {
          const check = new URL(url); check.pathname = '/feedback/api/session';
          const permission = await legacy.fetch(new Request(check, { headers: request.headers }), env, context);
          if (!permission?.ok) return permission ?? null;
          const repo = await github(`/repos/${config.repository}`);
          if (typeof repo.private !== 'boolean' || repo.full_name?.toLowerCase() !== config.repository.toLowerCase()) fail(503, 'Repository visibility is unverified.');
          if (request.headers.get('X-Feedback-Visibility') !== (repo.private ? 'private' : 'public')) throw new Failure(409, 'Repository visibility changed. Review the current disclosure before sending.', 'visibility_changed');
        }
        const old = await legacy.fetch(new Request(mapped, request), env, context);
        if (path === PREFIX + '/session' && request.method === 'GET' && old?.ok) {
          const repo = await github(`/repos/${config.repository}`);
          if (typeof repo.private !== 'boolean' || repo.full_name?.toLowerCase() !== config.repository.toLowerCase()) fail(503, 'Repository visibility is unverified.');
          return json({ ...await old.json(), api: API, libraryVersion: LIBRARY_VERSION, visibility: repo.private ? 'private' : 'public', capabilities: ['requests:own', 'replies:own'] });
        }
        return old ?? null;
      }
      if (!config.worker || !env.WORK_BRIDGE_TOKEN_SHA256 || !/^[a-f0-9]{64}$/.test(env.WORK_BRIDGE_TOKEN_SHA256)) fail(503, 'Worker access is not configured.');
      const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(request.headers.get('Authorization') ?? '');
      if (!match || Date.now() >= config.worker.expiresAt) fail(401, 'Worker authentication required.');
      const actual = await digest(match[1]!); let difference = 0;
      for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ env.WORK_BRIDGE_TOKEN_SHA256.charCodeAt(i);
      if (difference) fail(401, 'Worker authentication required.');
      if (request.headers.has('Origin') && request.headers.get('Origin') !== env.PUBLIC_ORIGIN) fail(403, 'Invalid worker origin.');
      if (!env.APP_DB || !env.FEEDBACK_GITHUB_TOKEN) fail(503, 'Bridge is not configured.');
      const actor = config.worker.subject, db = env.APP_DB;
      const stmt = (sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
      const base = `/repos/${config.repository}/issues`;
      if (path === PREFIX + '/worker/session' && request.method === 'GET') return json({ api: API, libraryVersion: LIBRARY_VERSION, repository: config.repository, actor, expiresAt: config.worker.expiresAt, capabilities: ['requests:read', 'responses:write'] });
      if (path === PREFIX + '/worker/requests' && request.method === 'GET') {
        const rows = (await stmt('SELECT id,title,phase,created,issue FROM yolo_feedback_requests ORDER BY created DESC LIMIT 100').all()).results;
        return json({ api: API, requests: rows });
      }
      const route = /^\/yolo\/api\/v1\/worker\/requests\/([^/]+)(\/responses(?:\/([^/]+))?)?$/.exec(path);
      if (!route || !UUID.test(route[1]!)) fail(404, 'Request not found.');
      const row = await stmt('SELECT * FROM yolo_feedback_requests WHERE id=?', route[1]).first<RequestRow>();
      if (!row || row.phase !== 'sent' || !row.issue) fail(404, 'Confirmed request not found.');
      const issue = await github(`${base}/${row.issue}`);
      if (issue.number !== row.issue || issue.pull_request || issue.locked || !Array.isArray(issue.labels) || issue.labels.some((l: { name?: string } | string) => ['yolo:manual', 'manual', 'yolo:control'].includes(typeof l === 'string' ? l : l.name ?? ''))) fail(403, 'This record is reserved or unavailable.');
      if (issue.title !== row.title || issue.body !== row.payload) fail(409, 'Request source changed; reconcile through the direct GitHub procedure.');
      const comments = async () => {
        const items: { id: number; body: string; user?: { login?: string } }[] = [];
        for (let page = 1; page <= 2; page++) {
          const result = await github(`${base}/${row.issue}/comments?per_page=100&page=${page}`);
          if (!Array.isArray(result)) fail(503, 'Unverified discussion.');
          items.push(...result); if (result.length < 100) break;
        }
        return items;
      };
      if (!route[2] && request.method === 'GET') return json({ api: API, id: row.id, issue: row.issue, input: JSON.parse(row.payload), state: issue.state, labels: issue.labels, comments: await comments() });
      const reconcile = async (operation: ResponseRow) => {
        if (operation.phase === 'writing') {
          const matches = (await comments()).filter(c => c.body === operation.payload && config.responders.includes(c.user?.login ?? '') && Number.isSafeInteger(c.id) && c.id > 0);
          if (matches.length === 1) await stmt("UPDATE yolo_feedback_responses SET phase='sent',comment=? WHERE id=? AND actor=? AND phase='writing'", matches[0]!.id, operation.id, actor).run();
        }
        const saved = await stmt('SELECT * FROM yolo_feedback_responses WHERE id=? AND actor=?', operation.id, actor).first<ResponseRow>();
        return json({ api: API, id: saved!.id, requestId: saved!.request_id, phase: saved!.phase, comment: saved!.comment }, saved!.phase === 'sent' ? 201 : 202);
      };
      if (route[3] && request.method === 'GET') {
        const operation = await stmt('SELECT * FROM yolo_feedback_responses WHERE id=? AND actor=? AND request_id=?', route[3], actor, row.id).first<ResponseRow>();
        if (!operation) fail(404, 'Operation not found.'); return reconcile(operation);
      }
      if (route[2] !== '/responses' || request.method !== 'POST') fail(405, 'Method not allowed.');
      const data = await readJSON(request);
      if (!exact(data, ['id', 'message']) || !text(data.id, 36) || !UUID.test(data.id) || !text(data.message, 16000)) fail(400, 'Invalid response.');
      const payload = MARKER + JSON.stringify({ request_id: row.id, id: data.id, message: data.message });
      const fingerprint = await digest(payload), now = Date.now();
      await stmt("INSERT OR IGNORE INTO yolo_feedback_responses(id,request_id,actor,payload,digest,created,phase) VALUES(?,?,?,?,?,?,'staged')", data.id, row.id, actor, payload, fingerprint, now).run();
      const operation = await stmt('SELECT * FROM yolo_feedback_responses WHERE id=?', data.id).first<ResponseRow>();
      if (!operation || operation.actor !== actor || operation.request_id !== row.id) fail(404, 'Operation not found.');
      if (operation.digest !== fingerprint) fail(409, 'Operation ID belongs to different response text.');
      const claim = await stmt("UPDATE yolo_feedback_responses SET phase='writing' WHERE id=? AND actor=? AND phase='staged'", data.id, actor).run();
      if (claim.meta.changes === 1) {
        try {
          const result = await github(`${base}/${row.issue}/comments`, { method: 'POST', body: JSON.stringify({ body: payload }) });
          if (!Number.isSafeInteger(result.id) || result.id <= 0 || result.body !== payload || !config.responders.includes(result.user?.login)) fail(503, 'Unverified response write.');
          await stmt("UPDATE yolo_feedback_responses SET phase='sent',comment=? WHERE id=? AND actor=? AND phase='writing'", result.id, data.id, actor).run();
        } catch (error) {
          if (error instanceof Failure && [401, 403, 404, 422].includes(error.status)) await stmt("UPDATE yolo_feedback_responses SET phase='rejected' WHERE id=? AND actor=? AND phase='writing'", data.id, actor).run();
        }
      }
      return reconcile(operation);
    } catch (error) { return json({ error: error instanceof Failure ? error.message : 'Bridge unavailable; retain operation IDs and reconcile before retrying.', ...(error instanceof Failure && error.code ? {code:error.code} : {}) }, error instanceof Failure ? error.status : 503); }
  } };
}
