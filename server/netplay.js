/**
 * Multi-user online presence, open 2P game invites, and real-time room event
 * relay (#236, #286).
 *
 * Shared by the local Express server (`server/app.js`) and mirrored by the
 * Cloudflare Worker Durable Object (`hosting/cloudflare/worker.mjs`) so that
 * `Tetris` and `Puzzle Bobble` 2-player online matchmaking and gameplay work
 * identically over WebSockets (primary) and HTTP `/api/netplay` (fallback).
 */
import crypto from 'node:crypto';

const PLAYER_TTL_MS = 25_000;
const INVITE_TTL_MS = 20_000;
const ROOM_TTL_MS = 120_000;
const SYNC_LAG_THRESHOLD_MS = 2_500;
const SYNC_TIMEOUT_MS = 15_000;
const MAX_ROOM_EVENTS = 160;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const VALID_GAMES = new Set(['tetris', 'puzzle-bobble']);
const VALID_STATUSES = new Set(['idle', 'inviting', 'playing_2p']);

function cleanId(raw, maxLen = 64) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
}

function cleanName(raw) {
  if (typeof raw !== 'string') return 'Player';
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 24);
  return trimmed || 'Player';
}

function encodeWsFrame(text, opcode = 0x1) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeWsFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let payloadLen = second & 0x7f;
    let headerLen = 2;
    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }
    const maskLen = masked ? 4 : 0;
    const totalLen = headerLen + maskLen + payloadLen;
    if (offset + totalLen > buffer.length) break;
    const payloadStart = offset + headerLen + maskLen;
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLen));
    if (masked) {
      const mask = buffer.subarray(offset + headerLen, offset + headerLen + 4);
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] ^= mask[i & 3];
      }
    }
    frames.push({ opcode, payload });
    offset += totalLen;
  }
  return { frames, remaining: buffer.subarray(offset) };
}

export function createNetplayHub({ now = () => Date.now() } = {}) {
  /** @type {Map<string, { id: string, name: string, status: string, appId: string | null, roomId: string | null, updatedAt: number }>} */
  const players = new Map();
  /** @type {Map<string, { id: string, gameId: string, hostId: string, hostName: string, status: 'open' | 'accepted' | 'dismissed', roomId: string | null, createdAt: number, dismissedBy: Set<string> }>} */
  const invites = new Map();
  /** @type {Map<string, { id: string, gameId: string, seed: number, status?: 'ready_check' | 'playing', syncPausedSince?: number | null, timeoutEmitted?: boolean, players: Array<{ id: string, name: string, slot: 0 | 1, ready?: boolean, lastSeenAt?: number, lagging?: boolean }>, events: Array<{ seq: number, senderId: string, kind: string, payload: unknown, at: number }>, nextSeq: number, updatedAt: number }>} */
  const rooms = new Map();
  /** @type {Map<import('node:net').Socket, { clientId: string, lastSeq: number, buffer: Buffer }>} */
  const sockets = new Map();
  let syncMonitorTimer = null;

  let idCounter = 1;
  function nextId(prefix) {
    const ts = now().toString(36);
    const seq = (idCounter++).toString(36);
    return `${prefix}_${ts}_${seq}`;
  }

  function prune(currentTime) {
    for (const [id, player] of players.entries()) {
      if (currentTime - player.updatedAt > PLAYER_TTL_MS) {
        players.delete(id);
      }
    }
    for (const [id, invite] of invites.entries()) {
      const host = players.get(invite.hostId);
      if (
        currentTime - invite.createdAt > INVITE_TTL_MS ||
        !host ||
        (invite.status === 'open' && host.status === 'playing_2p')
      ) {
        invites.delete(id);
      }
    }
    for (const [id, room] of rooms.entries()) {
      if (currentTime - room.updatedAt > ROOM_TTL_MS) {
        rooms.delete(id);
      }
    }
  }

  function snapshotFor(clientId, afterSeq = 0) {
    const currentTime = now();
    prune(currentTime);

    const self = clientId ? players.get(clientId) : null;
    const onlinePlayers = Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      appId: p.appId,
    }));

    const openInvites = [];
    const myPendingInvites = [];
    for (const inv of invites.values()) {
      if (inv.status !== 'open') continue;
      if (inv.hostId === clientId) {
        myPendingInvites.push({
          id: inv.id,
          gameId: inv.gameId,
          hostId: inv.hostId,
          hostName: inv.hostName,
          createdAt: inv.createdAt,
        });
      } else if ((!self || self.status !== 'playing_2p') && !inv.dismissedBy.has(clientId)) {
        openInvites.push({
          id: inv.id,
          gameId: inv.gameId,
          hostId: inv.hostId,
          hostName: inv.hostName,
          createdAt: inv.createdAt,
        });
      }
    }

    let activeRoom = null;
    if (self && self.roomId) {
      const room = rooms.get(self.roomId);
      if (room) {
        let syncStatus = 'ok';
        let syncRemainingMs = SYNC_TIMEOUT_MS;
        let laggingPlayerNames = [];
        if (room.status === 'playing') {
          const laggingPlayers = room.players.filter(
            (p) =>
              p.lagging === true ||
              currentTime - (p.lastSeenAt || room.updatedAt) > SYNC_LAG_THRESHOLD_MS,
          );
          if (laggingPlayers.length > 0) {
            if (!room.syncPausedSince) {
              room.syncPausedSince = currentTime;
            }
            const elapsed = Math.max(0, currentTime - room.syncPausedSince);
            syncRemainingMs = Math.max(0, SYNC_TIMEOUT_MS - elapsed);
            laggingPlayerNames = laggingPlayers.map((p) => p.name);
            if (syncRemainingMs <= 0) {
              syncStatus = 'timeout';
              if (!room.timeoutEmitted) {
                room.timeoutEmitted = true;
                room.events.push({
                  seq: room.nextSeq++,
                  senderId: laggingPlayers[0].id,
                  kind: 'sync_timeout',
                  payload: { laggingPlayerNames },
                  at: currentTime,
                });
              }
            } else {
              syncStatus = 'paused';
            }
          } else if (room.syncPausedSince) {
            room.syncPausedSince = null;
            room.events.push({
              seq: room.nextSeq++,
              senderId: clientId,
              kind: 'sync_resumed',
              payload: { resumedAt: currentTime },
              at: currentTime,
            });
          }
        }

        const lastRoomSeq = room.nextSeq - 1;
        const rawMinSeq = Number.isFinite(afterSeq) ? Math.max(0, Math.trunc(afterSeq)) : 0;
        const minSeq = rawMinSeq > lastRoomSeq ? 0 : rawMinSeq;
        const events = room.events
          .filter((ev) => ev.seq > minSeq)
          .map((ev) => ({
            seq: ev.seq,
            senderId: ev.senderId,
            kind: ev.kind,
            payload: ev.payload,
            at: ev.at,
          }));
        activeRoom = {
          id: room.id,
          gameId: room.gameId,
          seed: room.seed,
          status: room.status || 'playing',
          syncStatus,
          syncRemainingMs,
          laggingPlayerNames,
          players: room.players,
          events,
          lastSeq: room.nextSeq - 1,
        };
      }
    }

    return {
      onlineCount: onlinePlayers.length,
      players: onlinePlayers,
      openInvites,
      myPendingInvites,
      activeRoom,
      serverTime: currentTime,
    };
  }

  function sendSnapshotToSocket(socket, meta) {
    if (socket.destroyed || !meta.clientId) return;
    const snap = snapshotFor(meta.clientId, meta.lastSeq);
    if (snap.activeRoom && typeof snap.activeRoom.lastSeq === 'number') {
      meta.lastSeq = snap.activeRoom.lastSeq;
    } else if (!snap.activeRoom) {
      meta.lastSeq = 0;
    }
    try {
      socket.write(encodeWsFrame(JSON.stringify({ type: 'snapshot', ...snap })));
    } catch {
      sockets.delete(socket);
    }
  }

  function broadcastSnapshots(targetClientIds = null) {
    for (const [socket, meta] of sockets.entries()) {
      if (!meta.clientId) continue;
      if (targetClientIds && !targetClientIds.has(meta.clientId)) continue;
      sendSnapshotToSocket(socket, meta);
    }
    ensureSyncMonitor();
  }

  function ensureSyncMonitor() {
    const hasPlayingRoom = Array.from(rooms.values()).some((r) => r.status === 'playing');
    if (hasPlayingRoom && sockets.size > 0 && !syncMonitorTimer) {
      syncMonitorTimer = setInterval(() => {
        if (sockets.size === 0 || rooms.size === 0) {
          clearInterval(syncMonitorTimer);
          syncMonitorTimer = null;
          return;
        }
        const roomMemberIds = new Set();
        for (const r of rooms.values()) {
          if (r.status === 'playing') {
            for (const p of r.players) roomMemberIds.add(p.id);
          }
        }
        if (roomMemberIds.size > 0) {
          broadcastSnapshots(roomMemberIds);
        }
      }, 600);
      if (typeof syncMonitorTimer.unref === 'function') syncMonitorTimer.unref();
    } else if ((!hasPlayingRoom || sockets.size === 0) && syncMonitorTimer) {
      clearInterval(syncMonitorTimer);
      syncMonitorTimer = null;
    }
  }

  function handleAction(body = {}, sourceSocket = null) {
    const currentTime = now();
    prune(currentTime);

    const action = typeof body.action === 'string' ? body.action : 'poll';
    const clientId = cleanId(body.clientId);
    if (!clientId) {
      return {
        status: 400,
        payload: { error: { kind: 'invalid_request', message: 'clientId is required.' } },
      };
    }

    const name = cleanName(body.name);
    const appId = typeof body.appId === 'string' && VALID_GAMES.has(body.appId) ? body.appId : null;
    const requestedStatus =
      typeof body.status === 'string' && VALID_STATUSES.has(body.status) ? body.status : null;

    let isNewPlayer = false;
    let statusChanged = false;
    let player = players.get(clientId);
    if (!player) {
      isNewPlayer = true;
      player = {
        id: clientId,
        name,
        status: requestedStatus || 'idle',
        appId,
        roomId: null,
        updatedAt: currentTime,
      };
      players.set(clientId, player);
    } else {
      if (name && player.name !== name) {
        player.name = name;
        statusChanged = true;
      }
      if (appId !== undefined && player.appId !== appId) {
        player.appId = appId;
        statusChanged = true;
      }
      if (requestedStatus && (!player.roomId || requestedStatus === 'idle')) {
        if (player.status !== requestedStatus) {
          player.status = requestedStatus;
          statusChanged = true;
        }
      }
      player.updatedAt = currentTime;
    }

    if (sourceSocket && sockets.has(sourceSocket)) {
      const meta = sockets.get(sourceSocket);
      meta.clientId = clientId;
      if (typeof body.afterSeq === 'number' && body.afterSeq > meta.lastSeq) {
        meta.lastSeq = body.afterSeq;
      }
    }

    if (player.roomId && rooms.has(player.roomId)) {
      const activeRm = rooms.get(player.roomId);
      const member = activeRm?.players.find((p) => p.id === clientId);
      if (member && !member.lagging && action !== 'simulate_lag') {
        member.lastSeenAt = currentTime;
      }
    }

    if (action === 'simulate_lag') {
      const affected = new Set([clientId]);
      if (player.roomId && rooms.has(player.roomId)) {
        const rm = rooms.get(player.roomId);
        for (const p of rm.players) affected.add(p.id);
        const member = rm.players.find((p) => p.id === clientId);
        if (member) {
          member.lagging = Boolean(body.lagging);
          if (!member.lagging) {
            member.lastSeenAt = currentTime;
          } else if (typeof body.forceElapsedMs === 'number') {
            rm.syncPausedSince = currentTime - body.forceElapsedMs;
          }
        }
      }
      const snap = snapshotFor(clientId, 0);
      broadcastSnapshots(affected);
      return { status: 200, payload: snap };
    }

    if (action === 'heartbeat' || action === 'poll') {
      const afterSeq = typeof body.afterSeq === 'number' ? body.afterSeq : 0;
      let roomDissolved = false;
      if (player.roomId && rooms.has(player.roomId)) {
        const currentRoom = rooms.get(player.roomId);
        if (appId && currentRoom.gameId !== appId) {
          const oldRoomId = player.roomId;
          rooms.delete(oldRoomId);
          for (const p of players.values()) {
            if (p.roomId === oldRoomId) {
              p.roomId = null;
              if (p.status === 'playing_2p') p.status = 'idle';
            }
          }
          roomDissolved = true;
        } else {
          currentRoom.updatedAt = currentTime;
        }
      }
      const snap = snapshotFor(clientId, afterSeq);
      if (isNewPlayer || statusChanged || roomDissolved) {
        broadcastSnapshots();
      } else if (sourceSocket && sockets.has(sourceSocket)) {
        sendSnapshotToSocket(sourceSocket, sockets.get(sourceSocket));
      }
      return { status: 200, payload: snap };
    }

    if (action === 'invite') {
      const gameId =
        typeof body.gameId === 'string' && VALID_GAMES.has(body.appId || body.gameId)
          ? body.gameId || body.appId
          : 'tetris';
      if (player.roomId) {
        const oldRoomId = player.roomId;
        rooms.delete(oldRoomId);
        for (const p of players.values()) {
          if (p.roomId === oldRoomId) {
            p.roomId = null;
            if (p.status === 'playing_2p') p.status = 'idle';
          }
        }
      }
      for (const [id, inv] of invites.entries()) {
        if (inv.hostId === clientId && inv.status === 'open') {
          invites.delete(id);
        }
      }
      for (const [existingId, existingInv] of invites.entries()) {
        if (
          existingInv.status === 'open' &&
          existingInv.gameId === gameId &&
          existingInv.hostId !== clientId
        ) {
          const host = players.get(existingInv.hostId);
          if (host && host.status !== 'playing_2p') {
            const roomId = nextId('room');
            const seed = ((currentTime & 0x7fffffff) ^ 0x5a5a5a5a) >>> 0 || 1337;
            const room = {
              id: roomId,
              gameId,
              seed,
              status: 'ready_check',
              players: [
                { id: host.id, name: host.name, slot: 0, ready: false },
                { id: player.id, name: player.name, slot: 1, ready: false },
              ],
              events: [
                {
                  seq: 1,
                  senderId: host.id,
                  kind: 'room_joined',
                  payload: {
                    roomId,
                    gameId,
                    seed,
                    status: 'ready_check',
                    players: [
                      { id: host.id, name: host.name, slot: 0, ready: false },
                      { id: player.id, name: player.name, slot: 1, ready: false },
                    ],
                  },
                  at: currentTime,
                },
              ],
              nextSeq: 2,
              updatedAt: currentTime,
            };
            rooms.set(roomId, room);
            invites.delete(existingId);
            host.roomId = roomId;
            host.status = 'playing_2p';
            host.appId = gameId;
            host.updatedAt = currentTime;
            player.roomId = roomId;
            player.status = 'playing_2p';
            player.appId = gameId;
            player.updatedAt = currentTime;
            const snap = snapshotFor(clientId, 0);
            broadcastSnapshots();
            return { status: 200, payload: snap };
          }
        }
      }
      const inviteId = cleanId(body.inviteId) || nextId('inv');
      invites.set(inviteId, {
        id: inviteId,
        gameId,
        hostId: clientId,
        hostName: player.name,
        status: 'open',
        roomId: null,
        createdAt: currentTime,
        dismissedBy: new Set(),
      });
      player.roomId = null;
      player.status = 'inviting';
      player.appId = gameId;
      const snap = { ...snapshotFor(clientId, 0), inviteId };
      broadcastSnapshots();
      return { status: 200, payload: snap };
    }

    if (action === 'cancel_invite') {
      for (const [id, inv] of invites.entries()) {
        if (inv.hostId === clientId && inv.status === 'open') {
          invites.delete(id);
        }
      }
      if (player.status === 'inviting') player.status = 'idle';
      const snap = snapshotFor(clientId, 0);
      broadcastSnapshots();
      return { status: 200, payload: snap };
    }

    if (action === 'dismiss_invite') {
      const inviteId = cleanId(body.inviteId);
      const inv = invites.get(inviteId);
      if (inv) {
        inv.dismissedBy.add(clientId);
      }
      const snap = snapshotFor(clientId, 0);
      broadcastSnapshots(new Set([clientId]));
      return { status: 200, payload: snap };
    }

    if (action === 'accept_invite') {
      const inviteId = cleanId(body.inviteId);
      const inv = invites.get(inviteId);
      if (!inv || inv.status !== 'open') {
        return {
          status: 409,
          payload: {
            error: {
              kind: 'invite_unavailable',
              message: 'That 2P invite was already accepted or expired.',
            },
            ...snapshotFor(clientId, 0),
          },
        };
      }
      const host = players.get(inv.hostId);
      if (!host || host.id === clientId) {
        invites.delete(inviteId);
        return {
          status: 409,
          payload: {
            error: { kind: 'invite_unavailable', message: 'Host player is no longer available.' },
            ...snapshotFor(clientId, 0),
          },
        };
      }

      const roomId = nextId('room');
      const seed = ((currentTime & 0x7fffffff) ^ 0x5a5a5a5a) >>> 0;
      const room = {
        id: roomId,
        gameId: inv.gameId,
        seed: seed || 1337,
        status: 'ready_check',
        players: [
          { id: host.id, name: host.name, slot: /** @type {0} */ (0), ready: false },
          { id: player.id, name: player.name, slot: /** @type {1} */ (1), ready: false },
        ],
        events: [
          {
            seq: 1,
            senderId: host.id,
            kind: 'room_joined',
            payload: {
              roomId,
              gameId: inv.gameId,
              seed: seed || 1337,
              status: 'ready_check',
              players: [
                { id: host.id, name: host.name, slot: 0, ready: false },
                { id: player.id, name: player.name, slot: 1, ready: false },
              ],
            },
            at: currentTime,
          },
        ],
        nextSeq: 2,
        updatedAt: currentTime,
      };
      rooms.set(roomId, room);
      inv.status = 'accepted';
      inv.roomId = roomId;
      invites.delete(inviteId);

      for (const [id, otherInv] of invites.entries()) {
        if (otherInv.hostId === clientId) invites.delete(id);
      }

      host.roomId = roomId;
      host.status = 'playing_2p';
      host.appId = inv.gameId;
      host.updatedAt = currentTime;

      player.roomId = roomId;
      player.status = 'playing_2p';
      player.appId = inv.gameId;
      player.updatedAt = currentTime;

      const snap = snapshotFor(clientId, 0);
      broadcastSnapshots();
      return { status: 200, payload: snap };
    }

    if (action === 'player_ready') {
      const roomId = cleanId(body.roomId) || player.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) {
        return {
          status: 404,
          payload: { error: { kind: 'room_not_found', message: 'Match room ended.' } },
        };
      }
      const member = room.players.find((p) => p.id === clientId);
      if (member) {
        member.ready = true;
      }
      const seq = room.nextSeq++;
      room.events.push({
        seq,
        senderId: clientId,
        kind: 'player_ready',
        payload: { playerId: clientId, players: room.players.map((p) => ({ ...p })) },
        at: currentTime,
      });
      if (room.players.every((p) => p.ready) && room.status !== 'playing') {
        room.status = 'playing';
        room.syncPausedSince = null;
        for (const p of room.players) {
          p.lastSeenAt = currentTime;
          p.lagging = false;
        }
        const startSeq = room.nextSeq++;
        room.events.push({
          seq: startSeq,
          senderId: clientId,
          kind: 'match_start',
          payload: {
            roomId: room.id,
            gameId: room.gameId,
            seed: room.seed,
            players: room.players.map((p) => ({ ...p })),
          },
          at: currentTime,
        });
      }
      room.updatedAt = currentTime;
      const afterSeq = typeof body.afterSeq === 'number' ? body.afterSeq : seq - 1;
      const snap = snapshotFor(clientId, afterSeq);
      broadcastSnapshots(new Set(room.players.map((p) => p.id)));
      return { status: 200, payload: snap };
    }

    if (action === 'room_event') {
      const roomId = cleanId(body.roomId) || player.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) {
        return {
          status: 404,
          payload: { error: { kind: 'room_not_found', message: 'Match room ended.' } },
        };
      }
      const kind = typeof body.kind === 'string' ? body.kind.slice(0, 40) : 'state';
      const payload = body.payload ?? null;
      if (kind === 'tetris_state' || kind === 'pb_state') {
        room.events = room.events.filter(
          (ev) => !(ev.senderId === clientId && ev.kind === kind),
        );
      }
      const seq = room.nextSeq++;
      room.events.push({
        seq,
        senderId: clientId,
        kind,
        payload,
        at: currentTime,
      });
      if (room.events.length > MAX_ROOM_EVENTS) {
        room.events.splice(0, room.events.length - MAX_ROOM_EVENTS);
      }
      room.updatedAt = currentTime;

      const afterSeq = typeof body.afterSeq === 'number' ? body.afterSeq : seq - 1;
      const snap = snapshotFor(clientId, afterSeq);
      broadcastSnapshots(new Set(room.players.map((p) => p.id)));
      return { status: 200, payload: snap };
    }

    if (action === 'leave_room') {
      const roomId = cleanId(body.roomId) || player.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      if (room) {
        const seq = room.nextSeq++;
        room.events.push({
          seq,
          senderId: clientId,
          kind: 'player_left',
          payload: { playerId: clientId, name: player.name },
          at: currentTime,
        });
        room.updatedAt = currentTime;
      }
      player.roomId = null;
      player.status = 'idle';
      const snap = snapshotFor(clientId, 0);
      broadcastSnapshots();
      return { status: 200, payload: snap };
    }

    return {
      status: 400,
      payload: { error: { kind: 'invalid_request', message: 'Unknown netplay action.' } },
    };
  }

  function attachUpgrade(httpServer) {
    if (!httpServer || typeof httpServer.on !== 'function') return;
    httpServer.on('upgrade', (req, socket, head) => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        if (url.pathname !== '/api/netplay') {
          socket.destroy();
          return;
        }
        const key = req.headers['sec-websocket-key'];
        if (typeof key !== 'string' || !key.trim()) {
          socket.destroy();
          return;
        }
        const accept = crypto
          .createHash('sha1')
          .update(key.trim() + WS_GUID)
          .digest('base64');
        socket.write(
          [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '\r\n',
          ].join('\r\n'),
        );
        socket.setNoDelay?.(true);

        const initialClientId = cleanId(url.searchParams.get('clientId') || '');
        const initialName = cleanName(url.searchParams.get('name') || 'Player');
        const initialAppId = url.searchParams.get('appId') || null;
        const meta = {
          clientId: initialClientId,
          lastSeq: 0,
          buffer: head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0),
        };
        sockets.set(socket, meta);

        if (initialClientId) {
          handleAction(
            {
              action: 'heartbeat',
              clientId: initialClientId,
              name: initialName,
              appId: initialAppId,
              status: 'idle',
            },
            socket,
          );
        }

        const processBuffer = () => {
          const { frames, remaining } = decodeWsFrames(meta.buffer);
          meta.buffer = remaining;
          for (const frame of frames) {
            if (frame.opcode === 0x8) {
              // Client close frame
              try {
                socket.end(encodeWsFrame('', 0x8));
              } catch {
                socket.destroy();
              }
              return;
            }
            if (frame.opcode === 0x9) {
              // Ping -> Pong
              try {
                socket.write(encodeWsFrame(frame.payload.toString('utf8'), 0x0a));
              } catch {
                socket.destroy();
              }
              continue;
            }
            if (frame.opcode === 0x1) {
              try {
                const msg = JSON.parse(frame.payload.toString('utf8'));
                if (msg && typeof msg === 'object') {
                  handleAction(msg, socket);
                }
              } catch {
                // Ignore malformed JSON frames
              }
            }
          }
        };

        if (meta.buffer.length > 0) processBuffer();

        socket.on('data', (chunk) => {
          meta.buffer = Buffer.concat([meta.buffer, chunk]);
          if (meta.buffer.length > 512 * 1024) {
            socket.destroy();
            return;
          }
          processBuffer();
        });

        const cleanup = () => {
          const closedMeta = sockets.get(socket);
          sockets.delete(socket);
          if (closedMeta?.clientId) {
            const stillConnected = Array.from(sockets.values()).some(
              (m) => m.clientId === closedMeta.clientId,
            );
            const p = players.get(closedMeta.clientId);
            if (!stillConnected && p && p.status === 'idle' && !p.roomId) {
              players.delete(closedMeta.clientId);
              broadcastSnapshots();
            }
          }
          ensureSyncMonitor();
        };

        socket.on('close', cleanup);
        socket.on('error', cleanup);
      } catch {
        socket.destroy();
      }
    });

    const origClose = httpServer.close.bind(httpServer);
    httpServer.close = (...closeArgs) => {
      if (syncMonitorTimer) {
        clearInterval(syncMonitorTimer);
        syncMonitorTimer = null;
      }
      for (const socket of sockets.keys()) {
        try {
          socket.destroy();
        } catch {
          // Ignore close errors
        }
      }
      sockets.clear();
      return origClose(...closeArgs);
    };
  }

  return {
    handleAction,
    snapshotFor,
    attachUpgrade,
  };
}
