import { describe, expect, it } from 'vitest';
import {
  createKartOnlineRoomManager,
  KART_LOBBY_TIMEOUT_MS,
  KART_START_COUNTDOWN_MS,
} from '../src/shared/kartOnlineRoom';
import { KART_DRIVERS, applyAuthoritativeRaceSnapshot, createRaceState } from '../src/shared/microKart';

describe('8-Player Server-Authoritative Online Micro Kart Room Manager (#438)', () => {
  it('enforces unique Starlight companions across up to 8 humans and rejects duplicate selections', () => {
    let t = 10_000;
    const mgr = createKartOnlineRoomManager({ now: () => t });

    const created = mgr.createLobby('host', 'Alice', { character: 'fox', format: 'marathon' }, ['p2', 'p3']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.room.players).toHaveLength(1);
    expect(created.room.canStart).toBe(false); // Requires >= 1 other player

    // P2 requests 'fox' too -> server auto-assigns next unused Starlight companion!
    const j2 = mgr.joinRoom('p2', 'Bob', 'fox');
    expect(j2.ok).toBe(true);
    if (!j2.ok) return;
    expect(j2.character).not.toBe('fox');

    // P2 cannot switch onto 'fox' (already taken by Alice)
    const takenAttempt = mgr.selectCharacter('p2', 'fox');
    expect(takenAttempt.ok).toBe(false);

    // Join 6 more humans -> full 8/8 human grid with 8 strictly distinct companions!
    for (let i = 3; i <= 8; i += 1) {
      const ji = mgr.joinRoom(`p${i}`, `Racer ${i}`, 'fox');
      expect(ji.ok).toBe(true);
    }
    const view = mgr.getPublicRoomView('host')!;
    expect(view.players).toHaveLength(8);
    expect(new Set(view.players.map((p) => p.character)).size).toBe(8);
    expect(Object.keys(view.takenCharacters)).toHaveLength(8);
    expect(view.canStart).toBe(true);

    // 9th player cannot join full lobby
    const j9 = mgr.joinRoom('p9', 'Overflow');
    expect(j9.ok).toBe(false);
  });

  it('exits waiting screen on all 3 exact conditions: Host Go!, 2-minute timeout (start vs quit), and all notified players dismissed', () => {
    // Condition 1: Host Go! (blocked at 1 player, succeeds at >= 2)
    let t = 100_000;
    const m1 = createKartOnlineRoomManager({ now: () => t });
    m1.createLobby('host', 'Host', {}, ['p2']);
    expect(m1.startRace('host').ok).toBe(false);
    m1.joinRoom('p2', 'Guest');
    const started = m1.startRace('host');
    expect(started.ok).toBe(true);
    expect(m1.isSimActive()).toBe(true);

    // Condition 2a: 2-minute timeout with 0 other joiners -> exits netplay with reason 'timeout'
    t = 200_000;
    const m2a = createKartOnlineRoomManager({ now: () => t });
    m2a.createLobby('host', 'Host', {}, ['p2']);
    t += KART_LOBBY_TIMEOUT_MS + 10;
    const res2a = m2a.checkTimers(new Set(['host', 'p2']));
    expect(res2a.autoStarted).toBe(false);
    expect(res2a.closed?.reason).toBe('timeout');
    expect(m2a.hasActiveRoom()).toBe(false);

    // Condition 2b: 2-minute timeout with >= 1 joiner -> auto-starts race!
    t = 300_000;
    const m2b = createKartOnlineRoomManager({ now: () => t });
    m2b.createLobby('host', 'Host', {}, ['p2']);
    m2b.joinRoom('p2', 'Guest');
    t += KART_LOBBY_TIMEOUT_MS + 10;
    const res2b = m2b.checkTimers(new Set(['host', 'p2']));
    expect(res2b.autoStarted).toBe(true);
    expect(m2b.isSimActive()).toBe(true);

    // Condition 3: All notified online players dismiss without joining -> exits immediately!
    t = 400_000;
    const m3 = createKartOnlineRoomManager({ now: () => t });
    m3.createLobby('host', 'Host', {}, ['p2', 'p3']);
    const d1 = m3.dismissLobby('p2');
    expect(d1.closed).toBeNull();
    expect(m3.hasActiveRoom()).toBe(true);
    const d2 = m3.dismissLobby('p3');
    expect(d2.closed?.reason).toBe('all_dismissed');
    expect(m3.hasActiveRoom()).toBe(false);
  });

  it('runs authoritative 20Hz simulation, allows anytime spectate + best-CPU live drop-in, and converts departing humans into CPUs', () => {
    let t = 500_000;
    const mgr = createKartOnlineRoomManager({ now: () => t });
    mgr.createLobby('h1', 'Alice', { circuitId: 'sunset-loop', format: 'grand-prix', character: 'fox' }, ['p2', 'p3']);
    mgr.joinRoom('p2', 'Bob', 'cat');
    const started = mgr.startRace('h1');
    expect(started.ok).toBe(true);

    // Advance past 2.4s countdown and simulate 1.5s of authoritative 20Hz ticks (6 CPUs + 2 humans)
    t += KART_START_COUNTDOWN_MS + 50;
    let snap = mgr.tickSimulation()!;
    for (let i = 0; i < 30; i += 1) {
      t += 50;
      mgr.setInput('h1', { left: false, right: false, brake: false });
      mgr.setInput('p2', { left: false, right: false, brake: true });
      snap = mgr.tickSimulation()!;
    }
    expect(snap.k).toHaveLength(8);
    expect(snap.k.filter((k) => k.h === 1)).toHaveLength(2);
    expect(snap.k[0]!.sp).toBeGreaterThan(20); // Human 0 accelerated cleanly!

    // Client reconciliation applies authoritative snapshot cleanly
    const clientRace = createRaceState('sunset-loop', 'online-8p', 1);
    applyAuthoritativeRaceSnapshot(clientRace, snap, 0, true);
    expect(clientRace.karts[0]!.speed).toBeCloseTo(snap.k[0]!.sp, 1);

    // P3 spectates live, then clicks Join Race -> takes over the BEST-PERFORMING surviving CPU!
    const spec = mgr.spectate('p3', 'Charlie');
    expect(spec.ok).toBe(true);
    expect(mgr.getPublicRoomView('p3')!.myRole).toBe('spectator');

    const bestCpuBefore = snap.k
      .filter((k) => k.h === 0 && k.el === 0)
      .sort((a, b) => a.pl - b.pl)[0]!;
    const dropIn = mgr.joinRoom('p3', 'Charlie');
    expect(dropIn.ok).toBe(true);
    if (!dropIn.ok) return;
    expect(dropIn.joinedLive).toBe(true);
    expect(dropIn.slot).toBe(bestCpuBefore.sl);
    expect(dropIn.snapshot!.k[dropIn.slot]!.h).toBe(1);
    expect(dropIn.snapshot!.k[dropIn.slot]!.nm).toBe('Charlie');

    // Bob leaves mid-race -> seamlessly converts to CPU driver without interrupting the race!
    const left = mgr.leave('p2');
    expect(left.changed).toBe(true);
    expect(left.convertedSlot).toBe(1);
    expect(left.closed).toBeNull();
    const afterLeaveSnap = mgr.getLastSnapshot()!;
    expect(afterLeaveSnap.k[1]!.h).toBe(0);
    expect(KART_DRIVERS.some((d) => d.driverName === afterLeaveSnap.k[1]!.nm)).toBe(true);

    // Remaining humans leave -> room closes cleanly so Cloudflare DO can hibernate!
    mgr.leave('h1');
    const lastLeave = mgr.leave('p3');
    expect(lastLeave.closed?.reason).toBe('empty');
    expect(mgr.hasActiveRoom()).toBe(false);
    expect(mgr.isSimActive()).toBe(false);
  });
});
