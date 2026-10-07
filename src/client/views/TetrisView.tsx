import { useEffect, useRef, useState } from 'react';
import { TetrisMusic } from '../audio/tetrisMusic';
import {
  BACKGROUNDS,
  nextBackgroundIndex,
  type PixelArt,
} from '../../shared/tetrisBackgrounds';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createGame,
  displayBoard,
  dropInterval,
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

function ArtLayer({ art, past }: { art: PixelArt; past: boolean }) {
  return (
    <svg
      className={`tetris-art-layer ${past ? 'is-past' : 'is-current'}`}
      viewBox={`0 0 ${art.width} ${art.height}`}
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {art.rows.map((row, y) =>
        Array.from(row).map((key, x) =>
          key === '.' ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={art.palette[key]} />
          ),
        ),
      )}
    </svg>
  );
}

/**
 * Crossfades between scenes: the new scene fades in while the previous one
 * fades out. The outgoing layer is dropped once the transition finishes.
 */
function PixelBackdrop({ art }: { art: PixelArt }) {
  const [layers, setLayers] = useState<Array<{ key: number; art: PixelArt }>>([{ key: 0, art }]);
  const keyRef = useRef(0);

  useEffect(() => {
    setLayers((current) => {
      if (current[current.length - 1].art.id === art.id) return current;
      keyRef.current += 1;
      return [...current, { key: keyRef.current, art }];
    });
  }, [art]);

  useEffect(() => {
    if (layers.length <= 1) return;
    const id = window.setTimeout(() => setLayers((current) => current.slice(-1)), 700);
    return () => window.clearTimeout(id);
  }, [layers]);

  return (
    <div className="tetris-art" aria-hidden="true">
      {layers.map((layer, index) => (
        <ArtLayer key={layer.key} art={layer.art} past={index < layers.length - 1} />
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

export function TetrisView({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<TetrisState>(() => createGame());
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const musicRef = useRef<TetrisMusic | null>(null);
  if (musicRef.current === null) {
    musicRef.current = new TetrisMusic((melody) => setNowPlaying(melody.title));
  }
  const gameRef = useRef(game);
  gameRef.current = game;
  const tetrisCountRef = useRef(game.tetrisCount);

  // Clearing four lines at once advances the backdrop to the next scene. A new
  // game resets the counter, which only lowers the ref and never cycles.
  useEffect(() => {
    if (game.tetrisCount > tetrisCountRef.current) {
      setBackgroundIndex((index) => nextBackgroundIndex(index));
    }
    tetrisCountRef.current = game.tetrisCount;
  }, [game.tetrisCount]);

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
        onClose();
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
  }, [onClose, paused]);

  const board = displayBoard(game);

  return (
    <section className="tetris" aria-label="Tetris game">
      <PixelBackdrop art={BACKGROUNDS[backgroundIndex]} />
      <header className="tetris-header">
        <h2 className="tetris-title">Tetris</h2>
        <div className="row">
          <button
            type="button"
            aria-pressed={musicOn}
            onClick={() => {
              const next = !musicOn;
              if (next && !(musicRef.current?.ensureContext() ?? false)) return; // no Web Audio available
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
          <button type="button" onClick={onClose} aria-label="Close Tetris">
            Close
          </button>
        </div>
      </header>

      <div className="tetris-body">
        <div className="tetris-board" role="img" aria-label={`Tetris board, ${BOARD_WIDTH} by ${BOARD_HEIGHT}`}>
          {board.map((row, y) => row.map((cell, x) => <div key={`${x},${y}`} className={cellClass(cell)} />))}
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

      {BACKGROUNDS.length > 1 ? (
        <p className="tetris-scene" aria-live="polite">
          Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {BACKGROUNDS[backgroundIndex].title}
          {nowPlaying ? ` · Music: ${nowPlaying}` : ''}
        </p>
      ) : null}

      {game.status === 'over' ? (
        <p className="tetris-over" role="status">
          Game over — score {game.score}. Start a new game to play again.
        </p>
      ) : (
        <p className="tetris-help">
          Arrow keys move and rotate; down soft-drops; space hard-drops. Clear four lines at once to
          change the scene. {paused ? 'Paused.' : ''}
        </p>
      )}
    </section>
  );
}
