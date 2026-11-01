import { createElement, useEffect, useMemo, useRef, type RefObject } from 'react';
import {mountHostedFeedbackLauncher,type HostedMountOptions} from './hosted.js';
import { mountFeedback, mountFeedbackLauncher, type MountOptions } from './browser.js';
/** Keep options stable with useMemo; each hook owns only its supplied mount root. */
function useMountedFeedback(root: RefObject<HTMLElement>, options: MountOptions, mount: typeof mountFeedback) {
  const current = useRef<ReturnType<typeof mountFeedback> | null>(null);
  useEffect(() => {
    if (!root.current) return;
    const mounted = mount(root.current, options); current.current = mounted;
    return () => { mounted.destroy(); if (current.current === mounted) current.current = null; };
  }, [root, options, mount]);
  return current;
}
export function useFeedback(root: RefObject<HTMLElement>, options: MountOptions) {
  return useMountedFeedback(root, options, mountFeedback);
}
export function useFeedbackLauncher(root: RefObject<HTMLElement>, options: MountOptions) {
  return useMountedFeedback(root, options, mountFeedbackLauncher);
}

/** Drop-in React UI; ordinary parent rerenders do not recreate the panel. */
export function FeedbackLauncher(options: MountOptions) {
  const root = useRef<HTMLDivElement>(null);
  const stable = useMemo(() => options, [
    options.app.id, options.app.name, options.app.version, options.apiBase,
    options.stylesheet, options.onLogin, options.onLogout, options.onOpenChange, options.getContext
  ]);
  useFeedbackLauncher(root, stable);
  return createElement('div', {ref: root});
}

/** One local integration; compatible hosted browser updates arrive on reload. */
export function HostedFeedbackLauncher(options: HostedMountOptions) {
  const root=useRef<HTMLDivElement>(null);
  const stable=useMemo(()=>options,[options.app.id,options.app.name,options.app.version,options.apiBase,options.onLogin,options.onLogout,options.onOpenChange,options.getContext,options.release]);
  useMountedFeedback(root,stable,mountHostedFeedbackLauncher);
  return createElement('div',{ref:root});
}
