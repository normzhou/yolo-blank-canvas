import { API, UUID } from './contract.js';
export interface WorkConnection { baseURL: string; token: string; fetch?: typeof fetch }
/** Headless L1 transport; IDs must be saved by the caller before respond(). No POST retry. */
export function createWorkClient(connection: WorkConnection) {
  const base = new URL(connection.baseURL);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Bridge requires HTTPS, or loopback HTTP for a local fixture.');
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(connection.token)) throw new Error('Invalid worker credential.');
  const root = base.href.replace(/\/$/, '');
  const id = (value: string) => { if (!UUID.test(value)) throw new Error('A saved UUID is required.'); return value; };
  async function call(path: string, body?: unknown) {
    const response = await (connection.fetch ?? fetch)(root + '/worker/' + path, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', credentials: 'omit',
      signal: AbortSignal.timeout(15000), headers: { Origin: base.origin, Authorization: `Bearer ${connection.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const value = await response.json();
    if (!response.ok) throw new Error(`Bridge ${response.status}: ${typeof value.error === 'string' ? value.error : 'Unavailable; retain operation IDs.'}`);
    if (value.api !== API) throw new Error('Incompatible bridge API; keep local operation records.');
    return value;
  }
  return {
    session: () => call('session'),
    requests: () => call('requests'),
    request: (requestId: string) => call('requests/' + id(requestId)),
    respond: async (requestId: string, operationId: string, message: string) => {
      id(requestId); id(operationId);
      const session = await call('session');
      if (!Array.isArray(session.capabilities) || !session.capabilities.includes('responses:write')) throw new Error('Worker response capability is unavailable.');
      return call('requests/' + requestId + '/responses', { id: operationId, message });
    },
    receipt: (requestId: string, operationId: string) => call('requests/' + id(requestId) + '/responses/' + id(operationId))
  };
}
