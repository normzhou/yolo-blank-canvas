export { LIBRARY_VERSION } from './version.js';
import { API, UUID } from './contract.js';
/** Mount only in the supplied root. No network/write occurs before open(). */
export function mountFeedback(root, options) {
    if (!root || root.childNodes.length || !/^[A-Za-z0-9_-]{1,80}$/.test(options.app.id))
        throw new Error('Provide an empty mount root and a stable app ID.');
    const apiBase = new URL(options.apiBase ?? '/yolo/api/v1', location.href);
    const stylesheet = new URL(options.stylesheet ?? '/yolo/feedback/styles.css', location.href);
    if (apiBase.origin !== location.origin || stylesheet.origin !== location.origin || apiBase.search || apiBase.hash)
        throw new Error('Feedback API and stylesheet must be same-origin.');
    const tag = 'yolo-feedback-v1';
    if (!customElements.get(tag))
        customElements.define(tag, class extends HTMLElement {
            constructor() { super(); this.attachShadow({ mode: 'open' }); }
        });
    const host = document.createElement(tag), shadow = host.shadowRoot;
    root.append(host);
    shadow.innerHTML = `<link rel="stylesheet"><dialog aria-labelledby="feedback-heading"><header><div><p class="eyebrow"></p><h2 id="feedback-heading">Make it better.</h2></div><button type="button" data-close aria-label="Close feedback">✕</button></header><nav><button type="button" data-compose>New request</button><button type="button" data-history>My requests</button><button type="button" data-refresh>Refresh</button></nav><p class="notice" role="status" aria-live="polite"></p><button type="button" data-login hidden>Sign in</button><main></main><footer>Leave out credentials, account details and private logs.</footer></dialog>`;
    shadow.querySelector('link').href = stylesheet.href;
    shadow.querySelector('.eyebrow').textContent = options.app.name + ' · Feedback';
    const dialog = shadow.querySelector('dialog'), main = shadow.querySelector('main'), status = shadow.querySelector('.notice');
    const login = shadow.querySelector('[data-login]');
    let session, selected, formId;
    let view = 'new', destroyed = false, epoch = 0, contextPage = '';
    let abort = new AbortController(), previousFocus = null;
    const drafts = {};
    const notice = (value) => { status.textContent = value; };
    const storageKey = (name) => `yolo-feedback-v1:${options.app.id}:${session.owner}:${name.startsWith('draft:') ? 'context:' + encodeURIComponent(contextPage) + ':' : ''}${name}`;
    function load(name) { try {
        const value = sessionStorage.getItem(storageKey(name));
        return value ? JSON.parse(value) : undefined;
    }
    catch {
        return undefined;
    } }
    function save(name, value) { try {
        sessionStorage.setItem(storageKey(name), JSON.stringify(value));
    }
    catch {
        notice('Draft storage is unavailable. Keep this page open until sending is confirmed.');
    } }
    async function api(path, body) {
        const response = await fetch(apiBase.href.replace(/\/$/, '') + '/' + path, { credentials: 'same-origin', redirect: 'error', signal: abort.signal,
            headers: { ...(session ? { 'X-Feedback-Owner': session.owner, 'X-Feedback-Visibility': session.visibility } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
        const value = await response.json();
        if (!response.ok) {
            if (([401, 403].includes(response.status) || (response.status === 409 && value.code !== 'visibility_changed'))) {
                main.replaceChildren();
                for (const key of Object.keys(drafts))
                    delete drafts[key];
                session = undefined;
                selected = undefined;
                view = 'new';
                login.hidden = !options.onLogin;
            }
            throw Object.assign(new Error(value.error ?? 'Feedback unavailable. Keep your saved draft.'), { code: value.code });
        }
        return value;
    }
    const node = (tag, label) => { const element = document.createElement(tag); if (label)
        element.textContent = label; return element; };
    function button(label, action) { const b = node('button', label); b.type = 'button'; b.addEventListener('click', () => { Promise.resolve(action()).catch(error => notice(error.message)); }); return b; }
    const fresh = (template) => ({ id: crypto.randomUUID(), template, input: contextPage ? { context: contextPage } : {} });
    function getDraft() {
        const id = formId ?? session.forms[0].id;
        if (!drafts[id]) {
            const saved = load('draft:' + id);
            drafts[id] = saved && UUID.test(saved.id) && saved.template === id && saved.input && typeof saved.input === 'object' ? saved : fresh(id);
        }
        return drafts[id];
    }
    function compose() {
        view = 'new';
        selected = undefined;
        main.replaceChildren();
        const draft = getDraft(), form = session.forms.find(f => f.id === draft.template);
        const fields = node('form'), types = node('div');
        types.className = 'types';
        for (const f of session.forms) {
            const b = button({ 'yolo.bug': 'Problem', 'yolo.feature': 'Idea', 'yolo.question': 'Question', 'yolo.feedback': 'Feedback' }[f.id] ?? f.title, () => { formId = f.id; compose(); });
            b.setAttribute('aria-pressed', String(f.id === form.id));
            types.append(b);
        }
        main.append(types);
        const addField = (field, parent) => {
            const label = node('label', field.label), input = node('textarea'), help = node('p', field.help);
            input.name = field.field;
            input.rows = 3;
            input.required = form.input_schema.required.includes(field.field);
            input.maxLength = form.input_schema.properties[field.field].maxLength;
            input.value = draft.input[field.field] ?? '';
            input.disabled = !!draft.sent;
            label.append(input);
            help.className = 'hint';
            input.addEventListener('input', () => { if (input.value)
                draft.input[field.field] = input.value;
            else
                delete draft.input[field.field]; save('draft:' + draft.template, draft); });
            parent.append(label, help);
        };
        const details = node('details'), summary = node('summary', 'Add details');
        details.append(summary);
        for (const field of form.form.fields)
            addField(field, (form.input_schema.required.includes(field.field) || (field.field === 'context' && !!draft.input.context)) ? fields : details);
        fields.append(details);
        const disclosure = node('p', session.visibility === 'public' ? 'Posted publicly — leave out personal information.' : 'Repository collaborators can access this feedback.');
        disclosure.className = 'disclosure';
        fields.append(disclosure);
        const send = node('button', draft.sent ? 'Awaiting confirmation' : 'Send request');
        send.type = 'submit';
        send.disabled = !!draft.sent;
        fields.append(send);
        main.append(fields);
        if (draft.sent)
            main.append(button('Check saved submission', () => thread(draft.id)));
        fields.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (draft.sent)
                return;
            draft.sent = true;
            save('draft:' + draft.template, draft);
            send.disabled = true;
            notice('Sending…');
            const started = epoch;
            try {
                const result = await api('requests', { id: draft.id, template: draft.template, input: draft.input });
                if (started !== epoch)
                    return;
                if (result.phase === 'sent') {
                    delete drafts[draft.template];
                    save('draft:' + draft.template, fresh(draft.template));
                }
                await thread(result.id);
            }
            catch (error) {
                if (started !== epoch)
                    return;
                if (error.code === 'visibility_changed') {
                    draft.sent = false;
                    save('draft:' + draft.template, draft);
                    await reviewVisibility();
                }
                else
                    notice(error.message + ' Draft retained; refresh to reconcile before sending another request.');
            }
        });
    }
    async function history() {
        view = 'requests';
        selected = undefined;
        const started = epoch;
        const data = await api('requests');
        if (started !== epoch)
            return;
        main.replaceChildren(node('h3', 'My requests'));
        if (!data.requests.length)
            main.append(node('p', 'Your feedback will appear here.'));
        for (const item of data.requests) {
            const b = button((item.preview ? item.preview + ' · ' : '') + item.title + ' · ' + (item.phase === 'sent' ? 'Submitted' : item.phase === 'rejected' ? 'Not submitted' : 'Awaiting confirmation'), () => thread(item.id));
            b.className = 'request';
            main.append(b);
        }
    }
    async function thread(id) {
        if (!UUID.test(id))
            throw new Error('Invalid request reference.');
        const started = epoch, data = await api('requests/' + id);
        if (started !== epoch)
            return;
        selected = id;
        view = 'thread';
        main.replaceChildren(node('h3', Object.values(data.input)[0]?.slice(0, 100) || data.title));
        main.append(node('p', data.status ? `Recorded state: ${data.status.state}. This alone does not verify delivery.` : 'Awaiting confirmation. Refresh checks the saved operation without posting again.'));
        const messages = [
            { text: Object.values(data.input).join('\n\n'), label: 'Your request', created: data.created },
            ...data.replies.map(r => ({ text: r.message, label: r.phase === 'sent' ? 'You' : 'You · ' + r.phase, created: r.created ?? Number.MAX_SAFE_INTEGER })),
            ...data.responses.map(r => ({ text: r.message, label: 'Response', created: r.created ?? Number.MAX_SAFE_INTEGER }))
        ].sort((a, b) => a.created - b.created);
        for (const message of messages) {
            const article = node('article'), label = node('strong', message.label), content = node('p', message.text);
            article.append(label, content);
            main.append(article);
        }
        const draft = Object.values(drafts).find(d => d.id === id);
        if (data.phase === 'rejected' && draft)
            main.append(button('Review rejected draft as a new request', () => { draft.id = crypto.randomUUID(); draft.sent = false; save('draft:' + draft.template, draft); formId = draft.template; compose(); }));
        if (data.phase !== 'sent')
            return;
        if (draft) {
            delete drafts[draft.template];
            save('draft:' + draft.template, fresh(draft.template));
        }
        let reply = load('reply:' + id) ?? { id: crypto.randomUUID(), message: '' };
        const posted = data.replies.find(r => r.id === reply.id);
        if (posted?.phase === 'sent') {
            reply = { id: crypto.randomUUID(), message: '' };
            save('reply:' + id, reply);
        }
        const form = node('form'), label = node('label', 'Add a reply'), input = node('textarea'), send = node('button', 'Send reply');
        input.rows = 3;
        input.maxLength = 4000;
        input.required = true;
        input.value = reply.message;
        input.disabled = !!reply.sent;
        send.type = 'submit';
        send.disabled = !!reply.sent;
        label.append(input);
        form.append(node('p', session.visibility === 'public' ? 'Posted publicly — leave out personal information.' : 'Repository collaborators can access this feedback.'), label, send);
        main.append(form);
        if (posted?.phase === 'rejected')
            main.append(button('Review rejected reply as a new operation', () => { reply = { id: crypto.randomUUID(), message: reply.message }; save('reply:' + id, reply); return thread(id); }));
        input.addEventListener('input', () => { reply.message = input.value; save('reply:' + id, reply); });
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (reply.sent)
                return;
            reply.sent = true;
            save('reply:' + id, reply);
            input.disabled = send.disabled = true;
            try {
                await api('requests/' + id + '/replies', { id: reply.id, message: reply.message });
                if (started === epoch)
                    await thread(id);
            }
            catch (error) {
                if (started !== epoch)
                    return;
                if (error.code === 'visibility_changed') {
                    reply.sent = false;
                    save('reply:' + id, reply);
                    await reviewVisibility();
                }
                else
                    notice(error.message + ' Reply retained; refresh to reconcile.');
            }
        });
    }
    async function refresh() {
        const started = epoch, before = session?.owner, current = await api('session');
        if (started !== epoch || destroyed || !dialog.open)
            return;
        if (current.api !== API || !['public', 'private'].includes(current.visibility) || !Array.isArray(current.forms) || !current.forms.length)
            throw new Error('Incompatible feedback API. Drafts retained.');
        if (before && before !== current.owner) {
            for (const key of Object.keys(drafts))
                delete drafts[key];
            selected = undefined;
            formId = undefined;
            view = 'new';
            main.replaceChildren();
        }
        session = current;
        login.hidden = true;
        notice('');
        if (view === 'thread' && selected)
            await thread(selected);
        else if (view === 'requests')
            await history();
        else
            compose();
    }
    async function reviewVisibility() {
        try {
            await refresh();
            notice('Repository visibility changed. Review the updated disclosure, then send explicitly.');
        }
        catch {
            notice('Repository visibility changed. Your draft is retained; Refresh to load the current disclosure before sending.');
        }
    }
    const safeRefresh = () => refresh().catch(error => { if (!abort.signal.aborted)
        notice(error.message); });
    shadow.querySelector('[data-compose]').addEventListener('click', () => { if (session)
        compose(); });
    shadow.querySelector('[data-history]').addEventListener('click', () => { if (session)
        history().catch(error => notice(error.message)); });
    shadow.querySelector('[data-refresh]').addEventListener('click', safeRefresh);
    shadow.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    login.addEventListener('click', () => options.onLogin?.());
    dialog.addEventListener('close', () => { epoch++; abort.abort(); options.onOpenChange?.(false); if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus(); });
    return {
        open(next = {}) {
            if (destroyed)
                throw new Error('Feedback mount was destroyed.');
            if (next.context) {
                if (typeof next.context.page !== 'string' || next.context.page.length > 160)
                    throw new Error('Use a short nonsecret page label for feedback context.');
                if (contextPage !== next.context.page) {
                    contextPage = next.context.page;
                    for (const key of Object.keys(drafts))
                        delete drafts[key];
                }
            }
            epoch++;
            abort.abort();
            abort = new AbortController();
            view = next.view ?? 'new';
            selected = next.requestId;
            formId = next.template;
            if (!dialog.open) {
                previousFocus = document.activeElement;
                dialog.showModal();
                options.onOpenChange?.(true);
            }
            main.replaceChildren();
            notice('Loading…');
            void safeRefresh();
        },
        close() { if (dialog.open)
            dialog.close(); },
        destroy() { if (destroyed)
            return; destroyed = true; epoch++; abort.abort(); if (dialog.open)
            dialog.close(); host.remove(); }
    };
}
