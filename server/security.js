/**
 * Loopback and same-origin guards.
 *
 * The backend is an authenticated local service, so another website must not be
 * able to reach it (DNS rebinding) or mutate through it (CSRF).
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLoopbackHost(hostHeader) {
  const host = String(hostHeader || '').trim().toLowerCase();
  if (!host) return false;
  const withoutPort = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  if (LOOPBACK_HOSTS.has(withoutPort) || LOOPBACK_HOSTS.has(withoutPort.replace(/^\[|\]$/g, ''))) return true;
  return false;
}

/** Reject any request that did not arrive at a loopback name/address we serve. */
export function hostGuard(req, res, next) {
  if (!isLoopbackHost(req.headers.host)) {
    res.status(400).json({ error: { kind: 'bad_host', message: 'Requests must be sent to a loopback address.' } });
    return;
  }
  next();
}

/**
 * Mutations must come from our own page: same-origin Fetch Metadata, or an Origin
 * that matches the loopback host actually being served.
 */
export function sameOriginGuard(req, res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  const fetchSite = req.headers['sec-fetch-site'];
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    res.status(403).json({ error: { kind: 'cross_site', message: 'Cross-site requests are not allowed.' } });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      res.status(403).json({ error: { kind: 'cross_site', message: 'Cross-site requests are not allowed.' } });
      return;
    }
    const host = String(req.headers.host || '').toLowerCase();
    if (originHost.toLowerCase() !== host) {
      res.status(403).json({ error: { kind: 'cross_site', message: 'Cross-site requests are not allowed.' } });
      return;
    }
  } else if (fetchSite !== 'none') {
    // A browser always sends Origin for cross-site and same-site POSTs we care about;
    // a non-browser client (no Origin, no Fetch Metadata) is allowed through and
    // still needs a valid session cookie.
  }
  if (req.headers['x-requested-with'] && req.headers['x-requested-with'] !== 'yolo-blank-canvas') {
    res.status(403).json({ error: { kind: 'cross_site', message: 'Cross-site requests are not allowed.' } });
    return;
  }
  next();
}

/** Security headers for the served UI. The panel renders untrusted Markdown. */
export function securityHeaders(req, res, next) {
  void req;
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "media-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}