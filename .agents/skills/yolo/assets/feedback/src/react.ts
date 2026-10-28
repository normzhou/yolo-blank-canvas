import { useEffect, useRef, type RefObject } from 'react';
import { mountFeedback, type MountOptions } from './browser.js';
/** Keep options stable with useMemo; this hook owns only its supplied mount root. */
export function useFeedback(root: RefObject<HTMLElement>, options: MountOptions) {
  const current = useRef<ReturnType<typeof mountFeedback> | null>(null);
  useEffect(() => {
    if (!root.current) return;
    const mounted = mountFeedback(root.current, options); current.current = mounted;
    return () => { mounted.destroy(); if (current.current === mounted) current.current = null; };
  }, [root, options]);
  return current;
}
