import { timings } from '../read-cache.mjs';
import { createWorkBridge } from './work.js';
import { digest, exact, text } from './contract.js';
import { MANAGED_API, managedRoute, managedJSON, httpsOrigin, boundedText } from './managed-client.js';
const positive = (v) => Number.isSafeInteger(v) && Number(v) > 0;
const HASH = /^[0-9a-f]{64}$/;
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const encode = (v) => b64(new TextEncoder().encode(JSON.stringify(v)));
function der(tag, value) {
    const n = value.length, length = n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255];
    return new Uint8Array([tag, ...length, ...value]);
}
async function jwt(app, pem) {
    if (!/^[1-9][0-9]*$/.test(app) || typeof pem !== 'string' || pem.length > 16000)
        throw new Error('Invalid App credentials');
    const match = /^-----BEGIN (RSA PRIVATE KEY|PRIVATE KEY)-----\s+([A-Za-z0-9+/=\s]+)-----END \1-----\s*$/.exec(pem);
    if (!match)
        throw new Error('Invalid App key');
    let bytes = Uint8Array.from(atob(match[2].replace(/\s/g, '')), c => c.charCodeAt(0));
    // GitHub may supply PKCS#1; WebCrypto imports PKCS#8. Wrap entirely in memory.
    if (match[1] === 'RSA PRIVATE KEY')
        bytes = der(0x30, new Uint8Array([2, 1, 0, 0x30, 0x0d, 6, 9, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 1, 1, 1, 5, 0, ...der(4, bytes)]));
    const key = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    if (key.algorithm.modulusLength < 2048)
        throw new Error('App key too small');
    const now = Math.floor(Date.now() / 1000), input = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iat: now - 60, exp: now + 540, iss: app });
    return input + '.' + b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input))));
}
async function api(path, token, body) {
    const response = await fetch('https://api.github.com' + path, { method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'yolo-managed-feedback', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok)
        throw new Error('App access unavailable');
    return JSON.parse(await boundedText(response.body, 1024 * 1024));
}
/** Publisher credentials are used only by this YOLO-owned handler, never exported. */
export function createManagedFeedbackService(registrations) {
    if (!Array.isArray(registrations) || registrations.length > 50)
        throw new Error('Invalid registry');
    const ids = new Set(), databases = new Set(), repos = new Set(), tokens = new Set();
    for (const c of registrations) {
        if (!exact(c, ['appId', 'origin', 'repository', 'repositoryId', 'installationId', 'installationOwnerId', 'databaseBinding', 'tokenSha256', 'expiresAt', 'maxRequestsPerDay', 'responders', 'worker', 'tracking']) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(c.appId) || !httpsOrigin(c.origin) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(c.repository) || !positive(c.repositoryId) || !positive(c.installationId) || !positive(c.installationOwnerId) || !/^[A-Z][A-Z0-9_]{0,63}$/.test(c.databaseBinding) || !HASH.test(c.tokenSha256) || !positive(c.expiresAt) || !positive(c.maxRequestsPerDay) || c.maxRequestsPerDay > 10000 || !Array.isArray(c.responders) || c.responders.some(x => !/^[-A-Za-z0-9_\[\]]{1,100}$/.test(x)) || ids.has(c.appId) || databases.has(c.databaseBinding) || repos.has(c.repositoryId) || tokens.has(c.tokenSha256))
            throw new Error('Unsafe managed feedback registration');
        if (c.tracking !== undefined && typeof c.tracking !== 'boolean')
            throw new Error('Invalid tracking profile');
        if (c.worker && (!exact(c.worker, ['subject', 'expiresAt', 'tokenSha256', 'trackingPublish']) || !text(c.worker.subject, 128) || !positive(c.worker.expiresAt) || !HASH.test(c.worker.tokenSha256) || c.worker.trackingPublish !== undefined && typeof c.worker.trackingPublish !== 'boolean' || c.worker.trackingPublish === true && c.tracking !== true))
            throw new Error('Invalid worker grant');
        ids.add(c.appId);
        databases.add(c.databaseBinding);
        repos.add(c.repositoryId);
        tokens.add(c.tokenSha256);
    }
    // Copy trusted configuration; mutation by a caller cannot retarget cached capabilities.
    const registry = new Map(registrations.map(c => [c.appId, structuredClone(c)]));
    const bridges = new Map();
    const cache = new Map();
    async function credential(c, env) {
        const key = env.GITHUB_APP_ID + ':' + c.installationId + ':' + c.repositoryId + ':' + await digest(env.GITHUB_APP_PRIVATE_KEY);
        const old = cache.get(c.appId);
        if (old && old.key === key && old.expires > Date.now() + 60000)
            return old;
        const signed = await jwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
        const app = await api('/app', signed), installation = await api('/app/installations/' + c.installationId, signed);
        if (app.id !== Number(env.GITHUB_APP_ID) || typeof app.slug !== 'string' || !/^[a-z0-9-]{1,100}$/.test(app.slug) || installation.app_id !== app.id || installation.id !== c.installationId || installation.account?.id !== c.installationOwnerId || installation.suspended_at !== null)
            throw new Error('App installation mismatch');
        const access = await api('/app/installations/' + c.installationId + '/access_tokens', signed, { repository_ids: [c.repositoryId], permissions: { issues: 'write', metadata: 'read' } });
        const expiry = Date.parse(access.expires_at);
        if (typeof access.token !== 'string' || access.token.length < 20 || access.token.length > 20000 || !Number.isFinite(expiry) || expiry <= Date.now() + 60000 || expiry > Date.now() + 7200000 || access.permissions?.issues !== 'write' || access.permissions?.metadata !== 'read' || Object.keys(access.permissions).some(x => !['issues', 'metadata'].includes(x)))
            throw new Error('Token scope mismatch');
        const scope = await api('/installation/repositories?per_page=2', access.token), repo = scope.repositories?.[0];
        if (scope.total_count !== 1 || scope.repositories?.length !== 1 || repo.id !== c.repositoryId || repo.owner?.id !== c.installationOwnerId || repo.full_name?.toLowerCase() !== c.repository.toLowerCase())
            throw new Error('Repository mismatch');
        const result = { key, token: access.token, expires: expiry, bot: app.slug + '[bot]' };
        cache.set(c.appId, result);
        return result;
    }
    return { async fetch(request, env) {
            if (env.MANAGED_FEEDBACK_ENABLED !== 'true')
                return managedJSON('Managed feedback is disabled', 503);
            const u = new URL(request.url), route = /^\/v1\/apps\/([a-z0-9-]+)\/feedback$/.exec(u.pathname), c = route ? registry.get(route[1]) : undefined;
            if (!c || u.search || request.method !== 'POST')
                return managedJSON('Not found', 404);
            const bearer = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(request.headers.get('Authorization') ?? '');
            if (!bearer || c.expiresAt <= Date.now())
                return managedJSON('Client authentication required', 401);
            const hash = await digest(bearer[1]);
            let different = 0;
            for (let i = 0; i < 64; i++)
                different |= hash.charCodeAt(i) ^ c.tokenSha256.charCodeAt(i);
            if (different)
                return managedJSON('Client authentication required', 401);
            if (request.headers.get('X-Yolo-Managed-API') !== MANAGED_API || !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? ''))
                return managedJSON('Unsupported managed API', 415);
            const timing = timings('service');
            try {
                const e = JSON.parse(await boundedText(request.body, 98304));
                if (!exact(e, ['method', 'path', 'headers', 'principal', 'body']) || typeof e.method !== 'string' || typeof e.path !== 'string' || !managedRoute(e.path, e.method) || !exact(e.headers, ['owner', 'visibility', 'authorization']) || Object.keys(e.headers).length !== 3 || Object.values(e.headers).some(v => v !== null && !text(v, 1024)) || (e.method === 'POST' ? !text(e.body, 65536) : e.body !== null))
                    return managedJSON('Invalid feedback operation', 400);
                const worker = e.path.startsWith('/yolo/api/v1/worker/');
                let principal = null;
                if (worker) {
                    if (e.principal !== null)
                        return managedJSON('Invalid worker context', 400);
                    if (!c.worker)
                        return managedJSON('Worker access is not configured', 503);
                    const workerBearer = typeof e.headers.authorization === 'string' ? /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(e.headers.authorization) : null;
                    if (!workerBearer || c.worker.expiresAt <= Date.now())
                        return managedJSON('Worker authentication required', 401);
                    const workerHash = await digest(workerBearer[1]);
                    let mismatch = 0;
                    for (let i = 0; i < 64; i++)
                        mismatch |= workerHash.charCodeAt(i) ^ c.worker.tokenSha256.charCodeAt(i);
                    if (mismatch)
                        return managedJSON('Worker authentication required', 401);
                }
                else {
                    if (!exact(e.principal, ['issuer', 'subject', 'emailVerified']) || !text(e.principal.issuer, 2048) || !text(e.principal.subject, 512) || e.principal.emailVerified !== true || e.headers.authorization !== null)
                        return managedJSON('Invalid requester assertion', 403);
                    principal = e.principal;
                }
                const db = env[c.databaseBinding];
                if (!db || typeof db.prepare !== 'function')
                    return managedJSON('Feedback database is unavailable', 503);
                // Distinct binding names must also resolve to distinct runtime databases.
                if ([...registry.values()].some(other => other.appId !== c.appId && env[other.databaseBinding] === db))
                    return managedJSON('Unsafe shared database binding', 503);
                const bound = await db.prepare('SELECT repository FROM yolo_feedback_bridge_identity WHERE singleton=1').bind().first();
                if (bound?.repository.toLowerCase() !== c.repository.toLowerCase())
                    return managedJSON('Feedback repository requires reconciliation', 503);
                const day = Math.floor(Date.now() / 86400000);
                const usage = await db.prepare('INSERT INTO yolo_feedback_service_budget(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used<?').bind(day, c.maxRequestsPerDay).run();
                if (usage.meta.changes !== 1)
                    return managedJSON('Feedback service daily budget reached', 429);
                await db.prepare('DELETE FROM yolo_feedback_service_budget WHERE day<?').bind(day - 7).run();
                const auth = await timing.time('setup', () => credential(c, env));
                let cached = bridges.get(c.appId);
                if (!cached || cached.bot !== auth.bot) {
                    cached = { bot: auth.bot, bridge: createWorkBridge({ repository: c.repository, responders: [...new Set([...c.responders, auth.bot])], authorize: () => true, ...(c.worker ? { worker: { subject: c.worker.subject, expiresAt: c.worker.expiresAt, trackingPublish: c.worker.trackingPublish } } : {}), ...(c.tracking === true ? { tracking: { appId: c.appId, authorizeWork: () => true } } : {}) }) };
                    bridges.set(c.appId, cached);
                }
                const bridge = cached.bridge;
                const headers = new Headers({ 'Origin': c.origin, 'Content-Type': 'application/json' });
                if (request.headers.get('X-Yolo-Read-Cache') === 'v1')
                    headers.set('X-Yolo-Read-Cache', 'v1');
                if (request.headers.get('Cache-Control') === 'no-cache')
                    headers.set('Cache-Control', 'no-cache');
                if (e.headers.owner !== null)
                    headers.set('X-Feedback-Owner', String(e.headers.owner));
                if (e.headers.visibility !== null)
                    headers.set('X-Feedback-Visibility', String(e.headers.visibility));
                if (e.headers.authorization !== null)
                    headers.set('Authorization', String(e.headers.authorization));
                const response = await bridge.fetch(new Request(c.origin + e.path, { method: e.method, headers, signal: request.signal, ...(e.method === 'POST' ? { body: e.body } : {}) }), { APP_DB: db, PUBLIC_ORIGIN: c.origin, FEEDBACK_GITHUB_TOKEN: auth.token, ...(c.worker ? { WORK_BRIDGE_TOKEN_SHA256: c.worker.tokenSha256 } : {}) }, { principal, signal: request.signal, workRead: request.headers.get('X-Yolo-Shared-Work') === 'true' });
                if (response && response.status >= 400)
                    cache.delete(c.appId);
                return timing.finish(response ?? managedJSON('Not found', 404));
            }
            catch {
                cache.delete(c.appId);
                return managedJSON('Managed feedback is unavailable. Keep your draft and check its status.', 503);
            }
        } };
}
