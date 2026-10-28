import { LIBRARY_VERSION } from './version.js';
export { LIBRARY_VERSION };
export const API = 'yolo-work-api-v1';
export type Phase = 'staged' | 'writing' | 'sent' | 'rejected';
export interface Principal { issuer: string; subject: string; emailVerified: boolean }
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database { prepare(sql: string): Statement }
export interface Environment {
  APP_DB: Database; FEEDBACK_GITHUB_TOKEN: string; PUBLIC_ORIGIN: string;
  WORK_BRIDGE_TOKEN_SHA256?: string;
}
export interface RequestRow {
  id: string; owner: string; title: string; payload: string; digest: string;
  created: number; phase: Phase; issue: number | null;
}
export interface ResponseRow {
  id: string; request_id: string; actor: string; payload: string; digest: string;
  created: number; phase: Phase; comment: number | null;
}
export interface Form {
  id: string; title: string;
  input_schema: { required: string[]; properties: Record<string, { maxLength: number }> };
  form: { fields: { field: string; label: string; help: string }[] };
}
export interface Session {
  api: typeof API; libraryVersion: string; owner: string; forms: Form[];
  visibility: 'public' | 'private'; capabilities: string[];
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => keys.includes(k));
export const text = (value: unknown, max = 4000): value is string =>
  typeof value === 'string' && [...value].length > 0 && [...value].length <= max;
export async function digest(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
