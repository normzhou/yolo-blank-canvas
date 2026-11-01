import { type TrackingConfig } from './tracking.js';
import { type Environment, type Principal } from './contract.js';
interface Config {
    repository: string;
    responders: string[];
    authorize: (p: Principal) => boolean | Promise<boolean>;
    worker?: {
        subject: string;
        expiresAt: number;
        trackingPublish?: boolean;
    };
    tracking?: TrackingConfig;
}
interface Context {
    principal?: Principal | null;
    signal?: AbortSignal;
    workRead?: boolean;
}
/** One app-owned bridge. Mount worker routes inside the existing transport guard, before interactive login. */
export declare function createWorkBridge(config: Config): {
    fetch(request: Request, env: Environment, context?: Context): Promise<Response | null>;
};
export {};
