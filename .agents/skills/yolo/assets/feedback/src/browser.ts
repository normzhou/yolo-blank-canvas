export { LIBRARY_VERSION } from './version.js';
import { API, UUID, type Session, type Form } from './contract.js';
import { animateYoloMark, renderMark } from './brand.mjs';
export interface MountOptions {
  app: { id: string; name: string; version?: string }; apiBase?: string; stylesheet?: string;
  onLogin?: () => void; onLogout?: () => void | Promise<void>; onOpenChange?: (open: boolean) => void;
  getContext?: () => {page: string};
}
interface Draft { id: string; template: string; input: Record<string, string>; sent?: boolean }
interface Reply { id: string; message: string; sent?: boolean }
interface Summary { id: string; title: string; phase: string; preview?: string; created?: number }
interface Thread extends Summary {
  input: Record<string, string>; created: number;
  replies: { id: string; message: string; phase: string; created?: number }[];
  responses: { message: string; created?: number }[];
  status: { state: string; workflow: string[] } | null;
}
/** Mount only in the supplied root. No API access or write occurs before open(). */
export function mountFeedback(root: HTMLElement, options: MountOptions) {
  return createFeedback(root, options, false);
}
/** A complete opt-in launcher. Existing app identity/bridge permissions still apply. */
export function mountFeedbackLauncher(root: HTMLElement, options: MountOptions) {
  return createFeedback(root, options, true);
}
function createFeedback(root: HTMLElement, options: MountOptions, withLauncher: boolean) {
  if (!root || root.childNodes.length || !/^[A-Za-z0-9_-]{1,80}$/.test(options.app.id)) throw new Error('Provide an empty mount root and a stable app ID.');
  const apiBase = new URL(options.apiBase ?? '/yolo/api/v1', location.href);
  const stylesheet = new URL(options.stylesheet ?? '/yolo/feedback/styles.css', location.href);
  const hostedStyle=options.stylesheet!==undefined&&stylesheet.origin==='https://yolo-dev.ai'&&!stylesheet.username&&!stylesheet.password&&(!stylesheet.search||/^\?retry=\d{1,8}$/.test(stylesheet.search))&&!stylesheet.hash&&/^\/feedback\/releases\/\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?\/styles\.css$/.test(stylesheet.pathname);
  if (apiBase.origin !== location.origin || (stylesheet.origin !== location.origin&&!hostedStyle) || apiBase.search || apiBase.hash) throw new Error('Feedback API must be same-origin; select local or canonical hosted CSS.');
  const tag = 'yolo-feedback-v1';
  if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: 'open' }); } });
  const host = document.createElement(tag), shadow = host.shadowRoot!;
  root.append(host);
  shadow.innerHTML = `<link rel="stylesheet"><dialog aria-labelledby="feedback-heading"><header><div><h2 id="feedback-heading">Feedback</h2></div><div class="header-actions"><button type="button" class="signout" data-logout hidden>Sign out</button><button type="button" data-close autofocus aria-label="Close feedback">✕</button></div></header><nav hidden aria-label="Feedback views"><div class="view-switch"><button type="button" data-compose>New request</button><button type="button" data-history>My requests</button></div><button type="button" class="refresh" data-refresh aria-label="Refresh" title="Check for new replies and status updates"></button></nav><p class="notice" role="status" aria-live="polite"></p><section class="signin" hidden aria-labelledby="signin-title">${renderMark({decorative:true})}<h3 id="signin-title">Good ideas start here.</h3><p data-signin-copy>Sign in to share an idea, report a problem, or pick up a conversation.</p><button class="signin-action" type="button" data-login hidden>Continue with Google</button><button type="button" data-retry hidden>Try again</button><p class="signin-note">A little feedback can set things in motion.</p></section><main></main></dialog>`;
  shadow.querySelector('link')!.href = stylesheet.href;
  if(stylesheet.origin!==location.origin||hostedStyle)shadow.querySelector('link')!.crossOrigin='anonymous';
  const dialog = shadow.querySelector('dialog')!, main = shadow.querySelector('main')!, status = shadow.querySelector('.notice')!;
  const login = shadow.querySelector<HTMLButtonElement>('[data-login]')!, logout = shadow.querySelector<HTMLButtonElement>('[data-logout]')!;
  const entry = shadow.querySelector<HTMLElement>('.signin')!, navigation = shadow.querySelector<HTMLElement>('nav')!, heading = shadow.querySelector<HTMLElement>('h2')!;
  const entryTitle = shadow.querySelector<HTMLElement>('#signin-title')!, entryCopy = shadow.querySelector<HTMLElement>('[data-signin-copy]')!, retry = shadow.querySelector<HTMLButtonElement>('[data-retry]')!;
  if (options.onLogin) login.textContent = 'Sign in';
  let launcher: HTMLButtonElement | undefined, loginForm: HTMLFormElement | undefined;
  let motion: ReturnType<typeof animateYoloMark> | undefined;
  const entryMotion = animateYoloMark(entry.querySelector('svg')!);
  dialog.id = 'feedback-dialog';
  const icons: Record<string,string> = {
    refresh:'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1.6L20 8M4 16l2.3 2.6A7 7 0 0 0 17.9 17',
    problem:'M9 3h6M12 3v4M6 10l-3-2M18 10l3-2M5 15H2M19 15h3M6 20l-3 2M18 20l3 2M8 8h8l2 4v5a6 6 0 0 1-12 0v-5z',
    idea:'M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0l-1 2H9z',
    question:'M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    feedback:'M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 18-4M7 10h8M7 14h5',
    arrow:'M5 12h14M13 6l6 6-6 6',
    public:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18',
    lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3'
  };
  function icon(name: string) {
    const holder = document.createElement('template');
    holder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] ?? icons.feedback}"/></svg>`;
    return holder.content.firstElementChild!;
  }
  shadow.querySelector('[data-refresh]')!.append(icon('refresh'));
  let screenRevision = 0;
  function setView(next: 'new' | 'requests' | 'thread') {
    screenRevision++; if (next !== view) main.scrollTop = 0; view = next; main.dataset.view = next; notice('');
    heading.textContent = next === 'new' ? 'Share feedback' : next === 'requests' ? 'Your requests' : 'Conversation';
    shadow.querySelector<HTMLButtonElement>('[data-refresh]')!.hidden = next === 'new';
    shadow.querySelector('[data-compose]')!.setAttribute('aria-pressed',String(next === 'new'));
    shadow.querySelector('[data-history]')!.setAttribute('aria-pressed',String(next !== 'new'));
  }
  const phaseLabel = (phase: string) => phase === 'sent' ? 'Submitted' : phase === 'rejected' ? 'Not submitted' : 'Awaiting confirmation';
  function stamp(created?: number) {
    if (!created || !Number.isFinite(new Date(created).getTime())) return document.createTextNode('');
    const t = document.createElement('time'); t.dateTime = new Date(created).toISOString();
    t.textContent = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(created);
    return t;
  }
  const changeOpen = (open: boolean) => {
    launcher?.setAttribute('aria-expanded', String(open));
    options.onOpenChange?.(open);
  };
  const startLogin = options.onLogin ?? (withLauncher ? () => {
    if (!loginForm) {
      loginForm = document.createElement('form');
      loginForm.method = 'post';
      loginForm.action = new URL('/auth/yolo/login', location.origin).href;
      loginForm.target = '_self';
      loginForm.hidden = true;
      shadow.append(loginForm);
    }
    loginForm.submit();
  } : undefined);
  const endSession = options.onLogout ?? (withLauncher ? async () => {
    const response = await fetch(new URL('/auth/yolo/logout', location.origin), {
      method: 'POST', credentials: 'same-origin', redirect: 'error',
      headers: {Origin: location.origin}, signal: AbortSignal.timeout(15000)
    });
    if (response.status !== 204) throw new Error('Sign-out could not be confirmed.');
    // The whole app must observe its revoked session, including other private UI.
    location.reload();
  } : undefined);
  let signingOut = false;
  let session: Session | undefined, selected: string | undefined, formId: string | undefined;
  let view: 'new' | 'requests' | 'thread' = 'new', destroyed = false, epoch = 0, contextPage = '';
  let abort = new AbortController(), previousFocus: Element | null = null;
  const drafts: Record<string, Draft> = {};
  const notice = (value: string) => { status.textContent = value; };
  const storageKey = (name: string) => `yolo-feedback-v1:${options.app.id}:${session!.owner}:${name.startsWith('draft:') ? 'context:' + encodeURIComponent(contextPage) + ':' : ''}${name}`;
  function load<T>(name: string): T | undefined { try { const value = sessionStorage.getItem(storageKey(name)); return value ? JSON.parse(value) : undefined; } catch { return undefined; } }
  function save(name: string, value: unknown) { try { sessionStorage.setItem(storageKey(name), JSON.stringify(value)); } catch { notice('Draft storage is unavailable. Keep this page open until sending is confirmed.'); } }
  function showEntry(code?: string) {
    entry.hidden = false; navigation.hidden = heading.hidden = true;
    main.replaceChildren(); notice('');
    const denied = code === 'feedback_forbidden', unavailable = code === 'unavailable';
    logout.hidden = !endSession || !denied;
    entryTitle.textContent = unavailable ? 'A brief pause.' : denied ? 'Try another account.' : 'Good ideas start here.';
    entryCopy.textContent = unavailable ? 'Feedback could not be reached. Please try again in a moment.' : denied ? 'This account does not have access to feedback here. You can choose a different Google account.' : 'Sign in to share an idea, report a problem, or pick up a conversation.';
    login.hidden = !startLogin || unavailable; retry.hidden = !unavailable;
    login.textContent = denied ? 'Use another account' : options.onLogin ? 'Sign in' : 'Continue with Google';
  }
  async function api(path: string, body?: unknown) {
    const started = epoch;
    const response = await fetch(apiBase.href.replace(/\/$/, '') + '/' + path, { credentials: 'same-origin', redirect: 'error', signal: abort.signal,
      headers: { ...(session ? { 'X-Feedback-Owner': session.owner, 'X-Feedback-Visibility': session.visibility } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    const value = await response.json();
    if (!response.ok) {
      if (started === epoch && !destroyed && dialog.open && ([401, 403].includes(response.status) || (response.status === 409 && value.code !== 'visibility_changed'))) { main.replaceChildren(); for (const key of Object.keys(drafts)) delete drafts[key]; session = undefined; selected = undefined; view = 'new'; if (!destroyed && dialog.open) showEntry(value.code); }
      throw Object.assign(new Error(value.error ?? 'Feedback unavailable. Keep your saved draft.'), {code: value.code, status: response.status});
    }
    return value;
  }
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, label?: string) => { const element = document.createElement(tag); if (label) element.textContent = label; return element; };
  function button(label: string, action: () => void | Promise<void>) { const b = node('button', label); b.type = 'button'; b.addEventListener('click', () => { Promise.resolve(action()).catch(error => notice(error.message)); }); return b; }
  const fresh = (template: string): Draft => ({ id: crypto.randomUUID(), template, input: contextPage ? {context: contextPage} : {} });
  function getDraft(): Draft {
    const id = formId ?? session!.forms[0]!.id;
    if (!drafts[id]) {
      const saved = load<Draft>('draft:' + id);
      drafts[id] = saved && UUID.test(saved.id) && saved.template === id && saved.input && typeof saved.input === 'object' ? saved : fresh(id);
    }
    return drafts[id]!;
  }
  function compose() {
    setView('new'); selected = undefined; main.replaceChildren();
    const draft = getDraft(), form = session!.forms.find(f => f.id === draft.template)!;
    const fields = node('form'), types = node('div'); fields.className='compose'; types.className = 'types';
    types.setAttribute('role','group'); types.setAttribute('aria-label','Request type');
    const kinds: Record<string,{label:string;icon:string}> = {'yolo.bug':{label:'Problem',icon:'problem'},'yolo.feature':{label:'Idea',icon:'idea'},'yolo.question':{label:'Question',icon:'question'},'yolo.feedback':{label:'Feedback',icon:'feedback'}};
    for (const f of session!.forms) { const kind=kinds[f.id]; const b = button('', () => { formId = f.id; compose(); }); b.append(icon(kind?.icon ?? 'feedback'),node('span',kind?.label ?? f.title)); b.setAttribute('aria-pressed', String(f.id === form.id)); types.append(b); }
    main.append(types);
    const addField = (field: Form['form']['fields'][number], parent: HTMLElement) => {
      const label = node('label'), caption = node('span', field.label), input = node('textarea'), help = node('p', field.help);
      input.name = field.field; input.rows = form.input_schema.required.includes(field.field) ? 5 : 3; input.required = form.input_schema.required.includes(field.field); input.maxLength = form.input_schema.properties[field.field]!.maxLength;
      const quietPrompt = form.id === 'yolo.bug' && field.field === 'observed';
      if (quietPrompt) caption.className = 'sr-only';
      label.append(caption);
      input.value = draft.input[field.field] ?? ''; input.disabled = !!draft.sent; input.placeholder = form.input_schema.required.includes(field.field) ? 'A little context goes a long way…' : ''; label.append(input); help.className = 'hint';
      input.addEventListener('input', () => { if (input.value) draft.input[field.field] = input.value; else delete draft.input[field.field]; save('draft:' + draft.template, draft); }); parent.append(label); if (!quietPrompt && field.help) parent.append(help);
    };
    const details = node('details'), summary = node('summary', 'Add details'); details.append(summary);
    for (const field of form.form.fields) addField(field, (form.input_schema.required.includes(field.field) || (field.field === 'context' && !!draft.input.context)) ? fields : details);
    if (details.children.length > 1) fields.append(details);
    if (session!.visibility === 'public') { const disclosure = node('p', 'Posted publicly — leave out personal information.'); disclosure.className = 'disclosure'; disclosure.prepend(icon('public')); fields.append(disclosure); }
    const send = node('button', draft.sent ? 'Awaiting confirmation' : 'Send request'); send.type = 'submit'; send.disabled = !!draft.sent; send.className = 'primary-action'; if(!draft.sent)send.append(icon('arrow')); fields.append(send); main.append(fields);
    if (draft.sent) main.append(button('Check saved submission', () => thread(draft.id)));
    fields.addEventListener('submit', async event => {
      event.preventDefault(); if (draft.sent) return;
      draft.sent = true; save('draft:' + draft.template, draft); send.disabled = true; notice('Sending…');
      const started = epoch;
      try {
        const result = await api('requests', { id: draft.id, template: draft.template, input: draft.input });
        if (started !== epoch) return;
        if (result.phase === 'sent') { delete drafts[draft.template]; save('draft:' + draft.template, fresh(draft.template)); }
        await thread(result.id);
      } catch (error) { if (started !== epoch) return;
        if ((error as {code?:string}).code === 'visibility_changed') { draft.sent = false; save('draft:' + draft.template, draft); await reviewVisibility(); }
        else notice((error as Error).message + ' Draft retained; refresh to reconcile before sending another request.'); }
    });
  }
  async function history() {
    const started = epoch, screen = ++screenRevision, data = await api('requests'); if (started !== epoch || screen !== screenRevision) return;
    setView('requests'); selected = undefined; main.replaceChildren();
    const intro=node('p','Follow the conversation, all in one place.'); intro.className='view-intro'; main.append(intro);
    if (!data.requests.length) {
      const empty=node('section'); empty.className='empty'; empty.append(icon('feedback'),node('h3','Start a conversation.'),node('p','Your feedback will appear here.'),button('Share your first request',compose)); main.append(empty);
    }
    for (const item of data.requests as Summary[]) {
      const b=button('',()=>thread(item.id)); b.className='request';
      const meta=node('span'); meta.className='request-meta'; const phase=node('span',phaseLabel(item.phase)); phase.className='phase'; phase.dataset.phase=item.phase;
      meta.append(node('span',item.title),phase);
      const title=node('strong',item.preview || item.title); title.className='request-title';
      const bottom=node('span'); bottom.className='request-bottom'; bottom.append(stamp(item.created),icon('arrow'));
      b.append(meta,title,bottom);main.append(b);
    }
  }
  async function thread(id: string) {
    if (!UUID.test(id)) throw new Error('Invalid request reference.');
    const started = epoch, screen = ++screenRevision, data = await api('requests/' + id) as Thread; if (started !== epoch || screen !== screenRevision) return;
    selected = id; setView('thread');
    const back=button('All requests',history);back.className='back'; main.replaceChildren(back,node('h3', Object.values(data.input)[0]?.slice(0, 100) || data.title));
    const progress=node('div');progress.className='progress';const states:Record<string,string>={queued:'Planned',active:'In progress',waiting:'Waiting',deferred:'Postponed'};const workflow=data.status?.workflow.find(s=>s.startsWith('yolo:state:'))?.slice(11);const recorded=data.status?.state==='closed'?'Closed':workflow&&states[workflow]||'Request open';const badge=node('span',data.status ? recorded : phaseLabel(data.phase));badge.className='phase';badge.dataset.phase=data.phase;
    const explanation=node('p',data.status ? 'Recorded status · delivery is confirmed separately.' : 'Refresh checks the saved submission without sending it again.');progress.append(badge,explanation);main.append(progress);
    const messages = [
      { text: Object.values(data.input).join('\n\n'), label: 'Your request', created: data.created, own: true },
      ...data.replies.map(r => ({ text: r.message, label: r.phase === 'sent' ? 'You' : 'You · ' + phaseLabel(r.phase), created: r.created, own: true })),
      ...data.responses.map(r => ({ text: r.message, label: 'Response', created: r.created, own: false }))
    ].sort((a,b) => (a.created ?? Number.MAX_SAFE_INTEGER) - (b.created ?? Number.MAX_SAFE_INTEGER));
    const conversation=node('div');conversation.className='conversation';
    for (const message of messages) { const article = node('article'), meta=node('div'), label = node('strong', message.label), content = node('p', message.text); article.className=message.own?'message own':'message';meta.className='message-meta';meta.append(label,stamp(message.created));article.append(meta,content);conversation.append(article); }
    main.append(conversation);
    const draft = Object.values(drafts).find(d => d.id === id);
    if (data.phase === 'rejected' && draft) main.append(button('Review rejected draft as a new request', () => { draft.id = crypto.randomUUID(); draft.sent = false; save('draft:' + draft.template, draft); formId = draft.template; compose(); }));
    if (data.phase !== 'sent') return;
    if (draft) { delete drafts[draft.template]; save('draft:' + draft.template, fresh(draft.template)); }
    let reply = load<Reply>('reply:' + id) ?? { id: crypto.randomUUID(), message: '' };
    const posted = data.replies.find(r => r.id === reply.id);
    if (posted?.phase === 'sent') { reply = { id: crypto.randomUUID(), message: '' }; save('reply:' + id, reply); }
    const form = node('form'), label = node('label', 'Add a reply'), input = node('textarea'), send = node('button', 'Send reply');
    form.className='reply'; input.rows = 3; input.placeholder='Keep the conversation going…'; input.maxLength = 4000; input.required = true; input.value = reply.message; input.disabled = !!reply.sent; send.type = 'submit'; send.disabled = !!reply.sent;
    send.className='primary-action';send.append(icon('arrow'));label.append(input);form.append(label);
    if (session!.visibility === 'public') { const disclosure=node('p','Posted publicly — leave out personal information.');disclosure.className='disclosure';disclosure.prepend(icon('public'));form.append(disclosure); }
    form.append(send);main.append(form);
    if (posted?.phase === 'rejected') main.append(button('Review rejected reply as a new operation', () => { reply = { id: crypto.randomUUID(), message: reply.message }; save('reply:' + id, reply); return thread(id); }));
    input.addEventListener('input', () => { reply.message = input.value; save('reply:' + id, reply); });
    form.addEventListener('submit', async event => { event.preventDefault(); if (reply.sent) return; reply.sent = true; save('reply:' + id, reply); input.disabled = send.disabled = true;
      try { await api('requests/' + id + '/replies', { id: reply.id, message: reply.message }); if (started === epoch) await thread(id); }
      catch (error) { if (started !== epoch) return;
        if ((error as {code?:string}).code === 'visibility_changed') { reply.sent = false; save('reply:' + id, reply); await reviewVisibility(); }
        else notice((error as Error).message + ' Reply retained; refresh to reconcile.'); }
    });
  }
  async function refresh() {
    const started = epoch, before = session?.owner, current = await api('session');
    if (started !== epoch || destroyed || !dialog.open) return;
    if (current.api !== API || !['public','private'].includes(current.visibility) || !Array.isArray(current.forms) || !current.forms.length) throw new Error('Incompatible feedback API. Drafts retained.');
    if (before && before !== current.owner) { for (const key of Object.keys(drafts)) delete drafts[key]; selected = undefined; formId = undefined; view = 'new'; main.replaceChildren(); }
    session = current as Session; logout.hidden = !endSession; entry.hidden = true; navigation.hidden = heading.hidden = false; login.hidden = true; notice('');
    if (view === 'thread' && selected) await thread(selected); else if (view === 'requests') await history(); else compose();
  }
  async function reviewVisibility() {
    try { await refresh(); notice('Repository visibility changed. Review the updated disclosure, then send explicitly.'); }
    catch { notice('Repository visibility changed. Your draft is retained; reopen feedback to review the current disclosure before sending.'); }
  }
  const safeRefresh = () => {
    const started = epoch;
    return refresh().catch(error => {
      if (abort.signal.aborted || destroyed || started !== epoch || !dialog.open) return;
      if (!session) showEntry([401,403,409].includes(error.status) ? error.code : 'unavailable');
      else notice(error.message);
    });
  };
  retry.addEventListener('click', () => { entry.hidden = true; notice('One moment…'); void safeRefresh(); });
  shadow.querySelector('[data-compose]')!.addEventListener('click', () => { if (session) compose(); });
  shadow.querySelector('[data-history]')!.addEventListener('click', () => { if (session) history().catch(error => notice(error.message)); });
  shadow.querySelector('[data-refresh]')!.addEventListener('click', safeRefresh);
  shadow.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  login.addEventListener('click', () => startLogin?.());
  logout.addEventListener('click', async () => {
    if (destroyed || signingOut || !endSession) return;
    signingOut = true; epoch++; abort.abort(); abort = new AbortController();
    // Keep saved owner-scoped drafts/intents for reconciliation after re-login.
    session = undefined; selected = formId = undefined; view = 'new';
    for (const key of Object.keys(drafts)) delete drafts[key];
    main.replaceChildren(); entry.hidden = navigation.hidden = heading.hidden = true;
    logout.disabled = true; logout.textContent = 'Signing out…'; notice('Signing out…');
    try {
      await endSession();
      if (!destroyed) showEntry('login_required');
    } catch {
      if (!destroyed) { showEntry('unavailable'); logout.hidden = false; notice('Sign-out could not be confirmed. Try again.'); }
    } finally {
      signingOut = false; logout.disabled = false; logout.textContent = 'Sign out';
    }
  });
  dialog.addEventListener('close', () => { epoch++; abort.abort(); changeOpen(false); if (previousFocus instanceof HTMLElement && previousFocus.isConnected && previousFocus!==document.body && (!launcher || previousFocus.tabIndex>=0 || previousFocus.hasAttribute('tabindex'))) previousFocus.focus(); else launcher?.focus(); });
  const containKeys = (event: Event) => { if (withLauncher && dialog.open) event.stopPropagation(); };
  for (const type of ['keydown', 'keypress', 'keyup']) shadow.addEventListener(type, containKeys);
  const control = {
    open(next: { view?: 'new' | 'requests' | 'thread'; template?: string; requestId?: string; context?: {page: string} } = {}) {
      if (destroyed) throw new Error('Feedback mount was destroyed.');
      if (next.context) {
        if (typeof next.context.page !== 'string' || next.context.page.length > 160) throw new Error('Use a short nonsecret page label for feedback context.');
        if (contextPage !== next.context.page) { contextPage = next.context.page; for (const key of Object.keys(drafts)) delete drafts[key]; }
      }
      epoch++; abort.abort(); abort = new AbortController();
      view = next.view ?? 'new'; selected = next.requestId; formId = next.template;
      if (!dialog.open) { previousFocus = shadow.activeElement ?? document.activeElement; dialog.showModal(); changeOpen(true); }
      main.replaceChildren(); entry.hidden = true; navigation.hidden = heading.hidden = true; notice(signingOut ? 'Signing out…' : 'One moment…'); if (!signingOut) void safeRefresh();
    },
    close() { if (dialog.open) dialog.close(); },
    destroy() {
      if (destroyed) return;
      destroyed = true; epoch++; abort.abort(); motion?.destroy(); entryMotion.destroy();
      for (const type of ['keydown', 'keypress', 'keyup']) shadow.removeEventListener(type, containKeys);
      if (dialog.open) dialog.close();
      host.remove();
    }
  };
  function activateLauncher() {
    control.open(options.getContext ? {context: options.getContext()} : {});
  }
  if (withLauncher) {
    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'launcher';
    launcher.setAttribute('aria-label', 'Feedback and requests');
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-controls', dialog.id);
    launcher.setAttribute('aria-expanded', 'false');
    launcher.title = 'Feedback and requests';
    launcher.innerHTML = renderMark({decorative: true});
    shadow.insertBefore(launcher, dialog);
    motion = animateYoloMark(launcher.querySelector('svg')!, {trigger: launcher, onActivate: activateLauncher});
  }
  return control;
}
