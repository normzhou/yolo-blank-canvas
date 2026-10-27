/**
 * Multi-user online presence, open 2P game invites, and real-time room event
 * relay (#236).
 *
 * Shared by the local Express server (`server/app.js`) and the Cloudflare
 * Worker (`hosting/cloudflare/worker.mjs`) so that `Tetris` and `Puzzle Bobble`
 * 2-player online matchmaking and gameplay work identically in local dev,
 * multi-browser LAN/loopback sessions, and hosted preview.
 */

const PLAYER_TTL_MS = 18_000;
const INVITE_TTL_MS = 45_000;
const ROOM_TTL_MS = 120_000;
const MAX_ROOM_EVENTS = 160;

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

export function createNetplayHub({ now = () => Date.now() } = {}) {
  /** @type {Map<string, { id: string, name: string, status: string, appId: string | null, roomId: string | null, updatedAt: number }>} */
  const players = new Map();
  /** @type {Map<string, { id: string, gameId: string, hostId: string, hostName: string, status: 'open' | 'accepted' | 'dismissed', roomId: string | null, createdAt: number, dismissedBy: Set<string> }>} */
  const invites = new Map();
  /** @type {Map<string, { id: string, gameId: string, seed: number, players: Array<{ id: string, name: string, slot: 0 | 1 }>, events: Array<{ seq: number, senderId: string, kind: string, payload: unknown, at: number }>, nextSeq: number, updatedAt: number }>} */
  const rooms = new Map();

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

    // Active open invites visible to this client (only when the client is not already in a 2P match)
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

  function handleAction(body = {}) {
    const currentTime = now();
    prune(currentTime);

    const action = typeof body.action === 'string' ? body.action : 'poll';
    const clientId = cleanId(body.clientId);
    if (!clientId) {
      return { status: 400, payload: { error: { kind: 'invalid_request', message: 'clientId is required.' } } };
    }

    const name = cleanName(body.name);
    const appId = typeof body.appId === 'string' && VALID_GAMES.has(body.appId) ? body.appId : null;
    const requestedStatus =
      typeof body.status === 'string' && VALID_STATUSES.has(body.status) ? body.status : null;

    let player = players.get(clientId);
    if (!player) {
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
      player.name = name || player.name;
      if (appId !== undefined) player.appId = appId;
      if (requestedStatus && (!player.roomId || requestedStatus === 'idle')) {
        player.status = requestedStatus;
      }
      player.updatedAt = currentTime;
    }

    if (action === 'heartbeat' || action === 'poll') {
      const afterSeq = typeof body.afterSeq === 'number' ? body.afterSeq : 0;
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
        } else {
          currentRoom.updatedAt = currentTime;
        }
      }
      return { status: 200, payload: snapshotFor(clientId, afterSeq) };
    }

    if (action === 'invite') {
      const gameId = typeof body.gameId === 'string' && VALID_GAMES.has(body.appId || body.gameId)
        ? (body.gameId || body.appId)
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
      // Cancel any previous open invites from this host
      for (const [id, inv] of invites.entries()) {
        if (inv.hostId === clientId && inv.status === 'open') {
          invites.delete(id);
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
      return {
        status: 200,
        payload: {
          ...snapshotFor(clientId, 0),
          inviteId,
        },
      };
    }

    if (action === 'cancel_invite') {
      for (const [id, inv] of invites.entries()) {
        if (inv.hostId === clientId && inv.status === 'open') {
          invites.delete(id);
        }
      }
      if (player.status === 'inviting') player.status = 'idle';
      return { status: 200, payload: snapshotFor(clientId, 0) };
    }

    if (action === 'dismiss_invite') {
      const inviteId = cleanId(body.inviteId);
      const inv = invites.get(inviteId);
      if (inv) {
        inv.dismissedBy.add(clientId);
      }
      return { status: 200, payload: snapshotFor(clientId, 0) };
    }

    if (action === 'accept_invite') {
      const inviteId = cleanId(body.inviteId);
      const inv = invites.get(inviteId);
      if (!inv || inv.status !== 'open') {
        return {
          status: 409,
          payload: {
            error: { kind: 'invite_unavailable', message: 'That 2P invite was already accepted or expired.' },
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
        players: [
          { id: host.id, name: host.name, slot: /** @type {0} */ (0) },
          { id: player.id, name: player.name, slot: /** @type {1} */ (1) },
        ],
        events: [
          {
            seq: 1,
            senderId: host.id,
            kind: 'match_start',
            payload: {
              roomId,
              gameId: inv.gameId,
              seed: seed || 1337,
              players: [
                { id: host.id, name: host.name, slot: 0 },
                { id: player.id, name: player.name, slot: 1 },
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

      // Clear any open invites from the joining player too
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

      return { status: 200, payload: snapshotFor(clientId, 0) };
    }

    if (action === 'room_event') {
      const roomId = cleanId(body.roomId) || player.roomId;
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) {
        return { status: 404, payload: { error: { kind: 'room_not_found', message: 'Match room ended.' } } };
      }
      const kind = typeof body.kind === 'string' ? body.kind.slice(0, 40) : 'state';
      const payload = body.payload ?? null;
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
      return { status: 200, payload: snapshotFor(clientId, afterSeq) };
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
      return { status: 200, payload: snapshotFor(clientId, 0) };
    }

    return { status: 400, payload: { error: { kind: 'invalid_request', message: 'Unknown netplay action.' } } };
  }

  return {
    handleAction,
    snapshotFor,
  };
}
