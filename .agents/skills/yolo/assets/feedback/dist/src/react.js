import { createElement, useEffect, useMemo, useRef } from 'react';
import { mountHostedFeedbackLauncher } from './hosted.js';
import { mountFeedback, mountFeedbackLauncher } from './browser.js';
/** Keep options stable with useMemo; each hook owns only its supplied mount root. */
function useMountedFeedback(root, options, mount) {
    const current = useRef(null);
    useEffect(() => {
        if (!root.current)
            return;
        const mounted = mount(root.current, options);
        current.current = mounted;
        return () => { mounted.destroy(); if (current.current === mounted)
            current.current = null; };
    }, [root, options, mount]);
    return current;
}
export function useFeedback(root, options) {
    return useMountedFeedback(root, options, mountFeedback);
}
export function useFeedbackLauncher(root, options) {
    return useMountedFeedback(root, options, mountFeedbackLauncher);
}
/** Drop-in React UI; ordinary parent rerenders do not recreate the panel. */
export function FeedbackLauncher(options) {
    const root = useRef(null);
    const stable = useMemo(() => options, [
        options.app.id, options.app.name, options.app.version, options.apiBase,
        options.stylesheet, options.onLogin, options.onLogout, options.onOpenChange, options.getContext
    ]);
    useFeedbackLauncher(root, stable);
    return createElement('div', { ref: root });
}
/** One local integration; compatible hosted browser updates arrive on reload. */
export function HostedFeedbackLauncher(options) {
    const root = useRef(null);
    const stable = useMemo(() => options, [options.app.id, options.app.name, options.app.version, options.apiBase, options.onLogin, options.onLogout, options.onOpenChange, options.getContext, options.release]);
    useMountedFeedback(root, stable, mountHostedFeedbackLauncher);
    return createElement('div', { ref: root });
}
