import { renderMark, animateYoloMark } from './brand.mjs';
const ASSETS = 'https://yolo-dev.ai';
const RELEASE = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
/** Opt-in local adapter. Assets update remotely; identity/API remain app-owned. */
export function mountHostedFeedbackLauncher(root, options) {
    if (!root || root.childNodes.length || !/^[A-Za-z0-9_-]{1,80}$/.test(options.app.id))
        throw new Error('Provide an empty mount root and a stable app ID.');
    if ('stylesheet' in options)
        throw new Error('Hosted feedback uses matching release CSS; use theme variables or the local mount.');
    if (options.release && !RELEASE.test(options.release))
        throw new Error('Select an immutable release or the default v1 channel.');
    const api = new URL(options.apiBase ?? '/yolo/api/v1', location.href);
    if (api.origin !== location.origin || api.search || api.hash)
        throw new Error('Feedback API must be same-origin.');
    const host = document.createElement('div'), shadow = host.attachShadow({ mode: 'open' });
    root.append(host);
    shadow.innerHTML = `<link rel="stylesheet" href="/yolo/feedback/styles.css"><button type="button" class="launcher" aria-label="Feedback and requests">${renderMark({ decorative: true })}</button><p class="loader-note" role="status" aria-live="polite" hidden></p><div data-ui></div>`;
    const trigger = shadow.querySelector('button'), note = shadow.querySelector('.loader-note'), target = shadow.querySelector('[data-ui]');
    let control, pending, destroyed = false, loading = false, attempts = 0, version;
    const abort = new AbortController();
    const motion = animateYoloMark(trigger.querySelector('svg'), { trigger, onActivate: () => open(options.getContext ? { context: options.getContext() } : undefined) });
    async function load() {
        if (destroyed || loading || control)
            return;
        loading = true;
        trigger.setAttribute('aria-busy', 'true');
        note.hidden = true;
        const path = options.release ? `/feedback/releases/${options.release}/entry.mjs` : '/feedback/v1.mjs';
        const url = new URL(path, ASSETS);
        if (attempts++)
            url.searchParams.set('retry', String(attempts));
        try {
            const ui = await import(/* @vite-ignore */ url.href);
            if (destroyed)
                return;
            if (ui.HOSTED_FEEDBACK_API !== 'yolo-feedback-ui-v1' || typeof ui.mountFeedbackLauncher !== 'function' || typeof ui.prepareStyles !== 'function' || typeof ui.LIBRARY_VERSION !== 'string')
                throw Error('Incompatible hosted feedback UI.');
            await ui.prepareStyles(abort.signal, attempts);
            if (destroyed)
                return;
            const { release, ...mountOptions } = options;
            const mounted = ui.mountFeedbackLauncher(target, mountOptions);
            if (!mounted || typeof mounted.open !== 'function' || typeof mounted.close !== 'function' || typeof mounted.destroy !== 'function')
                throw Error('Incompatible hosted feedback control.');
            control = mounted;
            version = ui.LIBRARY_VERSION;
            if (pending) {
                const next = pending;
                pending = undefined;
                control.open(next);
            }
            motion.destroy();
            trigger.remove();
            note.remove();
            root.dataset.yoloFeedbackVersion = version;
        }
        catch {
            if (destroyed)
                return;
            control?.destroy();
            control = undefined;
            version = undefined;
            target.replaceChildren();
            delete root.dataset.yoloFeedbackVersion;
            note.textContent = 'Feedback is unavailable. Click the Y to retry.';
            note.hidden = false;
        }
        finally {
            loading = false;
            trigger.removeAttribute('aria-busy');
        }
    }
    function open(next = {}) {
        if (destroyed)
            throw new Error('Feedback mount was destroyed.');
        if (control)
            control.open(next);
        else {
            pending = next;
            void load();
        }
    }
    void load();
    return { open, close() { pending = undefined; control?.close(); }, destroy() { if (destroyed)
            return; destroyed = true; pending = undefined; abort.abort(); motion.destroy(); control?.destroy(); host.remove(); delete root.dataset.yoloFeedbackVersion; }, get version() { return version; } };
}
