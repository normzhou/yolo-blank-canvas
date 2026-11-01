export interface ManagedRegistration {
    appId: string;
    origin: string;
    repository: string;
    repositoryId: number;
    installationId: number;
    installationOwnerId: number;
    databaseBinding: string;
    tokenSha256: string;
    expiresAt: number;
    maxRequestsPerDay: number;
    responders: string[];
    tracking?: boolean;
    worker?: {
        subject: string;
        expiresAt: number;
        tokenSha256: string;
        trackingPublish?: boolean;
    };
}
export interface ManagedServiceEnvironment {
    GITHUB_APP_ID: string;
    GITHUB_APP_PRIVATE_KEY: string;
    MANAGED_FEEDBACK_ENABLED: string;
    [key: string]: unknown;
}
/** Publisher credentials are used only by this YOLO-owned handler, never exported. */
export declare function createManagedFeedbackService(registrations: ManagedRegistration[]): {
    fetch(request: Request, env: ManagedServiceEnvironment): Promise<Response>;
};
