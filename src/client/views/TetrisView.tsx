import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    pendingGarbage: 0,
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

function NextPreview({ type }: { type: Tetromino }) {
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
}

function OpponentTetrisRadar({
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
        className="tetris-radar-grid"
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
      </div>
      <div className="netplay-radar-stats">
        <span data-testid="tetris-opponent-score">{radar.score} pts</span>
        <span data-testid="tetris-opponent-lines">{radar.lines}L</span>
      </div>
    </div>
  );
}

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
  const [paused, setPaused] = useState<boolean>(() => getSharedGamePaused());
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
  const [countdown, setCountdown] = useState<number>(() => (motionReduced() ? 0 : 3));
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState<number>(20);
  const touchSeenRef = useRef<boolean>(detectTouchAvailable());
  const [touchAvailable, setTouchAvailable] = useState<boolean>(() => touchSeenRef.current);

  useEffect(() => {
    setSharedGamePaused(false);
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
  const isInviting = netplay.myPendingInvite?.gameId === 'tetris';
  const myRoomPlayer = activeTetrisRoom?.players.find((p) => p.id === netplay.clientId);
  const myReady = Boolean(myRoomPlayer?.ready);
  const oppReady = Boolean(activeTetrisRoom?.opponent?.ready);

  const startOnlineRoundWithSeed = useCallback((seed: number, resetTally = false) => {
    rngRef.current = mulberry32(seed);
    const fresh = createGame(rngRef.current);
    prevLinesRef.current = 0;
    prevStatusRef.current = 'playing';
    prevLockIdRef.current = 0;
    setGame(fresh);
    setOpponentRadar(createInitialTetrisRadar());
    setRoundOutcome('playing');
    setSharedGamePaused(false);
    setCountdown(motionReduced() ? 0 : 3);
    if (resetTally) {
      setWins([0, 0]);
    }
  }, []);

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

  // 3, 2, 1 arcade start countdown (#248).
  useEffect(() => {
    if (countdown <= 0 || paused || isReadyCheck || isInviting) return;
    const id = window.setTimeout(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 450);
    return () => window.clearTimeout(id);
  }, [countdown, paused, isReadyCheck, isInviting]);

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
        void getSharedNetplay().sendRoomEvent('tetris_state', {
          board: displayBoard(game),
          score: game.score,
          lines: game.lines,
          level: game.level,
          status: game.status,
          pendingGarbage: pendingGarbageCount(game),
        } satisfies TetrisRadarSnapshot);
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
    getSharedArcadeAudio().setActive(musicOn && !matchEnded && !paused);
  }, [musicOn, paused, matchEnded]);

  // Gravity. Restarts when the level (speed) changes and stops when not playing or during countdown/ready-check.
  useEffect(() => {
    if (paused || matchEnded || isReadyCheck || isInviting || countdown > 0) return;
    const id = window.setInterval(() => {
      setGame((current) => tick(current, rngRef.current));
    }, dropInterval(game.level));
    return () => window.clearInterval(id);
  }, [paused, game.level, matchEnded, isReadyCheck, isInviting, countdown]);

  // Keyboard controls: arrows move/rotate/soft-drop, space hard-drops, Escape toggles Pause Menu (#237).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        toggleSharedGamePaused();
        return;
      }
      if (paused || isReadyCheck || gameRef.current.status !== 'playing' || (isOnline2P && roundOutcomeRef.current !== 'playing')) {
        return;
      }
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          setCountdown(0);
          setGame((current) => moveLeft(current));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCountdown(0);
          setGame((current) => moveRight(current));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setCountdown(0);
          setGame((current) => softDrop(current, rngRef.current));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setCountdown(0);
          getSharedArcadeAudio().sfx.playRotate();
          setGame((current) => rotate(current, 1));
          break;
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          setCountdown(0);
          getSharedArcadeAudio().sfx.playHardDrop();
          setGame((current) => hardDrop(current, rngRef.current));
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOnline2P, isReadyCheck, onExit, paused]);

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
      if (paused || matchEnded) return;
      stopTouchRepeat();
      action();
      repeatTimeoutRef.current = window.setTimeout(() => {
        repeatIntervalRef.current = window.setInterval(action, 60);
      }, 160);
    },
    [matchEnded, paused, stopTouchRepeat],
  );

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (paused || matchEnded) return;
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
    if (!g || g.pointerId !== event.pointerId || paused || matchEnded) return;
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
    if (paused || matchEnded) return;
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

  const board = displayBoard(game);
  const ghost = ghostPiece(game);
  const ghostCoords = new Set<string>();
  if (ghost) {
    for (const [dx, dy] of rotationCells(ghost.type, ghost.rotation)) {
      const gx = ghost.x + dx;
      const gy = ghost.y + dy;
      if (gy >= 0 && gy < BOARD_HEIGHT && gx >= 0 && gx < BOARD_WIDTH && board[gy][gx] === null) {
        ghostCoords.add(`${gx},${gy}`);
      }
    }
  }

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
      setCountdown(motionReduced() ? 0 : 3);
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
              role="status"
              aria-live="polite"
            >
              <span className="arcade-countdown-digit">{countdown}</span>
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

      {paused ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Game paused"
            data-testid="game-pause-menu"
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
                    setSharedGamePaused(false);
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
                onClick={() => setSharedGamePaused(false)}
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
              disabled={paused || matchEnded || isReadyCheck}
              onPointerDown={(event) => {
                event.preventDefault();
                setCountdown(0);
                startTouchRepeat(() => setGame((current) => moveLeft(current)));
              }}
              onPointerUp={stopTouchRepeat}
              onPointerCancel={stopTouchRepeat}
              onPointerLeave={stopTouchRepeat}
              onClick={(event) => {
                if (event.detail === 0) {
                  setCountdown(0);
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
              disabled={paused || matchEnded || isReadyCheck}
              onPointerDown={(event) => {
                event.preventDefault();
                setCountdown(0);
                startTouchRepeat(() => setGame((current) => softDrop(current, rngRef.current)));
              }}
              onPointerUp={stopTouchRepeat}
              onPointerCancel={stopTouchRepeat}
              onPointerLeave={stopTouchRepeat}
              onClick={(event) => {
                if (event.detail === 0) {
                  setCountdown(0);
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
              disabled={paused || matchEnded || isReadyCheck}
              onPointerDown={(event) => {
                event.preventDefault();
                setCountdown(0);
                startTouchRepeat(() => setGame((current) => moveRight(current)));
              }}
              onPointerUp={stopTouchRepeat}
              onPointerCancel={stopTouchRepeat}
              onPointerLeave={stopTouchRepeat}
              onClick={(event) => {
                if (event.detail === 0) {
                  setCountdown(0);
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
              disabled={paused || matchEnded || isReadyCheck}
              onPointerDown={(event) => {
                event.preventDefault();
                setCountdown(0);
                getSharedArcadeAudio().sfx.playRotate();
                setGame((current) => rotate(current, 1));
              }}
              onClick={(event) => {
                if (event.detail === 0) {
                  setCountdown(0);
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
              disabled={paused || matchEnded || isReadyCheck}
              onPointerDown={(event) => {
                event.preventDefault();
                setCountdown(0);
                getSharedArcadeAudio().sfx.playHardDrop();
                setGame((current) => hardDrop(current, rngRef.current));
              }}
              onClick={(event) => {
                if (event.detail === 0) {
                  setCountdown(0);
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
