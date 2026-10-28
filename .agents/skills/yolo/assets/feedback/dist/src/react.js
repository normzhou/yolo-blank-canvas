import { useEffect, useRef } from 'react';
import { mountFeedback } from './browser.js';
/** Keep options stable with useMemo; this hook owns only its supplied mount root. */
export function useFeedback(root, options) {
    const current = useRef(null);
    useEffect(() => {
        if (!root.current)
            return;
        const mounted = mountFeedback(root.current, options);
        current.current = mounted;
        return () => { mounted.destroy(); if (current.current === mounted)
            current.current = null; };
    }, [root, options]);
    return current;
}
