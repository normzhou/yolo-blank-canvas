import { boundedText } from './managed-client.js';
import { API, UUID, digest, exact, text } from './contract.js';
import { TRACKING } from './tracking-contract.js';
export * from './tracking-contract.js';
const MARKER = '<!-- yolo:tracking:v1 -->\n';
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
class TrackingError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
function check(value, message = 'Invalid tracking data.') { if (!value)
    throw new TrackingError(400, message); }
const uuid = (v) => typeof v === 'string' && UUID.test(v);
const positive = (v) => Number.isSafeInteger(v) && Number(v) > 0;
const short = (v, max) => typeof v === 'string' && [...v].length <= max;
const record = (v, keys) => exact(v, keys) && Object.keys(v).length === keys.length;
function workData(v) {
    check(record(v, ['audience', 'title', 'summary', 'next', 'stage', 'delivery', 'milestones']));
    check(['app', 'hidden'].includes(v.audience) && text(v.title, 120) && text(v.summary, 1600) && short(v.next, 1000) && short(v.stage, 80));
    let delivery = null;
    if (v.delivery !== null) {
        const d = v.delivery;
        check(d && typeof d === 'object');
        if (d.state === 'pending') {
            check(record(d, ['state']));
            delivery = { state: 'pending' };
        }
        else {
            check(record(d, ['state', 'version', 'verifiedAt', 'evidence']) && ['available', 'unavailable'].includes(d.state) && text(d.version, 100) && positive(d.verifiedAt) && d.verifiedAt <= Date.now() + 120000 && text(d.evidence, 1000));
            delivery = { state: d.state, version: d.version, verifiedAt: d.verifiedAt, evidence: d.evidence };
        }
    }
    check(Array.isArray(v.milestones) && v.milestones.length <= 12);
    const milestones = v.milestones.map((m) => { check(record(m, ['at', 'text']) && positive(m.at) && m.at <= Date.now() + 120000 && text(m.text, 600)); return { at: m.at, text: m.text }; });
    return { audience: v.audience, title: v.title, summary: v.summary, next: v.next, stage: v.stage, delivery, milestones };
}
function requestData(v) {
    check(record(v, ['decision', 'interpretation', 'reason', 'next', 'coverage']));
    check(['received', 'needs-details', 'tracked', 'duplicate', 'answered', 'deferred', 'not-planned'].includes(v.decision) && text(v.interpretation, 1600) && text(v.reason, 1600) && short(v.next, 1000));
    check(Array.isArray(v.coverage) && v.coverage.length <= 12);
    const coverage = v.coverage.map((c) => { check(record(c, ['workId', 'scope', 'disposition']) && (c.workId === null || uuid(c.workId)) && text(c.scope, 600) && ['tracked', 'declined', 'superseded'].includes(c.disposition) && (c.disposition !== 'tracked' || c.workId !== null)); return { workId: c.workId, scope: c.scope, disposition: c.disposition }; });
    return { decision: v.decision, interpretation: v.interpretation, reason: v.reason, next: v.next, coverage };
}
/** New grants are opt-in. The ledger is an intent/source index, not workflow authority. */
export function createTracking(config, repository, responders, isRejected = () => false) {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(config.appId) || typeof config.authorizeWork !== 'function')
        throw new Error('Invalid tracking configuration.');
    const cache = new Map();
    const protectedLabels = new Set(['yolo:manual', 'manual', 'yolo:control']);
    function eligible(issue, number, work = false) { return issue?.number === number && !issue.pull_request && issue.locked === false && Array.isArray(issue.labels) && !issue.labels.some((l) => protectedLabels.has(typeof l === 'string' ? l : l.name)) && (!work || issue.labels.some((l) => (typeof l === 'string' ? l : l.name) === 'yolo:work')); }
    return { async handle(request, env, github, access) {
            const path = new URL(request.url).pathname.replace('/yolo/api/v1/', '');
            const db = env.APP_DB, app = config.appId, base = '/repos/' + repository + '/issues';
            const stmt = (sql, ...values) => db.prepare(sql).bind(...values);
            const latest = (kind, subject) => stmt("SELECT * FROM yolo_tracking_publications WHERE app_id=? AND kind=? AND subject=? AND phase!='rejected' ORDER BY sequence DESC LIMIT 1", app, kind, subject).first();
            async function source(row) {
                const issue = await github(base + '/' + row.issue);
                if (!eligible(issue, row.issue, row.kind === 'work'))
                    throw new TrackingError(404, 'Tracking is unavailable.');
                if (row.phase !== 'sent' || !row.comment)
                    throw new TrackingError(409, 'Publication is awaiting confirmation.');
                const c = await github('/repos/' + repository + '/issues/comments/' + row.comment);
                if (c?.id !== row.comment || c.issue_url?.toLowerCase() !== ('https://api.github.com' + base + '/' + row.issue).toLowerCase() || c.body !== row.payload || !responders.includes(c.user?.login))
                    throw new TrackingError(503, 'Tracking source needs reconciliation.');
                const data = JSON.parse(row.payload.slice(MARKER.length));
                if (!row.payload.startsWith(MARKER) || data.api !== TRACKING || data.appId !== app || data.origin !== env.PUBLIC_ORIGIN || data.operation !== row.id || data.subject !== row.subject || data.issue !== row.issue || data.actor !== row.actor || data.kind !== row.kind || data.publishedAt !== row.created)
                    throw new TrackingError(503, 'Tracking source needs reconciliation.');
                return { issue, data };
            }
            async function card(subject) {
                const row = await latest('work', subject);
                if (!row || row.phase !== 'sent')
                    return null;
                const cached = cache.get(subject);
                if (cached?.id === row.id && cached.until > Date.now())
                    return cached.card;
                let found;
                try {
                    found = await source(row);
                }
                catch (e) {
                    if (e instanceof TrackingError && e.status === 404)
                        return null;
                    throw e;
                }
                const v = workData(found.data.view);
                if (v.audience !== 'app')
                    return null;
                const labels = found.issue.labels.map((l) => typeof l === 'string' ? l : l.name);
                const states = labels.filter((l) => l.startsWith('yolo:state:'));
                let state = 'unknown';
                if (found.issue.state === 'open' && states.length === 1) {
                    const s = states[0].slice(11);
                    if (['queued', 'active', 'waiting', 'deferred'].includes(s))
                        state = s;
                }
                if (found.issue.state === 'closed' && states.length === 0)
                    state = found.issue.state_reason === 'not_planned' ? 'not-planned' : 'closed';
                let delivery = v.delivery === null ? { state: 'unreleased' } : v.delivery.state === 'pending' ? { state: 'pending' } : { state: v.delivery.state, version: v.delivery.version, verifiedAt: v.delivery.verifiedAt };
                if (state === 'unknown' || delivery.state === 'available' && (state !== 'closed' || found.issue.state_reason !== 'completed'))
                    delivery = { state: 'unknown' };
                const result = { id: subject, title: v.title, summary: v.summary, next: v.next, stage: v.stage, state, delivery, milestones: v.milestones, updated: row.created, checkedAt: Date.now() };
                if (cache.size >= 100)
                    cache.delete(cache.keys().next().value);
                cache.set(subject, { id: row.id, until: Date.now() + 30000, card: result });
                return result;
            }
            async function receipt(row) {
                if (row.phase === 'writing') {
                    const issue = await github(base + '/' + row.issue);
                    if (!eligible(issue, row.issue, row.kind === 'work'))
                        throw new TrackingError(403, 'This record is reserved or unavailable.');
                    const matches = [];
                    let complete = false;
                    const since = encodeURIComponent(new Date(row.created - 300000).toISOString());
                    for (let page = 1; page <= 2; page++) {
                        const list = await github(base + '/' + row.issue + '/comments?per_page=100&page=' + page + '&since=' + since);
                        if (!Array.isArray(list))
                            throw new TrackingError(503, 'Publication source is unavailable.');
                        matches.push(...list.filter(c => c.body === row.payload && responders.includes(c.user?.login) && positive(c.id) && c.issue_url?.toLowerCase() === ('https://api.github.com' + base + '/' + row.issue).toLowerCase()));
                        if (list.length < 100) {
                            complete = true;
                            break;
                        }
                    }
                    if (complete && matches.length === 1)
                        await stmt("UPDATE yolo_tracking_publications SET phase='sent',comment=? WHERE app_id=? AND id=? AND actor=? AND phase='writing'", matches[0].id, app, row.id, row.actor).run();
                }
                const saved = await stmt('SELECT * FROM yolo_tracking_publications WHERE app_id=? AND id=?', app, row.id).first();
                return response({ api: API, tracking: TRACKING, id: row.id, subject: row.subject, phase: saved.phase, comment: saved.comment }, saved.phase === 'sent' ? 201 : 202);
            }
            try {
                if (access.actor) {
                    const receiptRoute = /^worker\/tracking\/receipts\/([0-9a-f-]+)$/.exec(path);
                    if (receiptRoute && request.method === 'GET') {
                        check(UUID.test(receiptRoute[1]));
                        const row = await stmt('SELECT * FROM yolo_tracking_publications WHERE app_id=? AND id=? AND actor=?', app, receiptRoute[1], access.actor).first();
                        if (!row)
                            throw new TrackingError(404, 'Operation not found.');
                        return await receipt(row);
                    }
                    const detail = /^worker\/tracking\/(work|requests)\/([0-9a-f-]+)$/.exec(path);
                    if (detail && request.method === 'GET') {
                        check(UUID.test(detail[2]));
                        const row = await latest(detail[1] === 'work' ? 'work' : 'request', detail[2]);
                        if (!row)
                            return response({ api: API, tracking: TRACKING, publication: null, view: null });
                        const s = await source(row);
                        return response({ api: API, tracking: TRACKING, publication: row.id, view: s.data.view, issue: row.issue });
                    }
                    if (request.method === 'POST' && ['worker/tracking/work', 'worker/tracking/requests'].includes(path)) {
                        check(/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? ''));
                        let input;
                        try {
                            input = JSON.parse(await boundedText(request.body, 32768));
                        }
                        catch {
                            throw new TrackingError(400, 'Invalid or oversized tracking JSON.');
                        }
                        const kind = path.endsWith('/work') ? 'work' : 'request';
                        check(record(input, kind === 'work' ? ['id', 'base', 'workId', 'issue', 'view'] : ['id', 'base', 'requestId', 'view']));
                        check(uuid(input.id) && (input.base === null || uuid(input.base)));
                        const subject = kind === 'work' ? input.workId : input.requestId;
                        check(typeof subject === 'string' && UUID.test(subject));
                        let issue;
                        if (kind === 'work') {
                            check(positive(input.issue));
                            issue = input.issue;
                        }
                        else {
                            const row = await stmt("SELECT * FROM yolo_feedback_requests WHERE id=? AND phase='sent'", subject).first();
                            if (!row?.issue)
                                throw new TrackingError(404, 'Confirmed request not found.');
                            issue = row.issue;
                        }
                        const view = kind === 'work' ? workData(input.view) : requestData(input.view);
                        const inputHash = await digest(JSON.stringify({ kind, subject, issue, base: input.base, view }));
                        let operation = await stmt('SELECT * FROM yolo_tracking_publications WHERE app_id=? AND id=?', app, input.id).first();
                        if (operation) {
                            if (operation.actor !== access.actor || operation.subject !== subject || operation.kind !== kind)
                                throw new TrackingError(404, 'Operation not found.');
                            if (operation.input_digest !== inputHash)
                                throw new TrackingError(409, 'Operation ID belongs to different publication data.');
                            if (operation.phase !== 'staged')
                                return await receipt(operation);
                        }
                        const pending = await latest(kind, subject);
                        if (pending && pending.phase !== 'sent' && pending.id !== operation?.id)
                            throw new TrackingError(409, 'A publication for this record is awaiting confirmation.');
                        const prior = await stmt("SELECT * FROM yolo_tracking_publications WHERE app_id=? AND kind=? AND subject=? AND phase='sent' ORDER BY sequence DESC LIMIT 1", app, kind, subject).first();
                        if ((prior?.id ?? null) !== input.base)
                            throw new TrackingError(409, 'Publication base changed; read current tracking before publishing.');
                        if (prior) {
                            await source(prior);
                            if (prior.issue !== issue)
                                throw new TrackingError(409, 'Work source cannot be rebound.');
                        }
                        const target = await github(base + '/' + issue);
                        if (!eligible(target, issue, kind === 'work'))
                            throw new TrackingError(403, 'This record is reserved or unavailable.');
                        if (kind === 'request')
                            for (const c of view.coverage) {
                                if (c.workId) {
                                    const w = await card(c.workId);
                                    if (!w)
                                        throw new TrackingError(400, 'Coverage requires app-visible work.');
                                }
                            }
                        const now = Date.now(), payload = MARKER + JSON.stringify({ api: TRACKING, appId: app, origin: env.PUBLIC_ORIGIN, operation: input.id, actor: access.actor, kind, subject, issue, base: input.base, publishedAt: now, view });
                        if (!operation)
                            await stmt("INSERT OR IGNORE INTO yolo_tracking_publications(app_id,id,kind,subject,issue,actor,input_digest,payload,created,phase) SELECT ?,?,?,?,?,?,?,?,?,'staged' WHERE (SELECT id FROM yolo_tracking_publications WHERE app_id=? AND kind=? AND subject=? AND phase='sent' ORDER BY sequence DESC LIMIT 1) IS ?", app, input.id, kind, subject, issue, access.actor, inputHash, payload, now, app, kind, subject, input.base).run();
                        operation = await stmt('SELECT * FROM yolo_tracking_publications WHERE app_id=? AND id=?', app, input.id).first();
                        if (!operation)
                            throw new TrackingError(409, 'A publication for this record is pending.');
                        if (operation.input_digest !== inputHash || operation.actor !== access.actor)
                            throw new TrackingError(409, 'Publication claim changed.');
                        const claimed = await stmt("UPDATE yolo_tracking_publications SET phase='writing' WHERE app_id=? AND id=? AND phase='staged'", app, input.id).run();
                        if (claimed.meta.changes === 1) {
                            cache.delete(subject);
                            try {
                                const c = await github(base + '/' + issue + '/comments', { method: 'POST', body: JSON.stringify({ body: operation.payload }) });
                                if (c.body !== operation.payload || !positive(c.id) || !responders.includes(c.user?.login) || c.issue_url?.toLowerCase() !== ('https://api.github.com' + base + '/' + issue).toLowerCase())
                                    throw new Error('Unverified publication.');
                                await stmt("UPDATE yolo_tracking_publications SET phase='sent',comment=? WHERE app_id=? AND id=? AND phase='writing'", c.id, app, input.id).run();
                            }
                            catch (e) {
                                if (isRejected(e))
                                    await stmt("UPDATE yolo_tracking_publications SET phase='rejected' WHERE app_id=? AND id=? AND phase='writing'", app, input.id).run();
                            }
                        }
                        return await receipt(operation);
                    }
                }
                const personal = /^tracking\/requests\/([0-9a-f-]+)$/.exec(path);
                if (personal && request.method === 'GET' && access.owner) {
                    check(UUID.test(personal[1]));
                    const owned = await stmt("SELECT id FROM yolo_feedback_requests WHERE id=? AND owner=? AND phase='sent'", personal[1], access.owner).first();
                    if (!owned)
                        throw new TrackingError(404, 'Request not found.');
                    const row = await latest('request', personal[1]);
                    if (!row)
                        return response({ api: API, tracking: TRACKING, requestId: personal[1], progress: null });
                    const s = await source(row), view = requestData(s.data.view);
                    const coverage = [];
                    let reconciled = true;
                    for (const c of view.coverage) {
                        if (!c.workId || !access.workRead) {
                            coverage.push({ scope: c.scope, disposition: c.disposition, work: null });
                            continue;
                        }
                        const work = await card(c.workId);
                        if (!work) {
                            reconciled = false;
                            continue;
                        }
                        coverage.push({ scope: c.scope, disposition: c.disposition, work });
                        if (work.state === 'unknown' || work.delivery.state === 'unknown')
                            reconciled = false;
                    }
                    return response({ api: API, tracking: TRACKING, requestId: personal[1], progress: { decision: view.decision, interpretation: view.interpretation, reason: view.reason, next: view.next, coverage, updated: row.created, needsReconciliation: !reconciled } });
                }
                const board = /^(?:worker\/)?tracking\/work(?:\/page\/([0-9a-f-]+))?$/.exec(path);
                if (board && request.method === 'GET' && (access.actor || access.workRead)) {
                    let before = Number.MAX_SAFE_INTEGER;
                    if (board[1]) {
                        check(UUID.test(board[1]));
                        const cursor = await stmt("SELECT sequence FROM yolo_tracking_publications WHERE app_id=? AND id=? AND kind='work'", app, board[1]).first();
                        if (!cursor)
                            throw new TrackingError(404, 'Page not found.');
                        before = cursor.sequence;
                    }
                    const rows = (await stmt("SELECT p.* FROM yolo_tracking_publications p WHERE p.app_id=? AND p.kind='work' AND p.phase!='rejected' AND p.sequence<? AND NOT EXISTS(SELECT 1 FROM yolo_tracking_publications n WHERE n.app_id=p.app_id AND n.kind=p.kind AND n.subject=p.subject AND n.phase!='rejected' AND n.sequence>p.sequence) ORDER BY p.sequence DESC LIMIT 25", app, before).all()).results;
                    const work = [];
                    let needsReconciliation = false;
                    for (const row of rows.slice(0, 24)) {
                        if (row.phase !== 'sent')
                            needsReconciliation = true;
                        const value = await card(row.subject);
                        if (value) {
                            work.push(value);
                            if (value.state === 'unknown' || value.delivery.state === 'unknown')
                                needsReconciliation = true;
                        }
                    }
                    return response({ api: API, tracking: TRACKING, work, next: rows.length > 24 ? rows[23].id : null, checkedAt: Date.now(), needsReconciliation });
                }
                throw new TrackingError(403, 'Tracking access is unavailable.');
            }
            catch (e) {
                return response({ error: e instanceof TrackingError ? e.message : 'Tracking is unavailable; preserve publication IDs.', code: 'tracking_unavailable' }, e instanceof TrackingError ? e.status : 503);
            }
        } };
}
