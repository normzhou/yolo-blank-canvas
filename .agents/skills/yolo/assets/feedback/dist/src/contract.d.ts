import { LIBRARY_VERSION } from './version.js';
export { LIBRARY_VERSION };
export declare const API = "yolo-work-api-v1";
export type Phase = 'staged' | 'writing' | 'sent' | 'rejected';
export interface Principal {
    issuer: string;
    subject: string;
    emailVerified: boolean;
}
export interface Statement {
    bind(...values: unknown[]): Statement;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{
        results: T[];
    }>;
    run(): Promise<{
        meta: {
            changes: number;
        };
    }>;
}
export interface Database {
    prepare(sql: string): Statement;
}
export interface Environment {
    APP_DB: Database;
    FEEDBACK_GITHUB_TOKEN: string;
    PUBLIC_ORIGIN: string;
    WORK_BRIDGE_TOKEN_SHA256?: string;
}
export interface RequestRow {
    id: string;
    owner: string;
    title: string;
    payload: string;
    digest: string;
    created: number;
    phase: Phase;
    issue: number | null;
}
export interface ResponseRow {
    id: string;
    request_id: string;
    actor: string;
    payload: string;
    digest: string;
    created: number;
    phase: Phase;
    comment: number | null;
}
export interface Form {
    id: string;
    title: string;
    input_schema: {
        required: string[];
        properties: Record<string, {
            maxLength: number;
        }>;
    };
    form: {
        fields: {
            field: string;
            label: string;
            help: string;
        }[];
    };
}
export interface Session {
    api: typeof API;
    libraryVersion: string;
    owner: string;
    forms: Form[];
    visibility: 'public' | 'private';
    capabilities: string[];
}
export declare const UUID: RegExp;
export declare const exact: (value: unknown, keys: string[]) => value is Record<string, unknown>;
export declare const text: (value: unknown, max?: number) => value is string;
export declare function digest(value: string): Promise<string>;
