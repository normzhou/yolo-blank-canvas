import { useCallback, useEffect, useRef, useState } from 'react';
import { TetrisMusic } from '../audio/tetrisMusic';
import { BACKGROUNDS, nextBackgroundIndex } from '../../shared/tetrisBackgrounds';
import {
  AIM_STEP_DEG,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BUBBLE_RADIUS,
  DANGER_LINE_Y,
  LAUNCHER_X,
  LAUNCHER_Y,
  ROW_STEP,
  aimGuidePoints,
  aimPlayer,
  bubbleCenter,
  colsForRow,
  createMatch,
  fireAndResolvePlayer,
  firePlayerBubble,
  stepMatch,
  type BubbleColor,
  type PlayerBoardState,
  type PuzzleBobbleMatch,
} from '../../shared/puzzleBobble';

const BUBBLE_TOKEN: Record<BubbleColor, string> = {
  ruby: 'var(--tetromino-z)',
  amber: 'var(--tetromino-l)',
  emerald: 'var(--tetromino-s)',
  azure: 'var(--tetromino-j)',
  amethyst: 'var(--tetromino-t)',
  coral: 'var(--tetromino-i)',
};

function eventSummary(player: PlayerBoardState): string | null {
  const ev = player.lastEvent;
  if (!ev || ev.popped.length === 0) return null;
  const parts = [`Popped ${ev.popped.length}`];
  if (ev.dropped.length > 0) parts.push(`+${ev.dropped.length} dropped`);
  if (ev.sentGarbage > 0) parts.push(`sent ${ev.sentGarbage} attack`);
  return parts.join(' · ');
}

function BubbleSvg({
  cx,
  cy,
  color,
  radius = BUBBLE_RADIUS - 1,
}: {
  cx: number;
  cy: number;
  color: BubbleColor;
  radius?: number;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={BUBBLE_TOKEN[color]}
        stroke="var(--border)"
        strokeWidth="1.25"
      />
      <circle
        cx={cx - radius * 0.3}
        cy={cy - radius * 0.3}
        r={radius * 0.26}
        fill="var(--surface)"
        opacity="0.65"
      />
    </g>
  );
}

function PlayerArena({
  player,
  playerNumber,
  controlsLabel,
  isTwoPlayer,
}: {
  player: PlayerBoardState;
  playerNumber: 1 | 2;
  controlsLabel: string;
  isTwoPlayer: boolean;
}) {
  const ceilingY = player.ceilingDrop * ROW_STEP;
  const guide = aimGuidePoints(player.aimAngle, player.ceilingDrop);
  const polylinePoints = guide.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const rad = (player.aimAngle * Math.PI) / 180;
  const barrelTipX = LAUNCHER_X + Math.sin(rad) * 26;
  const barrelTipY = LAUNCHER_Y - Math.cos(rad) * 26;
  const summary = eventSummary(player);

  let settledCount = 0;
  for (const row of player.grid) {
    for (const cell of row) {
      if (cell !== null) settledCount += 1;
    }
  }

  return (
    <div className="pb-player-card" data-player={playerNumber}>
      <div className="pb-player-header">
        <div>
          <span className="pb-player-title">
            {isTwoPlayer ? `Player ${playerNumber}` : 'Solo'}
          </span>
          <span className="pb-player-controls">{controlsLabel}</span>
        </div>
        {player.incomingGarbage > 0 ? (
          <span className="badge waiting" role="status">
            Incoming +{player.incomingGarbage}
          </span>
        ) : (
          <span className="badge">
            {player.status === 'won'
              ? 'Winner!'
              : player.status === 'ko'
                ? 'KO'
                : `${settledCount} bubbles`}
          </span>
        )}
      </div>

      <div className="pb-arena-row">
        <svg
          className="pb-board"
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          viewBox={`0 0 ${ARENA_WIDTH} ${ARENA_HEIGHT}`}
          role="img"
          aria-label={`Player ${playerNumber} bubble board`}
        >
          {/* Dropped ceiling */}
          {ceilingY > 0 ? (
            <rect
              x={0}
              y={0}
              width={ARENA_WIDTH}
              height={ceilingY}
              fill="var(--neutral-weak)"
              stroke="var(--border)"
            />
          ) : null}
          <line
            x1={0}
            y1={ceilingY}
            x2={ARENA_WIDTH}
            y2={ceilingY}
            stroke="var(--border)"
            strokeWidth={2}
          />

          {/* Danger threshold line */}
          <line
            x1={0}
            y1={DANGER_LINE_Y}
            x2={ARENA_WIDTH}
            y2={DANGER_LINE_Y}
            stroke="var(--problem-border)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {/* Aiming sight line with wall-bounce reflection */}
          {player.status === 'playing' ? (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.75}
              strokeDasharray="4 4"
              opacity={0.75}
            />
          ) : null}

          {/* Settled hexagonal grid bubbles */}
          {player.grid.map((row, r) =>
            Array.from({ length: colsForRow(r) }, (_, c) => {
              const color = row[c];
              if (!color) return null;
              const center = bubbleCenter(r, c, player.ceilingDrop);
              return <BubbleSvg key={`${r},${c}`} cx={center.x} cy={center.y} color={color} />;
            }),
          )}

          {/* In-flight bubble */}
          {player.flying ? (
            <BubbleSvg
              cx={player.flying.x}
              cy={player.flying.y}
              color={player.flying.color}
            />
          ) : null}

          {/* Launcher cannon */}
          <line
            x1={LAUNCHER_X}
            y1={LAUNCHER_Y}
            x2={barrelTipX}
            y2={barrelTipY}
            stroke="var(--text)"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <BubbleSvg cx={LAUNCHER_X} cy={LAUNCHER_Y} color={player.currentBubble} />
        </svg>

        <aside className="tetris-side pb-side">
          <div className="tetris-stat">
            <span className="tetris-label">Score</span>
            <span className="tetris-value" aria-live="polite" data-testid={`p${playerNumber}-score`}>
              {player.score}
            </span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Aim</span>
            <span className="pb-stat-small" data-testid={`p${playerNumber}-aim`}>
              {player.aimAngle > 0 ? `+${player.aimAngle}°` : `${player.aimAngle}°`}
            </span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Shots</span>
            <span className="pb-stat-small" data-testid={`p${playerNumber}-shots`}>
              {player.shotsFired}
            </span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Next</span>
            <svg
              width={BUBBLE_RADIUS * 2 + 6}
              height={BUBBLE_RADIUS * 2 + 6}
              viewBox={`0 0 ${BUBBLE_RADIUS * 2 + 6} ${BUBBLE_RADIUS * 2 + 6}`}
              aria-label={`Player ${playerNumber} next bubble ${player.nextBubble}`}
            >
              <BubbleSvg
                cx={BUBBLE_RADIUS + 3}
                cy={BUBBLE_RADIUS + 3}
                color={player.nextBubble}
              />
            </svg>
          </div>
          {summary ? (
            <div className="pb-combo" role="status">
              {summary}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function PuzzleBobbleView({ onExit }: { onExit: () => void }) {
  const [match, setMatch] = useState<PuzzleBobbleMatch>(() => createMatch('2p'));
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(1);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);

  const musicRef = useRef<TetrisMusic | null>(null);
  if (musicRef.current === null) {
    musicRef.current = new TetrisMusic((track) => setNowPlaying(track.title));
  }

  const matchRef = useRef(match);
  matchRef.current = match;
  const heldAimKeysRef = useRef< Map<string, number> >(new Map());

  // Audio playback follows active match state.
  useEffect(() => {
    musicRef.current?.setActive(musicOn && match.status === 'playing' && !paused);
  }, [musicOn, paused, match.status]);

  useEffect(() => () => musicRef.current?.dispose(), []);

  // Advance flying bubbles smoothly at ~60fps while any projectile is in flight.
  const anyFlying = match.players.some((p) => p.flying !== null);
  useEffect(() => {
    if (paused || match.status !== 'playing' || !anyFlying) return;
    const id = window.setInterval(() => {
      setMatch((current) => stepMatch(current));
    }, 16);
    return () => window.clearInterval(id);
  }, [anyFlying, match.status, paused]);

  // Deterministic E2E / test hook to resolve a player's shot in one step when needed.
  useEffect(() => {
    function onInstantResolve(event: Event) {
      const detail = (event as CustomEvent<{ player?: 0 | 1 }>).detail;
      const idx: 0 | 1 = detail?.player === 1 ? 1 : 0;
      setMatch((current) => fireAndResolvePlayer(current, idx));
    }
    window.addEventListener('yolo:puzzle-bobble:fire-resolve', onInstantResolve);
    return () => window.removeEventListener('yolo:puzzle-bobble:fire-resolve', onInstantResolve);
  }, []);

  const startNewRound = useCallback((mode: '2p' | '1p', keepWins = true) => {
    setMatch((current) =>
      createMatch(mode, Math.random, keepWins ? current.wins : [0, 0]),
    );
    setPaused(false);
    setBackgroundIndex((index) => nextBackgroundIndex(index));
  }, []);

  // Keyboard controls:
  // - Player 1 (left board, or solo): A / D to aim left/right; S / F / W to shoot.
  // - Player 2 (right board in 2P, or solo fallback): ArrowLeft / ArrowRight to aim; ArrowUp / ArrowDown / Space / Enter to shoot.
  // - Tracks held aim keys independently per player so two players sharing one
  //   keyboard never cancel each other's OS key repeat.
  // - Escape closes the view.
  useEffect(() => {
    const held = heldAimKeysRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      if (paused || matchRef.current.status !== 'playing') return;

      const is2P = matchRef.current.mode === '2p';
      const p2Index: 0 | 1 = is2P ? 1 : 0;

      switch (event.key) {
        // Player 1: ASDF (and W)
        case 'a':
        case 'A':
          event.preventDefault();
          if (!held.has('a')) {
            held.set('a', performance.now());
            setMatch((current) => aimPlayer(current, 0, -AIM_STEP_DEG));
          }
          break;
        case 'd':
        case 'D':
          event.preventDefault();
          if (!held.has('d')) {
            held.set('d', performance.now());
            setMatch((current) => aimPlayer(current, 0, AIM_STEP_DEG));
          }
          break;
        case 's':
        case 'S':
        case 'f':
        case 'F':
        case 'w':
        case 'W':
          event.preventDefault();
          setMatch((current) => firePlayerBubble(current, 0));
          break;

        // Player 2 (in 2P) or Player 1 (in 1P): Arrow keys
        case 'ArrowLeft':
          event.preventDefault();
          if (!held.has('ArrowLeft')) {
            held.set('ArrowLeft', performance.now());
            setMatch((current) => aimPlayer(current, p2Index, -AIM_STEP_DEG));
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (!held.has('ArrowRight')) {
            held.set('ArrowRight', performance.now());
            setMatch((current) => aimPlayer(current, p2Index, AIM_STEP_DEG));
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case ' ':
        case 'Spacebar':
        case 'Enter':
          event.preventDefault();
          setMatch((current) => firePlayerBubble(current, p2Index));
          break;
        default:
          break;
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      held.delete(k);
    }

    function onBlur() {
      held.clear();
    }

    const holdInterval = window.setInterval(() => {
      if (paused || matchRef.current.status !== 'playing' || held.size === 0) return;
      const now = performance.now();
      const holdDelayMs = 130;
      const is2P = matchRef.current.mode === '2p';
      const p2Index: 0 | 1 = is2P ? 1 : 0;

      let p1Delta = 0;
      let p2Delta = 0;
      if ((held.get('a') ?? Infinity) <= now - holdDelayMs) p1Delta -= AIM_STEP_DEG;
      if ((held.get('d') ?? Infinity) <= now - holdDelayMs) p1Delta += AIM_STEP_DEG;
      if ((held.get('ArrowLeft') ?? Infinity) <= now - holdDelayMs) p2Delta -= AIM_STEP_DEG;
      if ((held.get('ArrowRight') ?? Infinity) <= now - holdDelayMs) p2Delta += AIM_STEP_DEG;

      if (p1Delta !== 0 || p2Delta !== 0) {
        setMatch((current) => {
          let next = current;
          if (p1Delta !== 0) next = aimPlayer(next, 0, p1Delta);
          if (p2Delta !== 0) next = aimPlayer(next, p2Index, p2Delta);
          return next;
        });
      }
    }, 32);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.clearInterval(holdInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [onExit, paused]);

  const art = BACKGROUNDS[backgroundIndex] ?? BACKGROUNDS[0];

  return (
    <section className="tetris pb-game" aria-label="Puzzle Bobble game">
      <div className="tetris-art" aria-hidden="true">
        <img className="tetris-art-layer is-current" src={art.src} alt="" aria-hidden="true" />
      </div>

      <header className="tetris-header pb-header">
        <div className="row">
          <h2 className="tetris-title">Puzzle Bobble</h2>
          {match.mode === '2p' ? (
            <span className="pb-tally" aria-label="Round wins">
              P1 {match.wins[0]} – {match.wins[1]} P2
            </span>
          ) : null}
        </div>
        <div className="row">
          <div className="filter-group" role="group" aria-label="Player mode">
            <button
              type="button"
              aria-pressed={match.mode === '2p'}
              onClick={() => startNewRound('2p', false)}
            >
              2 Players
            </button>
            <button
              type="button"
              aria-pressed={match.mode === '1p'}
              onClick={() => startNewRound('1p', false)}
            >
              1 Player
            </button>
          </div>
          <button
            type="button"
            aria-pressed={musicOn}
            onClick={() => {
              const next = !musicOn;
              if (next && !(musicRef.current?.ensureContext() ?? false)) return;
              setMusicOn(next);
            }}
          >
            Music {musicOn ? 'on' : 'off'}
          </button>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            disabled={match.status !== 'playing'}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => startNewRound(match.mode, true)}
          >
            {match.status === 'round_over' ? 'Next round' : 'New game'}
          </button>
          <button type="button" onClick={onExit} aria-label="Close Puzzle Bobble">
            Close
          </button>
        </div>
      </header>

      <div className="tetris-body pb-boards">
        <PlayerArena
          player={match.players[0]}
          playerNumber={1}
          controlsLabel={
            match.mode === '2p'
              ? 'ASDF — A/D aim · S/F shoot'
              : 'ASDF or Arrows — A/D or ←/→ aim · S/F or ↑ shoot'
          }
          isTwoPlayer={match.mode === '2p'}
        />
        {match.mode === '2p' && match.players[1] ? (
          <PlayerArena
            player={match.players[1]}
            playerNumber={2}
            controlsLabel="Arrows — ←/→ aim · ↑/↓ shoot"
            isTwoPlayer
          />
        ) : null}
      </div>

      <p className="tetris-scene" aria-live="polite">
        Bust-A-Move · Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {art.title}
        {nowPlaying ? ` · Music: ${nowPlaying}` : ''}
      </p>

      {match.status === 'round_over' ? (
        <p className="tetris-over pb-banner" role="status">
          {match.winner !== null
            ? `Player ${match.winner + 1} wins the round! (${match.wins[0]}–${match.wins[1]}). Press Next round to battle again.`
            : `Game over — score ${match.players[0].score}. Press Next round to play again.`}
        </p>
      ) : (
        <p className="tetris-help">
          {match.mode === '2p'
            ? 'Player 1: A/D aim, S or F fire. Player 2: ←/→ aim, ↑ or ↓ fire. Match 3+ bubbles to pop; drop hanging clusters to send attack bubbles!'
            : 'Match 3+ bubbles of the same colour to pop them; unanchored clusters fall for bonus points.'}{' '}
          {paused ? 'Paused.' : ''}
        </p>
      )}
    </section>
  );
}
