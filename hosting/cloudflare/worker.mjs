import {publicOrigin, originAuthorization, cleanRequestHeaders, cleanResponse, failure, withinDeadline} from './transport.mjs';

const PLAYER_TTL_MS = 18_000;
const INVITE_TTL_MS = 45_000;
const ROOM_TTL_MS = 120_000;
const MAX_ROOM_EVENTS = 160;
const VALID_GAMES = new Set(['tetris', 'puzzle-bobble']);
const VALID_STATUSES = new Set(['idle', 'inviting', 'playing_2p']);

const netplayPlayers = new Map();
const netplayInvites = new Map();
const netplayRooms = new Map();
let netplaySeq = 1;

function nextNetplayId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(netplaySeq++).toString(36)}`;
}

function cleanId(raw, maxLen = 64) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
}

function cleanName(raw) {
  if (typeof raw !== 'string') return 'Player';
  return raw.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Player';
}

function pruneNetplay(now) {
  for (const [id, p] of netplayPlayers.entries()) {
    if (now - p.updatedAt > PLAYER_TTL_MS) netplayPlayers.delete(id);
  }
  for (const [id, inv] of netplayInvites.entries()) {
    const host = netplayPlayers.get(inv.hostId);
    if (now - inv.createdAt > INVITE_TTL_MS || !host || (inv.status === 'open' && host.status === 'playing_2p')) {
      netplayInvites.delete(id);
    }
  }
  for (const [id, r] of netplayRooms.entries()) {
    if (now - r.updatedAt > ROOM_TTL_MS) netplayRooms.delete(id);
  }
}

function netplaySnapshot(clientId, afterSeq = 0) {
  const now = Date.now();
  pruneNetplay(now);
  const self = clientId ? netplayPlayers.get(clientId) : null;
  const players = Array.from(netplayPlayers.values()).map(p => ({
    id: p.id, name: p.name, status: p.status, appId: p.appId,
  }));
  const openInvites = [];
  const myPendingInvites = [];
  for (const inv of netplayInvites.values()) {
    if (inv.status !== 'open') continue;
    const item = {id: inv.id, gameId: inv.gameId, hostId: inv.hostId, hostName: inv.hostName, createdAt: inv.createdAt};
    if (inv.hostId === clientId) myPendingInvites.push(item);
    else if ((!self || self.status !== 'playing_2p') && !inv.dismissedBy.has(clientId)) openInvites.push(item);
  }
  let activeRoom = null;
  if (self && self.roomId) {
    const room = netplayRooms.get(self.roomId);
    if (room) {
      const lastRoomSeq = room.nextSeq - 1;
      const rawMinSeq = Number.isFinite(afterSeq) ? Math.max(0, Math.trunc(afterSeq)) : 0;
      const minSeq = rawMinSeq > lastRoomSeq ? 0 : rawMinSeq;
      const events = room.events.filter(ev => ev.seq > minSeq);
      activeRoom = {
        id: room.id, gameId: room.gameId, seed: room.seed, players: room.players,
        events, lastSeq: room.nextSeq - 1,
      };
    }
  }
  return {onlineCount: players.length, players, openInvites, myPendingInvites, activeRoom, serverTime: now};
}

async function handleNetplayRequest(request) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const clientId = cleanId(url.searchParams.get('clientId') || '');
    const afterSeq = Number.parseInt(url.searchParams.get('afterSeq') || '0', 10) || 0;
    return Response.json(netplaySnapshot(clientId, afterSeq), {headers: {'cache-control': 'no-store'}});
  }
  if (request.method !== 'POST') return failure(405, 'Method not allowed');
  let body = {};
  try {
    body = await request.json();
  } catch {
    return failure(400, 'Invalid JSON');
  }
  const now = Date.now();
  pruneNetplay(now);
  const action = typeof body.action === 'string' ? body.action : 'poll';
  const clientId = cleanId(body.clientId);
  if (!clientId) return Response.json({error: {kind: 'invalid_request', message: 'clientId is required.'}}, {status: 400, headers: {'cache-control': 'no-store'}});

  const name = cleanName(body.name);
  const appId = typeof body.appId === 'string' && VALID_GAMES.has(body.appId) ? body.appId : null;
  const requestedStatus = typeof body.status === 'string' && VALID_STATUSES.has(body.status) ? body.status : null;

  let player = netplayPlayers.get(clientId);
  if (!player) {
    player = {id: clientId, name, status: requestedStatus || 'idle', appId, roomId: null, updatedAt: now};
    netplayPlayers.set(clientId, player);
  } else {
    player.name = name || player.name;
    if (appId !== undefined) player.appId = appId;
    if (requestedStatus && (!player.roomId || requestedStatus === 'idle')) player.status = requestedStatus;
    player.updatedAt = now;
  }

  if (action === 'heartbeat' || action === 'poll') {
    const afterSeq = typeof body.afterSeq === 'number' ? Math.max(0, body.afterSeq) : 0;
    if (player.roomId && netplayRooms.has(player.roomId)) {
      const currentRoom = netplayRooms.get(player.roomId);
      if (appId && currentRoom.gameId !== appId) {
        const oldRoomId = player.roomId;
        netplayRooms.delete(oldRoomId);
        for (const p of netplayPlayers.values()) {
          if (p.roomId === oldRoomId) {
            p.roomId = null;
            if (p.status === 'playing_2p') p.status = 'idle';
          }
        }
      } else {
        currentRoom.updatedAt = now;
      }
    }
    return Response.json(netplaySnapshot(clientId, afterSeq), {headers: {'cache-control': 'no-store'}});
  }

  if (action === 'invite') {
    const gameId = typeof body.gameId === 'string' && VALID_GAMES.has(body.gameId) ? body.gameId : 'tetris';
    if (player.roomId) {
      const oldRoomId = player.roomId;
      netplayRooms.delete(oldRoomId);
      for (const p of netplayPlayers.values()) {
        if (p.roomId === oldRoomId) {
          p.roomId = null;
          if (p.status === 'playing_2p') p.status = 'idle';
        }
      }
    }
    for (const [id, inv] of netplayInvites.entries()) {
      if (inv.hostId === clientId && inv.status === 'open') netplayInvites.delete(id);
    }
    const inviteId = cleanId(body.inviteId) || nextNetplayId('inv');
    netplayInvites.set(inviteId, {
      id: inviteId, gameId, hostId: clientId, hostName: player.name,
      status: 'open', roomId: null, createdAt: now, dismissedBy: new Set(),
    });
    player.roomId = null;
    player.status = 'inviting';
    player.appId = gameId;
    return Response.json({...netplaySnapshot(clientId, 0), inviteId}, {headers: {'cache-control': 'no-store'}});
  }

  if (action === 'cancel_invite') {
    for (const [id, inv] of netplayInvites.entries()) {
      if (inv.hostId === clientId && inv.status === 'open') netplayInvites.delete(id);
    }
    if (player.status === 'inviting') player.status = 'idle';
    return Response.json(netplaySnapshot(clientId, 0), {headers: {'cache-control': 'no-store'}});
  }

  if (action === 'dismiss_invite') {
    const inv = netplayInvites.get(cleanId(body.inviteId));
    if (inv) inv.dismissedBy.add(clientId);
    return Response.json(netplaySnapshot(clientId, 0), {headers: {'cache-control': 'no-store'}});
  }

  if (action === 'accept_invite') {
    const inviteId = cleanId(body.inviteId);
    const inv = netplayInvites.get(inviteId);
    if (!inv || inv.status !== 'open') {
      return Response.json({error: {kind: 'invite_unavailable', message: 'Invite already accepted or expired.'}, ...netplaySnapshot(clientId, 0)}, {status: 409, headers: {'cache-control': 'no-store'}});
    }
    const host = netplayPlayers.get(inv.hostId);
    if (!host || host.id === clientId) {
      netplayInvites.delete(inviteId);
      return Response.json({error: {kind: 'invite_unavailable', message: 'Host player unavailable.'}, ...netplaySnapshot(clientId, 0)}, {status: 409, headers: {'cache-control': 'no-store'}});
    }
    const roomId = nextNetplayId('room');
    const seed = ((now & 0x7fffffff) ^ 0x5a5a5a5a) >>> 0 || 1337;
    const room = {
      id: roomId, gameId: inv.gameId, seed,
      players: [{id: host.id, name: host.name, slot: 0}, {id: player.id, name: player.name, slot: 1}],
      events: [{
        seq: 1, senderId: host.id, kind: 'match_start',
        payload: {roomId, gameId: inv.gameId, seed, players: [{id: host.id, name: host.name, slot: 0}, {id: player.id, name: player.name, slot: 1}]},
        at: now,
      }],
      nextSeq: 2, updatedAt: now,
    };
    netplayRooms.set(roomId, room);
    netplayInvites.delete(inviteId);
    for (const [id, otherInv] of netplayInvites.entries()) {
      if (otherInv.hostId === clientId) netplayInvites.delete(id);
    }
    host.roomId = roomId; host.status = 'playing_2p'; host.appId = inv.gameId; host.updatedAt = now;
    player.roomId = roomId; player.status = 'playing_2p'; player.appId = inv.gameId; player.updatedAt = now;
    return Response.json(netplaySnapshot(clientId, 0), {headers: {'cache-control': 'no-store'}});
  }

  if (action === 'room_event') {
    const roomId = cleanId(body.roomId) || player.roomId;
    const room = roomId ? netplayRooms.get(roomId) : null;
    if (!room) return Response.json({error: {kind: 'room_not_found', message: 'Match room ended.'}}, {status: 404, headers: {'cache-control': 'no-store'}});
    const kind = typeof body.kind === 'string' ? body.kind.slice(0, 40) : 'state';
    const seq = room.nextSeq++;
    room.events.push({seq, senderId: clientId, kind, payload: body.payload ?? null, at: now});
    if (room.events.length > MAX_ROOM_EVENTS) room.events.splice(0, room.events.length - MAX_ROOM_EVENTS);
    room.updatedAt = now;
    const afterSeq = typeof body.afterSeq === 'number' ? body.afterSeq : seq - 1;
    return Response.json(netplaySnapshot(clientId, afterSeq), {headers: {'cache-control': 'no-store'}});
  }

  if (action === 'leave_room') {
    const roomId = cleanId(body.roomId) || player.roomId;
    const room = roomId ? netplayRooms.get(roomId) : null;
    if (room) {
      room.events.push({seq: room.nextSeq++, senderId: clientId, kind: 'player_left', payload: {playerId: clientId, name: player.name}, at: now});
      room.updatedAt = now;
    }
    player.roomId = null;
    player.status = 'idle';
    return Response.json(netplaySnapshot(clientId, 0), {headers: {'cache-control': 'no-store'}});
  }

  return failure(400, 'Unknown netplay action');
}

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
    if (url.pathname === '/api/netplay') {
      return handleNetplayRequest(request);
    }
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
