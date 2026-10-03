/**
 * Local session protection.
 *
 * The browser only ever holds an opaque HttpOnly, SameSite=Strict cookie. GitHub
 * credentials stay inside `gh`; the server keeps the small amount of per-run state
 * (identity + target repo) in memory, so stopping the app ends the session.
 */
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'yolo_session';

export function createSessionStore() {
  const sessions = new Map();

  return {
    create(data) {
      const id = crypto.randomBytes(32).toString('base64url');
      sessions.set(id, { ...data, createdAt: Date.now() });
      return { id, data };
    },
    get(id) {
      if (typeof id !== 'string' || id.length < 20) return undefined;
      return sessions.get(id);
    },
    update(id, patch) {
      const current = sessions.get(id);
      if (!current) return undefined;
      const next = { ...current, ...patch };
      sessions.set(id, next);
      return next;
    },
    destroy(id) {
      return sessions.delete(id);
    },
    get size() {
      return sessions.size;
    },
    clear() {
      sessions.clear();
    },
  };
}

export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function setSessionCookie(res, id, { maxAgeSeconds = 60 * 60 * 12 } = {}) {
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', path: '/' });
}

export function sessionIdFrom(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}