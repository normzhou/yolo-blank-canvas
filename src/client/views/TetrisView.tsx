import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { TetrisMusic } from '../audio/tetrisMusic';
import {
  BACKGROUNDS,
  nextBackgroundIndex,
  type Backdrop,
} from '../../shared/tetrisBackgrounds';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createGame,
  displayBoard,
  dropInterval,
  ghostPiece,
  hardDrop,
  moveLeft,
  moveRight,
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

const CELL_CLASS: Record<Tetromino, string> = {
  I: 'tetromino-i',
  J: 'tetromino-j',
  L: 'tetromino-l',
  O: 'tetromino-o',
  S: 'tetromino-s',
  T: 'tetromino-t',
  Z: 'tetromino-z',
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
      // The fade decides when the layer goes: removing it on a second copy of
      // the duration lets the two drift apart and pop the art mid-fade.
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

/**
 * Crossfades between scenes: the new scene fades in while the previous one
 * fades out.
 *
 * The outgoing layer is removed by its own `animationend`, so the unmount
 * happens where the fade actually ends rather than at a second copy of its
 * length. Under `prefers-reduced-motion: reduce` no animation runs, so that
 * event never arrives and the layer is dropped on the next frame instead —
 * there is nothing to fade, and leaving it in the DOM would accumulate one
 * hidden layer per scene change.
 */
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

  // Cut, not crossfade: no animation means no `animationend` to wait for.
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

export function TetrisView({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<TetrisState>(() => createGame());
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const musicRef = useRef<TetrisMusic | null>(null);
  if (musicRef.current === null) {
    musicRef.current = new TetrisMusic((track) => setNowPlaying(track.title));
  }
  const gameRef = useRef(game);
  gameRef.current = game;
  const tetrisCountRef = useRef(game.tetrisCount);
  const gameSectionRef = useRef<HTMLElement>(null);

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

  // Clearing four lines at once advances the backdrop to the next scene. A new
  // game resets the counter, which only lowers the ref and never cycles.
  useEffect(() => {
    if (game.tetrisCount > tetrisCountRef.current) {
      setBackgroundIndex((index) => nextBackgroundIndex(index));
    }
    tetrisCountRef.current = game.tetrisCount;
  }, [game.tetrisCount]);

  // Browser-driven test hook: a synthetic four-line clear, as the game would
  // record on a real one, so the cycle can be exercised without scripted
  // gameplay. Play rules are unchanged.
  useEffect(() => {
    function forceFourLineClear() {
      setGame((current) => ({ ...current, tetrisCount: current.tetrisCount + 1 }));
    }
    window.addEventListener('yolo:tetris:four-line-clear', forceFourLineClear);
    return () => window.removeEventListener('yolo:tetris:four-line-clear', forceFourLineClear);
  }, []);

  // Drive playback from game state. The audio context itself is created by the
  // Music button click, because browsers require a user gesture to start audio.
  useEffect(() => {
    musicRef.current?.setActive(musicOn && game.status === 'playing' && !paused);
  }, [musicOn, paused, game.status]);

  useEffect(() => () => musicRef.current?.dispose(), []);

  // Gravity. Restarts when the level (speed) changes and stops when not playing.
  useEffect(() => {
    if (paused || game.status !== 'playing') return;
    const id = window.setInterval(() => {
      setGame((current) => tick(current));
    }, dropInterval(game.level));
    return () => window.clearInterval(id);
  }, [paused, game.level, game.status]);

  // Keyboard controls: arrows move/rotate/soft-drop, space hard-drops, Escape closes.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      if (paused || gameRef.current.status !== 'playing') return;
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
          setGame((current) => softDrop(current));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setGame((current) => rotate(current, 1));
          break;
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          setGame((current) => hardDrop(current));
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit, paused]);

  // #212: Touch / pointer auto-repeat (DAS) for on-screen Tetris arcade buttons
  // and direct board gestures (drag left/right to move, tap to rotate, flick down to hard-drop).
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
      if (paused || game.status !== 'playing') return;
      stopTouchRepeat();
      action();
      repeatTimeoutRef.current = window.setTimeout(() => {
        repeatIntervalRef.current = window.setInterval(action, 60);
      }, 160);
    },
    [game.status, paused, stopTouchRepeat],
  );

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (paused || game.status !== 'playing') return;
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
    if (!g || g.pointerId !== event.pointerId || paused || game.status !== 'playing') return;
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
    if (paused || game.status !== 'playing') return;
    const totalDx = event.clientX - g.startX;
    const totalDy = event.clientY - g.startY;
    if (totalDy >= 44 && Math.abs(totalDy) > Math.abs(totalDx) * 1.3) {
      setGame((current) => hardDrop(current));
    } else if (!g.moved && Math.hypot(totalDx, totalDy) < 12) {
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

  return (
    <section className="tetris" aria-label="Tetris game" ref={gameSectionRef}>
      <PixelBackdrop art={BACKGROUNDS[backgroundIndex]} />
      <header className="tetris-header">
        <div className="row">
          <span className="pb-up-badge pb-up-1" aria-hidden="true">
            1UP
          </span>
          <h2 className="tetris-title">Tetris</h2>
          {BACKGROUNDS.length > 1 ? (
            <p className="tetris-scene" aria-live="polite">
              Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {BACKGROUNDS[backgroundIndex].title}
              {nowPlaying ? ` · Music: ${nowPlaying}` : ''}
            </p>
          ) : null}
        </div>
        <div className="row">
          <button
            type="button"
            aria-pressed={musicOn}
            onClick={() => {
              const next = !musicOn;
              if (next && !(musicRef.current?.ensureContext() ?? false)) return; // no Web Audio available
              // #217: Start or stop synchronously inside the user tap gesture
              // so iOS Safari / Chrome WebKit allows audio playback.
              musicRef.current?.setActive(next && game.status === 'playing' && !paused);
              setMusicOn(next);
            }}
          >
            Music {musicOn ? 'on' : 'off'}
          </button>
          <button type="button" onClick={() => setPaused((value) => !value)} disabled={game.status !== 'playing'}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="primary" onClick={() => { setGame(createGame()); setPaused(false); }}>
            New game
          </button>
          <button type="button" onClick={onExit} aria-label="Close Tetris">
            Close
          </button>
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
        </div>
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
        </aside>
      </div>

      <div
        className="tetris-touch-bar"
        role="group"
        aria-label="Tetris touch controls"
        data-testid="tetris-touch-controls"
      >
        <button
          type="button"
          className="pb-touch-btn pb-touch-rocker"
          data-testid="tetris-touch-left"
          aria-label="Move left"
          disabled={paused || game.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            startTouchRepeat(() => setGame((current) => moveLeft(current)));
          }}
          onPointerUp={stopTouchRepeat}
          onPointerCancel={stopTouchRepeat}
          onPointerLeave={stopTouchRepeat}
          onClick={(event) => {
            if (event.detail === 0) setGame((current) => moveLeft(current));
          }}
        >
          ◀
        </button>
        <button
          type="button"
          className="pb-touch-btn pb-touch-rocker"
          data-testid="tetris-touch-soft"
          aria-label="Soft drop"
          disabled={paused || game.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            startTouchRepeat(() => setGame((current) => softDrop(current)));
          }}
          onPointerUp={stopTouchRepeat}
          onPointerCancel={stopTouchRepeat}
          onPointerLeave={stopTouchRepeat}
          onClick={(event) => {
            if (event.detail === 0) setGame((current) => softDrop(current));
          }}
        >
          ▼
        </button>
        <button
          type="button"
          className="pb-touch-btn pb-touch-rocker"
          data-testid="tetris-touch-right"
          aria-label="Move right"
          disabled={paused || game.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            startTouchRepeat(() => setGame((current) => moveRight(current)));
          }}
          onPointerUp={stopTouchRepeat}
          onPointerCancel={stopTouchRepeat}
          onPointerLeave={stopTouchRepeat}
          onClick={(event) => {
            if (event.detail === 0) setGame((current) => moveRight(current));
          }}
        >
          ▶
        </button>
        <button
          type="button"
          className="pb-touch-btn pb-touch-rotate"
          data-testid="tetris-touch-rotate"
          aria-label="Rotate piece"
          disabled={paused || game.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            setGame((current) => rotate(current, 1));
          }}
          onClick={(event) => {
            if (event.detail === 0) setGame((current) => rotate(current, 1));
          }}
        >
          ↻ ROTATE
        </button>
        <button
          type="button"
          className="primary pb-touch-btn pb-touch-fire"
          data-testid="tetris-touch-drop"
          aria-label="Hard drop"
          disabled={paused || game.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            setGame((current) => hardDrop(current));
          }}
          onClick={(event) => {
            if (event.detail === 0) setGame((current) => hardDrop(current));
          }}
        >
          ⤓ DROP
        </button>
      </div>

      {game.status === 'over' ? (
        <p className="tetris-over" role="status">
          Game over — score {game.score}. Start a new game to play again.
        </p>
      ) : null}
    </section>
  );
}
