/**
 * Client-side 2-Player Online Netplay coordinator (#236, #286).
 *
 * Demand-driven, event-pushed architecture (#286):
 * 1. Primary transport: WebSocket `/api/netplay` (Hibernatable Durable Object on
 *    Cloudflare Worker `hosting/cloudflare/worker.mjs` and RFC 6455 upgrade on
 *    local Express `server/netplay.js`). Consumes 1 Worker invocation per
 *    connection instead of sub-second HTTP polling.
 * 2. Local fast path: Browser `BroadcastChannel('yolo:netplay:v1')` for <1ms
 *    same-browser multi-tab synchronization.
 * 3. Demand-driven lifecycle:
 *    - Zero HTTP polling while WebSocket is connected.
 *    - Hidden-tab pause (`document.hidden`): disconnects WebSocket and halts all
 *      background network traffic immediately when hidden and not in a 2P match.
 *    - Idle sleep (`IDLE_SLEEP_MS = 60_000`): disconnects WebSocket after 60s
 *      without user interaction while idle, waking on user activity or 2P actions.
 *    - Listener-unsubscribe teardown: stops networking when all subscribers leave.
 *    - Exponential backoff (`2s -> 4s -> 8s -> ... -> 120s`) on network/Worker errors.
 */

import type { Board } from '../shared/tetris';
import type { BubbleColor, BubbleGrid } from '../shared/puzzleBobble';

export const INVITE_TIMEOUT_MS = 20_000;
export const SYNC_TIMEOUT_MS = 15_000;
export const IDLE_SLEEP_MS = 60_000;
export const WS_IDLE_KEEPALIVE_MS = 12_000;
export const WS_ROOM_KEEPALIVE_MS = 1_500;
export const HTTP_FALLBACK_IDLE_MS = 15_000;
export const HTTP_FALLBACK_ROOM_MS = 1_000;
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 120_000;

export type NetplayGameId = 'tetris' | 'puzzle-bobble';
export type NetplayPlayerStatus = 'idle' | 'inviting' | 'playing_2p';

export interface OnlinePlayerInfo {
  id: string;
  name: string;
  status: NetplayPlayerStatus;
  appId: NetplayGameId | null;
}

export interface NetplayInvite {
  id: string;
  gameId: NetplayGameId;
  hostId: string;
  hostName: string;
  createdAt: number;
}

export interface NetplayRoomPlayer {
  id: string;
  name: string;
  slot: 0 | 1;
  ready?: boolean;
}

export interface NetplayRoomEvent {
  seq: number;
  senderId: string;
  kind: string;
  payload: unknown;
  at: number;
}

export interface NetplayActiveRoom {
  id: string;
  gameId: NetplayGameId;
  seed: number;
  status: 'ready_check' | 'playing';
  syncStatus?: 'ok' | 'paused' | 'timeout';
  syncRemainingMs?: number;
  laggingPlayerNames?: string[];
  players: [NetplayRoomPlayer, NetplayRoomPlayer];
  mySlot: 0 | 1;
  opponent: NetplayRoomPlayer;
}

export interface TetrisRadarSnapshot {
  board: Board;
  settledBoard?: Board;
  activePiece?: {
    type: 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
    x: number;
    y: number;
    rotation: number;
  } | null;
  lastEvent?: {
    id: number;
    clearedLines: number;
    sentGarbage: number;
    risenGarbage: number;
  } | null;
  score: number;
  lines: number;
  level: number;
  status: 'playing' | 'over';
  pendingGarbage: number;
}

export interface PuzzleBobbleRadarCellEvent {
  row: number;
  col: number;
  x: number;
  y: number;
  color: BubbleColor;
}

export interface PuzzleBobbleRadarSnapshot {
  grid: BubbleGrid;
  ceilingDrop: number;
  score: number;
  status: 'playing' | 'won' | 'ko';
  incomingGarbage: number;
  aimAngle: number;
  currentBubble: BubbleColor;
  flying?: {
    x: number;
    y: number;
    color: BubbleColor;
  } | null;
  lastEvent?: {
    id: number;
    popped: PuzzleBobbleRadarCellEvent[];
    dropped: PuzzleBobbleRadarCellEvent[];
    risenGarbage: PuzzleBobbleRadarCellEvent[];
    sentGarbage: number;
  } | null;
}

export interface NetplayState {
  clientId: string;
  clientName: string;
  onlineCount: number;
  players: OnlinePlayerInfo[];
  openInvites: NetplayInvite[];
  myPendingInvite: NetplayInvite | null;
  activeRoom: NetplayActiveRoom | null;
}

type RoomEventListener = (event: NetplayRoomEvent) => void;
type StateListener = (state: NetplayState) => void;

const HANDLE_ADJECTIVES = [
  'Neon',
  'Pixel',
  'Cosmic',
  'Turbo',
  'Cyber',
  'Starlight',
  'Nova',
  'Crystal',
  'Hyper',
  'Retro',
  'Solar',
  'lunar',
];

const HANDLE_NOUNS = [
  'Dragon',
  'Falcon',
  'Comet',
  'Knight',
  'Wizard',
  'Fox',
  'Tiger',
  'Drifter',
  'Pilot',
  'Voyager',
  'Phoenix',
  'Ranger',
];

function getOrCreateClientIdentity(): { id: string; name: string } {
  try {
    const existingId = window.sessionStorage.getItem('yolo.netplay.clientId');
    const existingName = window.sessionStorage.getItem('yolo.netplay.clientName');
    if (existingId && existingName) {
      return { id: existingId, name: existingName };
    }
    const rand = Math.floor(Math.random() * 900 + 100);
    const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const adj = HANDLE_ADJECTIVES[Math.floor(Math.random() * HANDLE_ADJECTIVES.length)] ?? 'Arcade';
    const noun = HANDLE_NOUNS[Math.floor(Math.random() * HANDLE_NOUNS.length)] ?? 'Player';
    const name = `${adj} ${noun} #${rand}`;
    window.sessionStorage.setItem('yolo.netplay.clientId', id);
    window.sessionStorage.setItem('yolo.netplay.clientName', name);
    return { id, name };
  } catch {
    const rand = Math.floor(Math.random() * 900 + 100);
    return {
      id: `p_${Date.now().toString(36)}_${rand}`,
      name: `Arcade Player #${rand}`,
    };
  }
}

export function computeBackoffDelayMs(
  consecutiveFailures: number,
  baseMs = BACKOFF_BASE_MS,
  maxMs = BACKOFF_MAX_MS,
): number {
  if (consecutiveFailures <= 0) return 0;
  const exp = Math.min(10, consecutiveFailures - 1);
  return Math.min(maxMs, baseMs * Math.pow(2, exp));
}

export class NetplayClient {
  private identity = getOrCreateClientIdentity();
  private state: NetplayState = {
    clientId: this.identity.id,
    clientName: this.identity.name,
    onlineCount: 1,
    players: [
      {
        id: this.identity.id,
        name: this.identity.name,
        status: 'idle',
        appId: null,
      },
    ],
    openInvites: [],
    myPendingInvite: null,
    activeRoom: null,
  };

  private stateListeners = new Set<StateListener>();
  private roomEventListeners = new Set<RoomEventListener>();
  private currentAppId: NetplayGameId | null = (() => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('app');
    return raw === 'tetris' || raw === 'puzzle-bobble' ? raw : null;
  })();
  private lastServerSeq = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private wsKeepaliveTimer: ReturnType<typeof setTimeout> | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private ws: WebSocket | null = null;
  private started = false;
  private idleSleeping = false;
  private lastUserActivityAt = Date.now();
  private consecutiveFailures = 0;
  private channel: BroadcastChannel | null = null;
  private localPeers = new Map<string, OnlinePlayerInfo & { updatedAt: number }>();
  private localInvites = new Map<string, NetplayInvite>();
  private dismissedInvites = new Set<string>();
  private processedEventKeys = new Set<string>();
  private localSeq = 10_000;

  private readonly onVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      if (!this.state.activeRoom) {
        this.pauseNetwork();
      }
    } else {
      this.recordUserActivity();
    }
  };

  private readonly onUserActivity = () => {
    this.recordUserActivity();
  };

  private readonly onSimulateLagEvent = (event: Event) => {
    const detail = (
      event as CustomEvent<{ lagging?: boolean; forceElapsedMs?: number }>
    ).detail;
    void this.simulateLag(Boolean(detail?.lagging), detail?.forceElapsedMs);
  };

  getState(): NetplayState {
    return this.state;
  }

  private hasListeners(): boolean {
    return this.stateListeners.size > 0 || this.roomEventListeners.size > 0;
  }

  private isDocumentHidden(): boolean {
    return typeof document !== 'undefined' && document.hidden === true;
  }

  recordUserActivity(): void {
    this.lastUserActivityAt = Date.now();
    if (!this.started || !this.hasListeners() || this.isDocumentHidden()) return;
    if (this.idleSleeping) {
      this.idleSleeping = false;
      this.connectWebSocket();
      this.scheduleNextTick();
    } else if (!this.ws && this.wsReconnectTimer === null && this.consecutiveFailures === 0) {
      this.connectWebSocket();
    }
  }

  setDisplayName(name: string): void {
    const clean = name.trim().slice(0, 24);
    if (!clean || clean === this.identity.name) return;
    this.identity.name = clean;
    try {
      window.sessionStorage.setItem('yolo.netplay.clientName', clean);
    } catch {
      // Ignore storage failures
    }
    this.updateState({ clientName: clean });
    this.recordUserActivity();
    void this.heartbeat();
  }

  setCurrentApp(appId: string | null): void {
    const valid: NetplayGameId | null =
      appId === 'tetris' || appId === 'puzzle-bobble' ? appId : null;
    if (this.state.activeRoom && this.state.activeRoom.gameId !== valid) {
      void this.leaveRoom();
    }
    if (this.currentAppId === valid) return;
    this.currentAppId = valid;
    this.recordUserActivity();
    if (this.hasListeners() && !this.isDocumentHidden()) {
      void this.heartbeat();
    }
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    this.ensureStarted();
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
      this.checkTeardownIfUnused();
    };
  }

  onRoomEvent(listener: RoomEventListener): () => void {
    this.roomEventListeners.add(listener);
    this.ensureStarted();
    return () => {
      this.roomEventListeners.delete(listener);
      this.checkTeardownIfUnused();
    };
  }

  private checkTeardownIfUnused(): void {
    if (!this.hasListeners()) {
      this.suspend();
    }
  }

  private ensureStarted(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.lastUserActivityAt = Date.now();
    this.idleSleeping = false;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('yolo:netplay:v1');
        this.channel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch {
        this.channel = null;
      }
    }

    window.addEventListener('yolo:netplay:simulate-lag', this.onSimulateLagEvent);
    window.addEventListener('pointerdown', this.onUserActivity, { passive: true });
    window.addEventListener('keydown', this.onUserActivity, { passive: true });
    window.addEventListener('focus', this.onUserActivity, { passive: true });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    if (!this.isDocumentHidden()) {
      this.connectWebSocket();
      this.scheduleNextTick();
    }
  }

  private pauseNetwork(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.wsKeepaliveTimer !== null) {
      clearTimeout(this.wsKeepaliveTimer);
      this.wsKeepaliveTimer = null;
    }
    if (this.wsReconnectTimer !== null) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      try {
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close(1000, 'paused');
      } catch {
        // Ignore close errors
      }
    }
  }

  suspend(): void {
    this.pauseNetwork();
    this.started = false;
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Ignore close errors
      }
      this.channel = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('yolo:netplay:simulate-lag', this.onSimulateLagEvent);
      window.removeEventListener('pointerdown', this.onUserActivity);
      window.removeEventListener('keydown', this.onUserActivity);
      window.removeEventListener('focus', this.onUserActivity);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private isWsOpen(): boolean {
    return Boolean(this.ws && typeof WebSocket !== 'undefined' && this.ws.readyState === WebSocket.OPEN);
  }

  private connectWebSocket(): void {
    if (
      typeof window === 'undefined' ||
      typeof WebSocket === 'undefined' ||
      !this.started ||
      !this.hasListeners() ||
      this.isDocumentHidden() ||
      this.idleSleeping
    ) {
      return;
    }
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (this.wsReconnectTimer !== null) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        clientId: this.identity.id,
        name: this.identity.name,
      });
      if (this.currentAppId) params.set('appId', this.currentAppId);
      const url = `${proto}//${window.location.host}/api/netplay?${params.toString()}`;
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.consecutiveFailures = 0;
        this.localOfflineSince = null;
        if (this.pollTimer !== null) {
          clearTimeout(this.pollTimer);
          this.pollTimer = null;
        }
        this.broadcastLocal({
          type: 'presence',
          status: this.currentPlayerStatus(),
          appId: this.currentAppId,
        });
        this.scheduleWsKeepalive();
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        try {
          const data = JSON.parse(String(event.data)) as Record<string, unknown>;
          if (data && typeof data === 'object') {
            this.consecutiveFailures = 0;
            this.localOfflineSince = null;
            this.reconcileLocalState(data as never);
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };

      socket.onerror = () => {
        // Handled in onclose
      };

      socket.onclose = (event) => {
        if (this.ws !== socket) return;
        this.ws = null;
        if (this.wsKeepaliveTimer !== null) {
          clearTimeout(this.wsKeepaliveTimer);
          this.wsKeepaliveTimer = null;
        }
        if (!this.started || !this.hasListeners()) return;
        if (this.isDocumentHidden() && !this.state.activeRoom) {
          this.pauseNetwork();
          return;
        }
        const idleElapsed = Date.now() - this.lastUserActivityAt;
        if (!this.state.activeRoom && !this.state.myPendingInvite && idleElapsed >= IDLE_SLEEP_MS) {
          this.idleSleeping = true;
          this.pauseNetwork();
          return;
        }
        // Gateway 60s auth rotation closes with code 1000; abnormal closes use backoff.
        if (event.code !== 1000) {
          this.consecutiveFailures += 1;
        }
        const delay =
          event.code === 1000
            ? 250
            : computeBackoffDelayMs(this.consecutiveFailures);
        this.wsReconnectTimer = setTimeout(() => {
          this.wsReconnectTimer = null;
          this.connectWebSocket();
        }, delay);
        this.scheduleNextTick();
      };
    } catch {
      this.ws = null;
      this.consecutiveFailures += 1;
      this.scheduleNextTick();
    }
  }

  private scheduleWsKeepalive(): void {
    if (this.wsKeepaliveTimer !== null) {
      clearTimeout(this.wsKeepaliveTimer);
      this.wsKeepaliveTimer = null;
    }
    if (!this.started || !this.hasListeners() || !this.isWsOpen()) return;
    if (this.isDocumentHidden() && !this.state.activeRoom) {
      this.pauseNetwork();
      return;
    }
    const idleElapsed = Date.now() - this.lastUserActivityAt;
    if (!this.state.activeRoom && !this.state.myPendingInvite && idleElapsed >= IDLE_SLEEP_MS) {
      this.idleSleeping = true;
      this.pauseNetwork();
      return;
    }
    const interval = this.state.activeRoom ? WS_ROOM_KEEPALIVE_MS : WS_IDLE_KEEPALIVE_MS;
    this.wsKeepaliveTimer = setTimeout(() => {
      this.wsKeepaliveTimer = null;
      if (!this.isWsOpen()) return;
      this.sendWsFrame({
        action: 'heartbeat',
        status: this.currentPlayerStatus(),
      });
      this.broadcastLocal({
        type: 'presence',
        status: this.currentPlayerStatus(),
        appId: this.currentAppId,
      });
      this.scheduleWsKeepalive();
    }, interval);
  }

  private scheduleNextTick(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (!this.started || !this.hasListeners()) return;
    if (this.isDocumentHidden() && !this.state.activeRoom) {
      this.pauseNetwork();
      return;
    }
    const idleElapsed = Date.now() - this.lastUserActivityAt;
    if (!this.state.activeRoom && !this.state.myPendingInvite && idleElapsed >= IDLE_SLEEP_MS) {
      this.idleSleeping = true;
      this.pauseNetwork();
      return;
    }
    // When WebSocket is connected, no HTTP polling runs at all.
    if (this.isWsOpen()) {
      this.scheduleWsKeepalive();
      return;
    }
    const baseInterval = this.state.activeRoom ? HTTP_FALLBACK_ROOM_MS : HTTP_FALLBACK_IDLE_MS;
    const backoff = computeBackoffDelayMs(this.consecutiveFailures);
    const delay = Math.max(baseInterval, backoff);
    this.pollTimer = setTimeout(async () => {
      this.pollTimer = null;
      if (!this.isWsOpen()) {
        await this.heartbeat();
      }
      this.scheduleNextTick();
    }, delay);
  }

  private currentPlayerStatus(): NetplayPlayerStatus {
    return this.state.activeRoom
      ? 'playing_2p'
      : this.state.myPendingInvite
        ? 'inviting'
        : 'idle';
  }

  private sendWsFrame(body: Record<string, unknown>): boolean {
    if (!this.isWsOpen() || !this.ws) return false;
    try {
      this.ws.send(
        JSON.stringify({
          clientId: this.identity.id,
          name: this.identity.name,
          appId: this.currentAppId,
          afterSeq: this.lastServerSeq,
          ...body,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private emitRoomEvent(event: NetplayRoomEvent): void {
    const key = `${event.senderId}:${event.seq}:${event.kind}:${event.at}`;
    if (this.processedEventKeys.has(key)) return;
    this.processedEventKeys.add(key);
    if (this.processedEventKeys.size > 400) {
      const first = this.processedEventKeys.values().next().value;
      if (first) this.processedEventKeys.delete(first);
    }
    for (const listener of this.roomEventListeners) {
      listener(event);
    }
  }

  private lastStateDigest = '';

  private computeStateDigest(s: NetplayState): string {
    const rm = s.activeRoom;
    const syncBucket =
      rm && rm.syncStatus === 'paused'
        ? Math.ceil((rm.syncRemainingMs ?? SYNC_TIMEOUT_MS) / 1000)
        : 0;
    return JSON.stringify({
      c: s.clientId,
      n: s.clientName,
      oc: s.onlineCount,
      p: s.players,
      oi: s.openInvites,
      mi: s.myPendingInvite,
      r: rm
        ? {
            id: rm.id,
            g: rm.gameId,
            s: rm.seed,
            st: rm.status,
            ss: rm.syncStatus ?? 'ok',
            sb: syncBucket,
            lg: rm.laggingPlayerNames ?? [],
            pl: rm.players,
          }
        : null,
    });
  }

  private updateState(partial: Partial<NetplayState>): void {
    const next: NetplayState = { ...this.state, ...partial };
    const digest = this.computeStateDigest(next);
    this.state = next;
    if (digest === this.lastStateDigest) return;
    this.lastStateDigest = digest;
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }

  private broadcastLocal(msg: Record<string, unknown>): void {
    if (!this.channel) return;
    try {
      this.channel.postMessage({ ...msg, fromId: this.identity.id, fromName: this.identity.name });
    } catch {
      // Ignore BroadcastChannel errors
    }
  }

  private handleBroadcastMessage(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, unknown>;
    const fromId = typeof msg.fromId === 'string' ? msg.fromId : '';
    const fromName = typeof msg.fromName === 'string' ? msg.fromName : 'Player';
    if (!fromId || fromId === this.identity.id) return;

    const now = Date.now();
    if (msg.type === 'presence') {
      const status: NetplayPlayerStatus =
        msg.status === 'playing_2p' || msg.status === 'inviting' ? msg.status : 'idle';
      const appId: NetplayGameId | null =
        msg.appId === 'tetris' || msg.appId === 'puzzle-bobble' ? msg.appId : null;
      this.localPeers.set(fromId, { id: fromId, name: fromName, status, appId, updatedAt: now });
      this.reconcileLocalState();
      return;
    }

    if (msg.type === 'invite') {
      const invite = msg.invite as NetplayInvite | undefined;
      if (invite && invite.id && invite.hostId !== this.identity.id) {
        this.localInvites.set(invite.id, invite);
        this.reconcileLocalState();
      }
      return;
    }

    if (msg.type === 'cancel_invite') {
      const inviteId = typeof msg.inviteId === 'string' ? msg.inviteId : '';
      if (inviteId) this.localInvites.delete(inviteId);
      for (const [id, inv] of this.localInvites.entries()) {
        if (inv.hostId === fromId) this.localInvites.delete(id);
      }
      this.reconcileLocalState();
      return;
    }

    if (msg.type === 'room_joined' || msg.type === 'match_start') {
      const room = msg.room as {
        id: string;
        gameId: NetplayGameId;
        seed: number;
        status?: 'ready_check' | 'playing';
        players: [NetplayRoomPlayer, NetplayRoomPlayer];
      } | null;
      const inviteId = typeof msg.inviteId === 'string' ? msg.inviteId : '';
      if (inviteId) this.localInvites.delete(inviteId);
      if (!room || !Array.isArray(room.players)) return;
      const me = room.players.find((p) => p.id === this.identity.id);
      const opponent = room.players.find((p) => p.id !== this.identity.id);
      if (!me || !opponent) return;

      const activeRoom: NetplayActiveRoom = {
        id: room.id,
        gameId: room.gameId,
        seed: room.seed,
        status: room.status ?? (msg.type === 'match_start' ? 'playing' : 'ready_check'),
        players: room.players,
        mySlot: me.slot,
        opponent,
      };
      this.updateState({
        activeRoom,
        myPendingInvite: null,
        openInvites: [],
      });
      this.scheduleNextTick();
      this.emitRoomEvent({
        seq: 1,
        senderId: fromId,
        kind: activeRoom.status === 'playing' ? 'match_start' : 'room_joined',
        payload: activeRoom,
        at: now,
      });
      return;
    }

    if (msg.type === 'player_ready') {
      const roomId = typeof msg.roomId === 'string' ? msg.roomId : '';
      const curRoom = this.state.activeRoom;
      if (!curRoom || curRoom.id !== roomId) return;
      const nextPlayers = curRoom.players.map((p) =>
        p.id === fromId ? { ...p, ready: true } : p,
      ) as [NetplayRoomPlayer, NetplayRoomPlayer];
      const me = nextPlayers.find((p) => p.id === this.identity.id) ?? curRoom.players[curRoom.mySlot];
      const opponent = nextPlayers.find((p) => p.id !== this.identity.id) ?? curRoom.opponent;
      const allReady = nextPlayers.every((p) => Boolean(p.ready));
      const nextRoom: NetplayActiveRoom = {
        ...curRoom,
        status: allReady ? 'playing' : 'ready_check',
        players: nextPlayers,
        mySlot: me.slot,
        opponent,
      };
      this.updateState({ activeRoom: nextRoom });
      if (allReady && curRoom.status !== 'playing') {
        this.emitRoomEvent({
          seq: ++this.localSeq,
          senderId: fromId,
          kind: 'match_start',
          payload: nextRoom,
          at: now,
        });
      }
      return;
    }

    if (msg.type === 'room_event') {
      const roomId = typeof msg.roomId === 'string' ? msg.roomId : '';
      if (!this.state.activeRoom || this.state.activeRoom.id !== roomId) return;
      const event = msg.event as NetplayRoomEvent | undefined;
      if (event) this.emitRoomEvent(event);
      return;
    }

    if (msg.type === 'leave_room') {
      const roomId = typeof msg.roomId === 'string' ? msg.roomId : '';
      if (!this.state.activeRoom || this.state.activeRoom.id !== roomId) return;
      this.emitRoomEvent({
        seq: ++this.localSeq,
        senderId: fromId,
        kind: 'player_left',
        payload: { playerId: fromId, name: fromName },
        at: now,
      });
      return;
    }
  }

  private reconcileLocalState(serverSnapshot?: {
    onlineCount: number;
    players: OnlinePlayerInfo[];
    openInvites: NetplayInvite[];
    myPendingInvites: NetplayInvite[];
    activeRoom: {
      id: string;
      gameId: NetplayGameId;
      seed: number;
      status?: 'ready_check' | 'playing';
      syncStatus?: 'ok' | 'paused' | 'timeout';
      syncRemainingMs?: number;
      laggingPlayerNames?: string[];
      players: [NetplayRoomPlayer, NetplayRoomPlayer];
      events: NetplayRoomEvent[];
      lastSeq: number;
    } | null;
  }): void {
    const now = Date.now();
    for (const [id, peer] of this.localPeers.entries()) {
      if (now - peer.updatedAt > 25_000) this.localPeers.delete(id);
    }
    for (const [id, inv] of this.localInvites.entries()) {
      if (now - inv.createdAt > INVITE_TIMEOUT_MS) this.localInvites.delete(id);
    }

    const playerMap = new Map<string, OnlinePlayerInfo>();
    playerMap.set(this.identity.id, {
      id: this.identity.id,
      name: this.identity.name,
      status: this.currentPlayerStatus(),
      appId: this.currentAppId,
    });
    for (const peer of this.localPeers.values()) {
      playerMap.set(peer.id, {
        id: peer.id,
        name: peer.name,
        status: peer.status,
        appId: peer.appId,
      });
    }
    if (serverSnapshot?.players) {
      for (const p of serverSnapshot.players) {
        if (p && typeof p.id === 'string') {
          playerMap.set(p.id, {
            id: p.id,
            name: p.name,
            status:
              p.status === 'playing_2p' || p.status === 'inviting' ? p.status : 'idle',
            appId: p.appId === 'tetris' || p.appId === 'puzzle-bobble' ? p.appId : null,
          });
        }
      }
    }

    let activeRoom = this.state.activeRoom;
    let myPendingInvite = this.state.myPendingInvite;

    if (serverSnapshot?.activeRoom) {
      const sr = serverSnapshot.activeRoom;
      const me = sr.players.find((p) => p.id === this.identity.id);
      const opponent = sr.players.find((p) => p.id !== this.identity.id);
      if (me && opponent) {
        const isNewRoom = !activeRoom || activeRoom.id !== sr.id;
        const resolvedStatus: 'ready_check' | 'playing' =
          sr.status ?? (sr.players.every((p) => p.ready) ? 'playing' : 'ready_check');
        activeRoom = {
          id: sr.id,
          gameId: sr.gameId,
          seed: sr.seed,
          status: resolvedStatus,
          syncStatus: sr.syncStatus ?? 'ok',
          syncRemainingMs: sr.syncRemainingMs ?? SYNC_TIMEOUT_MS,
          laggingPlayerNames: sr.laggingPlayerNames ?? [],
          players: sr.players,
          mySlot: me.slot,
          opponent,
        };
        myPendingInvite = null;
        if (isNewRoom) {
          this.lastServerSeq = sr.lastSeq;
          this.scheduleNextTick();
        } else if (sr.lastSeq > this.lastServerSeq) {
          this.lastServerSeq = sr.lastSeq;
        }
        for (const ev of sr.events ?? []) {
          if (
            ev.senderId !== this.identity.id ||
            ev.kind === 'match_start' ||
            ev.kind === 'room_joined' ||
            ev.kind === 'player_ready' ||
            ev.kind === 'sync_resumed' ||
            ev.kind === 'sync_timeout'
          ) {
            this.emitRoomEvent(ev);
          }
        }
      }
    } else if (serverSnapshot && serverSnapshot.activeRoom === null) {
      activeRoom = null;
      this.lastServerSeq = 0;
    }

    const inviteMap = new Map<string, NetplayInvite>();
    if (!activeRoom) {
      for (const inv of this.localInvites.values()) {
        if (!this.dismissedInvites.has(inv.id) && inv.hostId !== this.identity.id) {
          inviteMap.set(inv.id, inv);
        }
      }
      if (serverSnapshot?.openInvites) {
        for (const inv of serverSnapshot.openInvites) {
          if (!this.dismissedInvites.has(inv.id) && inv.hostId !== this.identity.id) {
            inviteMap.set(inv.id, inv);
          }
        }
      }
      if (serverSnapshot?.myPendingInvites && serverSnapshot.myPendingInvites.length > 0) {
        myPendingInvite = serverSnapshot.myPendingInvites[0];
      } else if (
        serverSnapshot &&
        Array.isArray(serverSnapshot.myPendingInvites) &&
        serverSnapshot.myPendingInvites.length === 0
      ) {
        if (myPendingInvite && now - myPendingInvite.createdAt > INVITE_TIMEOUT_MS) {
          myPendingInvite = null;
        }
      }
      if (myPendingInvite && now - myPendingInvite.createdAt > INVITE_TIMEOUT_MS) {
        myPendingInvite = null;
      }
    } else {
      myPendingInvite = null;
    }

    const players = Array.from(playerMap.values());
    this.updateState({
      onlineCount: Math.max(1, players.length),
      players,
      openInvites: activeRoom ? [] : Array.from(inviteMap.values()),
      myPendingInvite,
      activeRoom,
    });
  }

  private async dispatchAction(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (this.sendWsFrame(body)) {
      return null;
    }
    return this.postAction(body);
  }

  private async postAction(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch('/api/netplay', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'yolo-blank-canvas',
        },
        body: JSON.stringify({
          clientId: this.identity.id,
          name: this.identity.name,
          appId: this.currentAppId,
          afterSeq: this.lastServerSeq,
          ...body,
        }),
      });
      if (!response.ok && response.status !== 409) {
        this.consecutiveFailures += 1;
        return null;
      }
      this.consecutiveFailures = 0;
      const data = (await response.json()) as Record<string, unknown>;
      return data;
    } catch {
      this.consecutiveFailures += 1;
      return null;
    }
  }

  private heartbeatInFlight = false;

  async heartbeat(): Promise<void> {
    if (this.heartbeatInFlight) return;
    if (this.isDocumentHidden() && !this.state.activeRoom) return;
    this.heartbeatInFlight = true;
    try {
      const status = this.currentPlayerStatus();
      this.broadcastLocal({
        type: 'presence',
        status,
        appId: this.currentAppId,
      });
      if (this.sendWsFrame({ action: 'heartbeat', status })) {
        this.localOfflineSince = null;
        return;
      }
      const data = await this.postAction({ action: 'heartbeat', status });
      if (data) {
        this.localOfflineSince = null;
        this.reconcileLocalState(data as never);
      } else {
        if (this.state.activeRoom && this.state.activeRoom.status === 'playing') {
          if (!this.localOfflineSince) {
            this.localOfflineSince = Date.now();
          }
          const elapsed = Math.max(0, Date.now() - this.localOfflineSince);
          const remaining = Math.max(0, SYNC_TIMEOUT_MS - elapsed);
          this.updateState({
            activeRoom: {
              ...this.state.activeRoom,
              syncStatus: remaining <= 0 ? 'timeout' : 'paused',
              syncRemainingMs: remaining,
              laggingPlayerNames: [this.identity.name],
            },
          });
          if (remaining <= 0) {
            this.emitRoomEvent({
              seq: ++this.localSeq,
              senderId: this.identity.id,
              kind: 'sync_timeout',
              payload: { laggingPlayerNames: [this.identity.name] },
              at: Date.now(),
            });
          }
        }
        this.reconcileLocalState();
      }
    } finally {
      this.heartbeatInFlight = false;
    }
  }

  private localOfflineSince: number | null = null;

  async simulateLag(lagging: boolean, forceElapsedMs?: number): Promise<void> {
    const data = await this.dispatchAction({
      action: 'simulate_lag',
      lagging,
      forceElapsedMs,
    });
    if (data) {
      this.reconcileLocalState(data as never);
    }
  }

  async sendInvite(gameId: NetplayGameId): Promise<void> {
    this.recordUserActivity();
    this.currentAppId = gameId;
    this.lastServerSeq = 0;
    const inviteId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const invite: NetplayInvite = {
      id: inviteId,
      gameId,
      hostId: this.identity.id,
      hostName: this.identity.name,
      createdAt: Date.now(),
    };
    this.updateState({ activeRoom: null, myPendingInvite: invite });
    this.broadcastLocal({ type: 'invite', invite });
    const data = await this.dispatchAction({ action: 'invite', gameId, inviteId });
    if (data) this.reconcileLocalState(data as never);
  }

  async cancelInvite(): Promise<void> {
    this.recordUserActivity();
    const current = this.state.myPendingInvite;
    this.updateState({ myPendingInvite: null });
    this.broadcastLocal({ type: 'cancel_invite', inviteId: current?.id ?? '' });
    const data = await this.dispatchAction({ action: 'cancel_invite' });
    if (data) this.reconcileLocalState(data as never);
  }

  async dismissInvite(inviteId: string): Promise<void> {
    this.recordUserActivity();
    this.dismissedInvites.add(inviteId);
    this.localInvites.delete(inviteId);
    this.updateState({
      openInvites: this.state.openInvites.filter((inv) => inv.id !== inviteId),
    });
    await this.dispatchAction({ action: 'dismiss_invite', inviteId });
  }

  async acceptInvite(invite: NetplayInvite): Promise<NetplayActiveRoom | null> {
    this.recordUserActivity();
    this.currentAppId = invite.gameId;
    this.localInvites.delete(invite.id);
    // Use HTTP POST for acceptInvite so the caller receives the synchronous activeRoom return value,
    // while the server also broadcasts the room snapshot to all connected WebSockets immediately.
    const data = await this.postAction({ action: 'accept_invite', inviteId: invite.id });
    if (data && data.activeRoom) {
      this.reconcileLocalState(data as never);
      if (this.state.activeRoom) {
        this.broadcastLocal({
          type: 'room_joined',
          inviteId: invite.id,
          room: {
            id: this.state.activeRoom.id,
            gameId: this.state.activeRoom.gameId,
            seed: this.state.activeRoom.seed,
            status: this.state.activeRoom.status,
            players: this.state.activeRoom.players,
          },
        });
        return this.state.activeRoom;
      }
    }

    // Fallback to direct BroadcastChannel pairing if server wasn't holding the invite
    const roomId = `room_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const seed = ((Date.now() & 0x7fffffff) ^ 0x5a5a5a5a) >>> 0 || 1337;
    const players: [NetplayRoomPlayer, NetplayRoomPlayer] = [
      { id: invite.hostId, name: invite.hostName, slot: 0, ready: false },
      { id: this.identity.id, name: this.identity.name, slot: 1, ready: false },
    ];
    const activeRoom: NetplayActiveRoom = {
      id: roomId,
      gameId: invite.gameId,
      seed,
      status: 'ready_check',
      players,
      mySlot: 1,
      opponent: players[0],
    };
    this.updateState({
      activeRoom,
      myPendingInvite: null,
      openInvites: [],
    });
    this.broadcastLocal({
      type: 'room_joined',
      inviteId: invite.id,
      room: { id: roomId, gameId: invite.gameId, seed, status: 'ready_check', players },
    });
    this.scheduleNextTick();
    return activeRoom;
  }

  async setReady(): Promise<void> {
    this.recordUserActivity();
    const curRoom = this.state.activeRoom;
    if (!curRoom) return;
    const nextPlayers = curRoom.players.map((p) =>
      p.id === this.identity.id ? { ...p, ready: true } : p,
    ) as [NetplayRoomPlayer, NetplayRoomPlayer];
    const allReady = nextPlayers.every((p) => Boolean(p.ready));
    const nextRoom: NetplayActiveRoom = {
      ...curRoom,
      status: allReady ? 'playing' : 'ready_check',
      players: nextPlayers,
    };
    this.updateState({ activeRoom: nextRoom });
    this.broadcastLocal({
      type: 'player_ready',
      roomId: curRoom.id,
    });
    const data = await this.dispatchAction({
      action: 'player_ready',
      roomId: curRoom.id,
    });
    if (data) this.reconcileLocalState(data as never);
  }

  async sendRoomEvent(kind: string, payload: unknown): Promise<void> {
    const room = this.state.activeRoom;
    if (!room) return;
    const event: NetplayRoomEvent = {
      seq: ++this.localSeq,
      senderId: this.identity.id,
      kind,
      payload,
      at: Date.now(),
    };
    this.broadcastLocal({
      type: 'room_event',
      roomId: room.id,
      event,
    });
    const data = await this.dispatchAction({
      action: 'room_event',
      roomId: room.id,
      kind,
      payload,
    });
    if (data) this.reconcileLocalState(data as never);
  }

  async leaveRoom(): Promise<void> {
    const room = this.state.activeRoom;
    if (!room) return;
    this.lastServerSeq = 0;
    this.updateState({ activeRoom: null });
    this.broadcastLocal({ type: 'leave_room', roomId: room.id });
    this.scheduleNextTick();
    const data = await this.dispatchAction({ action: 'leave_room', roomId: room.id });
    if (data) this.reconcileLocalState(data as never);
  }
}

let sharedClient: NetplayClient | null = null;

export function getSharedNetplay(): NetplayClient {
  if (!sharedClient) {
    sharedClient = new NetplayClient();
  }
  return sharedClient;
}
