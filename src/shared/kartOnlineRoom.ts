/**
 * Unified 8-Player Server-Authoritative Micro Kart Room Manager (#438).
 *
 * Single TypeScript source compiled via `esbuild` for BOTH:
 * - Local Express WebSocket/HTTP hub (`server/netplay.js`)
 * - Cloudflare Worker Durable Object (`hosting/cloudflare/worker.mjs`)
 *
 * Implements:
 * - Up to 8 simultaneous humans + server-simulated CPU rivals filling the 8-kart grid
 * - Unique Starlight Burst companion assignment (greyed-out human picks + auto-fallback)
 * - Simple waiting screen with exact 3 exit conditions:
 *     1) Host clicks Go! (requires >= 1 other human joined)
 *     2) 2-minute timeout (auto-starts if >= 1 other joined, else exits netplay)
 *     3) All notified idle online players dismissed without joining (exits netplay)
 * - Anytime spectating + live mid-race drop-in taking over the best-performing surviving CPU
 * - Seamless human disconnect/leave -> CPU conversion
 */

import {
  KART_DRIVERS,
  CIRCUIT_LIST,
  createRaceState,
  stepRaceState,
  convertKartToCpu,
  takeOverBestCpuKart,
  serializeAuthoritativeRaceSnapshot,
  type AuthoritativeRaceSnapshot,
  type CircuitId,
  type DriverCharacterId,
  type ThrusterInput,
  type KartRaceFormat,
  type KartRaceState,
} from './microKart';

export const KART_MAX_PLAYERS = 8;
export const KART_LOBBY_TIMEOUT_MS = 120_000;
export const KART_SERVER_TICK_MS = 50; // 20 Hz server broadcast (steps 120 Hz physics substeps)
export const KART_PHYSICS_SUBSTEP_MS = 1000 / 120;
export const KART_START_COUNTDOWN_MS = 2_400;
export const KART_PLAYER_DISCONNECT_MS = 15_000;
export const KART_FINISHED_IDLE_TTL_MS = 45_000;

export type KartLobbyCloseReason = 'timeout' | 'all_dismissed' | 'host_cancelled' | 'empty';

export interface KartOnlineHumanMember {
  id: string;
  name: string;
  slot: number;
  character: DriverCharacterId;
  joinedAt: number;
  lastSeenAt: number;
}

export interface KartOnlineSpectator {
  id: string;
  name: string;
  joinedAt: number;
  lastSeenAt: number;
}

export interface KartOnlineRoomPublicView {
  id: string;
  status: 'waiting' | 'playing';
  hostId: string;
  hostName: string;
  format: KartRaceFormat;
  circuitId: CircuitId;
  reversed: boolean;
  seed: number;
  maxPlayers: number;
  createdAt: number;
  timeoutAt: number;
  countdownRemainingMs: number;
  players: Array<{
    id: string;
    name: string;
    slot: number;
    character: DriverCharacterId;
    isHost: boolean;
  }>;
  spectators: Array<{ id: string; name: string }>;
  takenCharacters: Partial<Record<DriverCharacterId, { playerId: string; playerName: string }>>;
  myRole: 'player' | 'spectator' | 'none';
  mySlot: number | null;
  canStart: boolean;
  dismissedByMe: boolean;
  notifiedCount: number;
  dismissedCount: number;
  openCpuSeats: number;
}

export interface KartLobbyClosedNotice {
  roomId: string;
  hostId: string;
  reason: KartLobbyCloseReason;
  at: number;
}

interface InternalKartRoom {
  id: string;
  status: 'waiting' | 'playing';
  hostId: string;
  hostName: string;
  format: KartRaceFormat;
  circuitId: CircuitId;
  reversed: boolean;
  seed: number;
  createdAt: number;
  timeoutAt: number;
  raceStartedAt: number | null;
  finishedAt: number | null;
  lastTickAt: number;
  serverTick: number;
  players: Map<string, KartOnlineHumanMember>;
  spectators: Map<string, KartOnlineSpectator>;
  notifiedIds: Set<string>;
  dismissedBy: Set<string>;
  inputsBySlot: Record<number, ThrusterInput>;
  race: KartRaceState | null;
  lastSnapshot: AuthoritativeRaceSnapshot | null;
}

const VALID_CIRCUITS = new Set<string>(CIRCUIT_LIST.map((c) => c.id));
const VALID_CHARS = new Set<string>(KART_DRIVERS.map((d) => d.id));
const ALL_CHAR_IDS: DriverCharacterId[] = KART_DRIVERS.map((d) => d.id);

function sanitizeCircuit(raw: unknown): CircuitId {
  return typeof raw === 'string' && VALID_CIRCUITS.has(raw) ? (raw as CircuitId) : 'sunset-loop';
}

function sanitizeFormat(raw: unknown): KartRaceFormat {
  return raw === 'marathon' ? 'marathon' : 'grand-prix';
}

function sanitizeCharacter(raw: unknown): DriverCharacterId {
  return typeof raw === 'string' && VALID_CHARS.has(raw) ? (raw as DriverCharacterId) : 'fox';
}

function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Player';
  return raw.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Player';
}

function pickUniqueCharacter(
  players: Map<string, KartOnlineHumanMember>,
  preferred?: DriverCharacterId,
  excludePlayerId?: string,
): DriverCharacterId {
  const taken = new Set<DriverCharacterId>();
  for (const p of players.values()) {
    if (p.id !== excludePlayerId) taken.add(p.character);
  }
  if (preferred && !taken.has(preferred)) return preferred;
  return ALL_CHAR_IDS.find((c) => !taken.has(c)) ?? preferred ?? 'fox';
}

function nextOpenSlot(players: Map<string, KartOnlineHumanMember>): number {
  const used = new Set<number>();
  for (const p of players.values()) used.add(p.slot);
  for (let s = 0; s < KART_MAX_PLAYERS; s += 1) {
    if (!used.has(s)) return s;
  }
  return -1;
}

export function createKartOnlineRoomManager({ now = () => Date.now() }: { now?: () => number } = {}) {
  let room: InternalKartRoom | null = null;
  let seq = 1;
  let lastClosedNotice: KartLobbyClosedNotice | null = null;

  function makeId(): string {
    return `kroom_${now().toString(36)}_${(seq++).toString(36)}`;
  }

  function closeRoom(reason: KartLobbyCloseReason): KartLobbyClosedNotice | null {
    if (!room) return null;
    const notice: KartLobbyClosedNotice = {
      roomId: room.id,
      hostId: room.hostId,
      reason,
      at: now(),
    };
    lastClosedNotice = notice;
    room = null;
    return notice;
  }

  function buildAuthoritativeRace(r: InternalKartRoom, t: number): void {
    const humanRoster = [...r.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => ({ slot: p.slot, name: p.name, character: p.character }));
    r.race = createRaceState(r.circuitId, 'online-8p', r.seed, {
      reversed: r.reversed,
      format: r.format,
      humanRoster,
    });
    r.status = 'playing';
    r.raceStartedAt = t;
    r.lastTickAt = t;
    r.finishedAt = null;
    r.serverTick = 1;
    r.inputsBySlot = {};
    r.lastSnapshot = serializeAuthoritativeRaceSnapshot(r.race, r.serverTick);
  }

  function createLobby(
    hostId: string,
    hostName: string,
    options: {
      format?: KartRaceFormat;
      circuitId?: CircuitId;
      reversed?: boolean;
      character?: DriverCharacterId;
      seed?: number;
    } = {},
    notifiedOnlineIds: string[] = [],
  ): { ok: true; room: KartOnlineRoomPublicView } | { ok: false; error: string } {
    const t = now();
    if (room) {
      return { ok: false, error: 'An 8P Micro Kart room is already active — join or spectate it!' };
    }
    const cleanHostName = cleanName(hostName);
    const charId = sanitizeCharacter(options.character);
    const notified = new Set<string>();
    for (const pid of notifiedOnlineIds) {
      if (pid && pid !== hostId) notified.add(pid);
    }

    const hostMember: KartOnlineHumanMember = {
      id: hostId,
      name: cleanHostName,
      slot: 0,
      character: charId,
      joinedAt: t,
      lastSeenAt: t,
    };

    room = {
      id: makeId(),
      status: 'waiting',
      hostId,
      hostName: cleanHostName,
      format: sanitizeFormat(options.format),
      circuitId: sanitizeCircuit(options.circuitId),
      reversed: Boolean(options.reversed),
      seed:
        typeof options.seed === 'number' && Number.isFinite(options.seed)
          ? Math.max(1, Math.floor(options.seed))
          : ((t % 999_983) + 1),
      createdAt: t,
      timeoutAt: t + KART_LOBBY_TIMEOUT_MS,
      raceStartedAt: null,
      finishedAt: null,
      lastTickAt: t,
      serverTick: 0,
      players: new Map([[hostId, hostMember]]),
      spectators: new Map(),
      notifiedIds: notified,
      dismissedBy: new Set(),
      inputsBySlot: {},
      race: null,
      lastSnapshot: null,
    };
    lastClosedNotice = null;
    return { ok: true, room: getPublicRoomView(hostId)! };
  }

  function joinRoom(
    playerId: string,
    playerName: string,
    preferredCharacter?: DriverCharacterId,
  ):
    | {
        ok: true;
        joinedLive: boolean;
        slot: number;
        character: DriverCharacterId;
        room: KartOnlineRoomPublicView;
        snapshot: AuthoritativeRaceSnapshot | null;
      }
    | { ok: false; error: string } {
    const t = now();
    if (!room) return { ok: false, error: 'No active 8P Micro Kart room.' };

    const existing = room.players.get(playerId);
    if (existing) {
      existing.lastSeenAt = t;
      return {
        ok: true,
        joinedLive: room.status === 'playing',
        slot: existing.slot,
        character: existing.character,
        room: getPublicRoomView(playerId)!,
        snapshot: room.lastSnapshot,
      };
    }

    const name = cleanName(playerName);
    room.spectators.delete(playerId);
    room.dismissedBy.delete(playerId);

    if (room.status === 'waiting') {
      const slot = nextOpenSlot(room.players);
      if (slot < 0) return { ok: false, error: 'Room is full (8/8 players).' };
      const chosenChar = pickUniqueCharacter(
        room.players,
        preferredCharacter ? sanitizeCharacter(preferredCharacter) : undefined,
      );
      room.players.set(playerId, {
        id: playerId,
        name,
        slot,
        character: chosenChar,
        joinedAt: t,
        lastSeenAt: t,
      });
      return {
        ok: true,
        joinedLive: false,
        slot,
        character: chosenChar,
        room: getPublicRoomView(playerId)!,
        snapshot: null,
      };
    }

    // Live mid-race drop-in: take over the BEST-PERFORMING surviving CPU kart (#438)!
    if (!room.race) return { ok: false, error: 'Race state unavailable.' };
    const slot = takeOverBestCpuKart(room.race, name);
    if (slot < 0) {
      // All surviving seats are human -> keep them as a spectator cleanly
      room.spectators.set(playerId, { id: playerId, name, joinedAt: t, lastSeenAt: t });
      return { ok: false, error: 'All 8 karts are already human-controlled.' };
    }
    const takenKart = room.race.karts[slot]!;
    room.players.set(playerId, {
      id: playerId,
      name,
      slot,
      character: takenKart.character,
      joinedAt: t,
      lastSeenAt: t,
    });
    room.inputsBySlot[slot] = { left: false, right: false, brake: false };
    room.lastSnapshot = serializeAuthoritativeRaceSnapshot(room.race, room.serverTick);
    return {
      ok: true,
      joinedLive: true,
      slot,
      character: takenKart.character,
      room: getPublicRoomView(playerId)!,
      snapshot: room.lastSnapshot,
    };
  }

  function selectCharacter(
    playerId: string,
    character: DriverCharacterId,
  ): { ok: true; character: DriverCharacterId } | { ok: false; error: string } {
    if (!room || room.status !== 'waiting') {
      return { ok: false, error: 'Character can only be changed in the waiting lobby.' };
    }
    const member = room.players.get(playerId);
    if (!member) return { ok: false, error: 'Player is not in the lobby.' };
    const cleanChar = sanitizeCharacter(character);
    for (const other of room.players.values()) {
      if (other.id !== playerId && other.character === cleanChar) {
        return { ok: false, error: `${cleanChar} is already chosen by ${other.name}.` };
      }
    }
    member.character = cleanChar;
    member.lastSeenAt = now();
    return { ok: true, character: cleanChar };
  }

  function updateLobbyOptions(
    requesterId: string,
    options: { format?: KartRaceFormat; circuitId?: CircuitId; reversed?: boolean },
  ): boolean {
    if (!room || room.status !== 'waiting' || room.hostId !== requesterId) return false;
    if (options.format !== undefined) room.format = sanitizeFormat(options.format);
    if (options.circuitId !== undefined) room.circuitId = sanitizeCircuit(options.circuitId);
    if (options.reversed !== undefined) room.reversed = Boolean(options.reversed);
    return true;
  }

  function spectate(
    playerId: string,
    playerName: string,
  ):
    | { ok: true; room: KartOnlineRoomPublicView; snapshot: AuthoritativeRaceSnapshot | null }
    | { ok: false; error: string } {
    const t = now();
    if (!room) return { ok: false, error: 'No active 8P Micro Kart room.' };
    if (room.players.has(playerId)) {
      // Already a racer in this room
      return { ok: true, room: getPublicRoomView(playerId)!, snapshot: room.lastSnapshot };
    }
    room.dismissedBy.delete(playerId);
    room.spectators.set(playerId, {
      id: playerId,
      name: cleanName(playerName),
      joinedAt: t,
      lastSeenAt: t,
    });
    return { ok: true, room: getPublicRoomView(playerId)!, snapshot: room.lastSnapshot };
  }

  function dismissLobby(playerId: string): { closed: KartLobbyClosedNotice | null } {
    if (!room || room.status !== 'waiting') return { closed: null };
    if (room.players.has(playerId)) return { closed: null };
    room.dismissedBy.add(playerId);
    // Exit Condition #3: all notified online players dismissed without anyone joining!
    if (
      room.players.size < 2 &&
      room.notifiedIds.size > 0 &&
      [...room.notifiedIds].every((id) => room!.dismissedBy.has(id))
    ) {
      return { closed: closeRoom('all_dismissed') };
    }
    return { closed: null };
  }

  function startRace(
    requesterId: string,
  ):
    | { ok: true; room: KartOnlineRoomPublicView; snapshot: AuthoritativeRaceSnapshot }
    | { ok: false; error: string } {
    if (!room || room.status !== 'waiting') return { ok: false, error: 'No waiting lobby to start.' };
    if (room.hostId !== requesterId) return { ok: false, error: 'Only the host can start the race.' };
    if (room.players.size < 2) {
      return { ok: false, error: 'Wait for at least 1 other player to join before starting.' };
    }
    buildAuthoritativeRace(room, now());
    return {
      ok: true,
      room: getPublicRoomView(requesterId)!,
      snapshot: room.lastSnapshot!,
    };
  }

  function setInput(playerId: string, input: Partial<ThrusterInput>): boolean {
    if (!room || room.status !== 'playing') return false;
    const member = room.players.get(playerId);
    if (!member) return false;
    member.lastSeenAt = now();
    const steerAnalog =
      typeof input.steerAnalog === 'number' && Number.isFinite(input.steerAnalog)
        ? Math.max(-1, Math.min(1, input.steerAnalog))
        : undefined;
    room.inputsBySlot[member.slot] = {
      left: Boolean(input.left),
      right: Boolean(input.right),
      brake: Boolean(input.brake),
      ...(steerAnalog !== undefined ? { steerAnalog } : {}),
    };
    return true;
  }

  function touch(playerId: string): void {
    if (!room) return;
    const t = now();
    const m = room.players.get(playerId);
    if (m) m.lastSeenAt = t;
    const s = room.spectators.get(playerId);
    if (s) s.lastSeenAt = t;
  }

  function leave(playerId: string): {
    changed: boolean;
    convertedSlot: number | null;
    closed: KartLobbyClosedNotice | null;
  } {
    if (!room) return { changed: false, convertedSlot: null, closed: null };

    if (room.spectators.delete(playerId)) {
      if (room.status === 'playing' && room.players.size === 0 && room.spectators.size === 0) {
        return { changed: true, convertedSlot: null, closed: closeRoom('empty') };
      }
      return { changed: true, convertedSlot: null, closed: null };
    }

    const member = room.players.get(playerId);
    if (!member) return { changed: false, convertedSlot: null, closed: null };

    room.players.delete(playerId);
    delete room.inputsBySlot[member.slot];

    if (room.status === 'waiting') {
      if (room.players.size === 0 || member.id === room.hostId) {
        // Host cancelled waiting lobby (or last player left) -> close lobby cleanly
        if (member.id === room.hostId) {
          return { changed: true, convertedSlot: null, closed: closeRoom('host_cancelled') };
        }
        return { changed: true, convertedSlot: null, closed: closeRoom('empty') };
      }
      return { changed: true, convertedSlot: null, closed: null };
    }

    // Mid-race leave/disconnect: seamlessly convert departing human into CPU (#438)!
    let convertedSlot: number | null = null;
    if (room.race && convertKartToCpu(room.race, member.slot)) {
      convertedSlot = member.slot;
      room.lastSnapshot = serializeAuthoritativeRaceSnapshot(room.race, room.serverTick);
    }

    // Reassign host badge if host left mid-race
    if (member.id === room.hostId && room.players.size > 0) {
      const nextHost = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0]!;
      room.hostId = nextHost.id;
      room.hostName = nextHost.name;
    }

    // If zero humans AND zero spectators remain, close room so DO can hibernate!
    if (room.players.size === 0 && room.spectators.size === 0) {
      return { changed: true, convertedSlot, closed: closeRoom('empty') };
    }

    return { changed: true, convertedSlot, closed: null };
  }

  function checkTimers(onlinePlayerIds?: Set<string>): {
    autoStarted: boolean;
    closed: KartLobbyClosedNotice | null;
    convertedSlots: number[];
    changed: boolean;
  } {
    const t = now();
    if (!room) return { autoStarted: false, closed: null, convertedSlots: [], changed: false };

    let changed = false;
    const convertedSlots: number[] = [];

    if (room.status === 'waiting') {
      // Remove notified players who went offline so "all dismissed" doesn't stall on offline ghosts
      if (onlinePlayerIds) {
        for (const nid of [...room.notifiedIds]) {
          if (!onlinePlayerIds.has(nid)) {
            room.notifiedIds.delete(nid);
            room.dismissedBy.delete(nid);
          }
        }
      }

      // Check Exit Condition #2: 2-minute timeout
      if (t >= room.timeoutAt) {
        if (room.players.size >= 2) {
          buildAuthoritativeRace(room, t);
          return { autoStarted: true, closed: null, convertedSlots, changed: true };
        }
        return { autoStarted: false, closed: closeRoom('timeout'), convertedSlots, changed: true };
      }

      // Check Exit Condition #3 again after pruning offline notified IDs
      if (
        room.players.size < 2 &&
        room.notifiedIds.size > 0 &&
        [...room.notifiedIds].every((id) => room!.dismissedBy.has(id))
      ) {
        return { autoStarted: false, closed: closeRoom('all_dismissed'), convertedSlots, changed: true };
      }

      // Host vanished (disconnected without explicit leave)
      const host = room.players.get(room.hostId);
      if (host && t - host.lastSeenAt > KART_PLAYER_DISCONNECT_MS * 2) {
        return { autoStarted: false, closed: closeRoom('host_cancelled'), convertedSlots, changed: true };
      }

      return { autoStarted: false, closed: null, convertedSlots, changed };
    }

    // Playing: convert stale disconnected humans into CPUs seamlessly!
    for (const member of [...room.players.values()]) {
      if (t - member.lastSeenAt > KART_PLAYER_DISCONNECT_MS) {
        room.players.delete(member.id);
        delete room.inputsBySlot[member.slot];
        if (room.race && convertKartToCpu(room.race, member.slot)) {
          convertedSlots.push(member.slot);
        }
        changed = true;
      }
    }
    for (const spec of [...room.spectators.values()]) {
      if (t - spec.lastSeenAt > KART_PLAYER_DISCONNECT_MS * 2) {
        room.spectators.delete(spec.id);
        changed = true;
      }
    }

    if (room.players.size === 0 && room.spectators.size === 0) {
      return { autoStarted: false, closed: closeRoom('empty'), convertedSlots, changed: true };
    }

    if (room.finishedAt !== null && t - room.finishedAt > KART_FINISHED_IDLE_TTL_MS) {
      return { autoStarted: false, closed: closeRoom('empty'), convertedSlots, changed: true };
    }

    return { autoStarted: false, closed: null, convertedSlots, changed };
  }

  function tickSimulation(): AuthoritativeRaceSnapshot | null {
    if (!room || room.status !== 'playing' || !room.race) return null;
    const t = now();
    const dtMs = Math.min(120, Math.max(0, t - room.lastTickAt));
    room.lastTickAt = t;

    const countdownRemaining =
      room.raceStartedAt !== null
        ? Math.max(0, room.raceStartedAt + KART_START_COUNTDOWN_MS - t)
        : 0;

    if (countdownRemaining <= 0 && dtMs > 0) {
      let remMs = dtMs;
      while (remMs > 0.05) {
        const subMs = Math.min(KART_PHYSICS_SUBSTEP_MS, remMs);
        stepRaceState(room.race, room.inputsBySlot, subMs);
        remMs -= subMs;
      }
      if (room.race.status === 'finished' && room.finishedAt === null) {
        room.finishedAt = t;
      }
    }

    room.serverTick += 1;
    room.lastSnapshot = serializeAuthoritativeRaceSnapshot(room.race, room.serverTick);
    return room.lastSnapshot;
  }

  function isSimActive(): boolean {
    return Boolean(room && room.status === 'playing');
  }

  function hasActiveRoom(): boolean {
    return room !== null;
  }

  function getRoomMemberIds(): Set<string> {
    const ids = new Set<string>();
    if (!room) return ids;
    for (const id of room.players.keys()) ids.add(id);
    for (const id of room.spectators.keys()) ids.add(id);
    return ids;
  }

  function getPublicRoomView(forPlayerId: string): KartOnlineRoomPublicView | null {
    if (!room) return null;
    const t = now();
    const takenCharacters: Partial<
      Record<DriverCharacterId, { playerId: string; playerName: string }>
    > = {};
    const players = [...room.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => {
        takenCharacters[p.character] = { playerId: p.id, playerName: p.name };
        return {
          id: p.id,
          name: p.name,
          slot: p.slot,
          character: p.character,
          isHost: p.id === room!.hostId,
        };
      });
    const spectators = [...room.spectators.values()].map((s) => ({ id: s.id, name: s.name }));
    const myPlayer = room.players.get(forPlayerId);
    const myRole: 'player' | 'spectator' | 'none' = myPlayer
      ? 'player'
      : room.spectators.has(forPlayerId)
        ? 'spectator'
        : 'none';
    const countdownRemainingMs =
      room.status === 'playing' && room.raceStartedAt !== null
        ? Math.max(0, room.raceStartedAt + KART_START_COUNTDOWN_MS - t)
        : 0;
    const openCpuSeats =
      room.status === 'playing' && room.race
        ? room.race.karts.filter((k) => !k.isHuman && !k.eliminated).length
        : Math.max(0, KART_MAX_PLAYERS - room.players.size);

    return {
      id: room.id,
      status: room.status,
      hostId: room.hostId,
      hostName: room.hostName,
      format: room.format,
      circuitId: room.circuitId,
      reversed: room.reversed,
      seed: room.seed,
      maxPlayers: KART_MAX_PLAYERS,
      createdAt: room.createdAt,
      timeoutAt: room.timeoutAt,
      countdownRemainingMs,
      players,
      spectators,
      takenCharacters,
      myRole,
      mySlot: myPlayer ? myPlayer.slot : null,
      canStart: room.status === 'waiting' && room.hostId === forPlayerId && room.players.size >= 2,
      dismissedByMe: room.dismissedBy.has(forPlayerId),
      notifiedCount: room.notifiedIds.size,
      dismissedCount: room.dismissedBy.size,
      openCpuSeats,
    };
  }

  function getLastClosedNotice(): KartLobbyClosedNotice | null {
    if (!lastClosedNotice) return null;
    if (now() - lastClosedNotice.at > 15_000) return null;
    return lastClosedNotice;
  }

  function getLastSnapshot(): AuthoritativeRaceSnapshot | null {
    return room?.lastSnapshot ?? null;
  }

  return {
    createLobby,
    joinRoom,
    selectCharacter,
    updateLobbyOptions,
    spectate,
    dismissLobby,
    startRace,
    setInput,
    touch,
    leave,
    checkTimers,
    tickSimulation,
    isSimActive,
    hasActiveRoom,
    getRoomMemberIds,
    getPublicRoomView,
    getLastClosedNotice,
    getLastSnapshot,
  };
}
