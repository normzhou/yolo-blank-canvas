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
  subscribeSharedAudio,
} from '../audio/tetrisMusic';
import {
  getSharedGamePaused,
  setSharedGamePaused,
  subscribeSharedGamePause,
  toggleSharedGamePaused,
} from '../gamePause';
import {
  getSharedNetplay,
  INVITE_TIMEOUT_MS,
  type NetplayState,
  type TetrisRadarSnapshot,
} from '../netplay';
import {
  pickCountdownLanguage,
  type CountdownLanguage,
} from '../../shared/countdownLanguages';
import { TETRIS_PLAYLIST } from '../../shared/tetrisMusic';
import {
  BACKGROUNDS,
  nextBackgroundIndex,
  type Backdrop,
} from '../../shared/tetrisBackgrounds';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createEmptyBoard,
  createGame,
  displayBoard,
  dropInterval,
  ghostPiece,
  hardDrop,
  moveLeft,
  moveRight,
  pendingGarbageCount,
  queueTetrisGarbage,
  rotate,
  rotationCells,
  softDrop,
  tick,
  type Cell,
  type TetrisState,
  type Tetromino,
} from '../../shared/tetris';

/** `prefers-reduced-motion: reduce`, where the crossfade is cut, not animated. */
function motionReduced(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const COUNTDOWN_BEAT_MS =
  typeof navigator !== 'undefined' && navigator.webdriver ? 180 : 2000;

function detectTouchAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < 768 || (window.innerWidth < 900 && window.innerHeight < 440)) return true;
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

function createInitialTetrisRadar(): TetrisRadarSnapshot {
  return {
    board: createEmptyBoard(),
    settledBoard: createEmptyBoard(),
    activePiece: null,
    lastEvent: null,
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    pendingGarbage: 0,
  };
}

function buildTetrisRadarSnapshot(cur: TetrisState): TetrisRadarSnapshot {
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
    lastEvent: cur.lastLockEvent
      ? {
          id: cur.lastLockEvent.id,
          clearedLines: cur.lastLockEvent.cleared,
          sentGarbage: cur.lastLockEvent.sentGarbage,
          risenGarbage: cur.lastLockEvent.risenGarbage,
        }
      : null,
    score: cur.score,
    lines: cur.lines,
    level: cur.level,
    status: cur.status,
    pendingGarbage: pendingGarbageCount(cur),
  };
}

const CELL_CLASS: Record<Tetromino | 'G', string> = {
  I: 'tetromino-i',
  J: 'tetromino-j',
  L: 'tetromino-l',
  O: 'tetromino-o',
  S: 'tetromino-s',
  T: 'tetromino-t',
  Z: 'tetromino-z',
  G: 'tetromino-g',
};

function cellClass(cell: Cell): string {
  return cell ? `tetris-cell ${CELL_CLASS[cell]}` : 'tetris-cell';
}

function ArtLayer({ art, past, onFaded }: { art: Backdrop; past: boolean; onFaded: () => void }) {
  return (
    <img
      className={`tetris-art-layer ${past ? 'is-past' : 'is-current'}`}
      src={art.src}
      alt=""
      aria-hidden="true"
      onAnimationEnd={
        past
          ? (event) => {
              if (event.animationName === 'tetris-art-out') onFaded();
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
    <div className="tetris-art" aria-hidden="true">
      {layers.map((layer, index) => (
        <ArtLayer key={layer.key} art={layer.art} past={index < layers.length - 1} onFaded={dropPastLayers} />
      ))}
    </div>
  );
}

const NextPreview = memo(function NextPreview({ type }: { type: Tetromino }) {
  const cells = rotationCells(type, 0);
  const filled = new Set(cells.map(([x, y]) => `${x},${y}`));
  return (
    <div className="tetris-next" aria-label={`Next piece ${type}`}>
      {Array.from({ length: 4 }, (_, y) =>
        Array.from({ length: 4 }, (_, x) => (
          <div key={`${x},${y}`} className={filled.has(`${x},${y}`) ? `tetris-cell ${CELL_CLASS[type]}` : 'tetris-cell'} />
        )),
      )}
    </div>
  );
});

const OpponentTetrisRadar = memo(function OpponentTetrisRadar({
  opponentName,
  radar,
  roundOutcome,
}: {
  opponentName: string;
  radar: TetrisRadarSnapshot;
  roundOutcome: 'playing' | 'won' | 'lost';
}) {
  const statusLabel =
    roundOutcome === 'won' || radar.status === 'over'
      ? 'KO'
      : roundOutcome === 'lost'
        ? 'WIN'
        : 'LIVE';

  const prevLinesRef = useRef<number>(radar.lines);
  const prevGarbageCellsRef = useRef<number>(0);
  const prevEventIdRef = useRef<number>(0);
  const [animMode, setAnimMode] = useState<'none' | 'clearing' | 'rising'>('none');

  useEffect(() => {
    let garbageCells = 0;
    for (const row of radar.board) {
      for (const cell of row) {
        if (cell === 'G') garbageCells += 1;
      }
    }
    const prevGarbage = prevGarbageCellsRef.current;
    prevGarbageCellsRef.current = garbageCells;

    const prevLines = prevLinesRef.current;
    prevLinesRef.current = radar.lines;

    const ev = radar.lastEvent;
    let nextAnim: 'none' | 'clearing' | 'rising' = 'none';
    if (ev && ev.id !== prevEventIdRef.current) {
      prevEventIdRef.current = ev.id;
      if (ev.risenGarbage > 0) nextAnim = 'rising';
      else if (ev.clearedLines > 0) nextAnim = 'clearing';
    } else if (garbageCells > prevGarbage) {
      nextAnim = 'rising';
    } else if (radar.lines > prevLines) {
      nextAnim = 'clearing';
    }

    if (nextAnim !== 'none') {
      setAnimMode(nextAnim);
      const id = window.setTimeout(() => setAnimMode('none'), 450);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [radar.board, radar.lines, radar.lastEvent]);

  const activePieceCells = useMemo(() => {
    if (!radar.activePiece) return null;
    const coords = new Set<string>();
    for (const [dx, dy] of rotationCells(radar.activePiece.type, radar.activePiece.rotation)) {
      coords.add(`${dx},${dy}`);
    }
    return coords;
  }, [radar.activePiece]);

  const gridClass =
    animMode === 'clearing'
      ? 'tetris-radar-grid is-clearing'
      : animMode === 'rising'
        ? 'tetris-radar-grid is-rising-garbage'
        : 'tetris-radar-grid';

  return (
    <div
      className="netplay-radar-card"
      data-testid="tetris-opponent-radar"
      aria-label={`Opponent ${opponentName} mini radar`}
    >
      <div className="netplay-radar-header">
        <span className="netplay-radar-name" title={opponentName}>
          VS {opponentName}
        </span>
        <span
          className={
            statusLabel === 'KO'
              ? 'netplay-radar-badge is-ko'
              : 'netplay-radar-badge'
          }
          data-testid="tetris-opponent-status"
        >
          {statusLabel}
        </span>
      </div>
      <div
        className={gridClass}
        role="img"
        aria-label={`${opponentName} board radar, score ${radar.score}, lines ${radar.lines}`}
      >
        {radar.board.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x},${y}`}
              className={cell ? `tetris-radar-cell ${CELL_CLASS[cell]}` : 'tetris-radar-cell'}
            />
          )),
        )}
        {radar.activePiece && activePieceCells ? (
          <div
            className="tetris-radar-active-piece"
            data-testid="tetris-opponent-active-piece"
            aria-hidden="true"
            style={{
              transform: `translate(${radar.activePiece.x * 7}px, ${radar.activePiece.y * 6}px)`,
            }}
          >
            {Array.from({ length: 4 }, (_, py) =>
              Array.from({ length: 4 }, (_, px) => {
                const filled = activePieceCells.has(`${px},${py}`);
                return (
                  <div
                    key={`${px},${py}`}
                    className={
                      filled
                        ? `tetris-radar-active-cell ${CELL_CLASS[radar.activePiece!.type]}`
                        : 'tetris-radar-active-cell'
                    }
                  />
                );
              }),
            )}
          </div>
        ) : null}
      </div>
      <div className="netplay-radar-stats">
        <span data-testid="tetris-opponent-score">{radar.score} pts</span>
        <span data-testid="tetris-opponent-lines">{radar.lines}L</span>
      </div>
    </div>
  );
});

export function TetrisView({ onExit }: { onExit: () => void }) {
  const customRngRef = useRef<(() => number) | null>(null);
  const rngRef = {
    get current(): () => number {
      return customRngRef.current ?? Math.random;
    },
    set current(fn: (() => number) | null) {
      customRngRef.current = fn === Math.random ? null : fn;
    },
  };
  const [game, setGame] = useState<TetrisState>(() => createGame());
  const [paused, setPaused] = useState<boolean>(() => {
    if (!getSharedNetplay().getState().activeRoom) {
      setSharedGamePaused(true);
      return true;
    }
    return getSharedGamePaused();
  });
  const [musicOn, setMusicOn] = useState<boolean>(() => getSharedMusicOn());
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<string | null>(
    () => getSharedArcadeAudio().getCurrentTrack()?.title ?? null,
  );
  const [netplay, setNetplay] = useState<NetplayState>(() => getSharedNetplay().getState());
  const [opponentRadar, setOpponentRadar] = useState<TetrisRadarSnapshot>(() =>
    createInitialTetrisRadar(),
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

  useEffect(() => {
    if (!getSharedNetplay().getState().activeRoom) {
      setSharedGamePaused(true);
    }
    const unsub = subscribeSharedGamePause((nextPaused) => {
      setPaused(nextPaused);
    });
    return () => {
      unsub();
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
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;
  const roundOutcomeRef = useRef(roundOutcome);
  roundOutcomeRef.current = roundOutcome;
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomStartedRef = useRef<string | null>(null);
  const tetrisCountRef = useRef(game.tetrisCount);
  const prevLinesRef = useRef(game.lines);
  const prevStatusRef = useRef(game.status);
  const prevLockIdRef = useRef<number>(0);
  const gameSectionRef = useRef<HTMLElement>(null);

  const activeTetrisRoom =
    netplay.activeRoom && netplay.activeRoom.gameId === 'tetris' ? netplay.activeRoom : null;
  const isOnline2P = activeTetrisRoom !== null;
  const isReadyCheck = activeTetrisRoom?.status === 'ready_check';
  const isNetworkPaused = Boolean(
    isOnline2P &&
      activeTetrisRoom?.status === 'playing' &&
      activeTetrisRoom?.syncStatus === 'paused',
  );
  const syncSecondsLeft = Math.max(
    0,
    Math.ceil((activeTetrisRoom?.syncRemainingMs ?? 15_000) / 1000),
  );
  const isInviting = netplay.myPendingInvite?.gameId === 'tetris';
  const myRoomPlayer = activeTetrisRoom?.players.find((p) => p.id === netplay.clientId);
  const myReady = Boolean(myRoomPlayer?.ready);
  const oppReady = Boolean(activeTetrisRoom?.opponent?.ready);

  useEffect(() => {
    if (activeTetrisRoom?.syncStatus === 'timeout') {
      void getSharedNetplay().leaveRoom();
      onExit();
    }
  }, [activeTetrisRoom?.syncStatus, onExit]);

  // Continuous 2P keep-alive and live board radar push (#250, #254, #256: 500ms / 2Hz deduplicated).
  const lastRadarDigestRef = useRef<string>('');
  useEffect(() => {
    if (!isOnline2P || isReadyCheck || isNetworkPaused || roundOutcome !== 'playing') return;
    const pushRadar = () => {
      const cur = gameRef.current;
      const snap = buildTetrisRadarSnapshot(cur);
      const digest = JSON.stringify(snap);
      if (digest === lastRadarDigestRef.current) return;
      lastRadarDigestRef.current = digest;
      void getSharedNetplay().sendRoomEvent('tetris_state', snap);
    };
    pushRadar();
    const id = window.setInterval(pushRadar, 500);
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
      setOpponentRadar(createInitialTetrisRadar());
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

  // 20-second invite countdown timer (#248).
  useEffect(() => {
    const invite = netplay.myPendingInvite;
    if (!invite || invite.gameId !== 'tetris') {
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

  // "Ready…" -> "Go!" speaker-weighted 10-language start countdown with spoken voice audio (#262, #268).
  useEffect(() => {
    if (countdown <= 0 || paused || isReadyCheck || isInviting || isNetworkPaused) return;
    const phase = countdown >= 2 ? 'ready' : 'go';
    getSharedArcadeAudio().playCountdownPhrase(countdownLang, phase);
    const id = window.setTimeout(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, COUNTDOWN_BEAT_MS);
    return () => window.clearTimeout(id);
  }, [countdown, countdownKey, countdownLang, paused, isReadyCheck, isInviting, isNetworkPaused]);

  useEffect(() => {
    const client = getSharedNetplay();
    const unsubState = client.subscribe((nextState) => {
      setNetplay(nextState);
      const room =
        nextState.activeRoom && nextState.activeRoom.gameId === 'tetris'
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
        if (payload && payload.gameId === 'tetris') {
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

      if (event.kind === 'tetris_attack') {
        const payload = event.payload as { lines?: number; holeColumn?: number } | null;
        const lines = Number(payload?.lines ?? 0);
        if (lines > 0) {
          setGame((current) => queueTetrisGarbage(current, lines, payload?.holeColumn));
        }
        return;
      }

      if (event.kind === 'tetris_state') {
        const snapshot = event.payload as TetrisRadarSnapshot | null;
        if (snapshot && Array.isArray(snapshot.board)) {
          setOpponentRadar(snapshot);
        }
        return;
      }

      if (event.kind === 'tetris_ko') {
        setOpponentRadar((prev) => ({ ...prev, status: 'over' }));
        if (roundOutcomeRef.current === 'playing') {
          setRoundOutcome('won');
          setWins(([myW, oppW]) => [myW + 1, oppW]);
          getSharedArcadeAudio().sfx.playRoundEnd(true);
        }
        return;
      }

      if (event.kind === 'tetris_rematch') {
        const payload = event.payload as { seed?: number } | null;
        startOnlineRoundWithSeed(payload?.seed ?? Date.now(), false);
        return;
      }

      if (event.kind === 'player_left') {
        setOpponentRadar((prev) => ({ ...prev, status: 'over' }));
        if (roundOutcomeRef.current === 'playing') {
          setRoundOutcome('won');
        }
      }
    });

    return () => {
      unsubState();
      unsubEvents();
    };
  }, [startOnlineRoundWithSeed]);

  useEffect(() => {
    const audio = getSharedArcadeAudio();
    audio.setPlaylist(TETRIS_PLAYLIST);
    setNowPlaying(audio.getCurrentTrack()?.title ?? null);
    return subscribeSharedAudio((nextOn, nextTitle) => {
      setMusicOn(nextOn);
      setNowPlaying(nextTitle);
    });
  }, []);

  // #217: Prevent browser viewport scroll or rubber-banding when dragging
  // anywhere on the full-screen game stage on iOS Safari / Chrome.
  useEffect(() => {
    const el = gameSectionRef.current;
    if (!el) return;
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  // Clearing four lines at once advances the backdrop to the next scene.
  useEffect(() => {
    if (game.tetrisCount > tetrisCountRef.current) {
      setBackgroundIndex((index) => nextBackgroundIndex(index));
    }
    tetrisCountRef.current = game.tetrisCount;
  }, [game.tetrisCount]);

  // #234, #236: Trigger real-time Tone.js-style SFX on line clears, garbage send/rise, and Game Over,
  // and relay 2P Versus garbage attacks and live radar snapshots to the opponent.
  useEffect(() => {
    if (game.lines > prevLinesRef.current) {
      const cleared = game.lines - prevLinesRef.current;
      getSharedArcadeAudio().sfx.playLineClear(cleared);
    }
    prevLinesRef.current = game.lines;
  }, [game.lines]);

  useEffect(() => {
    const lockEv = game.lastLockEvent;
    if (lockEv && lockEv.id !== prevLockIdRef.current) {
      prevLockIdRef.current = lockEv.id;
      const sfx = getSharedArcadeAudio().sfx;
      if (lockEv.sentGarbage > 0) {
        sfx.playGarbageSend(lockEv.sentGarbage);
        if (isOnline2P) {
          const holeColumn = Math.floor(rngRef.current() * BOARD_WIDTH);
          void getSharedNetplay().sendRoomEvent('tetris_attack', {
            lines: lockEv.sentGarbage,
            holeColumn,
          });
        }
      }
      if (lockEv.risenGarbage > 0) {
        sfx.playGarbageRise(lockEv.risenGarbage);
      }
      if (isOnline2P) {
        void getSharedNetplay().sendRoomEvent('tetris_state', buildTetrisRadarSnapshot(game));
      }
    }
  }, [game, isOnline2P]);

  useEffect(() => {
    if (game.status === 'over' && prevStatusRef.current === 'playing') {
      getSharedArcadeAudio().sfx.playGameOver();
      if (isOnline2P && roundOutcomeRef.current === 'playing') {
        setRoundOutcome('lost');
        setWins(([myW, oppW]) => [myW, oppW + 1]);
        void getSharedNetplay().sendRoomEvent('tetris_ko', { score: game.score, lines: game.lines });
      }
    }
    prevStatusRef.current = game.status;
  }, [game.lines, game.score, game.status, isOnline2P]);

  // Browser-driven test hooks: synthetic four-line clear and deterministic Versus garbage queue (#236).
  useEffect(() => {
    function forceFourLineClear() {
      getSharedArcadeAudio().sfx.playLineClear(4);
      setGame((current) => ({
        ...current,
        lines: current.lines + 4,
        score: current.score + 800 * current.level,
        tetrisCount: current.tetrisCount + 1,
        garbageSent: current.garbageSent + 4,
        lastLockEvent: {
          id: (current.lastLockEvent?.id ?? 0) + 1,
          cleared: 4,
          combo: 1,
          sentGarbage: 4,
          canceledGarbage: 0,
          risenGarbage: 0,
        },
      }));
    }
    function onQueueGarbage(event: Event) {
      const detail = (event as CustomEvent<{ lines?: number; holeColumn?: number }>).detail;
      const lines = detail?.lines ?? 2;
      const holeColumn = detail?.holeColumn ?? 4;
      setGame((current) => queueTetrisGarbage(current, lines, holeColumn));
    }
    window.addEventListener('yolo:tetris:four-line-clear', forceFourLineClear);
    window.addEventListener('yolo:tetris:queue-garbage', onQueueGarbage);
    return () => {
      window.removeEventListener('yolo:tetris:four-line-clear', forceFourLineClear);
      window.removeEventListener('yolo:tetris:queue-garbage', onQueueGarbage);
    };
  }, []);

  const matchEnded = game.status !== 'playing' || (isOnline2P && roundOutcome !== 'playing');

  // Drive playback from game state.
  useEffect(() => {
    getSharedArcadeAudio().setActive(musicOn && !matchEnded);
  }, [musicOn, matchEnded]);

  // Gravity. Restarts when the level (speed) changes and stops when not playing or during countdown/ready-check/network-pause.
  useEffect(() => {
    if (paused || matchEnded || isReadyCheck || isInviting || isNetworkPaused || countdown > 0) return;
    const id = window.setInterval(() => {
      setGame((current) => tick(current, rngRef.current));
    }, dropInterval(game.level));
    return () => window.clearInterval(id);
  }, [paused, game.level, matchEnded, isReadyCheck, isInviting, isNetworkPaused, countdown]);

  // Highlight Continue button when Pause Menu opens (#268).
  useEffect(() => {
    if (!paused || isReadyCheck || isInviting || isNetworkPaused) return;
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
  }, [paused, isReadyCheck, isInviting, isNetworkPaused]);

  // Keyboard controls: arrows move/rotate/soft-drop, space hard-drops, Escape toggles Pause Menu (#237, #268).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
        (gameRef.current.status !== 'playing' || (isOnline2P && roundOutcomeRef.current !== 'playing'))
      ) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
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
        (isOnline2P && roundOutcomeRef.current !== 'playing')
      ) {
        return;
      }
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          setGame((current) => moveLeft(current));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setGame((current) => moveRight(current));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setGame((current) => softDrop(current, rngRef.current));
          break;
        case 'ArrowUp':
          event.preventDefault();
          getSharedArcadeAudio().sfx.playRotate();
          setGame((current) => rotate(current, 1));
          break;
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          getSharedArcadeAudio().sfx.playHardDrop();
          setGame((current) => hardDrop(current, rngRef.current));
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInviting, isNetworkPaused, isOnline2P, isReadyCheck, onExit, paused]);

  // #212: Touch / pointer auto-repeat (DAS) for on-screen Tetris arcade buttons
  // and direct board gestures.
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
  const { ghost, ghostCoords } = useMemo(() => {
    const g = ghostPiece(game);
    const coords = new Set<string>();
    if (g) {
      for (const [dx, dy] of rotationCells(g.type, g.rotation)) {
        const gx = g.x + dx;
        const gy = g.y + dy;
        if (
          gy >= 0 &&
          gy < BOARD_HEIGHT &&
          gx >= 0 &&
          gx < BOARD_WIDTH &&
          board[gy][gx] === null
        ) {
          coords.add(`${gx},${gy}`);
        }
      }
    }
    return { ghost: g, ghostCoords: coords };
  }, [game, board]);

  const pendingGarbage = pendingGarbageCount(game);

  const handleNewOrRematch = () => {
    if (isOnline2P) {
      const nextSeed = ((Date.now() & 0x7fffffff) ^ 0x3c6ef372) >>> 0 || 2026;
      startOnlineRoundWithSeed(nextSeed, false);
      void getSharedNetplay().sendRoomEvent('tetris_rematch', { seed: nextSeed });
    } else {
      rngRef.current = Math.random;
      prevLinesRef.current = 0;
      prevStatusRef.current = 'playing';
      prevLockIdRef.current = 0;
      setGame(createGame(rngRef.current));
      setRoundOutcome('playing');
      setSharedGamePaused(false);
      triggerFreshCountdown();
      if (getSharedMusicOn()) {
        getSharedArcadeAudio().ensureContext();
      }
      getSharedArcadeAudio().startNewGameTrack();
    }
  };

  const canSelectOnline2P = netplay.onlineCount > 1 || isOnline2P || isInviting;

  return (
    <section className="tetris" aria-label="Tetris game" ref={gameSectionRef}>
      <PixelBackdrop art={BACKGROUNDS[backgroundIndex]} />
      <header className="tetris-header">
        <div className="row">
          <span className="pb-up-badge pb-up-1" aria-hidden="true">
            1UP
          </span>
          <h2 className="tetris-title">Tetris</h2>
          {isOnline2P && activeTetrisRoom ? (
            <span className="pb-tally" data-testid="tetris-2p-tally" aria-label="Online 2P round wins">
              YOU {wins[0]} – {wins[1]} {activeTetrisRoom.opponent.name}
            </span>
          ) : null}
          {BACKGROUNDS.length > 1 ? (
            <span className="tetris-scene sr-only" aria-live="polite">
              Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {BACKGROUNDS[backgroundIndex].title}
              {musicOn && nowPlaying ? ` · Music: ${nowPlaying}` : ''}
            </span>
          ) : null}
        </div>
      </header>

      <div className="tetris-body">
        <div
          className="tetris-board"
          role="img"
          aria-label={`Tetris board, ${BOARD_WIDTH} by ${BOARD_HEIGHT}`}
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
              const isGhost = cell === null && ghost !== null && ghostCoords.has(key);
              const cls = isGhost
                ? `tetris-cell is-ghost ${CELL_CLASS[ghost.type]}`
                : cellClass(cell);
              return <div key={key} className={cls} />;
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
              <span className="arcade-countdown-digit">
                {countdown >= 2 ? countdownLang.readyText : countdownLang.goText}
              </span>
            </div>
          ) : null}
        </div>

        {(isOnline2P || pendingGarbage > 0) ? (
          <div
            className="tetris-garbage-meter"
            data-testid="tetris-garbage-meter"
            role="status"
            aria-label={`${pendingGarbage} incoming garbage lines`}
            title={`${pendingGarbage} incoming garbage lines`}
          >
            {Array.from({ length: BOARD_HEIGHT }, (_, idx) => {
              const rowFromBottom = BOARD_HEIGHT - 1 - idx;
              const active = rowFromBottom < pendingGarbage;
              return (
                <div
                  key={idx}
                  className={
                    active
                      ? 'tetris-garbage-segment is-active'
                      : 'tetris-garbage-segment'
                  }
                />
              );
            })}
          </div>
        ) : null}

        <aside className="tetris-side">
          <div className="tetris-stat">
            <span className="tetris-label">Score</span>
            <span className="tetris-value" aria-live="polite">{game.score}</span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Lines</span>
            <span className="tetris-value">{game.lines}</span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Level</span>
            <span className="tetris-value">{game.level}</span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Next</span>
            <NextPreview type={game.next} />
          </div>
          {isOnline2P && activeTetrisRoom ? (
            <OpponentTetrisRadar
              opponentName={activeTetrisRoom.opponent.name}
              radar={opponentRadar}
              roundOutcome={roundOutcome}
            />
          ) : null}
        </aside>
      </div>

      {isInviting && !isOnline2P ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="status"
            aria-live="polite"
            data-testid="tetris-invite-waiting"
          >
            <span className="game-pause-kicker">2P Online Matchmaking</span>
            <h3 className="game-pause-title">Waiting for player…</h3>
            <p className="game-pause-copy" data-testid="netplay-invite-countdown">
              Invite expires in <strong>{inviteSecondsLeft}s</strong>
            </p>
            <div className="game-pause-actions">
              <button
                type="button"
                data-testid="tetris-cancel-invite-btn"
                onClick={() => void getSharedNetplay().cancelInvite()}
              >
                Cancel invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOnline2P && isReadyCheck && activeTetrisRoom ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="dialog"
            aria-modal="true"
            aria-label="2P Online Ready Check"
            data-testid="netplay-ready-modal"
          >
            <span className="game-pause-kicker">2P Online Tetris</span>
            <h3 className="game-pause-title">Players Ready?</h3>
            <div className="netplay-ready-roster">
              <div className="netplay-ready-row">
                <span>YOU ({netplay.clientName})</span>
                <span className={myReady ? 'netplay-ready-pill is-ready' : 'netplay-ready-pill'}>
                  {myReady ? 'READY ✓' : 'Waiting…'}
                </span>
              </div>
              <div className="netplay-ready-row">
                <span>{activeTetrisRoom.opponent.name}</span>
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

      {isNetworkPaused && activeTetrisRoom ? (
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
                {activeTetrisRoom.laggingPlayerNames?.length
                  ? activeTetrisRoom.laggingPlayerNames.join(', ')
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
            <span className="game-pause-kicker">Tetris</span>
            <h3 className="game-pause-title">Paused</h3>
            <div className="game-pause-section">
              <span className="tetris-label">Game Mode</span>
              <div className="filter-group" role="group" aria-label="Tetris player mode">
                <button
                  type="button"
                  aria-pressed={!isOnline2P && !isInviting}
                  onClick={() => {
                    if (isOnline2P) void getSharedNetplay().leaveRoom();
                    if (isInviting) void getSharedNetplay().cancelInvite();
                    rngRef.current = Math.random;
                    prevLinesRef.current = 0;
                    prevStatusRef.current = 'playing';
                    prevLockIdRef.current = 0;
                    setGame(createGame(rngRef.current));
                    setRoundOutcome('playing');
                    setSharedGamePaused(false);
                    triggerFreshCountdown();
                    if (getSharedMusicOn()) {
                      getSharedArcadeAudio().ensureContext();
                    }
                    getSharedArcadeAudio().startNewGameTrack();
                  }}
                >
                  1 Player
                </button>
                <button
                  type="button"
                  data-testid="tetris-2p-online-btn"
                  aria-pressed={isOnline2P || isInviting}
                  disabled={!canSelectOnline2P}
                  title={
                    canSelectOnline2P
                      ? 'Challenge online players to 2P Versus Tetris'
                      : 'Requires at least 2 players online'
                  }
                  onClick={() => {
                    if (isOnline2P) {
                      void getSharedNetplay().leaveRoom();
                    } else if (isInviting) {
                      void getSharedNetplay().cancelInvite();
                    } else if (canSelectOnline2P) {
                      setSharedGamePaused(false);
                      void getSharedNetplay().sendInvite('tetris');
                    }
                  }}
                >
                  {isOnline2P
                    ? `2P Online (${activeTetrisRoom.opponent.name})`
                    : isInviting
                      ? `Waiting 2P… (${inviteSecondsLeft}s)`
                      : '2P Online'}
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
                aria-label="Close Tetris"
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
          className="tetris-touch-bar"
          role="group"
          aria-label="Tetris touch controls"
          data-testid="tetris-touch-controls"
        >
          <div className="touch-cluster touch-cluster-left">
            <button
              type="button"
              className="pb-touch-btn pb-touch-rocker"
              data-testid="tetris-touch-left"
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
              className="pb-touch-btn pb-touch-rocker"
              data-testid="tetris-touch-soft"
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
              className="pb-touch-btn pb-touch-rocker"
              data-testid="tetris-touch-right"
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
              className="pb-touch-btn pb-touch-rotate"
              data-testid="tetris-touch-rotate"
              aria-label="Rotate piece"
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
              className="primary pb-touch-btn pb-touch-fire"
              data-testid="tetris-touch-drop"
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

      {isOnline2P && roundOutcome === 'won' && activeTetrisRoom ? (
        <p className="tetris-over" role="status" data-testid="tetris-online-banner">
          YOU WIN! {activeTetrisRoom.opponent.name} topped out ({wins[0]}–{wins[1]}).{' '}
          <button type="button" className="primary" onClick={handleNewOrRematch}>
            Next round
          </button>
        </p>
      ) : isOnline2P && roundOutcome === 'lost' && activeTetrisRoom ? (
        <p className="tetris-over" role="status" data-testid="tetris-online-banner">
          KO! {activeTetrisRoom.opponent.name} wins the round ({wins[0]}–{wins[1]}).{' '}
          <button type="button" className="primary" onClick={handleNewOrRematch}>
            Next round
          </button>
        </p>
      ) : game.status === 'over' ? (
        <p className="tetris-over" role="status">
          Game over — score {game.score}.{' '}
          <button type="button" className="primary" onClick={handleNewOrRematch}>
            New game
          </button>
        </p>
      ) : null}
    </section>
  );
}
