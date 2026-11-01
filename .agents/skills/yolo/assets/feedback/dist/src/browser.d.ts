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
    onLogout?: () => void | Promise<void>;
    onOpenChange?: (open: boolean) => void;
    getContext?: () => {
        page: string;
    };
}
/** Mount only in the supplied root. No API access or write occurs before open(). */
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
/** A complete opt-in launcher. Existing app identity/bridge permissions still apply. */
export declare function mountFeedbackLauncher(root: HTMLElement, options: MountOptions): {
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
