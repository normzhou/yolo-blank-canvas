import { forms } from './forms.mjs';
import { assets } from './ui-assets.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PUBLIC_REPLY = '<!-- yolo:public-feedback:v1 -->\n';
const headers = {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
};
class Problem extends Error {
    constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new Problem(status, message, code); };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => keys.includes(k));
const string = (value, max = 4000) => typeof value === 'string' && [...value].length >= 1 && [...value].length <= max;
const hash = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
async function boundedJSON(stream, max) {
    const reader = stream?.getReader();
    if (!reader)
        fail(400, 'Missing JSON body.');
    const parts = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            length += value.length;
            if (length > max)
                fail(413, 'Body too large.');
            parts.push(value);
        }
    }
    finally {
        await reader.cancel().catch(() => { });
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
    }
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
    catch {
        fail(400, 'Invalid JSON.');
    }
}
function requestPayload(data) {
    if (!exact(data, ['id', 'template', 'input']) || (typeof data.id !== 'string' || !UUID.test(data.id)))
        fail(400, 'Invalid request.');
    const form = forms.find(f => f.id === data.template);
    if (!form || !exact(data.input, Object.keys(form.input_schema.properties)))
        fail(400, 'Invalid form.');
    for (const key of form.input_schema.required)
        if (!(key in data.input))
            fail(400, 'Missing required field.');
    for (const [key, value] of Object.entries(data.input)) {
        const spec = form.input_schema.properties[key];
        if (!string(value, spec.maxLength))
            fail(400, 'Invalid field.');
    }
    // Field ordering is canonical, so a repeat with equivalent JSON reuses its intent.
    const input = {};
    for (const key of Object.keys(form.input_schema.properties))
        if (key in data.input)
            input[key] = data.input[key];
    return { title: `[yolo-feedback:${data.id}] ${form.title}`, payload: JSON.stringify({ template: { id: form.id, version: form.version }, input }) };
}
const publicState = issue => ({ state: issue.state === 'closed' ? 'closed' : 'open', workflow: (issue.labels ?? []).map(l => typeof l === 'string' ? l : l.name).filter(n => /^yolo:state:[a-z-]+$/.test(n)) });
const view = row => ({ id: row.id, preview: row.payload ? Object.values(JSON.parse(row.payload).input)[0]?.slice(0, 80) : '', title: row.title.replace(/^\[yolo-feedback:[^\]]+\] /, ''), phase: row.phase, created: row.created });
/** Mount after the client's verified identity adapter. A browser field/header is never a principal. */
export function createFeedbackBridge({ repository, responders, authorize }) {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) || !Array.isArray(responders) || responders.some(x => !/^[a-zA-Z0-9_[\]-]+$/.test(x)) || typeof authorize !== 'function')
        throw new Error('Invalid trusted feedback configuration.');
    const approved = new Set(responders);
    return { async fetch(request, env, context = {}) {
            const path = new URL(request.url).pathname;
            if (path !== '/feedback' && !path.startsWith('/feedback/'))
                return null;
            try {
                if (assets[path] && path !== '/feedback/' && request.method === 'GET')
                    return new Response(assets[path].body, { headers: { ...headers, 'Content-Type': assets[path].type } });
                const p = context.principal;
                if (!p || !string(p.issuer, 2048) || !string(p.subject, 512) || p.emailVerified !== true || await authorize(p) !== true) {
                    if (p)
                        fail(403, 'Feedback is unavailable for this account.', 'feedback_forbidden');
                    if ((path === '/feedback' || path === '/feedback/') && request.method === 'GET')
                        return new Response('<!doctype html><title>Feedback</title><form method="post" action="/auth/yolo/login"><button>Sign in to share feedback</button></form>', { status: 401, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
                    fail(403, 'Sign in to share feedback.', 'login_required');
                }
                if ((path === '/feedback' || path === '/feedback/') && request.method === 'GET')
                    return new Response(assets['/feedback/'].body, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
                if (!env.APP_DB || typeof env.FEEDBACK_GITHUB_TOKEN !== 'string' || !env.FEEDBACK_GITHUB_TOKEN)
                    fail(503, 'Feedback is not configured.');
                const owner = await hash(`${repository}\0${p.issuer}\0${p.subject}`);
                if (request.headers.get('X-Feedback-Owner') && request.headers.get('X-Feedback-Owner') !== owner)
                    fail(409, 'Your signed-in account changed. Reload before continuing.');
                const db = env.APP_DB;
                const stmt = (sql, ...args) => db.prepare(sql).bind(...args);
                if (request.method === 'POST') {
                    let origin;
                    try {
                        origin = new URL(env.PUBLIC_ORIGIN).origin;
                    }
                    catch {
                        fail(503, 'Feedback is not configured.');
                    }
                    if (request.headers.get('X-Feedback-Owner') !== owner)
                        fail(409, 'Reload feedback before sending.');
                    if (request.headers.get('Origin') !== origin || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? ''))
                        fail(403, 'Invalid request origin or content type.');
                }
                async function github(resource, init = {}) {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 8000);
                    const abort = () => controller.abort();
                    context.signal?.addEventListener('abort', abort, { once: true });
                    try {
                        if (context.signal?.aborted)
                            controller.abort();
                        const response = await fetch(`https://api.github.com${resource}`, { ...init, redirect: 'manual', signal: controller.signal, headers: {
                                'Authorization': `Bearer ${env.FEEDBACK_GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'yolo-client-feedback', 'Content-Type': 'application/json'
                            } });
                        if (!response.ok) {
                            const error = new Error('GitHub unavailable');
                            error.status = response.status;
                            throw error;
                        }
                        return await boundedJSON(response.body, 1024 * 1024);
                    }
                    finally {
                        clearTimeout(timer);
                        context.signal?.removeEventListener('abort', abort);
                    }
                }
                const base = `/repos/${repository}/issues`;
                function checkIssue(issue, number) {
                    if (!Number.isSafeInteger(issue?.number) || issue.number !== number || issue.pull_request || !['open', 'closed'].includes(issue.state))
                        fail(503, 'Request could not be verified.');
                    const labels = (issue.labels ?? []).map(l => typeof l === 'string' ? l : l.name);
                    if (issue.locked || labels.includes('manual') || labels.includes('yolo:manual') || labels.includes('yolo:control'))
                        fail(403, 'This request is unavailable through feedback.');
                }
                async function comments(number) {
                    const result = [];
                    for (let page = 1; page <= 2; page++) {
                        const items = await github(`${base}/${number}/comments?per_page=100&page=${page}`);
                        if (!Array.isArray(items))
                            throw new Error('Invalid comments');
                        result.push(...items);
                        if (items.length < 100)
                            break;
                    }
                    return result;
                }
                async function owned(id) {
                    if (!UUID.test(id))
                        fail(404, 'Request not found.');
                    const row = await stmt('SELECT * FROM yolo_feedback_requests WHERE id=? AND owner=?', id, owner).first();
                    if (!row)
                        fail(404, 'Request not found.');
                    return row;
                }
                async function reconcile(row) {
                    if (row.phase !== 'writing' || row.issue)
                        return row;
                    // Search is read-only and eventually consistent. No match remains pending; never replay POST.
                    const query = encodeURIComponent(`repo:${repository} is:issue in:title "yolo-feedback:${row.id}"`);
                    const result = await github(`/search/issues?q=${query}&per_page=10`);
                    if (!Array.isArray(result.items) || result.incomplete_results || result.items.length !== 1)
                        return row;
                    const item = result.items[0];
                    if (!Number.isSafeInteger(item.number))
                        return row;
                    const issue = await github(`${base}/${item.number}`);
                    checkIssue(issue, item.number);
                    const created = Date.parse(issue.created_at);
                    if (issue.title !== row.title || issue.body !== row.payload || !Number.isFinite(created) || created < row.created - 60000 || created > Date.now() + 60000)
                        return row;
                    await stmt("UPDATE yolo_feedback_requests SET phase='sent',issue=? WHERE id=? AND owner=? AND phase='writing'", issue.number, row.id, owner).run();
                    return { ...row, phase: 'sent', issue: issue.number };
                }
                async function send(table, row, resource, body, resultKey) {
                    const claimed = await stmt(`UPDATE ${table} SET phase='writing' WHERE id=? AND owner=? AND phase='staged'`, row.id, owner).run();
                    if (claimed.meta.changes !== 1)
                        return;
                    try {
                        const result = await github(resource, { method: 'POST', body: JSON.stringify(body) });
                        const number = result[resultKey];
                        if (!Number.isSafeInteger(number) || number <= 0)
                            throw new Error('Unverified write result');
                        const column = table === 'yolo_feedback_requests' ? 'issue' : 'comment';
                        await stmt(`UPDATE ${table} SET phase='sent',${column}=? WHERE id=? AND owner=? AND phase='writing'`, number, row.id, owner).run();
                    }
                    catch (error) {
                        // A definite rejection can be reported. All ambiguous effects retain their claimed intent.
                        if ([401, 403, 404, 422].includes(error.status))
                            await stmt(`UPDATE ${table} SET phase='rejected' WHERE id=? AND owner=? AND phase='writing'`, row.id, owner).run();
                    }
                }
                if (path === '/feedback/api/session' && request.method === 'GET')
                    return json({ owner, forms });
                if (path === '/feedback/api/requests' && request.method === 'GET') {
                    const rows = await stmt('SELECT id,title,payload,phase,created FROM yolo_feedback_requests WHERE owner=? ORDER BY created DESC LIMIT 100', owner).all();
                    return json({ requests: rows.results.map(view) });
                }
                if (path === '/feedback/api/requests' && request.method === 'POST') {
                    const data = await boundedJSON(request.body, 65536);
                    const { title, payload } = requestPayload(data);
                    const digest = await hash(payload);
                    const now = Date.now();
                    await stmt("INSERT OR IGNORE INTO yolo_feedback_requests(id,owner,title,payload,digest,created,phase) SELECT ?,?,?,?,?,?,'staged' WHERE (SELECT count(*) FROM yolo_feedback_requests WHERE owner=? AND created>?)<10", data.id, owner, title, payload, digest, now, owner, now - 86400000).run();
                    const row = await stmt('SELECT * FROM yolo_feedback_requests WHERE id=?', data.id).first();
                    if (!row)
                        fail(429, 'Daily feedback limit reached. Keep your draft and try later.');
                    if (row.owner !== owner)
                        fail(404, 'Request not found.');
                    if (row.digest !== digest)
                        fail(409, 'This request ID already belongs to a different draft.');
                    await send('yolo_feedback_requests', row, base, { title, body: payload }, 'number');
                    const saved = await owned(row.id);
                    return json(view(saved), saved.phase === 'sent' ? 201 : 202);
                }
                const route = /^\/feedback\/api\/requests\/([^/]+)(\/replies)?$/.exec(path);
                if (!route)
                    fail(404, 'Not found.');
                let row = await owned(route[1]);
                if (!route[2] && request.method === 'GET') {
                    row = await reconcile(row);
                    const replyRows = (await stmt('SELECT * FROM yolo_feedback_replies WHERE request_id=? AND owner=? ORDER BY created', row.id, owner).all()).results;
                    if (!row.issue)
                        return json({ ...view(row), input: JSON.parse(row.payload).input, replies: replyRows.map(r => ({ id: r.id, message: JSON.parse(r.payload).message, phase: r.phase, created: r.created })), responses: [], status: null });
                    const issue = await github(`${base}/${row.issue}`);
                    checkIssue(issue, row.issue);
                    const items = await comments(row.issue);
                    for (const reply of replyRows)
                        if (reply.phase === 'writing') {
                            const match = items.find(c => c.body === reply.payload && Number.isSafeInteger(c.id));
                            if (match) {
                                await stmt("UPDATE yolo_feedback_replies SET phase='sent',comment=? WHERE id=? AND owner=? AND phase='writing'", match.id, reply.id, owner).run();
                                reply.phase = 'sent';
                            }
                        }
                    const responses = [];
                    for (const c of items) {
                        if (!approved.has(c.user?.login) || typeof c.body !== 'string' || !c.body.startsWith(PUBLIC_REPLY))
                            continue;
                        try {
                            const value = JSON.parse(c.body.slice(PUBLIC_REPLY.length));
                            if (exact(value, ['request_id', 'message', 'id']) && (value.id === undefined || (typeof value.id === 'string' && UUID.test(value.id))) && value.request_id === row.id && string(value.message, 16000))
                                responses.push({ message: value.message, ...(Number.isFinite(Date.parse(c.created_at)) ? { created: Date.parse(c.created_at) } : {}) });
                        }
                        catch { /* Private comments stay private. */ }
                    }
                    return json({ ...view(row), input: JSON.parse(row.payload).input, status: publicState(issue), replies: replyRows.map(r => ({ id: r.id, message: JSON.parse(r.payload).message, phase: r.phase, created: r.created })), responses });
                }
                if (route[2] && request.method === 'POST') {
                    if (row.phase !== 'sent' || !row.issue)
                        fail(409, 'Wait for the request to be confirmed.');
                    const issue = await github(`${base}/${row.issue}`);
                    checkIssue(issue, row.issue);
                    const data = await boundedJSON(request.body, 65536);
                    if (!exact(data, ['id', 'message']) || (typeof data.id !== 'string' || !UUID.test(data.id)) || !string(data.message))
                        fail(400, 'Invalid reply.');
                    const payload = JSON.stringify({ kind: 'requester-reply', request_id: row.id, id: data.id, message: data.message });
                    const digest = await hash(payload);
                    const now = Date.now();
                    await stmt("INSERT OR IGNORE INTO yolo_feedback_replies(id,request_id,owner,payload,digest,created,phase) SELECT ?,?,?,?,?,?,'staged' WHERE (SELECT count(*) FROM yolo_feedback_replies WHERE owner=? AND created>?)<20", data.id, row.id, owner, payload, digest, now, owner, now - 86400000).run();
                    const reply = await stmt('SELECT * FROM yolo_feedback_replies WHERE id=?', data.id).first();
                    if (!reply)
                        fail(429, 'Daily reply limit reached. Keep your draft and try later.');
                    if (reply.owner !== owner || reply.request_id !== row.id)
                        fail(404, 'Reply not found.');
                    if (reply.digest !== digest)
                        fail(409, 'This reply ID already belongs to a different draft.');
                    await send('yolo_feedback_replies', reply, `${base}/${row.issue}/comments`, { body: payload }, 'id');
                    const saved = await stmt('SELECT phase FROM yolo_feedback_replies WHERE id=? AND owner=?', data.id, owner).first();
                    return json({ id: reply.id, phase: saved.phase }, saved.phase === 'sent' ? 201 : 202);
                }
                fail(405, 'Method not allowed.');
            }
            catch (error) {
                return json({ error: error instanceof Problem ? error.message : 'Feedback is temporarily unavailable. Keep your draft and refresh to check its status.', ...(error instanceof Problem && error.code ? { code: error.code } : {}) }, error instanceof Problem ? error.status : 503);
            }
        } };
}
