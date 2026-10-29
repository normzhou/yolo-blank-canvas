/**
 * Client-side 2-Player Online Netplay coordinator (#236).
 *
 * Bridges two transports seamlessly:
 * 1. Server `/api/netplay` (works on both local Express server `server/app.js`
 *    and hosted Cloudflare Worker `hosting/cloudflare/worker.mjs` at `demo.yolo-dev.ai`)
 * 2. Browser `BroadcastChannel('yolo:netplay:v1')` for instant <1ms multi-tab
 *    synchronization on the same machine, even if the server is unreachable.
 */

import type { Board } from '../shared/tetris';
import type { BubbleColor, BubbleGrid } from '../shared/puzzleBobble';

export const INVITE_TIMEOUT_MS = 20_000;
export const SYNC_TIMEOUT_MS = 15_000;

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
  score: number;
  lines: number;
  level: number;
  status: 'playing' | 'over';
  pendingGarbage: number;
}

export interface PuzzleBobbleRadarSnapshot {
  grid: BubbleGrid;
  ceilingDrop: number;
  score: number;
  status: 'playing' | 'won' | 'ko';
  incomingGarbage: number;
  aimAngle: number;
  currentBubble: BubbleColor;
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

class NetplayClient {
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
  private pollTimer: number | null = null;
  private started = false;
  private channel: BroadcastChannel | null = null;
  private localPeers = new Map<string, OnlinePlayerInfo & { updatedAt: number }>();
  private localInvites = new Map<string, NetplayInvite>();
  private dismissedInvites = new Set<string>();
  private processedEventKeys = new Set<string>();
  private localSeq = 10_000;

  getState(): NetplayState {
    return this.state;
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
    void this.heartbeat();
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    this.ensureStarted();
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onRoomEvent(listener: RoomEventListener): () => void {
    this.roomEventListeners.add(listener);
    this.ensureStarted();
    return () => {
      this.roomEventListeners.delete(listener);
    };
  }

  private ensureStarted(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

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

    window.addEventListener('yolo:netplay:simulate-lag', (event: Event) => {
      const detail = (
        event as CustomEvent<{ lagging?: boolean; forceElapsedMs?: number }>
      ).detail;
      void this.simulateLag(Boolean(detail?.lagging), detail?.forceElapsedMs);
    });

    void this.heartbeat();
    this.schedulePoll();
  }

  private schedulePoll(): void {
    if (this.pollTimer !== null) window.clearTimeout(this.pollTimer);
    const interval = this.state.activeRoom ? 220 : 1200;
    this.pollTimer = window.setTimeout(async () => {
      await this.heartbeat();
      this.schedulePoll();
    }, interval);
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

  private updateState(partial: Partial<NetplayState>): void {
    this.state = { ...this.state, ...partial };
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
      this.schedulePoll();
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
      if (now - peer.updatedAt > 15_000) this.localPeers.delete(id);
    }
    for (const [id, inv] of this.localInvites.entries()) {
      if (now - inv.createdAt > INVITE_TIMEOUT_MS) this.localInvites.delete(id);
    }

    const playerMap = new Map<string, OnlinePlayerInfo>();
    playerMap.set(this.identity.id, {
      id: this.identity.id,
      name: this.identity.name,
      status: this.state.activeRoom
        ? 'playing_2p'
        : this.state.myPendingInvite
          ? 'inviting'
          : 'idle',
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
          this.schedulePoll();
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
      } else if (serverSnapshot && Array.isArray(serverSnapshot.myPendingInvites) && serverSnapshot.myPendingInvites.length === 0) {
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
      if (!response.ok && response.status !== 409) return null;
      const data = (await response.json()) as Record<string, unknown>;
      return data;
    } catch {
      return null;
    }
  }

  async heartbeat(): Promise<void> {
    const status: NetplayPlayerStatus = this.state.activeRoom
      ? 'playing_2p'
      : this.state.myPendingInvite
        ? 'inviting'
        : 'idle';
    this.broadcastLocal({
      type: 'presence',
      status,
      appId: this.currentAppId,
    });
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
  }

  private localOfflineSince: number | null = null;

  async simulateLag(lagging: boolean, forceElapsedMs?: number): Promise<void> {
    const data = await this.postAction({
      action: 'simulate_lag',
      lagging,
      forceElapsedMs,
    });
    if (data) {
      this.reconcileLocalState(data as never);
    }
  }

  async sendInvite(gameId: NetplayGameId): Promise<void> {
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
    const data = await this.postAction({ action: 'invite', gameId, inviteId });
    if (data) this.reconcileLocalState(data as never);
  }

  async cancelInvite(): Promise<void> {
    const current = this.state.myPendingInvite;
    this.updateState({ myPendingInvite: null });
    this.broadcastLocal({ type: 'cancel_invite', inviteId: current?.id ?? '' });
    const data = await this.postAction({ action: 'cancel_invite' });
    if (data) this.reconcileLocalState(data as never);
  }

  async dismissInvite(inviteId: string): Promise<void> {
    this.dismissedInvites.add(inviteId);
    this.localInvites.delete(inviteId);
    this.updateState({
      openInvites: this.state.openInvites.filter((inv) => inv.id !== inviteId),
    });
    await this.postAction({ action: 'dismiss_invite', inviteId });
  }

  async acceptInvite(invite: NetplayInvite): Promise<NetplayActiveRoom | null> {
    this.currentAppId = invite.gameId;
    this.localInvites.delete(invite.id);
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
    this.schedulePoll();
    return activeRoom;
  }

  async setReady(): Promise<void> {
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
    const data = await this.postAction({
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
    const data = await this.postAction({
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
    this.schedulePoll();
    const data = await this.postAction({ action: 'leave_room', roomId: room.id });
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
