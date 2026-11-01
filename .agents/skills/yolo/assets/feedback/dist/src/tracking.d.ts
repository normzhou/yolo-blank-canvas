import { type Environment } from './contract.js';
import { type TrackingConfig } from './tracking-contract.js';
export * from './tracking-contract.js';
type Github = (path: string, init?: RequestInit) => Promise<any>;
/** New grants are opt-in. The ledger is an intent/source index, not workflow authority. */
export declare function createTracking(config: TrackingConfig, repository: string, responders: string[], isRejected?: (error: unknown) => boolean): {
    handle(request: Request, env: Environment, github: Github, access: {
        actor?: string;
        owner?: string;
        workRead: boolean;
    }): Promise<Response>;
};
