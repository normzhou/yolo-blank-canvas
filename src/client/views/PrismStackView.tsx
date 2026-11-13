import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  getSharedArcadeAudio,
  getSharedMusicOn,
  getSharedSfxOn,
  setSharedMusicOn,
  setSharedSfxOn,
  subscribeSharedAudio,
} from '../audio/arcadeAudio';
import {
  getSharedGamePaused,
  getSharedOverlayOpen,
  setSharedGamePaused,
  subscribeSharedGamePause,
  subscribeSharedOverlayOpen,
  toggleSharedGamePaused,
} from '../gamePause';
import {
  getSharedNetplay,
  INVITE_TIMEOUT_MS,
  type NetplayState,
  type PrismStackLiveSnapshot,
} from '../netplay';
import {
  pickCountdownLanguage,
  type CountdownLanguage,
} from '../../shared/countdownLanguages';
import { PRISM_STACK_PLAYLIST } from '../../shared/arcadeMusic';
import {
  BACKGROUNDS,
  nextBackgroundIndex,
  type Backdrop,
} from '../../shared/stageBackdrops';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createEmptyBoard,
  createGame,
  displayBoard,
  dropInterval,
  hardDrop,
  landingGuide,
  moveLeft,
  moveRight,
  pendingHazardCount,
  queuePrismHazard,
  rotate,
  rotationCells,
  softDrop,
  tick,
  type Cell,
  type PolyId,
  type PrismStackState,
} from '../../shared/prismStack';

const COUNTDOWN_READY_MS =
  typeof navigator !== 'undefined' && navigator.webdriver ? 180 : 950;
const COUNTDOWN_GO_MS =
  typeof navigator !== 'undefined' && navigator.webdriver ? 140 : 600;

function motionReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function detectTouchAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < 768) return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return true;
  return false;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createInitialPrismSnapshot(): PrismStackLiveSnapshot {
  return {
    board: createEmptyBoard(),
    settledBoard: createEmptyBoard(),
    activePiece: null,
    nextPiece: 'bar',
    lastEvent: null,
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    pendingHazard: 0,
  };
}

function buildPrismLiveSnapshot(cur: PrismStackState): PrismStackLiveSnapshot {
  return {
    board: displayBoard(cur),
    settledBoard: cur.board,
    activePiece: cur.piece
      ? {
          type: cur.piece.type,
          x: cur.piece.x,
          y: cur.piece.y,
          rotation: cur.piece.rotation,
        }
      : null,
    nextPiece: cur.next,
    lastEvent: cur.lastLockEvent
      ? {
          id: cur.lastLockEvent.id,
          clearedLines: cur.lastLockEvent.cleared,
          sentHazard: cur.lastLockEvent.sentHazard,
          risenHazard: cur.lastLockEvent.risenHazard,
        }
      : null,
    score: cur.score,
    lines: cur.lines,
    level: cur.level,
    status: cur.status,
    pendingHazard: pendingHazardCount(cur),
  };
}

/**
 * Non-Guideline jewel/prism color mapping (#352):
 * - `bar`   (4-bar) -> `--prism-1` (Coral-Ruby)
 * - `quad`  (2×2)   -> `--prism-2` (Amethyst-Orchid)
 * - `crest` (3+1)   -> `--prism-3` (Seafoam-Mint)
 * - `stepR`         -> `--prism-4` (Solar-Gold)
 * - `stepL`         -> `--prism-5` (Cobalt-Sapphire)
 * - `hookL`         -> `--prism-6` (Tangerine-Amber)
 * - `hookR`         -> `--prism-7` (Sky-Aqua)
 * - `H`             -> Solid crystalline Hazard Lock Bar
 */
const CELL_CLASS: Record<PolyId | 'H', string> = {
  bar: 'prism-cell-1',
  quad: 'prism-cell-2',
  crest: 'prism-cell-3',
  stepR: 'prism-cell-4',
  stepL: 'prism-cell-5',
  hookL: 'prism-cell-6',
  hookR: 'prism-cell-7',
  H: 'prism-cell-hazard',
};

function cellClass(cell: Cell, isGuideCol = false, isLandingTick = false): string {
  if (cell) return `stack-cell ${CELL_CLASS[cell]}`;
  if (isLandingTick) return 'stack-cell is-guide-col is-landing-tick';
  if (isGuideCol) return 'stack-cell is-guide-col';
  return 'stack-cell';
}

function ArtLayer({ art, past, onFaded }: { art: Backdrop; past: boolean; onFaded: () => void }) {
  return (
    <img
      className={`stack-art-layer ${past ? 'is-past' : 'is-current'}`}
      src={art.src}
      alt=""
      aria-hidden="true"
      onAnimationEnd={
        past
          ? (event) => {
              if (event.animationName === 'stack-art-out') onFaded();
            }
          : undefined
      }
    />
  );
}

function PixelBackdrop({ art }: { art: Backdrop }) {
  const [layers, setLayers] = useState<Array<{ key: number; art: Backdrop }>>([{ key: 0, art }]);
  const keyRef = useRef(0);

  const dropPastLayers = useCallback(() => setLayers((current) => current.slice(-1)), []);

  useEffect(() => {
    setLayers((current) => {
      if (current[current.length - 1].art.id === art.id) return current;
      keyRef.current += 1;
      return [...current, { key: keyRef.current, art }];
    });
  }, [art]);

  useEffect(() => {
    if (layers.length <= 1 || !motionReduced()) return;
    const id = window.requestAnimationFrame(dropPastLayers);
    return () => window.cancelAnimationFrame(id);
  }, [layers, dropPastLayers]);

  return (
    <div className="stack-art" aria-hidden="true">
      {layers.map((layer, index) => (
        <ArtLayer key={layer.key} art={layer.art} past={index < layers.length - 1} onFaded={dropPastLayers} />
      ))}
    </div>
  );
}

/**
 * Compact inline header upcoming-prism pill (replaces boxed right-rail "Next" window, #352).
 */
const InlineNextPrismPill = memo(function InlineNextPrismPill({
  type,
  testId,
}: {
  type: PolyId;
  testId?: string;
}) {
  const cells = rotationCells(type, 0);
  const filled = new Set(cells.map(([x, y]) => `${x},${y}`));
  return (
    <div
      className="stack-next-pill"
      data-testid={testId}
      data-next-shape={type}
      aria-label={`Upcoming prism ${type}`}
    >
      <span className="stack-next-pill-label">Upcoming</span>
      <div className="stack-next-mini">
        {Array.from({ length: 4 }, (_, y) =>
          Array.from({ length: 4 }, (_, x) => (
            <div
              key={`${x},${y}`}
              className={
                filled.has(`${x},${y}`)
                  ? `stack-next-mini-cell ${CELL_CLASS[type]}`
                  : 'stack-next-mini-cell'
              }
            />
          )),
        )}
      </div>
    </div>
  );
});

/**
 * Full-size symmetric 9×18 Online Opponent Stage (replaces miniature side-radar, #352).
 */
const OnlineOpponentPrismLane = memo(function OnlineOpponentPrismLane({
  opponentName,
  snapshot,
  roundOutcome,
}: {
  opponentName: string;
  snapshot: PrismStackLiveSnapshot;
  roundOutcome: 'playing' | 'won' | 'lost';
}) {
  const statusLabel =
    roundOutcome === 'won' || snapshot.status === 'over'
      ? 'KO'
      : roundOutcome === 'lost'
        ? 'WIN'
        : 'LIVE';

  const board = useMemo(() => {
    const base = snapshot.settledBoard
      ? snapshot.settledBoard.map((r) => r.slice())
      : snapshot.board.map((r) => r.slice());
    if (snapshot.activePiece) {
      for (const [dx, dy] of rotationCells(
        snapshot.activePiece.type,
        snapshot.activePiece.rotation,
      )) {
        const x = snapshot.activePiece.x + dx;
        const y = snapshot.activePiece.y + dy;
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
          base[y]![x] = snapshot.activePiece.type;
        }
      }
    }
    return base;
  }, [snapshot.activePiece, snapshot.board, snapshot.settledBoard]);

  return (
    <div
      className="stack-player-lane"
      data-player="2"
      data-testid="prism-online-opponent-arena"
    >
      <div className="stack-lane-bar">
        <div className="sb-player-id">
          <span
            className="sb-slot-badge sb-slot-2"
            style={{ background: 'var(--prism-7)', color: 'var(--stage-well)' }}
          >
            VS
          </span>
          <span className="sb-player-title" title={opponentName}>
            {opponentName}
          </span>
          <span
            className={statusLabel === 'KO' ? 'netplay-radar-badge is-ko' : 'netplay-radar-badge'}
            data-testid="prism-opponent-status"
          >
            {statusLabel}
          </span>
        </div>
        {snapshot.nextPiece ? <InlineNextPrismPill type={snapshot.nextPiece} /> : null}
      </div>

      <div className="stack-stage-row">
        <div
          className={
            statusLabel === 'KO' ? 'stack-board is-dissolved' : 'stack-board'
          }
          data-testid="prism-opponent-board"
          role="img"
          aria-label={`${opponentName} Prism Stack board, ${BOARD_WIDTH} by ${BOARD_HEIGHT}, score ${snapshot.score}, lines ${snapshot.lines}`}
        >
          {board.map((row, y) =>
            row.map((cell, x) => <div key={`${x},${y}`} className={cellClass(cell)} />),
          )}
          {snapshot.activePiece ? (
            <span
              className="sr-only"
              data-testid="prism-opponent-active-piece"
              data-x={snapshot.activePiece.x}
              data-y={snapshot.activePiece.y}
            />
          ) : null}
        </div>

        <div
          className="stack-hazard-meter"
          role="status"
          aria-label={`${opponentName} ${snapshot.pendingHazard} incoming hazard bars`}
        >
          {Array.from({ length: BOARD_HEIGHT }, (_, idx) => {
            const rowFromBottom = BOARD_HEIGHT - 1 - idx;
            const active = rowFromBottom < snapshot.pendingHazard;
            return (
              <div
                key={idx}
                className={
                  active ? 'stack-hazard-segment is-active' : 'stack-hazard-segment'
                }
              />
            );
          })}
        </div>

        <aside className="stack-side">
          <div className="stack-stat">
            <span className="stack-label">Score</span>
            <span className="stack-value" data-testid="prism-opponent-score">
              {snapshot.score}
            </span>
          </div>
          <div className="stack-stat">
            <span className="stack-label">Lines</span>
            <span className="stack-value" data-testid="prism-opponent-lines">
              {snapshot.lines}
            </span>
          </div>
          <div className="stack-stat">
            <span className="stack-label">Level</span>
            <span className="stack-value">{snapshot.level}</span>
          </div>
        </aside>
      </div>
    </div>
  );
});

export function PrismStackView({ onExit }: { onExit: () => void }) {
  const customRngRef = useRef<(() => number) | null>(null);
  const rngRef = {
    get current(): () => number {
      return customRngRef.current ?? Math.random;
    },
    set current(fn: (() => number) | null) {
      customRngRef.current = fn === Math.random ? null : fn;
    },
  };
  const [game, setGame] = useState<PrismStackState>(() => createGame());
  const [game2, setGame2] = useState<PrismStackState>(() => createGame());
  const [localMode, setLocalMode] = useState<'1p' | '2p'>('1p');
  const [paused, setPaused] = useState<boolean>(() => getSharedGamePaused());
  const [musicOn, setMusicOn] = useState<boolean>(() => getSharedMusicOn());
  const [sfxOn, setSfxOn] = useState<boolean>(() => getSharedSfxOn());
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<string | null>(
    () => getSharedArcadeAudio().getCurrentTrack()?.title ?? null,
  );
  const [netplay, setNetplay] = useState<NetplayState>(() => getSharedNetplay().getState());
  const [opponentSnapshot, setOpponentSnapshot] = useState<PrismStackLiveSnapshot>(() =>
    createInitialPrismSnapshot(),
  );
  const [roundOutcome, setRoundOutcome] = useState<'playing' | 'won' | 'lost'>('playing');
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [countdown, setCountdown] = useState<number>(2);
  const [countdownKey, setCountdownKey] = useState<number>(0);
  const [countdownLang, setCountdownLang] = useState<CountdownLanguage>(() =>
    pickCountdownLanguage(),
  );
  const pauseMenuRef = useRef<HTMLDivElement | null>(null);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState<number>(20);
  const touchSeenRef = useRef<boolean>(detectTouchAvailable());
  const [touchAvailable, setTouchAvailable] = useState<boolean>(() => touchSeenRef.current);
  const [overlayOpen, setOverlayOpen] = useState<boolean>(() => getSharedOverlayOpen());

  useEffect(() => {
    const unsubPause = subscribeSharedGamePause((nextPaused) => {
      setPaused(nextPaused);
    });
    const unsubOverlay = subscribeSharedOverlayOpen((nextOpen) => {
      setOverlayOpen(nextOpen);
    });
    return () => {
      unsubPause();
      unsubOverlay();
      setSharedGamePaused(false);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (detectTouchAvailable()) touchSeenRef.current = true;
      setTouchAvailable(touchSeenRef.current || detectTouchAvailable());
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touchSeenRef.current = true;
        setTouchAvailable(true);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const gameRef = useRef(game);
  gameRef.current = game;
  const game2Ref = useRef(game2);
  game2Ref.current = game2;
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;
  const roundOutcomeRef = useRef(roundOutcome);
  roundOutcomeRef.current = roundOutcome;
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomStartedRef = useRef<string | null>(null);
  const quadClearRef = useRef(game.quadClearCount);
  const quadClear2Ref = useRef(game2.quadClearCount);
  const prevLinesRef = useRef(game.lines);
  const prevLines2Ref = useRef(game2.lines);
  const prevStatusRef = useRef(game.status);
  const prevStatus2Ref = useRef(game2.status);
  const prevLockIdRef = useRef<number>(0);
  const prevLockId2Ref = useRef<number>(0);
  const gameSectionRef = useRef<HTMLElement>(null);

  const activePrismRoom =
    netplay.activeRoom && netplay.activeRoom.gameId === 'prism-stack'
      ? netplay.activeRoom
      : null;
  const isOnline2P = activePrismRoom !== null;
  const isReadyCheck = activePrismRoom?.status === 'ready_check';
  const isNetworkPaused = Boolean(
    isOnline2P &&
      activePrismRoom?.status === 'playing' &&
      activePrismRoom?.syncStatus === 'paused',
  );
  const syncSecondsLeft = Math.max(
    0,
    Math.ceil((activePrismRoom?.syncRemainingMs ?? 15_000) / 1000),
  );
  const isInviting = netplay.myPendingInvite?.gameId === 'prism-stack';
  const isLocal2P = localMode === '2p' && !isOnline2P && !isInviting;
  const isSymmetric2P = isLocal2P || isOnline2P;
  const myRoomPlayer = activePrismRoom?.players.find((p) => p.id === netplay.clientId);
  const myReady = Boolean(myRoomPlayer?.ready);
  const oppReady = Boolean(activePrismRoom?.opponent?.ready);

  useEffect(() => {
    if (activePrismRoom?.syncStatus === 'timeout') {
      void getSharedNetplay().leaveRoom();
      onExit();
    }
  }, [activePrismRoom?.syncStatus, onExit]);

  const lastSnapshotDigestRef = useRef<string>('');
  useEffect(() => {
    if (!isOnline2P || isReadyCheck || isNetworkPaused || roundOutcome !== 'playing') return;
    const pushSnapshot = () => {
      const cur = gameRef.current;
      const snap = buildPrismLiveSnapshot(cur);
      const digest = JSON.stringify(snap);
      if (digest === lastSnapshotDigestRef.current) return;
      lastSnapshotDigestRef.current = digest;
      void getSharedNetplay().sendRoomEvent('prism_state', snap);
    };
    pushSnapshot();
    const id = window.setInterval(pushSnapshot, 500);
    return () => window.clearInterval(id);
  }, [isOnline2P, isReadyCheck, isNetworkPaused, roundOutcome]);

  const triggerFreshCountdown = useCallback(
    (lang: CountdownLanguage = pickCountdownLanguage()) => {
      countdownRef.current = 2;
      setCountdownLang(lang);
      setCountdown(2);
      setCountdownKey((k) => k + 1);
    },
    [],
  );

  const startOnlineRoundWithSeed = useCallback(
    (seed: number, resetTally = false) => {
      rngRef.current = mulberry32(seed);
      const fresh = createGame(rngRef.current);
      prevLinesRef.current = 0;
      prevStatusRef.current = 'playing';
      prevLockIdRef.current = 0;
      setGame(fresh);
      setOpponentSnapshot(createInitialPrismSnapshot());
      setRoundOutcome('playing');
      setSharedGamePaused(false);
      triggerFreshCountdown(pickCountdownLanguage(mulberry32((seed ^ 0x5a5a5a5a) >>> 0)));
      getSharedArcadeAudio().startNewGameTrack();
      if (resetTally) {
        setWins([0, 0]);
      }
    },
    [triggerFreshCountdown],
  );

  useEffect(() => {
    const invite = netplay.myPendingInvite;
    if (!invite || invite.gameId !== 'prism-stack') {
      setInviteSecondsLeft(20);
      return;
    }
    const updateTimer = () => {
      const elapsed = Date.now() - invite.createdAt;
      const remaining = Math.max(0, Math.ceil((INVITE_TIMEOUT_MS - elapsed) / 1000));
      setInviteSecondsLeft(remaining);
      if (remaining <= 0) {
        void getSharedNetplay().cancelInvite();
      }
    };
    updateTimer();
    const id = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(id);
  }, [netplay.myPendingInvite]);

  useEffect(() => {
    if (countdown <= 0 || paused || isReadyCheck || isInviting || isNetworkPaused) return;
    const phase = countdown >= 2 ? 'ready' : 'go';
    getSharedArcadeAudio().playCountdownPhrase(countdownLang, phase);
    const beatMs = phase === 'ready' ? COUNTDOWN_READY_MS : COUNTDOWN_GO_MS;
    const id = window.setTimeout(() => {
      setCountdown((c) => {
        const next = Math.max(0, c - 1);
        if (next === 0) {
          setGame((cur) => tick(cur, rngRef.current));
          if (isLocal2P) {
            setGame2((cur) => tick(cur, rngRef.current));
          }
        }
        return next;
      });
    }, beatMs);
    return () => window.clearTimeout(id);
  }, [countdown, countdownKey, countdownLang, isLocal2P, paused, isReadyCheck, isInviting, isNetworkPaused]);

  useEffect(() => {
    const client = getSharedNetplay();
    const unsubState = client.subscribe((nextState) => {
      setNetplay(nextState);
      const room =
        nextState.activeRoom && nextState.activeRoom.gameId === 'prism-stack'
          ? nextState.activeRoom
          : null;
      if (room && activeRoomIdRef.current !== room.id) {
        activeRoomIdRef.current = room.id;
        setSharedGamePaused(false);
        if (room.status === 'playing') {
          activeRoomStartedRef.current = room.id;
          startOnlineRoundWithSeed(room.seed, true);
        }
      } else if (
        room &&
        room.status === 'playing' &&
        activeRoomStartedRef.current !== room.id
      ) {
        activeRoomStartedRef.current = room.id;
        startOnlineRoundWithSeed(room.seed, true);
      } else if (!room && activeRoomIdRef.current !== null) {
        activeRoomIdRef.current = null;
        activeRoomStartedRef.current = null;
        rngRef.current = Math.random;
        setRoundOutcome('playing');
      }
    });

    const unsubEvents = client.onRoomEvent((event) => {
      if (event.kind === 'match_start') {
        const payload = event.payload as { gameId?: string; seed?: number; id?: string; roomId?: string } | null;
        if (payload && payload.gameId === 'prism-stack') {
          const rid = payload.id ?? payload.roomId ?? null;
          if (rid && activeRoomStartedRef.current !== rid) {
            activeRoomIdRef.current = rid;
            activeRoomStartedRef.current = rid;
            startOnlineRoundWithSeed(payload.seed ?? 1337, true);
          }
        }
        return;
      }

      if (event.kind === 'sync_resumed') {
        triggerFreshCountdown();
        return;
      }

      if (event.kind === 'sync_timeout') {
        void getSharedNetplay().leaveRoom();
        onExit();
        return;
      }

      if (event.senderId === client.getState().clientId) return;

      if (event.kind === 'prism_attack') {
        const payload = event.payload as { lines?: number } | null;
        const lines = Number(payload?.lines ?? 0);
        if (lines > 0) {
          setGame((current) => queuePrismHazard(current, lines));
        }
        return;
      }

      if (event.kind === 'prism_state') {
        const snapshot = event.payload as PrismStackLiveSnapshot | null;
        if (snapshot && Array.isArray(snapshot.board)) {
          setOpponentSnapshot(snapshot);
        }
        return;
      }

      if (event.kind === 'prism_ko') {
        setOpponentSnapshot((prev) => ({ ...prev, status: 'over' }));
        if (roundOutcomeRef.current === 'playing') {
          setRoundOutcome('won');
          setWins(([myW, oppW]) => [myW + 1, oppW]);
          getSharedArcadeAudio().sfx.playRoundEnd(true);
        }
        return;
      }

      if (event.kind === 'prism_rematch') {
        const payload = event.payload as { seed?: number } | null;
        startOnlineRoundWithSeed(payload?.seed ?? Date.now(), false);
        return;
      }

      if (event.kind === 'player_left') {
        setOpponentSnapshot((prev) => ({ ...prev, status: 'over' }));
        if (roundOutcomeRef.current === 'playing') {
          setRoundOutcome('won');
        }
      }
    });

    return () => {
      unsubState();
      unsubEvents();
    };
  }, [onExit, startOnlineRoundWithSeed, triggerFreshCountdown]);

  useEffect(() => {
    const audio = getSharedArcadeAudio();
    audio.setPlaylist(PRISM_STACK_PLAYLIST);
    setNowPlaying(audio.getCurrentTrack()?.title ?? null);
    return subscribeSharedAudio((nextOn, nextTitle, nextSfxOn) => {
      setMusicOn(nextOn);
      setNowPlaying(nextTitle);
      setSfxOn(nextSfxOn);
    });
  }, []);

  useEffect(() => {
    const el = gameSectionRef.current;
    if (!el) return;
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  useEffect(() => {
    if (game.quadClearCount > quadClearRef.current) {
      setBackgroundIndex((index) => nextBackgroundIndex(index));
    }
    quadClearRef.current = game.quadClearCount;
  }, [game.quadClearCount]);

  useEffect(() => {
    if (!isLocal2P) return;
    if (game2.quadClearCount > quadClear2Ref.current) {
      setBackgroundIndex((index) => nextBackgroundIndex(index));
    }
    quadClear2Ref.current = game2.quadClearCount;
  }, [game2.quadClearCount, isLocal2P]);

  useEffect(() => {
    if (game.lines > prevLinesRef.current) {
      const cleared = game.lines - prevLinesRef.current;
      getSharedArcadeAudio().sfx.playLineClear(cleared);
    }
    prevLinesRef.current = game.lines;
  }, [game.lines]);

  useEffect(() => {
    if (!isLocal2P) return;
    if (game2.lines > prevLines2Ref.current) {
      const cleared = game2.lines - prevLines2Ref.current;
      getSharedArcadeAudio().sfx.playLineClear(cleared);
    }
    prevLines2Ref.current = game2.lines;
  }, [game2.lines, isLocal2P]);

  useEffect(() => {
    const lockEv = game.lastLockEvent;
    if (lockEv && lockEv.id !== prevLockIdRef.current) {
      prevLockIdRef.current = lockEv.id;
      const sfx = getSharedArcadeAudio().sfx;
      if (lockEv.sentHazard > 0) {
        sfx.playGarbageSend(lockEv.sentHazard);
        if (isOnline2P) {
          void getSharedNetplay().sendRoomEvent('prism_attack', {
            lines: lockEv.sentHazard,
          });
        } else if (isLocal2P) {
          setGame2((cur2) => queuePrismHazard(cur2, lockEv.sentHazard));
        }
      }
      if (lockEv.risenHazard > 0) {
        sfx.playGarbageRise(lockEv.risenHazard);
      }
      if (isOnline2P) {
        void getSharedNetplay().sendRoomEvent('prism_state', buildPrismLiveSnapshot(game));
      }
    }
  }, [game, isLocal2P, isOnline2P]);

  useEffect(() => {
    if (!isLocal2P) return;
    const lockEv2 = game2.lastLockEvent;
    if (lockEv2 && lockEv2.id !== prevLockId2Ref.current) {
      prevLockId2Ref.current = lockEv2.id;
      const sfx = getSharedArcadeAudio().sfx;
      if (lockEv2.sentHazard > 0) {
        sfx.playGarbageSend(lockEv2.sentHazard);
        setGame((cur1) => queuePrismHazard(cur1, lockEv2.sentHazard));
      }
      if (lockEv2.risenHazard > 0) {
        sfx.playGarbageRise(lockEv2.risenHazard);
      }
    }
  }, [game2, isLocal2P]);

  useEffect(() => {
    if (game.status === 'over' && prevStatusRef.current === 'playing') {
      if (isOnline2P && roundOutcomeRef.current === 'playing') {
        getSharedArcadeAudio().sfx.playGameOver();
        setRoundOutcome('lost');
        setWins(([myW, oppW]) => [myW, oppW + 1]);
        void getSharedNetplay().sendRoomEvent('prism_ko', { score: game.score, lines: game.lines });
      } else if (isLocal2P && roundOutcomeRef.current === 'playing') {
        getSharedArcadeAudio().sfx.playRoundEnd(true);
        setRoundOutcome('lost');
        setWins(([w1, w2]) => [w1, w2 + 1]);
      } else {
        getSharedArcadeAudio().sfx.playGameOver();
      }
    }
    prevStatusRef.current = game.status;
  }, [game.lines, game.score, game.status, isLocal2P, isOnline2P]);

  useEffect(() => {
    if (!isLocal2P) return;
    if (game2.status === 'over' && prevStatus2Ref.current === 'playing') {
      if (roundOutcomeRef.current === 'playing') {
        getSharedArcadeAudio().sfx.playRoundEnd(true);
        setRoundOutcome('won');
        setWins(([w1, w2]) => [w1 + 1, w2]);
      }
    }
    prevStatus2Ref.current = game2.status;
  }, [game2.status, isLocal2P]);

  useEffect(() => {
    function forceQuadClear() {
      getSharedArcadeAudio().sfx.playLineClear(4);
      setGame((current) => ({
        ...current,
        lines: current.lines + 4,
        score: current.score + 800 * current.level,
        quadClearCount: current.quadClearCount + 1,
        hazardSent: current.hazardSent + 4,
        lastLockEvent: {
          id: (current.lastLockEvent?.id ?? 0) + 1,
          cleared: 4,
          shatteredHazards: 0,
          sentHazard: 4,
          canceledHazard: 0,
          risenHazard: 0,
        },
      }));
    }
    function onQueueHazard(event: Event) {
      const detail = (event as CustomEvent<{ lines?: number }>).detail;
      const lines = detail?.lines ?? 2;
      setGame((current) => queuePrismHazard(current, lines));
    }
    window.addEventListener('yolo:prism:quad-clear', forceQuadClear);
    window.addEventListener('yolo:prism:queue-hazard', onQueueHazard);
    return () => {
      window.removeEventListener('yolo:prism:quad-clear', forceQuadClear);
      window.removeEventListener('yolo:prism:queue-hazard', onQueueHazard);
    };
  }, []);

  const matchEnded =
    game.status !== 'playing' ||
    (isLocal2P && (game2.status !== 'playing' || roundOutcome !== 'playing')) ||
    (isOnline2P && roundOutcome !== 'playing');

  useEffect(() => {
    getSharedArcadeAudio().setActive(musicOn && !matchEnded);
  }, [musicOn, matchEnded]);

  useEffect(() => {
    if (paused || matchEnded || isReadyCheck || isInviting || isNetworkPaused || countdown > 0) return;
    const id = window.setInterval(() => {
      setGame((current) => tick(current, rngRef.current));
    }, dropInterval(game.level));
    return () => window.clearInterval(id);
  }, [paused, game.level, matchEnded, isReadyCheck, isInviting, isNetworkPaused, countdown]);

  useEffect(() => {
    if (!isLocal2P || paused || matchEnded || isReadyCheck || isInviting || isNetworkPaused || countdown > 0) return;
    const id = window.setInterval(() => {
      setGame2((current) => tick(current, rngRef.current));
    }, dropInterval(game2.level));
    return () => window.clearInterval(id);
  }, [isLocal2P, paused, game2.level, matchEnded, isReadyCheck, isInviting, isNetworkPaused, countdown]);

  useEffect(() => {
    if (!paused || overlayOpen || isReadyCheck || isInviting || isNetworkPaused) return;
    const menu = pauseMenuRef.current;
    if (!menu) return;
    const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const resumeIdx = buttons.findIndex((b) => b.dataset.testid === 'pause-menu-resume');
    const targetIdx = resumeIdx >= 0 ? resumeIdx : 0;
    buttons.forEach((btn, i) => {
      if (i === targetIdx) {
        btn.setAttribute('data-menu-focused', 'true');
        btn.classList.add('is-menu-focused');
      } else {
        btn.removeAttribute('data-menu-focused');
        btn.classList.remove('is-menu-focused');
      }
    });
  }, [paused, overlayOpen, isReadyCheck, isInviting, isNetworkPaused]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (getSharedOverlayOpen()) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        toggleSharedGamePaused();
        return;
      }
      if (paused && !isReadyCheck && !isInviting && !isNetworkPaused) {
        const menu = pauseMenuRef.current;
        if (!menu) return;
        const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        if (buttons.length === 0) return;
        const currentIdx = Math.max(
          0,
          buttons.findIndex((b) => b.getAttribute('data-menu-focused') === 'true'),
        );
        if (
          event.key === 'ArrowDown' ||
          event.key === 'ArrowRight' ||
          event.key === 's' ||
          event.key === 'S' ||
          event.key === 'd' ||
          event.key === 'D'
        ) {
          event.preventDefault();
          event.stopPropagation();
          const nextIdx = (currentIdx + 1) % buttons.length;
          buttons.forEach((btn, i) => {
            if (i === nextIdx) {
              btn.setAttribute('data-menu-focused', 'true');
              btn.classList.add('is-menu-focused');
              btn.focus();
            } else {
              btn.removeAttribute('data-menu-focused');
              btn.classList.remove('is-menu-focused');
            }
          });
          getSharedArcadeAudio().sfx.playRotate();
          return;
        }
        if (
          event.key === 'ArrowUp' ||
          event.key === 'ArrowLeft' ||
          event.key === 'w' ||
          event.key === 'W' ||
          event.key === 'a' ||
          event.key === 'A'
        ) {
          event.preventDefault();
          event.stopPropagation();
          const prevIdx = (currentIdx - 1 + buttons.length) % buttons.length;
          buttons.forEach((btn, i) => {
            if (i === prevIdx) {
              btn.setAttribute('data-menu-focused', 'true');
              btn.classList.add('is-menu-focused');
              btn.focus();
            } else {
              btn.removeAttribute('data-menu-focused');
              btn.classList.remove('is-menu-focused');
            }
          });
          getSharedArcadeAudio().sfx.playRotate();
          return;
        }
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          event.stopPropagation();
          buttons[currentIdx]?.click();
          return;
        }
        return;
      }
      if (
        !paused &&
        !isReadyCheck &&
        !isInviting &&
        !isNetworkPaused &&
        (gameRef.current.status !== 'playing' ||
          (isLocal2P && (game2Ref.current.status !== 'playing' || roundOutcomeRef.current !== 'playing')) ||
          (isOnline2P && roundOutcomeRef.current !== 'playing'))
      ) {
        if (
          !event.repeat &&
          (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')
        ) {
          event.preventDefault();
          handleNewOrRematch();
        }
        return;
      }
      if (
        paused ||
        isReadyCheck ||
        isInviting ||
        isNetworkPaused ||
        countdownRef.current > 0 ||
        gameRef.current.status !== 'playing' ||
        (isLocal2P && (game2Ref.current.status !== 'playing' || roundOutcomeRef.current !== 'playing')) ||
        (isOnline2P && roundOutcomeRef.current !== 'playing')
      ) {
        return;
      }
      const setArrowTarget = isLocal2P ? setGame2 : setGame;
      switch (event.key) {
        case 'a':
        case 'A':
          event.preventDefault();
          setGame((current) => moveLeft(current));
          break;
        case 'd':
        case 'D':
          event.preventDefault();
          setGame((current) => moveRight(current));
          break;
        case 's':
        case 'S':
          event.preventDefault();
          setGame((current) => softDrop(current, rngRef.current));
          break;
        case 'w':
        case 'W':
          event.preventDefault();
          getSharedArcadeAudio().sfx.playRotate();
          setGame((current) => rotate(current, 1));
          break;
        case 'f':
        case 'F':
        case 'q':
        case 'Q':
        case 'e':
        case 'E':
          event.preventDefault();
          getSharedArcadeAudio().sfx.playHardDrop();
          setGame((current) => hardDrop(current, rngRef.current));
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setArrowTarget((current) => moveLeft(current));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setArrowTarget((current) => moveRight(current));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setArrowTarget((current) => softDrop(current, rngRef.current));
          break;
        case 'ArrowUp':
          event.preventDefault();
          getSharedArcadeAudio().sfx.playRotate();
          setArrowTarget((current) => rotate(current, 1));
          break;
        case ' ':
        case 'Spacebar':
        case 'Enter':
          if (event.key === 'Enter' && !isLocal2P) break;
          event.preventDefault();
          getSharedArcadeAudio().sfx.playHardDrop();
          setArrowTarget((current) => hardDrop(current, rngRef.current));
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInviting, isLocal2P, isNetworkPaused, isOnline2P, isReadyCheck, onExit, paused]);

  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  const boardGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastStepX: number;
    moved: boolean;
  } | null>(null);

  const stopTouchRepeat = useCallback(() => {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTouchRepeat(), [stopTouchRepeat]);

  const startTouchRepeat = useCallback(
    (action: () => void) => {
      if (paused || matchEnded || countdownRef.current > 0) return;
      stopTouchRepeat();
      action();
      repeatTimeoutRef.current = window.setTimeout(() => {
        repeatIntervalRef.current = window.setInterval(action, 60);
      }, 160);
    },
    [matchEnded, paused, stopTouchRepeat],
  );

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (paused || matchEnded || countdown > 0) return;
    boardGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastStepX: event.clientX,
      moved: false,
    };
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = boardGestureRef.current;
    if (!g || g.pointerId !== event.pointerId || paused || matchEnded || countdown > 0) return;
    const stepPx = 22;
    const dx = event.clientX - g.lastStepX;
    if (Math.abs(dx) >= stepPx) {
      const steps = Math.trunc(dx / stepPx);
      g.lastStepX += steps * stepPx;
      g.moved = true;
      setGame((current) => {
        let next = current;
        const count = Math.min(10, Math.abs(steps));
        for (let i = 0; i < count; i += 1) {
          next = steps > 0 ? moveRight(next) : moveLeft(next);
        }
        return next;
      });
    }
  };

  const onBoardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = boardGestureRef.current;
    if (!g || g.pointerId !== event.pointerId) return;
    boardGestureRef.current = null;
    if (paused || matchEnded || countdown > 0) return;
    const totalDx = event.clientX - g.startX;
    const totalDy = event.clientY - g.startY;
    if (totalDy >= 44 && Math.abs(totalDy) > Math.abs(totalDx) * 1.3) {
      getSharedArcadeAudio().sfx.playHardDrop();
      setGame((current) => hardDrop(current, rngRef.current));
    } else if (!g.moved && Math.hypot(totalDx, totalDy) < 12) {
      getSharedArcadeAudio().sfx.playRotate();
      setGame((current) => rotate(current, 1));
    }
  };

  const board = useMemo(() => displayBoard(game), [game]);
  const guide1 = useMemo(() => landingGuide(game), [game]);
  const tickSet1 = useMemo(
    () => new Set(guide1.floorTicks.map((t) => `${t.x},${t.y}`)),
    [guide1.floorTicks],
  );
  const pendingHazard1 = pendingHazardCount(game);

  const board2 = useMemo(() => displayBoard(game2), [game2]);
  const guide2 = useMemo(() => landingGuide(game2), [game2]);
  const tickSet2 = useMemo(
    () => new Set(guide2.floorTicks.map((t) => `${t.x},${t.y}`)),
    [guide2.floorTicks],
  );
  const pendingHazard2 = pendingHazardCount(game2);

  const startLocalRound = useCallback(
    (mode: '1p' | '2p', resetWins = false) => {
      if (isOnline2P) void getSharedNetplay().leaveRoom();
      if (isInviting) void getSharedNetplay().cancelInvite();
      rngRef.current = Math.random;
      prevLinesRef.current = 0;
      prevLines2Ref.current = 0;
      prevStatusRef.current = 'playing';
      prevStatus2Ref.current = 'playing';
      prevLockIdRef.current = 0;
      prevLockId2Ref.current = 0;
      setLocalMode(mode);
      setGame(createGame(rngRef.current));
      setGame2(createGame(rngRef.current));
      setRoundOutcome('playing');
      if (resetWins) {
        setWins([0, 0]);
      }
      setSharedGamePaused(false);
      triggerFreshCountdown();
      if (getSharedMusicOn()) {
        getSharedArcadeAudio().ensureContext();
      }
      getSharedArcadeAudio().startNewGameTrack();
    },
    [isInviting, isOnline2P, triggerFreshCountdown],
  );

  const handleNewOrRematch = () => {
    if (isOnline2P) {
      const nextSeed = ((Date.now() & 0x7fffffff) ^ 0x3c6ef372) >>> 0 || 2026;
      startOnlineRoundWithSeed(nextSeed, false);
      void getSharedNetplay().sendRoomEvent('prism_rematch', { seed: nextSeed });
    } else {
      startLocalRound(localMode, false);
    }
  };

  const canSelectOnline2P = netplay.onlineCount > 1 || isOnline2P || isInviting;

  return (
    <section
      className="stack-stage"
      data-mode={isSymmetric2P ? '2p' : '1p'}
      aria-label="Prism Stack game"
      ref={gameSectionRef}
    >
      <PixelBackdrop art={BACKGROUNDS[backgroundIndex]} />
      <header className="stack-header">
        <div className="row">
          <h2 className="stack-title">Prism Stack</h2>
          {isOnline2P && activePrismRoom ? (
            <span className="sb-tally" data-testid="prism-2p-tally" aria-label="Online 2P round wins">
              YOU {wins[0]} – {wins[1]} {activePrismRoom.opponent.name}
            </span>
          ) : isLocal2P ? (
            <span className="sb-tally" data-testid="prism-2p-tally" aria-label="Local 2P round wins">
              P1 {wins[0]} – {wins[1]} P2
            </span>
          ) : null}
          {BACKGROUNDS.length > 1 ? (
            <span className="stack-scene sr-only" aria-live="polite">
              Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {BACKGROUNDS[backgroundIndex].title}
              {musicOn && nowPlaying ? ` · Music: ${nowPlaying}` : ''}
            </span>
          ) : null}
        </div>
      </header>

      <div className={isSymmetric2P ? 'stack-body is-symmetric-2p' : 'stack-body'}>
        <div className="stack-player-lane" data-player="1">
          <div className="stack-lane-bar">
            <div className="sb-player-id">
              <span
                className="sb-slot-badge sb-slot-1"
                style={{ background: 'var(--prism-3)', color: 'var(--stage-well)' }}
                aria-hidden="true"
              >
                P1
              </span>
              <span className="sb-player-title">
                {isOnline2P ? netplay.clientName : isLocal2P ? 'WASD + F' : '9×18 Matrix'}
              </span>
            </div>
            <InlineNextPrismPill type={game.next} testId="prism-p1-next" />
          </div>

          <div className="stack-stage-row">
            <div
              className={game.status === 'over' ? 'stack-board is-dissolved' : 'stack-board'}
              data-testid="prism-p1-board"
              role="img"
              aria-label={`Prism Stack board, ${BOARD_WIDTH} by ${BOARD_HEIGHT}`}
              onPointerDown={onBoardPointerDown}
              onPointerMove={onBoardPointerMove}
              onPointerUp={onBoardPointerUp}
              onPointerCancel={() => {
                boardGestureRef.current = null;
              }}
            >
              {board.map((row, y) =>
                row.map((cell, x) => {
                  const key = `${x},${y}`;
                  const isGuide = cell === null && guide1.columns.has(x);
                  const isTick = cell === null && tickSet1.has(key);
                  return (
                    <div
                      key={key}
                      className={cellClass(cell, isGuide, isTick)}
                      data-guide-col={isGuide ? 'true' : undefined}
                      data-landing-tick={isTick ? 'true' : undefined}
                    />
                  );
                }),
              )}
              {!paused && !isReadyCheck && !isInviting && countdown > 0 ? (
                <div
                  className="arcade-countdown-backdrop"
                  data-testid="arcade-countdown"
                  data-lang={countdownLang.id}
                  data-phase={countdown >= 2 ? 'ready' : 'go'}
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="arcade-countdown-flags"
                    data-testid="arcade-countdown-flags"
                    aria-hidden="true"
                  >
                    {countdownLang.flags}
                  </span>
                  <span className="arcade-countdown-digit">
                    {countdown >= 2 ? countdownLang.readyText : countdownLang.goText}
                  </span>
                </div>
              ) : null}
            </div>

            {(isOnline2P || isLocal2P || pendingHazard1 > 0) ? (
              <div
                className="stack-hazard-meter"
                data-testid="prism-hazard-meter"
                role="status"
                aria-label={`${pendingHazard1} incoming hazard bars`}
                title={`${pendingHazard1} incoming hazard bars`}
              >
                {Array.from({ length: BOARD_HEIGHT }, (_, idx) => {
                  const rowFromBottom = BOARD_HEIGHT - 1 - idx;
                  const active = rowFromBottom < pendingHazard1;
                  return (
                    <div
                      key={idx}
                      className={
                        active ? 'stack-hazard-segment is-active' : 'stack-hazard-segment'
                      }
                    />
                  );
                })}
              </div>
            ) : null}

            <aside className="stack-side">
              <div className="stack-stat">
                <span className="stack-label">Score</span>
                <span className="stack-value" data-testid="prism-p1-score" aria-live="polite">
                  {game.score}
                </span>
              </div>
              <div className="stack-stat">
                <span className="stack-label">Lines</span>
                <span className="stack-value" data-testid="prism-p1-lines">{game.lines}</span>
              </div>
              <div className="stack-stat">
                <span className="stack-label">Level</span>
                <span className="stack-value" data-testid="prism-p1-level">{game.level}</span>
              </div>
            </aside>
          </div>
        </div>

        {isOnline2P && activePrismRoom ? (
          <OnlineOpponentPrismLane
            opponentName={activePrismRoom.opponent.name}
            snapshot={opponentSnapshot}
            roundOutcome={roundOutcome}
          />
        ) : isLocal2P ? (
          <div className="stack-player-lane" data-player="2">
            <div className="stack-lane-bar">
              <div className="sb-player-id">
                <span
                  className="sb-slot-badge sb-slot-2"
                  style={{ background: 'var(--prism-7)', color: 'var(--stage-well)' }}
                  aria-hidden="true"
                >
                  P2
                </span>
                <span className="sb-player-title">Arrows + Space</span>
              </div>
              <InlineNextPrismPill type={game2.next} testId="prism-p2-next" />
            </div>

            <div className="stack-stage-row">
              <div
                className={game2.status === 'over' ? 'stack-board is-dissolved' : 'stack-board'}
                data-testid="prism-p2-board"
                role="img"
                aria-label={`Player 2 Prism Stack board, ${BOARD_WIDTH} by ${BOARD_HEIGHT}`}
              >
                {board2.map((row, y) =>
                  row.map((cell, x) => {
                    const key = `${x},${y}`;
                    const isGuide = cell === null && guide2.columns.has(x);
                    const isTick = cell === null && tickSet2.has(key);
                    return (
                      <div
                        key={key}
                        className={cellClass(cell, isGuide, isTick)}
                        data-guide-col={isGuide ? 'true' : undefined}
                        data-landing-tick={isTick ? 'true' : undefined}
                      />
                    );
                  }),
                )}
              </div>

              <div
                className="stack-hazard-meter"
                data-testid="prism-p2-hazard-meter"
                role="status"
                aria-label={`Player 2 ${pendingHazard2} incoming hazard bars`}
                title={`Player 2 ${pendingHazard2} incoming hazard bars`}
              >
                {Array.from({ length: BOARD_HEIGHT }, (_, idx) => {
                  const rowFromBottom = BOARD_HEIGHT - 1 - idx;
                  const active = rowFromBottom < pendingHazard2;
                  return (
                    <div
                      key={idx}
                      className={
                        active ? 'stack-hazard-segment is-active' : 'stack-hazard-segment'
                      }
                    />
                  );
                })}
              </div>

              <aside className="stack-side">
                <div className="stack-stat">
                  <span className="stack-label">Score</span>
                  <span className="stack-value" data-testid="prism-p2-score" aria-live="polite">
                    {game2.score}
                  </span>
                </div>
                <div className="stack-stat">
                  <span className="stack-label">Lines</span>
                  <span className="stack-value" data-testid="prism-p2-lines">{game2.lines}</span>
                </div>
                <div className="stack-stat">
                  <span className="stack-label">Level</span>
                  <span className="stack-value" data-testid="prism-p2-level">{game2.level}</span>
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </div>

      {isInviting && !isOnline2P ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="status"
            aria-live="polite"
            data-testid="prism-invite-waiting"
          >
            <span className="game-pause-kicker">2P Online Matchmaking</span>
            <h3 className="game-pause-title">Waiting for player…</h3>
            <p className="game-pause-copy" data-testid="netplay-invite-countdown">
              Invite expires in <strong>{inviteSecondsLeft}s</strong>
            </p>
            <div className="game-pause-actions">
              <button
                type="button"
                data-testid="prism-cancel-invite-btn"
                onClick={() => void getSharedNetplay().cancelInvite()}
              >
                Cancel invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOnline2P && isReadyCheck && activePrismRoom ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="dialog"
            aria-modal="true"
            aria-label="2P Online Ready Check"
            data-testid="netplay-ready-modal"
          >
            <span className="game-pause-kicker">2P Online Prism Stack</span>
            <h3 className="game-pause-title">Players Ready?</h3>
            <div className="netplay-ready-roster">
              <div className="netplay-ready-row">
                <span>YOU ({netplay.clientName})</span>
                <span className={myReady ? 'netplay-ready-pill is-ready' : 'netplay-ready-pill'}>
                  {myReady ? 'READY ✓' : 'Waiting…'}
                </span>
              </div>
              <div className="netplay-ready-row">
                <span>{activePrismRoom.opponent.name}</span>
                <span className={oppReady ? 'netplay-ready-pill is-ready' : 'netplay-ready-pill'}>
                  {oppReady ? 'READY ✓' : 'Waiting…'}
                </span>
              </div>
            </div>
            <div className="game-pause-actions">
              <button
                type="button"
                className="primary"
                data-testid="netplay-ready-btn"
                disabled={myReady}
                onClick={() => void getSharedNetplay().setReady()}
              >
                {myReady ? 'Waiting for opponent…' : 'Ready!'}
              </button>
              <button
                type="button"
                onClick={() => void getSharedNetplay().leaveRoom()}
              >
                Leave match
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isNetworkPaused && activePrismRoom ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="alert"
            aria-live="assertive"
            data-testid="netplay-sync-modal"
          >
            <span className="game-pause-kicker">Network Sync Interrupted</span>
            <h3 className="game-pause-title">Connection Paused</h3>
            <p className="game-pause-copy">
              Waiting for{' '}
              <strong>
                {activePrismRoom.laggingPlayerNames?.length
                  ? activePrismRoom.laggingPlayerNames.join(', ')
                  : 'both players'}
              </strong>{' '}
              to re-sync…
            </p>
            <p className="game-pause-copy" data-testid="netplay-sync-countdown">
              Exiting in <strong>{syncSecondsLeft}s</strong>
            </p>
            <div className="game-pause-actions">
              <button
                type="button"
                data-testid="netplay-sync-exit"
                onClick={() => {
                  void getSharedNetplay().leaveRoom();
                  onExit();
                }}
              >
                Exit match now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paused ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Game paused"
            data-testid="game-pause-menu"
            ref={pauseMenuRef}
          >
            <span className="game-pause-kicker">Prism Stack</span>
            <h3 className="game-pause-title">Paused</h3>
            <div className="game-pause-section">
              <span className="stack-label">Game Mode</span>
              <div className="filter-group" role="group" aria-label="Prism Stack player mode">
                <button
                  type="button"
                  data-testid="prism-1p-btn"
                  aria-pressed={!isLocal2P && !isOnline2P && !isInviting}
                  onClick={() => startLocalRound('1p', true)}
                >
                  1 Player
                </button>
                <button
                  type="button"
                  data-testid="prism-2p-local-btn"
                  aria-pressed={isLocal2P}
                  onClick={() => startLocalRound('2p', true)}
                >
                  2 Player
                </button>
                <button
                  type="button"
                  data-testid="prism-2p-online-btn"
                  aria-pressed={isOnline2P || isInviting}
                  disabled={!canSelectOnline2P}
                  title={
                    canSelectOnline2P
                      ? 'Challenge online players to 2P Versus Prism Stack'
                      : 'Requires at least 2 players online'
                  }
                  onClick={() => {
                    if (isOnline2P) {
                      void getSharedNetplay().leaveRoom();
                    } else if (isInviting) {
                      void getSharedNetplay().cancelInvite();
                    } else if (canSelectOnline2P) {
                      setLocalMode('1p');
                      setSharedGamePaused(false);
                      void getSharedNetplay().sendInvite('prism-stack');
                    }
                  }}
                >
                  {isOnline2P
                    ? `2P online (${activePrismRoom.opponent.name})`
                    : isInviting
                      ? `Waiting 2P… (${inviteSecondsLeft}s)`
                      : '2P online'}
                </button>
              </div>
            </div>
            <div className="game-pause-section">
              <span className="stack-label">Audio</span>
              <div className="filter-group" role="group" aria-label="Audio controls">
                <button
                  type="button"
                  data-testid="pause-menu-sfx-btn"
                  aria-pressed={sfxOn}
                  onClick={() => {
                    setSharedSfxOn(!sfxOn);
                  }}
                >
                  {sfxOn ? 'Sound: On' : 'Sound: Off'}
                </button>
                <button
                  type="button"
                  data-testid="pause-menu-music-btn"
                  aria-pressed={musicOn}
                  onClick={() => {
                    getSharedArcadeAudio().setPlaylist(PRISM_STACK_PLAYLIST);
                    setSharedMusicOn(!musicOn, true);
                  }}
                >
                  {musicOn ? 'Music: On' : 'Music: Off'}
                </button>
              </div>
            </div>
            <div className="game-pause-actions">
              <button
                type="button"
                className="primary"
                data-testid="pause-menu-resume"
                aria-label="Continue game"
                onClick={() => {
                  if (getSharedMusicOn()) {
                    getSharedArcadeAudio().ensureContext();
                  }
                  if (countdown > 0) {
                    triggerFreshCountdown();
                  }
                  setSharedGamePaused(false);
                }}
              >
                Continue
              </button>
              <button
                type="button"
                data-testid="pause-menu-restart"
                aria-label="Restart game"
                onClick={() => {
                  handleNewOrRematch();
                  setSharedGamePaused(false);
                }}
              >
                {isOnline2P && matchEnded ? 'Next round' : 'New game'}
              </button>
              <button
                type="button"
                data-testid="pause-menu-exit"
                aria-label="Close Prism Stack"
                onClick={onExit}
              >
                Exit to menu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {touchAvailable ? (
        <div
          className="stack-touch-bar"
          role="group"
          aria-label="Prism Stack touch controls"
          data-testid="prism-touch-controls"
        >
          <div className="touch-cluster touch-cluster-left">
            <button
              type="button"
              className="sb-touch-btn sb-touch-rocker"
              data-testid="prism-touch-left"
              aria-label="Move left"
              disabled={paused || matchEnded || isReadyCheck || countdown > 0}
              onPointerDown={(event) => {
                event.preventDefault();
                startTouchRepeat(() => setGame((current) => moveLeft(current)));
              }}
              onPointerUp={stopTouchRepeat}
              onPointerCancel={stopTouchRepeat}
              onPointerLeave={stopTouchRepeat}
              onClick={(event) => {
                if (event.detail === 0) {
                  setGame((current) => moveLeft(current));
                }
              }}
            >
              ◀
            </button>
            <button
              type="button"
              className="sb-touch-btn sb-touch-rocker"
              data-testid="prism-touch-soft"
              aria-label="Soft drop"
              disabled={paused || matchEnded || isReadyCheck || countdown > 0}
              onPointerDown={(event) => {
                event.preventDefault();
                startTouchRepeat(() => setGame((current) => softDrop(current, rngRef.current)));
              }}
              onPointerUp={stopTouchRepeat}
              onPointerCancel={stopTouchRepeat}
              onPointerLeave={stopTouchRepeat}
              onClick={(event) => {
                if (event.detail === 0) {
                  setGame((current) => softDrop(current, rngRef.current));
                }
              }}
            >
              ▼
            </button>
            <button
              type="button"
              className="sb-touch-btn sb-touch-rocker"
              data-testid="prism-touch-right"
              aria-label="Move right"
              disabled={paused || matchEnded || isReadyCheck || countdown > 0}
              onPointerDown={(event) => {
                event.preventDefault();
                startTouchRepeat(() => setGame((current) => moveRight(current)));
              }}
              onPointerUp={stopTouchRepeat}
              onPointerCancel={stopTouchRepeat}
              onPointerLeave={stopTouchRepeat}
              onClick={(event) => {
                if (event.detail === 0) {
                  setGame((current) => moveRight(current));
                }
              }}
            >
              ▶
            </button>
          </div>
          <div className="touch-cluster touch-cluster-right">
            <button
              type="button"
              className="sb-touch-btn sb-touch-rotate"
              data-testid="prism-touch-rotate"
              aria-label="Rotate prism"
              disabled={paused || matchEnded || isReadyCheck || countdown > 0}
              onPointerDown={(event) => {
                event.preventDefault();
                getSharedArcadeAudio().sfx.playRotate();
                setGame((current) => rotate(current, 1));
              }}
              onClick={(event) => {
                if (event.detail === 0) {
                  getSharedArcadeAudio().sfx.playRotate();
                  setGame((current) => rotate(current, 1));
                }
              }}
            >
              ↻
            </button>
            <button
              type="button"
              className="primary sb-touch-btn sb-touch-fire"
              data-testid="prism-touch-drop"
              aria-label="Hard drop"
              disabled={paused || matchEnded || isReadyCheck || countdown > 0}
              onPointerDown={(event) => {
                event.preventDefault();
                getSharedArcadeAudio().sfx.playHardDrop();
                setGame((current) => hardDrop(current, rngRef.current));
              }}
              onClick={(event) => {
                if (event.detail === 0) {
                  getSharedArcadeAudio().sfx.playHardDrop();
                  setGame((current) => hardDrop(current, rngRef.current));
                }
              }}
            >
              ⤓
            </button>
          </div>
        </div>
      ) : null}

      {!paused && isOnline2P && roundOutcome === 'won' && activePrismRoom ? (
        <p className="stack-over" role="status" data-testid="prism-online-banner">
          YOU WIN! {activePrismRoom.opponent.name} topped out ({wins[0]}–{wins[1]}).{' '}
          <button type="button" className="primary" onClick={handleNewOrRematch}>
            Next round
          </button>
        </p>
      ) : !paused && isOnline2P && roundOutcome === 'lost' && activePrismRoom ? (
        <p className="stack-over" role="status" data-testid="prism-online-banner">
          KO! {activePrismRoom.opponent.name} wins the round ({wins[0]}–{wins[1]}).{' '}
          <button type="button" className="primary" onClick={handleNewOrRematch}>
            Next round
          </button>
        </p>
      ) : !paused && isLocal2P && (roundOutcome !== 'playing' || game.status === 'over' || game2.status === 'over') ? (
        <p className="stack-over" role="status" data-testid="prism-local-2p-banner">
          {roundOutcome === 'won' || game2.status === 'over'
            ? `P1 WINS! (${wins[0]}–${wins[1]}) · Score ${game.score} vs ${game2.score}. `
            : `P2 WINS! (${wins[0]}–${wins[1]}) · Score ${game.score} vs ${game2.score}. `}
          <button type="button" className="primary" onClick={handleNewOrRematch}>
            Next round
          </button>
        </p>
      ) : !paused && game.status === 'over' ? (
        <p className="stack-over" role="status">
          Game over — score {game.score}.{' '}
          <button type="button" className="primary" onClick={handleNewOrRematch}>
            New game
          </button>
        </p>
      ) : null}
    </section>
  );
}
