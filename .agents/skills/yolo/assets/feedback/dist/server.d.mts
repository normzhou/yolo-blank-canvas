/** Mount after the client's verified identity adapter. A browser field/header is never a principal. */
export declare function createFeedbackBridge({ repository, responders, authorize }: {
    authorize: any;
    repository: any;
    responders: any;
}): {
    fetch(request: any, env: any, context?: {}): Promise<Response | null | undefined>;
};
