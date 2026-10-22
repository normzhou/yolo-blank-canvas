import {publicOrigin, originAuthorization, cleanRequestHeaders, cleanResponse, failure, withinDeadline} from './transport.mjs';

export default {
  async fetch(request, env) {
    let origin, authorization;
    try {
      origin = publicOrigin(env);
      authorization = await originAuthorization(request, env);
      if (!authorization) return failure(403, 'Forbidden');
    } catch {
      return failure(503, 'Origin configuration unavailable');
    }
    const url = new URL(request.url);
    if (['TRACE', 'CONNECT'].includes(request.method)) return failure(405, 'Method not allowed');
    if (url.pathname === '/__yolo/version') return Response.json({version: env.APP_VERSION}, {headers: {'cache-control': 'no-store'}});
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      if (!env.BACKEND_ORIGIN || !env.BACKEND_ACCESS_CLIENT_ID || !env.BACKEND_ACCESS_CLIENT_SECRET) return failure(503, 'Backend configuration unavailable');
      try {
        const backend = new URL(env.BACKEND_ORIGIN);
        const app = new URL(origin).hostname.split('.')[0];
        if (backend.origin !== `https://api-origin-${app}.yolo-dev.ai` || backend.pathname !== '/' || backend.search || backend.hash || backend.username || backend.password ||
            !env.BACKEND_ACCESS_CLIENT_ID || !env.BACKEND_ACCESS_CLIENT_SECRET) return failure(503, 'Backend configuration unavailable');
        const target = new URL(backend.origin);
        target.pathname = url.pathname;
        target.search = url.search;
        const headers = cleanRequestHeaders(request.headers);
        headers.set('cf-access-client-id', env.BACKEND_ACCESS_CLIENT_ID);
        headers.set('cf-access-client-secret', env.BACKEND_ACCESS_CLIENT_SECRET);
        headers.set('x-forwarded-host', new URL(origin).host);
        headers.set('x-forwarded-proto', 'https');
        // Deliberately preserve /api and stream the body. Never follow a redirect
        // with the machine credential, nor infer a user from spoofable headers.
        return withinDeadline(authorization.deadline, async signal => {
          const result = await fetch(new Request(target, new Request(request, {headers, redirect: 'manual', signal})));
          return cleanResponse(result, backend.origin, origin);
        });
      } catch {
        return failure(502, 'Backend unavailable');
      }
    }
    try {
      const assetRequest = new Request(request, {headers: cleanRequestHeaders(request.headers)});
      return withinDeadline(authorization.deadline, async signal =>
        cleanResponse(await env.ASSETS.fetch(new Request(assetRequest, {signal})), url.origin, origin), 503);
    } catch {
      return failure(503, 'Assets unavailable');
    }
  }
};
