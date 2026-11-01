import { type Principal } from './contract.js';
export declare const MANAGED_API = "yolo-managed-feedback-v1";
export declare const managedRoute: (path: string, method: string) => boolean;
export declare const managedJSON: (error: string, status: number, code?: string) => Response;
export declare function httpsOrigin(value: string): boolean;
export declare function boundedText(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string>;
export interface ManagedClientEnvironment {
    MANAGED_FEEDBACK_TOKEN: string;
    PUBLIC_ORIGIN: string;
}
/** This adapter runs only inside the client's verified identity/transport wrapper. */
export declare function createManagedWorkBridge(config: {
    appId: string;
    serviceOrigin: string;
    authorize: (p: Principal) => boolean | Promise<boolean>;
    authorizeWork?: (p: Principal) => boolean | Promise<boolean>;
}): {
    fetch(request: Request, env: ManagedClientEnvironment, context?: {
        principal?: Principal | null;
        signal?: AbortSignal;
    }): Promise<Response | null>;
};
