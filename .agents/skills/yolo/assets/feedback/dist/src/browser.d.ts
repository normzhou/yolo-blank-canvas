export { LIBRARY_VERSION } from './version.js';
export interface MountOptions {
    app: {
        id: string;
        name: string;
        version?: string;
    };
    apiBase?: string;
    stylesheet?: string;
    onLogin?: () => void;
    onOpenChange?: (open: boolean) => void;
}
/** Mount only in the supplied root. No network/write occurs before open(). */
export declare function mountFeedback(root: HTMLElement, options: MountOptions): {
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
};
