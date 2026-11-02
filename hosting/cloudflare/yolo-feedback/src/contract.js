import { LIBRARY_VERSION } from './version.js';
export { LIBRARY_VERSION };
export const API = 'yolo-work-api-v1';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const exact = (value, keys) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => keys.includes(k));
export const text = (value, max = 4000) => typeof value === 'string' && [...value].length > 0 && [...value].length <= max;
export async function digest(value) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
