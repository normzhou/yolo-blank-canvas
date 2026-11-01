import {publicOrigin, originAuthorization, cleanRequestHeaders, cleanResponse, failure, withinDeadline} from './transport.mjs';

const PLAYER_TTL_MS = 25_000;
const INVITE_TTL_MS = 20_000;
const ROOM_TTL_MS = 90_000;
const SOCKET_INACTIVITY_TTL_MS = 90_000;
const SYNC_LAG_THRESHOLD_MS = 2_500;
const SYNC_TIMEOUT_MS = 15_000;
const MAX_ROOM_EVENTS = 160;
const VALID_GAMES = new Set(['tetris', 'puzzle-bobble']);
const VALID_STATUSES = new Set(['idle', 'inviting', 'playing_2p']);

function cleanId(raw, maxLen = 64) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
}

function cleanName(raw) {
  if (typeof raw !== 'string') return 'Player';
  return raw.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Player';
}

/**
 * Strongly-consistent global Durable Object coordinator (#236, #244, #286)
 * supporting Hibernatable WebSocket push (`Upgrade: websocket` on `/api/netplay`)
 * as primary transport and HTTP `GET`/`POST /api/netplay` as fallback.
 */
export class NetplayHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.players = new Map();
    this.invites = new Map();
    this.rooms = new Map();
    this.socketMeta = new Map();
    this.seq = 1;
    if (ctx && typeof ctx.blockConcurrencyWhile === 'function' && ctx.storage) {
      ctx.blockConcurrencyWhile(async () => {
        try {
          const saved = await ctx.storage.get('netplay_state');
          if (saved && typeof saved === 'object') {
            if (typeof saved.seq === 'number') this.seq = saved.seq;
            if (Array.isArray(saved.players)) {
              for (const [k, v] of saved.players) this.players.set(k, v);
            }
            if (Array.isArray(saved.invites)) {
              for (const [k, v] of saved.invites) {
                this.invites.set(k, {...v, dismissedBy: new Set(v.dismissedBy || [])});
              }
            }
            if (Array.isArray(saved.rooms)) {
              for (const [k, v] of saved.rooms) this.rooms.set(k, v);
            }
          }
          if (typeof ctx.getWebSockets === 'function') {
            for (const ws of ctx.getWebSockets()) {
              const att = ws.deserializeAttachment?.();
              if (att && typeof att.clientId === 'string') {
                this.socketMeta.set(ws, {clientId: att.clientId, lastSeq: Number(att.lastSeq) || 0});
              }
            }
          }
        } catch {
          // Start fresh if storage read fails
        }
      });
    }
  }

  getConnectedSockets() {
    if (this.ctx && typeof this.ctx.getWebSockets === 'function') {
      const list = this.ctx.getWebSockets();
      for (const ws of list) {
        if (!this.socketMeta.has(ws)) {
          const att = ws.deserializeAttachment?.();
          this.socketMeta.set(ws, {
            clientId: cleanId(att?.clientId || ''),
            lastSeq: Number(att?.lastSeq) || 0,
          });
        }
      }
      return list;
    }
    return Array.from(this.socketMeta.keys());
  }

  setSocketMeta(ws, meta) {
    this.socketMeta.set(ws, meta);
    try {
      ws.serializeAttachment?.({clientId: meta.clientId, lastSeq: meta.lastSeq});
    } catch {
      // Ignore attachment serialization errors
    }
  }

  sendSnapshotToWs(ws) {
    const meta = this.socketMeta.get(ws);
    if (!meta || !meta.clientId) return;
    const snap = this.snapshot(meta.clientId, meta.lastSeq);
    if (snap.activeRoom && typeof snap.activeRoom.lastSeq === 'number') {
      meta.lastSeq = snap.activeRoom.lastSeq;
    } else if (!snap.activeRoom) {
      meta.lastSeq = 0;
    }
    this.setSocketMeta(ws, meta);
    try {
      ws.send(JSON.stringify({type: 'snapshot', ...snap}));
    } catch {
      this.socketMeta.delete(ws);
    }
  }

  broadcastSnapshots(targetClientIds = null) {
    for (const ws of this.getConnectedSockets()) {
      const meta = this.socketMeta.get(ws);
      if (!meta || !meta.clientId) continue;
      if (targetClientIds && !targetClientIds.has(meta.clientId)) continue;
      this.sendSnapshotToWs(ws);
    }
    void this.scheduleAlarmIfNeeded();
  }

  async scheduleAlarmIfNeeded() {
    if (!this.ctx?.storage?.setAlarm) return;
    const hasPlayingRoom = Array.from(this.rooms.values()).some(r => r.status === 'playing');
    if (hasPlayingRoom && this.getConnectedSockets().length > 0) {
      try {
        await this.ctx.storage.setAlarm(Date.now() + 1_000);
      } catch {
        // Ignore alarm scheduling errors
      }
    }
  }

  async alarm() {
    const roomMemberIds = new Set();
    for (const r of this.rooms.values()) {
      if (r.status === 'playing') {
        for (const p of r.players) roomMemberIds.add(p.id);
      }
    }
    if (roomMemberIds.size > 0) {
      this.broadcastSnapshots(roomMemberIds);
    }
  }

  async persist(force = true) {
    if (!this.ctx || !this.ctx.storage) return;
    const now = Date.now();
    if (!force && this.lastPersistedAt && now - this.lastPersistedAt < 2_500) {
      return;
    }
    this.lastPersistedAt = now;
    try {
      await this.ctx.storage.put('netplay_state', {
        seq: this.seq,
        players: Array.from(this.players.entries()),
        invites: Array.from(this.invites.entries()).map(([k, v]) => [
          k,
          {...v, dismissedBy: Array.from(v.dismissedBy || [])},
        ]),
        rooms: Array.from(this.rooms.entries()),
      });
    } catch {
      // Ignore storage write errors
    }
  }

  nextId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${(this.seq++).toString(36)}`;
  }

  prune(now) {
    for (const [id, p] of this.players.entries()) {
      if (now - p.updatedAt > PLAYER_TTL_MS) this.players.delete(id);
    }
    for (const [id, inv] of this.invites.entries()) {
      const host = this.players.get(inv.hostId);
      if (now - inv.createdAt > INVITE_TTL_MS || !host || (inv.status === 'open' && host.status === 'playing_2p')) {
        this.invites.delete(id);
      }
    }
    for (const [id, r] of this.rooms.entries()) {
      if (now - r.updatedAt > ROOM_TTL_MS) this.rooms.delete(id);
    }
  }

  snapshot(clientId, afterSeq = 0) {
    const now = Date.now();
    this.prune(now);
    const self = clientId ? this.players.get(clientId) : null;
    const players = Array.from(this.players.values()).map(p => ({
      id: p.id, name: p.name, status: p.status, appId: p.appId,
    }));
    const openInvites = [];
    const myPendingInvites = [];
    for (const inv of this.invites.values()) {
      if (inv.status !== 'open') continue;
      const item = {id: inv.id, gameId: inv.gameId, hostId: inv.hostId, hostName: inv.hostName, createdAt: inv.createdAt};
      if (inv.hostId === clientId) myPendingInvites.push(item);
      else if ((!self || self.status !== 'playing_2p') && !inv.dismissedBy.has(clientId)) openInvites.push(item);
    }
    let activeRoom = null;
    if (self && self.roomId) {
      const room = this.rooms.get(self.roomId);
      if (room) {
        let syncStatus = 'ok';
        let syncRemainingMs = SYNC_TIMEOUT_MS;
        let laggingPlayerNames = [];
        if (room.status === 'playing') {
          const laggingPlayers = room.players.filter(
            p => p.lagging === true || (now - (p.lastSeenAt || room.updatedAt) > SYNC_LAG_THRESHOLD_MS),
          );
          if (laggingPlayers.length > 0) {
            if (!room.syncPausedSince) room.syncPausedSince = now;
            const elapsed = Math.max(0, now - room.syncPausedSince);
            syncRemainingMs = Math.max(0, SYNC_TIMEOUT_MS - elapsed);
            laggingPlayerNames = laggingPlayers.map(p => p.name);
            if (syncRemainingMs <= 0) {
              syncStatus = 'timeout';
              if (!room.timeoutEmitted) {
                room.timeoutEmitted = true;
                room.events.push({
                  seq: room.nextSeq++, senderId: laggingPlayers[0].id,
                  kind: 'sync_timeout', payload: {laggingPlayerNames}, at: now,
                });
              }
            } else {
              syncStatus = 'paused';
            }
          } else if (room.syncPausedSince) {
            room.syncPausedSince = null;
            room.events.push({
              seq: room.nextSeq++, senderId: clientId,
              kind: 'sync_resumed', payload: {resumedAt: now}, at: now,
            });
          }
        }
        const lastRoomSeq = room.nextSeq - 1;
        const rawMinSeq = Number.isFinite(afterSeq) ? Math.max(0, Math.trunc(afterSeq)) : 0;
        const minSeq = rawMinSeq > lastRoomSeq ? 0 : rawMinSeq;
        const events = room.events.filter(ev => ev.seq > minSeq);
        activeRoom = {
          id: room.id, gameId: room.gameId, seed: room.seed, status: room.status || 'playing',
          syncStatus, syncRemainingMs, laggingPlayerNames, players: room.players,
          events, lastSeq: room.nextSeq - 1,
        };
      }
    }
    return {onlineCount: players.length, players, openInvites, myPendingInvites, activeRoom, serverTime: now};
  }

  async processAction(body = {}, sourceWs = null) {
    const now = Date.now();
    this.prune(now);
    const action = typeof body.action === 'string' ? body.action : 'poll';
    const clientId = cleanId(body.clientId);
    if (!clientId) {
      return {status: 400, payload: {error: {kind: 'invalid_request', message: 'clientId is required.'}}};
    }

    const name = cleanName(body.name);
    const appId = typeof body.appId === 'string' && VALID_GAMES.has(body.appId) ? body.appId : null;
    const requestedStatus = typeof body.status === 'string' && VALID_STATUSES.has(body.status) ? body.status : null;

    let isNewPlayer = false;
    let statusChanged = false;
    let player = this.players.get(clientId);
    if (!player) {
      isNewPlayer = true;
      player = {id: clientId, name, status: requestedStatus || 'idle', appId, roomId: null, updatedAt: now};
      this.players.set(clientId, player);
    } else {
      if (name && player.name !== name) { player.name = name; statusChanged = true; }
      if (appId !== undefined && player.appId !== appId) { player.appId = appId; statusChanged = true; }
      if (requestedStatus && (!player.roomId || requestedStatus === 'idle')) {
        if (player.status !== requestedStatus) { player.status = requestedStatus; statusChanged = true; }
      }
      player.updatedAt = now;
    }

    if (sourceWs) {
      const prev = this.socketMeta.get(sourceWs) || {clientId, lastSeq: 0, lastInputAt: now};
      prev.clientId = clientId;
      if (typeof body.afterSeq === 'number' && body.afterSeq > prev.lastSeq) prev.lastSeq = body.afterSeq;
      const isUserInput =
        action !== 'heartbeat' &&
        action !== 'poll' &&
        !(action === 'room_event' && (body.kind === 'tetris_state' || body.kind === 'pb_state'));
      if (isUserInput || !prev.lastInputAt) {
        prev.lastInputAt = now;
      } else if (now - prev.lastInputAt > SOCKET_INACTIVITY_TTL_MS) {
        await this.webSocketClose(sourceWs);
        return {status: 200, payload: this.snapshot(clientId, 0)};
      }
      this.setSocketMeta(sourceWs, prev);
    }

    if (player.roomId && this.rooms.has(player.roomId)) {
      const activeRm = this.rooms.get(player.roomId);
      const member = activeRm?.players.find(p => p.id === clientId);
      if (member && !member.lagging && action !== 'simulate_lag') {
        member.lastSeenAt = now;
      }
    }

    if (action === 'simulate_lag') {
      const affected = new Set([clientId]);
      if (player.roomId && this.rooms.has(player.roomId)) {
        const rm = this.rooms.get(player.roomId);
        for (const p of rm.players) affected.add(p.id);
        const member = rm.players.find(p => p.id === clientId);
        if (member) {
          member.lagging = Boolean(body.lagging);
          if (!member.lagging) member.lastSeenAt = now;
          else if (typeof body.forceElapsedMs === 'number') rm.syncPausedSince = now - body.forceElapsedMs;
        }
      }
      await this.persist();
      const snap = this.snapshot(clientId, 0);
      this.broadcastSnapshots(affected);
      return {status: 200, payload: snap};
    }

    if (action === 'heartbeat' || action === 'poll') {
      const afterSeq = typeof body.afterSeq === 'number' ? Math.max(0, body.afterSeq) : 0;
      let roomDissolved = false;
      if (player.roomId && this.rooms.has(player.roomId)) {
        const currentRoom = this.rooms.get(player.roomId);
        if (appId && currentRoom.gameId !== appId) {
          const oldRoomId = player.roomId;
          this.rooms.delete(oldRoomId);
          for (const p of this.players.values()) {
            if (p.roomId === oldRoomId) {
              p.roomId = null;
              if (p.status === 'playing_2p') p.status = 'idle';
            }
          }
          roomDissolved = true;
        } else {
          currentRoom.updatedAt = now;
        }
      }
      await this.persist(roomDissolved);
      const snap = this.snapshot(clientId, afterSeq);
      if (isNewPlayer || statusChanged || roomDissolved) {
        this.broadcastSnapshots();
      } else if (sourceWs) {
        this.sendSnapshotToWs(sourceWs);
      }
      return {status: 200, payload: snap};
    }

    if (action === 'invite') {
      const gameId = typeof body.gameId === 'string' && VALID_GAMES.has(body.gameId) ? body.gameId : 'tetris';
      if (player.roomId) {
        const oldRoomId = player.roomId;
        this.rooms.delete(oldRoomId);
        for (const p of this.players.values()) {
          if (p.roomId === oldRoomId) {
            p.roomId = null;
            if (p.status === 'playing_2p') p.status = 'idle';
          }
        }
      }
      for (const [id, inv] of this.invites.entries()) {
        if (inv.hostId === clientId && inv.status === 'open') this.invites.delete(id);
      }
      for (const [existingId, existingInv] of this.invites.entries()) {
        if (existingInv.status === 'open' && existingInv.gameId === gameId && existingInv.hostId !== clientId) {
          const host = this.players.get(existingInv.hostId);
          if (host && host.status !== 'playing_2p') {
            const roomId = this.nextId('room');
            const seed = ((now & 0x7fffffff) ^ 0x5a5a5a5a) >>> 0 || 1337;
            const room = {
              id: roomId, gameId, seed, status: 'ready_check',
              players: [{id: host.id, name: host.name, slot: 0, ready: false}, {id: player.id, name: player.name, slot: 1, ready: false}],
              events: [{
                seq: 1, senderId: host.id, kind: 'room_joined',
                payload: {roomId, gameId, seed, status: 'ready_check', players: [{id: host.id, name: host.name, slot: 0, ready: false}, {id: player.id, name: player.name, slot: 1, ready: false}]},
                at: now,
              }],
              nextSeq: 2, updatedAt: now,
            };
            this.rooms.set(roomId, room);
            this.invites.delete(existingId);
            host.roomId = roomId; host.status = 'playing_2p'; host.appId = gameId; host.updatedAt = now;
            player.roomId = roomId; player.status = 'playing_2p'; player.appId = gameId; player.updatedAt = now;
            await this.persist();
            const snap = this.snapshot(clientId, 0);
            this.broadcastSnapshots();
            return {status: 200, payload: snap};
          }
        }
      }
      const inviteId = cleanId(body.inviteId) || this.nextId('inv');
      this.invites.set(inviteId, {
        id: inviteId, gameId, hostId: clientId, hostName: player.name,
        status: 'open', roomId: null, createdAt: now, dismissedBy: new Set(),
      });
      player.roomId = null;
      player.status = 'inviting';
      player.appId = gameId;
      await this.persist();
      const snap = {...this.snapshot(clientId, 0), inviteId};
      this.broadcastSnapshots();
      return {status: 200, payload: snap};
    }

    if (action === 'cancel_invite') {
      for (const [id, inv] of this.invites.entries()) {
        if (inv.hostId === clientId && inv.status === 'open') this.invites.delete(id);
      }
      if (player.status === 'inviting') player.status = 'idle';
      await this.persist();
      const snap = this.snapshot(clientId, 0);
      this.broadcastSnapshots();
      return {status: 200, payload: snap};
    }

    if (action === 'dismiss_invite') {
      const inv = this.invites.get(cleanId(body.inviteId));
      if (inv) inv.dismissedBy.add(clientId);
      await this.persist();
      const snap = this.snapshot(clientId, 0);
      this.broadcastSnapshots(new Set([clientId]));
      return {status: 200, payload: snap};
    }

    if (action === 'accept_invite') {
      const inviteId = cleanId(body.inviteId);
      const inv = this.invites.get(inviteId);
      if (!inv || inv.status !== 'open') {
        return {status: 409, payload: {error: {kind: 'invite_unavailable', message: 'Invite already accepted or expired.'}, ...this.snapshot(clientId, 0)}};
      }
      const host = this.players.get(inv.hostId);
      if (!host || host.id === clientId) {
        this.invites.delete(inviteId);
        await this.persist();
        return {status: 409, payload: {error: {kind: 'invite_unavailable', message: 'Host player unavailable.'}, ...this.snapshot(clientId, 0)}};
      }
      const roomId = this.nextId('room');
      const seed = ((now & 0x7fffffff) ^ 0x5a5a5a5a) >>> 0 || 1337;
      const room = {
        id: roomId, gameId: inv.gameId, seed, status: 'ready_check',
        players: [{id: host.id, name: host.name, slot: 0, ready: false}, {id: player.id, name: player.name, slot: 1, ready: false}],
        events: [{
          seq: 1, senderId: host.id, kind: 'room_joined',
          payload: {roomId, gameId: inv.gameId, seed, status: 'ready_check', players: [{id: host.id, name: host.name, slot: 0, ready: false}, {id: player.id, name: player.name, slot: 1, ready: false}]},
          at: now,
        }],
        nextSeq: 2, updatedAt: now,
      };
      this.rooms.set(roomId, room);
      this.invites.delete(inviteId);
      for (const [id, otherInv] of this.invites.entries()) {
        if (otherInv.hostId === clientId) this.invites.delete(id);
      }
      host.roomId = roomId; host.status = 'playing_2p'; host.appId = inv.gameId; host.updatedAt = now;
      player.roomId = roomId; player.status = 'playing_2p'; player.appId = inv.gameId; player.updatedAt = now;
      await this.persist();
      const snap = this.snapshot(clientId, 0);
      this.broadcastSnapshots();
      return {status: 200, payload: snap};
    }

    if (action === 'player_ready') {
      const roomId = cleanId(body.roomId) || player.roomId;
      const room = roomId ? this.rooms.get(roomId) : null;
      if (!room) return {status: 404, payload: {error: {kind: 'room_not_found', message: 'Match room ended.'}}};
      const member = room.players.find(p => p.id === clientId);
      if (member) member.ready = true;
      const seq = room.nextSeq++;
      room.events.push({seq, senderId: clientId, kind: 'player_ready', payload: {playerId: clientId, players: room.players.map(p => ({...p}))}, at: now});
      if (room.players.every(p => p.ready) && room.status !== 'playing') {
        room.status = 'playing';
        room.syncPausedSince = null;
        for (const p of room.players) {
          p.lastSeenAt = now;
          p.lagging = false;
        }
        const startSeq = room.nextSeq++;
        room.events.push({seq: startSeq, senderId: clientId, kind: 'match_start', payload: {roomId: room.id, gameId: room.gameId, seed: room.seed, players: room.players.map(p => ({...p}))}, at: now});
      }
      room.updatedAt = now;
      const afterSeq = typeof body.afterSeq === 'number' ? body.afterSeq : seq - 1;
      await this.persist();
      const snap = this.snapshot(clientId, afterSeq);
      this.broadcastSnapshots(new Set(room.players.map(p => p.id)));
      return {status: 200, payload: snap};
    }

    if (action === 'room_event') {
      const roomId = cleanId(body.roomId) || player.roomId;
      const room = roomId ? this.rooms.get(roomId) : null;
      if (!room) return {status: 404, payload: {error: {kind: 'room_not_found', message: 'Match room ended.'}}};
      const kind = typeof body.kind === 'string' ? body.kind.slice(0, 40) : 'state';
      const isRadarTick = kind === 'tetris_state' || kind === 'pb_state';
      if (isRadarTick) {
        room.events = room.events.filter(ev => !(ev.senderId === clientId && ev.kind === kind));
      }
      const seq = room.nextSeq++;
      room.events.push({seq, senderId: clientId, kind, payload: body.payload ?? null, at: now});
      if (room.events.length > MAX_ROOM_EVENTS) room.events.splice(0, room.events.length - MAX_ROOM_EVENTS);
      room.updatedAt = now;
      const afterSeq = typeof body.afterSeq === 'number' ? body.afterSeq : seq - 1;
      await this.persist(!isRadarTick);
      const snap = this.snapshot(clientId, afterSeq);
      this.broadcastSnapshots(new Set(room.players.map(p => p.id)));
      return {status: 200, payload: snap};
    }

    if (action === 'leave_room') {
      const roomId = cleanId(body.roomId) || player.roomId;
      const room = roomId ? this.rooms.get(roomId) : null;
      if (room) {
        room.events.push({seq: room.nextSeq++, senderId: clientId, kind: 'player_left', payload: {playerId: clientId, name: player.name}, at: now});
        room.updatedAt = now;
      }
      player.roomId = null;
      player.status = 'idle';
      await this.persist();
      const snap = this.snapshot(clientId, 0);
      this.broadcastSnapshots();
      return {status: 200, payload: snap};
    }

    return {status: 400, payload: {error: {kind: 'invalid_request', message: 'Unknown netplay action.'}}};
  }

  async webSocketMessage(ws, message) {
    try {
      const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const body = JSON.parse(raw);
      if (body && typeof body === 'object') {
        await this.processAction(body, ws);
      }
    } catch {
      // Ignore malformed WebSocket messages
    }
  }

  async webSocketClose(ws) {
    const meta = this.socketMeta.get(ws);
    this.socketMeta.delete(ws);
    try {
      ws.close(1000, 'closed');
    } catch {
      // Already closed
    }
    if (meta?.clientId) {
      const stillConnected = this.getConnectedSockets().some(
        other => other !== ws && this.socketMeta.get(other)?.clientId === meta.clientId,
      );
      const p = this.players.get(meta.clientId);
      if (!stillConnected && p && p.status === 'idle' && !p.roomId) {
        this.players.delete(meta.clientId);
        await this.persist(false);
        this.broadcastSnapshots();
      }
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if ((request.headers.get('upgrade') || '').toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const clientId = cleanId(url.searchParams.get('clientId') || '');
      const name = cleanName(url.searchParams.get('name') || 'Player');
      const appId = url.searchParams.get('appId') || null;

      if (this.ctx && typeof this.ctx.acceptWebSocket === 'function') {
        this.ctx.acceptWebSocket(server, clientId ? [clientId] : []);
      } else {
        server.accept();
        server.addEventListener('message', event => {
          void this.webSocketMessage(server, event.data);
        });
        server.addEventListener('close', () => {
          void this.webSocketClose(server);
        });
        server.addEventListener('error', () => {
          void this.webSocketError(server);
        });
      }

      this.setSocketMeta(server, {clientId, lastSeq: 0, lastInputAt: Date.now()});
      if (clientId) {
        setTimeout(() => {
          void this.processAction(
            {action: 'heartbeat', clientId, name, appId, status: 'idle'},
            server,
          );
        }, 0);
      }
      return new Response(null, {status: 101, webSocket: client});
    }

    if (request.method === 'GET') {
      const clientId = cleanId(url.searchParams.get('clientId') || '');
      const afterSeq = Number.parseInt(url.searchParams.get('afterSeq') || '0', 10) || 0;
      return Response.json(this.snapshot(clientId, afterSeq), {headers: {'cache-control': 'no-store'}});
    }
    if (request.method !== 'POST') return failure(405, 'Method not allowed');
    let body = {};
    try {
      body = await request.json();
    } catch {
      return failure(400, 'Invalid JSON');
    }
    const result = await this.processAction(body, null);
    return Response.json(result.payload, {status: result.status, headers: {'cache-control': 'no-store'}});
  }
}

const fallbackHub = new NetplayHub(null, null);

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
      return withinDeadline(authorization.deadline, async () => {
        if (env.NETPLAY_HUB && typeof env.NETPLAY_HUB.idFromName === 'function') {
          const id = env.NETPLAY_HUB.idFromName('global');
          return env.NETPLAY_HUB.get(id).fetch(request);
        }
        return fallbackHub.fetch(request);
      });
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
        return withinDeadline(authorization.deadline, async signal => {
          const result = await fetch(new Request(target, new Request(request, {headers, redirect: 'manual', signal})));
          return cleanResponse(result, backend.origin, origin);
        });
      } catch {
        return failure(502, 'Backend unavailable');
      }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return failure(405, 'Method not allowed');
    const asset = await env.ASSETS.fetch(request);
    const out = new Response(asset.body, asset);
    if (url.pathname === '/' || url.pathname.endsWith('.html')) out.headers.set('cache-control', 'no-cache');
    return out;
  },
};
