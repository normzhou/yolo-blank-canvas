import { type RefObject } from 'react';
import { type HostedMountOptions } from './hosted.js';
import { type MountOptions } from './browser.js';
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
export declare function useFeedbackLauncher(root: RefObject<HTMLElement>, options: MountOptions): import("react").MutableRefObject<{
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
/** Drop-in React UI; ordinary parent rerenders do not recreate the panel. */
export declare function FeedbackLauncher(options: MountOptions): import("react").DetailedReactHTMLElement<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
/** One local integration; compatible hosted browser updates arrive on reload. */
export declare function HostedFeedbackLauncher(options: HostedMountOptions): import("react").DetailedReactHTMLElement<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
