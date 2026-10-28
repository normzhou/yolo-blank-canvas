import { type RefObject } from 'react';
import { type MountOptions } from './browser.js';
/** Keep options stable with useMemo; this hook owns only its supplied mount root. */
export declare function useFeedback(root: RefObject<HTMLElement>, options: MountOptions): import("react").MutableRefObject<{
    open(next?: {
        view?: 'new' | 'requests' | 'thread';
        template?: string;
        requestId?: string;
        context?: {
            page: string;
        };
    }): void;
    close(): void;
    destroy(): void;
} | null>;
