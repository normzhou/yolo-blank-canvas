import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  IDLE_SLEEP_MS,
  NetplayClient,
  ROOM_INACTIVITY_TIMEOUT_MS,
  computeBackoffDelayMs,
} from '../src/client/netplay';
import { createNetplayHub } from '../server/netplay.js';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

describe('Demand-driven WebSocket Netplay (#286)', () => {
  const origWindow = globalThis.window;
  const origDocument = globalThis.document;
  const origWebSocket = globalThis.WebSocket;
  const origFetch = globalThis.fetch;

  let hiddenState = false;
  let visibilityListeners: Array<() => void> = [];
  let windowListeners: Map<string, Set<EventListener>>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    hiddenState = false;
    visibilityListeners = [];
    windowListeners = new Map();
    fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const storage = new Map<string, string>();
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    (globalThis as unknown as { document: unknown }).document = {
      get hidden() {
        return hiddenState;
      },
      addEventListener(type: string, fn: () => void) {
        if (type === 'visibilitychange') visibilityListeners.push(fn);
      },
      removeEventListener(type: string, fn: () => void) {
        visibilityListeners = visibilityListeners.filter((l) => l !== fn);
      },
    };
    (globalThis as unknown as { window: unknown }).window = {
      location: {
        protocol: 'https:',
        host: 'demo.yolo-dev.ai',
        search: '',
      },
      sessionStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
      addEventListener(type: string, fn: EventListener) {
        if (!windowListeners.has(type)) windowListeners.set(type, new Set());
        windowListeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: EventListener) {
        windowListeners.get(type)?.delete(fn);
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { window: unknown }).window = origWindow;
    (globalThis as unknown as { document: unknown }).document = origDocument;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = origWebSocket;
    (globalThis as unknown as { fetch: unknown }).fetch = origFetch;
  });

  it('computes exponential backoff up to BACKOFF_MAX_MS', () => {
    expect(computeBackoffDelayMs(0)).toBe(0);
    expect(computeBackoffDelayMs(1)).toBe(BACKOFF_BASE_MS);
    expect(computeBackoffDelayMs(2)).toBe(BACKOFF_BASE_MS * 2);
    expect(computeBackoffDelayMs(3)).toBe(BACKOFF_BASE_MS * 4);
    expect(computeBackoffDelayMs(20)).toBe(BACKOFF_MAX_MS);
  });

  it('connects via WebSocket without HTTP polling, pauses on hidden tab, sleeps after 60s idle, and tears down when unsubscribed', () => {
    const client = new NetplayClient();
    const states: number[] = [];
    const unsub = client.subscribe((s) => states.push(s.onlineCount));

    // 1. Connects via WebSocket immediately
    expect(MockWebSocket.instances.length).toBe(1);
    const ws1 = MockWebSocket.instances[0];
    expect(ws1.url).toContain('wss://demo.yolo-dev.ai/api/netplay?clientId=');
    ws1.open();
    ws1.receive({
      type: 'snapshot',
      onlineCount: 2,
      players: [
        { id: client.getState().clientId, name: client.getState().clientName, status: 'idle', appId: null },
        { id: 'p_other', name: 'Pixel Falcon #222', status: 'idle', appId: 'tetris' },
      ],
      openInvites: [],
      myPendingInvites: [],
      activeRoom: null,
    });
    expect(client.getState().onlineCount).toBe(2);
    // Zero HTTP fetch calls were made while WebSocket is open!
    expect(fetchMock).not.toHaveBeenCalled();

    // 2. Hiding the tab immediately closes the WebSocket and makes 0 requests overnight
    hiddenState = true;
    for (const fn of visibilityListeners) fn();
    expect(ws1.readyState).toBe(MockWebSocket.CLOSED);
    vi.advanceTimersByTime(3600_000); // 1 hour hidden
    expect(fetchMock).not.toHaveBeenCalled();
    expect(MockWebSocket.instances.length).toBe(1);

    // 3. Becoming visible again reconnects WebSocket
    hiddenState = false;
    for (const fn of visibilityListeners) fn();
    expect(MockWebSocket.instances.length).toBe(2);
    const ws2 = MockWebSocket.instances[1];
    ws2.open();

    // 4. After IDLE_SLEEP_MS (60s) with no user interaction while idle, enters idle sleep and closes WebSocket
    vi.advanceTimersByTime(IDLE_SLEEP_MS + 15_000);
    expect(ws2.readyState).toBe(MockWebSocket.CLOSED);
    vi.advanceTimersByTime(3600_000); // 1 hour untouched
    expect(fetchMock).not.toHaveBeenCalled();
    expect(MockWebSocket.instances.length).toBe(2);

    // 5. User interaction wakes from idle sleep and reconnects
    for (const fn of windowListeners.get('pointerdown') ?? []) {
      fn({} as Event);
    }
    expect(MockWebSocket.instances.length).toBe(3);
    const ws3 = MockWebSocket.instances[2];
    ws3.open();

    // 6. Unsubscribing all listeners immediately closes WebSocket and stops all timers
    unsub();
    expect(ws3.readyState).toBe(MockWebSocket.CLOSED);
    vi.advanceTimersByTime(600_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('closes an active 2P room session if there is no user input for ROOM_INACTIVITY_TIMEOUT_MS (90s)', () => {
    const client = new NetplayClient();
    const unsub = client.subscribe(() => undefined);
    const ws = MockWebSocket.instances[0];
    ws.open();
    ws.receive({
      type: 'snapshot',
      onlineCount: 2,
      players: [
        { id: client.getState().clientId, name: client.getState().clientName, status: 'playing_2p', appId: 'tetris' },
        { id: 'p_peer', name: 'Peer', status: 'playing_2p', appId: 'tetris' },
      ],
      openInvites: [],
      myPendingInvites: [],
      activeRoom: {
        id: 'room_1',
        gameId: 'tetris',
        seed: 42,
        status: 'playing',
        players: [
          { id: client.getState().clientId, name: client.getState().clientName, slot: 0, ready: true },
          { id: 'p_peer', name: 'Peer', slot: 1, ready: true },
        ],
        events: [],
        lastSeq: 1,
      },
    });
    expect(client.getState().activeRoom?.id).toBe('room_1');

    // Advance past ROOM_INACTIVITY_TIMEOUT_MS with no user input
    vi.advanceTimersByTime(ROOM_INACTIVITY_TIMEOUT_MS + 5_000);
    expect(client.getState().activeRoom).toBeNull();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    unsub();
  });

  it('auto-pairs 2P invites and relays room events in server/netplay.js', () => {
    let nowMs = 10_000;
    const hub = createNetplayHub({ now: () => nowMs });

    const r1 = hub.handleAction({
      action: 'invite',
      clientId: 'p_host',
      name: 'Host',
      gameId: 'tetris',
    });
    expect(r1.status).toBe(200);
    if ('myPendingInvites' in r1.payload) {
      expect(r1.payload.myPendingInvites.length).toBe(1);
    }

    // Second player inviting for the same game auto-pairs into ready_check room
    const r2 = hub.handleAction({
      action: 'invite',
      clientId: 'p_guest',
      name: 'Guest',
      gameId: 'tetris',
    });
    expect(r2.status).toBe(200);
    if ('activeRoom' in r2.payload) {
      expect(r2.payload.activeRoom?.status).toBe('ready_check');
    }

    hub.handleAction({ action: 'player_ready', clientId: 'p_host' });
    const ready2 = hub.handleAction({ action: 'player_ready', clientId: 'p_guest' });
    if ('activeRoom' in ready2.payload) {
      expect(ready2.payload.activeRoom?.status).toBe('playing');
    }

    nowMs += 500;
    hub.handleAction({
      action: 'room_event',
      clientId: 'p_host',
      kind: 'tetris_attack',
      payload: { lines: 4, holeColumn: 2 },
    });
    const guestSnap = hub.snapshotFor('p_guest', 0);
    expect(guestSnap.activeRoom?.events.some((e: { kind: string }) => e.kind === 'tetris_attack')).toBe(
      true,
    );
  });
});
