export interface WorkConnection {
    baseURL: string;
    token: string;
    fetch?: typeof fetch;
}
/** Headless L1 transport; IDs must be saved by the caller before respond(). No POST retry. */
export declare function createWorkClient(connection: WorkConnection): {
    session: () => Promise<any>;
    requests: () => Promise<any>;
    request: (requestId: string) => Promise<any>;
    respond: (requestId: string, operationId: string, message: string) => Promise<any>;
    receipt: (requestId: string, operationId: string) => Promise<any>;
};
