import type { MountOptions, mountFeedbackLauncher } from './browser.js';
export interface HostedMountOptions extends Omit<MountOptions, 'stylesheet'> {
    release?: string;
}
type Control = ReturnType<typeof mountFeedbackLauncher>;
/** Opt-in local adapter. Assets update remotely; identity/API remain app-owned. */
export declare function mountHostedFeedbackLauncher(root: HTMLElement, options: HostedMountOptions): {
    open: (next?: Parameters<Control['open']>[0]) => void;
    close(): void;
    destroy(): void;
    readonly version: string | undefined;
};
export {};
