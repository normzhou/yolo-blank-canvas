import { type Environment, type Principal } from './contract.js';
interface Config {
    repository: string;
    responders: string[];
    authorize: (p: Principal) => boolean | Promise<boolean>;
    worker?: {
        subject: string;
        expiresAt: number;
    };
}
interface Context {
    principal?: Principal | null;
    signal?: AbortSignal;
}
/** One app-owned bridge. Mount worker routes inside the existing transport guard, before interactive login. */
export declare function createWorkBridge(config: Config): {
    fetch(request: Request, env: Environment, context?: Context): Promise<Response | null>;
};
export {};
