import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  type StarlightBurstLiveSnapshot,
} from '../netplay';
import {
  pickCountdownLanguage,
  type CountdownLanguage,
} from '../../shared/countdownLanguages';
import { STARLIGHT_BURST_PLAYLIST } from '../../shared/arcadeMusic';
import { BACKGROUNDS, nextBackgroundIndex } from '../../shared/stageBackdrops';
import {
  AIM_STEP_DEG,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  DANGER_LINE_Y,
  LAUNCHER_X,
  LAUNCHER_Y,
  ROW_STEP,
  STAR_RADIUS,
  aimAngleFromBoardPoint,
  aimGuidePoints,
  aimPlayer,
  aimVelocityDegPerSec,
  characterDisplayName,
  colsForRow,
  createMatch,
  createPlayerBoard,
  createRandomMascotPair,
  createStageGrid,
  decomposeGarbageOrbs,
  deriveMascotAdvice,
  deriveMascotMood,
  fireAndResolvePlayer,
  firePlayerStar,
  formatAimAngle,
  generateGarbageColors,
  hurryCountdownSeconds,
  pickRandomOtherMascot,
  queueIncomingGarbage,
  resolveMatchOutcome,
  setPlayerAimAngle,
  shotsPerCeilingDrop,
  stageTitle,
  starCenter,
  stepMatch,
  tickShotTimers,
  TOTAL_STAGES,
  type CharacterId,
  type MascotAdvice,
  type MascotGender,
  type MascotSelection,
  type PlayerBoardState,
  type StarColor,
  type StarlightBurstMatch,
} from '../../shared/starlightBurst';
import {
  CompanionSvg,
  mascotPalette,
} from '../../games/starlight-burst/companions';

const STAR_TOKEN: Record<StarColor, string> = {
  ruby: 'var(--prism-1)',
  amber: 'var(--prism-4)',
  emerald: 'var(--prism-3)',
  azure: 'var(--prism-5)',
  amethyst: 'var(--prism-2)',
  coral: 'var(--prism-6)',
};

function eventSummary(player: PlayerBoardState): string | null {
  const ev = player.lastEvent;
  if (!ev) return null;
  if (ev.clearBonus > 0) {
    return `SKY CLEAR! +${ev.clearBonus.toLocaleString()} BONUS`;
  }
  if (ev.popped.length === 0 && ev.risenGarbage.length === 0) return null;
  const parts: string[] = [];
  if (ev.popped.length > 0) {
    parts.push(`Burst ${ev.popped.length} (+${ev.popScore})`);
  }
  if (ev.dropped.length > 0) {
    parts.push(`Cascade ${ev.dropped.length}! (+${ev.dropScore.toLocaleString()})`);
  }
  if (ev.sentGarbage > 0) {
    parts.push(`Sent ${ev.sentGarbage} stars!`);
  }
  if (ev.risenGarbage.length > 0) {
    parts.push(`+${ev.risenGarbage.length} stars rose!`);
  }
  return parts.join(' · ');
}

/**
 * Shared SVG <defs> for lush 3D glass/crystal spherical lighting on Star-Orbs (#354).
 */
function StarOrbDefs({ idPrefix }: { idPrefix: string }) {
  return (
    <>
      <radialGradient id={`${idPrefix}-orb-3d`} cx="30%" cy="24%" r="74%">
        <stop offset="0%" stopColor="var(--on-accent)" stopOpacity="0.68" />
        <stop offset="24%" stopColor="var(--on-accent)" stopOpacity="0.14" />
        <stop offset="64%" stopColor="var(--stage-well)" stopOpacity="0.06" />
        <stop offset="100%" stopColor="var(--stage-well)" stopOpacity="0.56" />
      </radialGradient>
      <radialGradient id={`${idPrefix}-orb-core`} cx="56%" cy="58%" r="44%">
        <stop offset="0%" stopColor="var(--on-accent)" stopOpacity="0.28" />
        <stop offset="70%" stopColor="var(--on-accent)" stopOpacity="0.03" />
        <stop offset="100%" stopColor="var(--on-accent)" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

/**
 * Lush 3D glass/crystal Starlight Orb (#354):
 * - Deep saturated jewel sphere with 3D radial dome shading (`-orb-3d`)
 * - Subtle inner starlight luminescence + dainty jewel-gleam sparkle
 * - Lower-right subsurface bounce-light crescent arc
 * - Curved upper-left glass specular gleam + pinpoint sparkle
 */
function StarCoreSvg({
  cx,
  cy,
  color,
  radius = STAR_RADIUS - 0.7,
  defsPrefix = 'sb-p1',
  className,
  style,
}: {
  cx: number;
  cy: number;
  color: StarColor;
  radius?: number;
  defsPrefix?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const glintX = cx - radius * 0.32;
  const glintY = cy - radius * 0.35;
  const starX = cx + radius * 0.22;
  const starY = cy + radius * 0.2;
  const s = radius * 0.19;
  const bounceR = Math.max(2, radius * 0.77);
  const bx1 = cx - bounceR * 0.36;
  const by1 = cy + bounceR * 0.91;
  const bx2 = cx + bounceR * 0.91;
  const by2 = cy + bounceR * 0.36;

  return (
    <g className={className} style={style}>
      {/* Base jewel sphere + crisp ink rim */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={STAR_TOKEN[color]}
        stroke="var(--stage-well)"
        strokeWidth="1.25"
      />
      {/* 3D spherical lighting & shadow dome */}
      <circle cx={cx} cy={cy} r={Math.max(1, radius - 0.5)} fill={`url(#${defsPrefix}-orb-3d)`} />
      {/* Soft inner subsurface luminescence */}
      <circle cx={cx} cy={cy} r={radius * 0.65} fill={`url(#${defsPrefix}-orb-core)`} />
      {/* Lower-right subsurface bounce-light rim arc */}
      <path
        d={`M ${bx1.toFixed(1)} ${by1.toFixed(1)} A ${bounceR.toFixed(1)} ${bounceR.toFixed(1)} 0 0 0 ${bx2.toFixed(1)} ${by2.toFixed(1)}`}
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth={Math.max(0.85, radius * 0.095)}
        strokeLinecap="round"
        opacity="0.42"
      />
      {/* Dainty starlight crystal glisten nestled inside the lower-right glow */}
      <polygon
        points={`${starX},${starY - s} ${starX + s * 0.26},${starY - s * 0.26} ${starX + s},${starY} ${starX + s * 0.26},${starY + s * 0.26} ${starX},${starY + s} ${starX - s * 0.26},${starY + s * 0.26} ${starX - s},${starY} ${starX - s * 0.26},${starY - s * 0.26}`}
        fill="var(--on-accent)"
        opacity="0.34"
      />
      {/* Curved upper-left 3D glass specular highlight */}
      <ellipse
        cx={glintX}
        cy={glintY}
        rx={radius * 0.34}
        ry={radius * 0.18}
        transform={`rotate(-32 ${glintX.toFixed(1)} ${glintY.toFixed(1)})`}
        fill="var(--on-accent)"
        opacity="0.88"
      />
      {/* Pinpoint secondary starlight glint */}
      <circle
        cx={cx - radius * 0.08}
        cy={cy - radius * 0.55}
        r={Math.max(0.75, radius * 0.088)}
        fill="var(--on-accent)"
        opacity="0.76"
      />
    </g>
  );
}

/**
 * Sculpted 3D Celestial Starlight Sling, Next-Orb Chalice, Faceted Golden
 * Star-Compass Pointer, and 3D Astrolabe Focus Wheel channeled by the companion (#354).
 */
function StarlightSlingSvg({
  player,
  playerNumber,
  mascot,
  advice,
  onCycleCharacter,
}: {
  player: PlayerBoardState;
  playerNumber: 1 | 2;
  mascot: MascotSelection;
  advice: MascotAdvice;
  onCycleCharacter?: () => void;
}) {
  const { character, gender } = mascot;
  const palette = mascotPalette(character, gender);
  const haloRotation = Math.round(player.aimAngle * 5 * 10) / 10;
  const orbitRotation = Math.round(-player.aimAngle * 18 * 10) / 10;
  const mood = deriveMascotMood(player);
  const defsPrefix = `sb-p${playerNumber}`;

  return (
    <g>
      {/* 3D sculpted celestial sanctuary pedestal with bevel top & shadow lip */}
      <ellipse
        cx={LAUNCHER_X + 10}
        cy={LAUNCHER_Y + 24.5}
        rx={58}
        ry={3.2}
        fill="var(--stage-well)"
        opacity="0.65"
      />
      <rect
        x={LAUNCHER_X - 48}
        y={LAUNCHER_Y + 13}
        width={116}
        height={11}
        rx={5.5}
        fill="var(--stage-surface)"
        stroke="var(--stage-well)"
        strokeWidth="1.35"
      />
      <path
        d={`M ${LAUNCHER_X - 42} ${LAUNCHER_Y + 15.2} L ${LAUNCHER_X + 62} ${LAUNCHER_Y + 15.2}`}
        stroke="var(--stage-bezel)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d={`M ${LAUNCHER_X - 34} ${LAUNCHER_Y + 19.5} L ${LAUNCHER_X + 54} ${LAUNCHER_Y + 19.5}`}
        stroke="var(--prism-7)"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Left 3D Cushioned Next-Orb Chalice */}
      <g transform={`translate(${LAUNCHER_X - 41}, ${LAUNCHER_Y + 8})`}>
        <ellipse cx={0} cy={6.2} rx={12.5} ry={3.2} fill="var(--stage-well)" opacity="0.55" />
        <path
          d="M -11.5 4.5 Q 0 9.5 11.5 4.5 L 9.2 0.2 Q 0 3.8 -9.2 0.2 Z"
          fill="var(--prism-5)"
          stroke="var(--stage-well)"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        <path
          d="M -8.2 1.4 Q 0 4.2 8.2 1.4"
          fill="none"
          stroke="var(--on-accent)"
          strokeWidth="0.9"
          opacity="0.55"
        />
        <StarCoreSvg
          cx={0}
          cy={-5.5}
          color={player.nextStar}
          radius={10}
          defsPrefix={defsPrefix}
        />
      </g>

      {/* Center 3D Celestial Ring Base & Rotating Star-Studs */}
      <g transform={`translate(${LAUNCHER_X}, ${LAUNCHER_Y})`}>
        <circle
          cx={0}
          cy={0}
          r={20.5}
          fill="var(--stage-surface)"
          stroke="var(--stage-well)"
          strokeWidth="1.5"
        />
        <circle
          cx={0}
          cy={0}
          r={18.4}
          fill="none"
          stroke="var(--prism-5)"
          strokeWidth="1.6"
          opacity="0.82"
        />
        <path
          d="M -14 -12 A 18.4 18.4 0 0 1 14 -12"
          fill="none"
          stroke="var(--on-accent)"
          strokeWidth="1.0"
          opacity="0.35"
        />
        <g transform={`rotate(${haloRotation})`}>
          {Array.from({ length: 8 }, (_, i) => (
            <circle
              key={i}
              cx={0}
              cy={-18.4}
              r={1.45}
              fill={i % 2 === 0 ? 'var(--prism-4)' : 'var(--prism-7)'}
              stroke="var(--stage-well)"
              strokeWidth="0.6"
              transform={`rotate(${i * 45})`}
            />
          ))}
        </g>
      </g>

      {/* Right 3D Jewel-Set Astrolabe Focus Wheel channeled by the companion */}
      <g
        transform={`translate(${LAUNCHER_X + 27}, ${LAUNCHER_Y + 6}) rotate(${orbitRotation})`}
        data-testid={`p${playerNumber}-sling-ring`}
        data-sling-angle={orbitRotation}
      >
        {/* Outer 3D wheel rim */}
        <circle
          cx={0}
          cy={0}
          r={9.8}
          fill="var(--stage-slot)"
          stroke="var(--stage-well)"
          strokeWidth="1.3"
        />
        {/* 6 delicate golden astrolabe spokes */}
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={-8.4}
            x2={0}
            y2={8.4}
            stroke="var(--prism-4)"
            strokeWidth="1.15"
            opacity="0.72"
            transform={`rotate(${i * 30})`}
          />
        ))}
        {/* Sculpted lavender-violet outer ring + inner specular sheen */}
        <circle
          cx={0}
          cy={0}
          r={8.4}
          fill="none"
          stroke="var(--prism-2)"
          strokeWidth="2.5"
        />
        <circle
          cx={0}
          cy={0}
          r={9.1}
          fill="none"
          stroke="var(--on-accent)"
          strokeWidth="0.65"
          opacity="0.4"
        />
        {/* 4 cardinal aqua gem studs */}
        {Array.from({ length: 4 }, (_, i) => (
          <circle
            key={i}
            cx={0}
            cy={-8.4}
            r={1.55}
            fill="var(--prism-7)"
            stroke="var(--stage-well)"
            strokeWidth="0.65"
            transform={`rotate(${i * 90})`}
          />
        ))}
        {/* Central 3D golden cabochon jewel */}
        <circle
          cx={0}
          cy={0}
          r={3.2}
          fill="var(--prism-4)"
          stroke="var(--stage-well)"
          strokeWidth="0.95"
        />
        <circle cx={-0.8} cy={-0.9} r={0.95} fill="var(--on-accent)" opacity="0.85" />
      </g>

      {/* Tilting 3D Crescent Cradle Claws & Faceted Golden Star-Compass Pointer (frames the orb cleanly without impaling it) */}
      <g transform={`translate(${LAUNCHER_X}, ${LAUNCHER_Y}) rotate(${player.aimAngle})`}>
        {/* Left & right sculpted crescent cradle arms hugging the orb */}
        <path
          d="M -15.5 3 C -17.5 -6, -13.5 -15, -6.5 -19.5 C -10.5 -13, -12.2 -5, -11.2 3 Z"
          fill="var(--prism-7)"
          stroke="var(--stage-well)"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        <path
          d="M 15.5 3 C 17.5 -6, 13.5 -15, 6.5 -19.5 C 10.5 -13, 12.2 -5, 11.2 3 Z"
          fill="var(--prism-5)"
          stroke="var(--stage-well)"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        {/* Two-tone 3D faceted golden compass lance starting outside the orb rim (y = -15 to -44) */}
        <polygon
          points="0,-46 -5.2,-33 -2.2,-31.5 -2.6,-15.5 0,-16.8"
          fill="var(--prism-4)"
          stroke="var(--stage-well)"
          strokeWidth="1.05"
          strokeLinejoin="round"
        />
        <polygon
          points="0,-46 5.2,-33 2.2,-31.5 2.6,-15.5 0,-16.8"
          fill="var(--prism-6)"
          stroke="var(--stage-well)"
          strokeWidth="1.05"
          strokeLinejoin="round"
        />
        {/* Luminous starlight gem set into the compass tip */}
        <polygon
          points="0,-40.5 2.2,-36 0,-31.5 -2.2,-36"
          fill="var(--on-accent)"
          opacity="0.9"
        />
      </g>

      {/* Active 3D Star-Orb seated cleanly in the celestial cradle */}
      {player.flying === null && player.status === 'playing' ? (
        <StarCoreSvg
          cx={LAUNCHER_X}
          cy={LAUNCHER_Y}
          color={player.currentStar}
          defsPrefix={defsPrefix}
        />
      ) : (
        <circle
          cx={LAUNCHER_X}
          cy={LAUNCHER_Y}
          r={STAR_RADIUS - 3}
          fill="var(--stage-slot)"
          stroke="var(--prism-5)"
          strokeWidth={1.2}
        />
      )}

      {/* Selectable plush companion channeling the Starlight Ring on the right */}
      <CompanionSvg
        x={LAUNCHER_X + 44}
        y={LAUNCHER_Y + 6}
        playerNumber={playerNumber}
        character={character}
        gender={gender}
        mood={mood}
        aimAngle={player.aimAngle}
        isFiring={player.flying !== null}
        onCycleCharacter={onCycleCharacter}
      />

      {/* Plain-text companion tactical callout above the companion without borders */}
      {(() => {
        const bangIdx = advice.bubbleText.indexOf('! ');
        const line1 =
          bangIdx > 0 && bangIdx < 28
            ? advice.bubbleText.slice(0, bangIdx + 1)
            : advice.bubbleText;
        const line2 =
          bangIdx > 0 && bangIdx < 28 ? advice.bubbleText.slice(bangIdx + 2) : '';
        const textFill =
          advice.kind === 'danger' || advice.kind === 'lose'
            ? 'var(--prism-1)'
            : advice.kind === 'match' || advice.kind === 'combo' || advice.kind === 'win'
              ? 'var(--prism-4)'
              : advice.kind === 'bank'
                ? 'var(--prism-2)'
                : palette.calloutText;
        return (
          <g
            className={`sb-mascot-speech sb-mascot-speech-${advice.kind}`}
            data-testid={`p${playerNumber}-mascot-speech`}
            data-advice-kind={advice.kind}
            aria-hidden="true"
          >
            <text
              x={168}
              y={line2 ? DANGER_LINE_Y - 19 : DANGER_LINE_Y - 11}
              textAnchor="middle"
              fontSize="6.6"
              fontWeight="700"
              fontFamily="var(--font-arcade-callout)"
              letterSpacing="0.04em"
              fill={textFill}
            >
              <tspan x={168} dy={0}>
                {line1}
              </tspan>
              {line2 ? (
                <tspan x={168} dy={8.5}>
                  {line2}
                </tspan>
              ) : null}
            </text>
          </g>
        );
      })()}
    </g>
  );
}

function IncomingStarsRow({ count, label }: { count: number; label: string }) {
  const orbs = decomposeGarbageOrbs(count);
  if (orbs.length === 0) return null;
  return (
    <span className="sb-orbs" role="img" aria-label={label}>
      {orbs.map((kind, i) => (
        <span key={i} className={`sb-orb sb-orb-${kind}`} />
      ))}
    </span>
  );
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

function createSnapshotFromBoard(
  board: PlayerBoardState,
  mascot: MascotSelection,
): StarlightBurstLiveSnapshot {
  return {
    grid: board.grid.map((row) => row.slice()),
    ceilingDrop: board.ceilingDrop,
    score: board.score,
    status: board.status,
    incomingGarbage: board.incomingGarbage,
    aimAngle: Math.round(board.aimAngle * 2) / 2,
    currentStar: board.currentStar,
    nextStar: board.nextStar,
    mascot,
    flying: board.flying
      ? {
          x: Math.round(board.flying.x),
          y: Math.round(board.flying.y),
          color: board.flying.color,
        }
      : null,
    lastEvent: board.lastEvent
      ? {
          id: board.lastEvent.id,
          popped: board.lastEvent.popped,
          dropped: board.lastEvent.dropped,
          risenGarbage: board.lastEvent.risenGarbage,
          sentGarbage: board.lastEvent.sentGarbage,
        }
      : null,
  };
}

function boardStateFromLiveSnapshot(snapshot: StarlightBurstLiveSnapshot): PlayerBoardState {
  return {
    grid: snapshot.grid,
    aimAngle: snapshot.aimAngle,
    currentStar: snapshot.currentStar,
    nextStar: snapshot.nextStar ?? snapshot.currentStar,
    flying: snapshot.flying
      ? { x: snapshot.flying.x, y: snapshot.flying.y, vx: 0, vy: 0, color: snapshot.flying.color }
      : null,
    score: snapshot.score,
    shotsFired: snapshot.lastEvent?.id ?? 0,
    shotsSinceDrop: 0,
    ceilingDrop: snapshot.ceilingDrop,
    ceilingWarning: false,
    attackStack: 0,
    incomingGarbage: snapshot.incomingGarbage,
    incomingQueue: [],
    shotTimerMs: 10_000,
    stageElapsedMs: 0,
    stage: 1,
    status: snapshot.status,
    lastEvent: snapshot.lastEvent
      ? {
          id: snapshot.lastEvent.id,
          popped: snapshot.lastEvent.popped,
          dropped: snapshot.lastEvent.dropped,
          risenGarbage: snapshot.lastEvent.risenGarbage,
          popScore: 0,
          dropScore: 0,
          clearBonus: 0,
          stackedGarbage: 0,
          sentGarbage: snapshot.lastEvent.sentGarbage,
        }
      : null,
  };
}

const SettledStarGridSvg = memo(function SettledStarGridSvg({
  grid,
  ceilingDrop,
  ceilingWarning,
  lastEvent,
  defsPrefix,
}: {
  grid: PlayerBoardState['grid'];
  ceilingDrop: number;
  ceilingWarning: boolean;
  lastEvent: PlayerBoardState['lastEvent'];
  defsPrefix: string;
}) {
  const stagingY = DANGER_LINE_Y + 12;
  const risenKeySet = new Set<string>(
    (lastEvent?.risenGarbage ?? []).map((cell) => `${cell.row},${cell.col}`),
  );
  return (
    <g className={ceilingWarning ? 'sb-cluster-warning' : undefined}>
      {grid.map((row, r) =>
        Array.from({ length: colsForRow(r) }, (_, c) => {
          const color = row[c];
          if (!color) return null;
          const center = starCenter(r, c, ceilingDrop);
          const coordKey = `${r},${c}`;
          const justRose = risenKeySet.has(coordKey) && lastEvent !== null;
          return (
            <StarCoreSvg
              key={justRose ? `${coordKey}-rise-${lastEvent.id}` : coordKey}
              cx={center.x}
              cy={center.y}
              color={color}
              defsPrefix={defsPrefix}
              className={justRose ? 'sb-rise-star' : undefined}
              style={
                justRose
                  ? ({ '--sb-rise-from': `${stagingY - center.y}px` } as CSSProperties)
                  : undefined
              }
            />
          );
        }),
      )}
    </g>
  );
});

function PlayerArena({
  player,
  playerNumber,
  mascot,
  onRandomizeMascot,
  isTwoPlayer,
  showTouchControls,
  remoteOpponentName,
  disabled,
  onAimStep,
  onAimDirect,
  onFire,
  onHoldAimStart,
  onHoldAimEnd,
}: {
  player: PlayerBoardState;
  playerNumber: 1 | 2;
  mascot: MascotSelection;
  onRandomizeMascot?: () => void;
  isTwoPlayer: boolean;
  showTouchControls: boolean;
  remoteOpponentName?: string | null;
  disabled: boolean;
  onAimStep?: (deltaDeg: number) => void;
  onAimDirect?: (targetAngle: number) => void;
  onFire?: () => void;
  onHoldAimStart?: (keyId: string, deltaDeg: number) => void;
  onHoldAimEnd?: (keyId: string) => void;
}) {
  const { character, gender } = mascot;
  const palette = mascotPalette(character, gender);
  const isRemote = Boolean(remoteOpponentName);
  const dragPointerIdRef = useRef<number | null>(null);
  const boardSvgRef = useRef<SVGSVGElement | null>(null);

  const aimFromPointerEvent = (event: ReactPointerEvent<Element>) => {
    if (disabled || isRemote || player.status !== 'playing' || !onAimDirect) return;
    const svgEl = boardSvgRef.current ?? event.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH;
    const svgY = ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT;
    onAimDirect(aimAngleFromBoardPoint(svgX, svgY));
  };
  const ceilingY = player.ceilingDrop * ROW_STEP;
  const polylinePoints = useMemo(() => {
    const guide = aimGuidePoints(player.aimAngle, player.ceilingDrop);
    return guide.map((pt) => `${pt.x},${pt.y}`).join(' ');
  }, [player.aimAngle, player.ceilingDrop]);
  const summary = eventSummary(player);
  const hurrySeconds = isRemote ? null : hurryCountdownSeconds(player);
  const charName = characterDisplayName(character, gender);
  const adviceStateRef = useRef<{
    advice: MascotAdvice;
    updatedAt: number;
    shotsFired: number;
    status: PlayerBoardState['status'];
    character: CharacterId;
  } | null>(null);
  const nowMs = Date.now();
  if (
    adviceStateRef.current === null ||
    adviceStateRef.current.character !== character ||
    adviceStateRef.current.status !== player.status ||
    (player.shotsFired === 0 && adviceStateRef.current.shotsFired > 0) ||
    (player.flying === null &&
      player.shotsFired !== adviceStateRef.current.shotsFired &&
      nowMs - adviceStateRef.current.updatedAt >= 10_000)
  ) {
    adviceStateRef.current = {
      advice: deriveMascotAdvice(player, character),
      updatedAt: nowMs,
      shotsFired: player.shotsFired,
      status: player.status,
      character,
    };
  }
  const advice = adviceStateRef.current.advice;

  const lastEv = player.lastEvent;
  const incomingPreview = player.incomingQueue.slice(0, 6);
  const orbList = decomposeGarbageOrbs(player.incomingGarbage);
  const gaugeX = playerNumber === 1 ? ARENA_WIDTH - 11 : 11;
  const stagingY = DANGER_LINE_Y + 12;

  const statusLine =
    player.status === 'won'
      ? `Victory! ${charName} celebrates!${summary ? ` · ${summary}` : ''}`
      : player.status === 'ko'
        ? `Oh no! ${charName} is crying...`
        : summary;

  return (
    <div
      className="sb-player-card"
      data-player={playerNumber}
      data-testid={isRemote ? 'sb-online-opponent-arena' : undefined}
    >
      {/* Studio Starlight player header (replaces 1UP/2UP arcade cabinet marquee) */}
      <div className="sb-player-header">
        <div className="sb-player-id">
          <span
            className={`sb-slot-badge sb-slot-${playerNumber}`}
            style={{ background: palette.badgeBg, color: palette.badgeFg }}
            aria-hidden="true"
          >
            {isRemote ? 'VS' : `P${playerNumber}`}
          </span>
          <span className="sb-player-title" data-testid={`p${playerNumber}-title`}>
            {isRemote ? `${remoteOpponentName} · ` : `${playerNumber}P · `}
            <span
              style={{
                color: palette.calloutText,
                textShadow: '0 1px 2px var(--stage-well), 0 0 6px var(--stage-well)',
              }}
            >
              {charName}
            </span>
          </span>
        </div>
        <div className="sb-status-pills">
          {player.incomingGarbage > 0 ? (
            <span className="badge waiting" role="status">
              ATK +{player.incomingGarbage}
            </span>
          ) : player.status !== 'playing' || player.ceilingWarning ? (
            <span
              className={player.ceilingWarning ? 'badge waiting' : 'badge'}
              data-testid={isRemote ? 'sb-opponent-status' : undefined}
            >
              {player.status === 'won'
                ? 'WINNER!'
                : player.status === 'ko'
                  ? 'KO'
                  : 'SKY DROP!'}
            </span>
          ) : isRemote ? (
            <span className="badge" data-testid="sb-opponent-status">
              LIVE
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="sb-arena-row"
        onPointerDown={(event) => {
          if (disabled || isRemote || player.status !== 'playing') return;
          dragPointerIdRef.current = event.pointerId;
          if (event.currentTarget.setPointerCapture) {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Synthetic pointer events in tests may not register an active pointer id.
            }
          }
          aimFromPointerEvent(event);
        }}
        onPointerMove={(event) => {
          if (dragPointerIdRef.current !== event.pointerId) return;
          aimFromPointerEvent(event);
        }}
        onPointerUp={(event) => {
          if (dragPointerIdRef.current === event.pointerId) {
            dragPointerIdRef.current = null;
            if (!disabled && !isRemote && player.status === 'playing') {
              aimFromPointerEvent(event);
              onFire?.();
            }
          }
        }}
        onPointerCancel={(event) => {
          if (dragPointerIdRef.current === event.pointerId) {
            dragPointerIdRef.current = null;
          }
        }}
      >
        <svg
          ref={boardSvgRef}
          className="sb-board"
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          viewBox={`0 0 ${ARENA_WIDTH} ${ARENA_HEIGHT}`}
          role="img"
          aria-label={
            isRemote
              ? `${remoteOpponentName} starlight board`
              : `Player ${playerNumber} starlight board`
          }
        >
          <defs>
            <StarOrbDefs idPrefix={`sb-p${playerNumber}`} />
            <pattern
              id={`sb-constellation-grid-${playerNumber}`}
              width={STAR_RADIUS * 2}
              height={ROW_STEP}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={STAR_RADIUS}
                cy={ROW_STEP / 2}
                r={0.85}
                fill="var(--border)"
                opacity="0.55"
              />
            </pattern>
          </defs>

          {/* Subtle constellation star-dot grid */}
          <rect
            x={0}
            y={ceilingY}
            width={ARENA_WIDTH}
            height={DANGER_LINE_Y - ceilingY}
            fill={`url(#sb-constellation-grid-${playerNumber})`}
          />

          {/* Side astral ricochet rails */}
          <rect x={0} y={0} width={3} height={ARENA_HEIGHT} fill="var(--prism-5)" opacity="0.45" />
          <rect
            x={ARENA_WIDTH - 3}
            y={0}
            width={3}
            height={ARENA_HEIGHT}
            fill="var(--prism-5)"
            opacity="0.45"
          />

          {/* Celestial Nebula Sky Veil when the constellation ceiling descends */}
          {ceilingY > 0 ? (
            <g aria-hidden="true">
              <rect
                x={0}
                y={0}
                width={ARENA_WIDTH}
                height={ceilingY}
                fill="var(--stage-surface)"
                opacity="0.92"
              />
              {Array.from({ length: 6 }, (_, i) => (
                <polygon
                  key={i}
                  points={`${22 + i * 36},${Math.max(4, ceilingY - 9)} ${24 + i * 36},${Math.max(6, ceilingY - 6)} ${22 + i * 36},${Math.max(8, ceilingY - 3)} ${20 + i * 36},${Math.max(6, ceilingY - 6)}`}
                  fill="var(--prism-4)"
                  opacity="0.8"
                />
              ))}
            </g>
          ) : null}

          <line
            x1={0}
            y1={ceilingY}
            x2={ARENA_WIDTH}
            y2={ceilingY}
            stroke="var(--prism-7)"
            strokeWidth={1.8}
          />

          {/* Horizon danger threshold above the Starlight Sling */}
          <line
            x1={0}
            y1={DANGER_LINE_Y}
            x2={ARENA_WIDTH}
            y2={DANGER_LINE_Y}
            stroke="var(--problem-border)"
            strokeWidth={1.8}
            strokeDasharray="6 4"
          />

          {/* Multi-bounce starlight trajectory guide */}
          {player.status === 'playing' ? (
            <polyline
              points={polylinePoints}
              data-testid={isRemote ? 'sb-opponent-aim' : undefined}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.9}
              strokeDasharray="3 4"
              opacity={isRemote ? 0.55 : 0.84}
            />
          ) : null}

          {/* Rising starlight motion trails */}
          {lastEv && lastEv.risenGarbage.length > 0 ? (
            <g key={`rise-trails-${lastEv.id}`} aria-hidden="true">
              {lastEv.risenGarbage.map((cell, idx) => (
                <line
                  key={`trail-${idx}`}
                  className="sb-rise-trail"
                  x1={cell.x}
                  y1={stagingY}
                  x2={cell.x}
                  y2={cell.y}
                  stroke={STAR_TOKEN[cell.color]}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              ))}
            </g>
          ) : null}

          {/* Settled hexagonal constellation grid */}
          <SettledStarGridSvg
            grid={player.grid}
            ceilingDrop={player.ceilingDrop}
            ceilingWarning={player.ceilingWarning}
            lastEvent={lastEv}
            defsPrefix={`sb-p${playerNumber}`}
          />

          {/* On-board indicator of incoming starlight orbs */}
          {player.incomingGarbage > 0 ? (
            <g
              className="sb-incoming-tray"
              data-testid={`p${playerNumber}-incoming-indicator`}
              aria-label={`${player.incomingGarbage} incoming star-cores about to rise`}
            >
              {orbList.map((orbKind, idx) => {
                const orbY = DANGER_LINE_Y - 12 - idx * 14;
                const isRed = orbKind === 'red';
                return (
                  <polygon
                    key={`orb-${idx}`}
                    points={`${gaugeX},${orbY - (isRed ? 6 : 4.5)} ${gaugeX + (isRed ? 5 : 3.8)},${orbY} ${gaugeX},${orbY + (isRed ? 6 : 4.5)} ${gaugeX - (isRed ? 5 : 3.8)},${orbY}`}
                    fill={isRed ? 'var(--prism-1)' : 'var(--prism-4)'}
                    stroke="var(--stage-well)"
                    strokeWidth="1.0"
                  />
                );
              })}

              {incomingPreview.map((color, idx) => {
                const count = incomingPreview.length;
                const span = Math.min(168, Math.max(36, (count - 1) * 28));
                const startX = LAUNCHER_X - span / 2;
                const bx = count === 1 ? LAUNCHER_X - 34 : startX + (idx * span) / (count - 1);
                return (
                  <g key={`stage-${idx}`} className="sb-incoming-preview-star">
                    <polygon
                      points={`${bx},${stagingY - 15} ${bx - 4},${stagingY - 9} ${bx + 4},${stagingY - 9}`}
                      fill="var(--problem)"
                    />
                    <StarCoreSvg
                      cx={bx}
                      cy={stagingY}
                      color={color}
                      radius={8.5}
                      defsPrefix={`sb-p${playerNumber}`}
                    />
                  </g>
                );
              })}
            </g>
          ) : null}

          {/* Starburst rings & cascading star-cores from the latest shot */}
          {lastEv && lastEv.popped.length > 0 ? (
            <g key={`fx-${lastEv.id}`} aria-hidden="true">
              {lastEv.popped.map((cell, idx) => (
                <circle
                  key={`pop-${idx}`}
                  className="sb-pop-ring"
                  cx={cell.x}
                  cy={cell.y}
                  r={STAR_RADIUS}
                  fill="none"
                  stroke={STAR_TOKEN[cell.color]}
                  strokeWidth="2.5"
                />
              ))}
              {lastEv.dropped.map((cell, idx) => (
                <StarCoreSvg
                  key={`drop-${idx}`}
                  className="sb-drop-star"
                  cx={cell.x}
                  cy={cell.y}
                  color={cell.color}
                  defsPrefix={`sb-p${playerNumber}`}
                />
              ))}
            </g>
          ) : null}

          {/* In-flight star-core */}
          {player.flying ? (
            <StarCoreSvg
              cx={player.flying.x}
              cy={player.flying.y}
              color={player.flying.color}
              defsPrefix={`sb-p${playerNumber}`}
            />
          ) : null}

          {/* Celestial Starlight Sling, orbital focus ring, on-deck star-core & companion */}
          <StarlightSlingSvg
            player={player}
            playerNumber={playerNumber}
            mascot={mascot}
            advice={advice}
            onCycleCharacter={isRemote ? undefined : onRandomizeMascot}
          />

          {/* In-board round win/lose banner */}
          {player.status !== 'playing' ? (
            <g aria-hidden="true">
              <rect
                x={28}
                y={104}
                width={ARENA_WIDTH - 56}
                height={44}
                rx={10}
                fill="var(--surface)"
                stroke="var(--text)"
                strokeWidth="2"
              />
              <rect
                x={32}
                y={108}
                width={ARENA_WIDTH - 64}
                height={36}
                rx={7}
                fill={player.status === 'won' ? 'var(--accent-weak)' : 'var(--problem-weak)'}
              />
              <text
                x={LAUNCHER_X}
                y={131}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fontFamily="var(--font-arcade-display)"
                fill={player.status === 'won' ? 'var(--accent-weak-text)' : 'var(--problem)'}
              >
                {player.status === 'won' ? '✦ STARLIGHT WIN! ✦' : '× SKY OVERFLOW ×'}
              </text>
            </g>
          ) : hurrySeconds !== null && player.status === 'playing' ? (
            <text
              x={LAUNCHER_X}
              y={ARENA_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="20"
              fontWeight="700"
              fontFamily="var(--font-arcade-display)"
              letterSpacing="0.05em"
              fill="var(--prism-1)"
              role="status"
              data-testid={`p${playerNumber}-hurry-overlay`}
            >
              HURRY UP! {hurrySeconds}
            </text>
          ) : null}
        </svg>

        <aside className="stack-side sb-side">
          <div className="stack-stat sb-score-slot">
            <span className="stack-label">Score</span>
            <span
              className="stack-value sb-score-value"
              aria-live="polite"
              data-testid={isRemote ? 'sb-opponent-score' : `p${playerNumber}-score`}
            >
              {player.score.toLocaleString()}
            </span>
          </div>

          <div className="stack-stat sb-next-dome">
            <span className="stack-label">Next</span>
            <div className="sb-next-orb-well">
              <svg
                width={STAR_RADIUS * 2 + 6}
                height={STAR_RADIUS * 2 + 6}
                viewBox={`0 0 ${STAR_RADIUS * 2 + 10} ${STAR_RADIUS * 2 + 10}`}
                aria-label={`Player ${playerNumber} next star ${player.nextStar}`}
              >
                <defs>
                  <StarOrbDefs idPrefix={`sb-next-p${playerNumber}`} />
                </defs>
                <StarCoreSvg
                  cx={STAR_RADIUS + 5}
                  cy={STAR_RADIUS + 5}
                  color={player.nextStar}
                  defsPrefix={`sb-next-p${playerNumber}`}
                />
              </svg>
            </div>
          </div>

          <span className="sr-only" data-testid={`p${playerNumber}-aim`}>
            {formatAimAngle(player.aimAngle)}
          </span>
          <span className="sr-only" data-testid={`p${playerNumber}-shots`}>
            {player.shotsFired}
          </span>

          {isTwoPlayer ? (
            <div className="stack-stat">
              <span className="stack-label">Warn</span>
              <span className="sb-stat-small" data-testid={`p${playerNumber}-incoming`}>
                {player.incomingGarbage}
                <IncomingStarsRow
                  count={player.incomingGarbage}
                  label={`${player.incomingGarbage} incoming star-cores`}
                />
              </span>
            </div>
          ) : null}

          <span className="sr-only" role={statusLine || hurrySeconds !== null ? 'status' : undefined}>
            {hurrySeconds !== null
              ? `HURRY! ${hurrySeconds}s`
              : statusLine ?? (player.ceilingWarning ? 'SKY DROP!' : `STAGE ${player.stage}`)}
          </span>
        </aside>
      </div>

      {/* Touch gamepad controls on coarse pointers (#212, #217) */}
      {showTouchControls && !isRemote ? (
        <div
          className="sb-touch-controls"
          data-testid={`p${playerNumber}-touch-controls`}
          role="group"
          aria-label={`Player ${playerNumber} touch controls`}
        >
          <button
            type="button"
            className="touch-pad-btn"
            data-testid={`p${playerNumber}-touch-left`}
            aria-label={`Player ${playerNumber} aim left`}
            disabled={disabled || player.status !== 'playing'}
            onPointerDown={(e) => {
              e.preventDefault();
              onHoldAimStart?.(`p${playerNumber}-left`, -AIM_STEP_DEG);
            }}
            onPointerUp={() => onHoldAimEnd?.(`p${playerNumber}-left`)}
            onPointerCancel={() => onHoldAimEnd?.(`p${playerNumber}-left`)}
            onPointerLeave={() => onHoldAimEnd?.(`p${playerNumber}-left`)}
            onClick={() => onAimStep?.(-AIM_STEP_DEG)}
          >
            ◀
          </button>
          <button
            type="button"
            className="touch-pad-btn is-primary"
            data-testid={`p${playerNumber}-touch-fire`}
            aria-label={`Player ${playerNumber} launch star`}
            disabled={disabled || player.status !== 'playing'}
            onClick={() => onFire?.()}
          >
            LAUNCH
          </button>
          <button
            type="button"
            className="touch-pad-btn"
            data-testid={`p${playerNumber}-touch-right`}
            aria-label={`Player ${playerNumber} aim right`}
            disabled={disabled || player.status !== 'playing'}
            onPointerDown={(e) => {
              e.preventDefault();
              onHoldAimStart?.(`p${playerNumber}-right`, AIM_STEP_DEG);
            }}
            onPointerUp={() => onHoldAimEnd?.(`p${playerNumber}-right`)}
            onPointerCancel={() => onHoldAimEnd?.(`p${playerNumber}-right`)}
            onPointerLeave={() => onHoldAimEnd?.(`p${playerNumber}-right`)}
            onClick={() => onAimStep?.(AIM_STEP_DEG)}
          >
            ▶
          </button>
        </div>
      ) : null}
    </div>
  );
}

const COUNTDOWN_READY_MS =
  typeof navigator !== 'undefined' && navigator.webdriver ? 180 : 950;
const COUNTDOWN_GO_MS =
  typeof navigator !== 'undefined' && navigator.webdriver ? 140 : 600;

const PHONE_PORTRAIT_MAX_WIDTH = 560;
const PHONE_LANDSCAPE_MAX_WIDTH = 900;
const PHONE_LANDSCAPE_MAX_HEIGHT = 440;

function isPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < PHONE_PORTRAIT_MAX_WIDTH) return true;
  if (w < PHONE_LANDSCAPE_MAX_WIDTH && h < PHONE_LANDSCAPE_MAX_HEIGHT) return true;
  return false;
}

function detectTouchAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (isPhoneViewport()) return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return true;
  return false;
}

function hasKeyboardAvailable(): boolean {
  if (typeof window === 'undefined') return true;
  if (isPhoneViewport()) return false;
  if (typeof window.matchMedia === 'function') {
    const coarseOnly =
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(any-pointer: fine)').matches;
    if (coarseOnly && window.innerWidth < 768) return false;
  }
  return true;
}

export function StarlightBurstView({ onExit }: { onExit: () => void }) {
  const [phoneViewport, setPhoneViewport] = useState<boolean>(() => isPhoneViewport());
  const touchSeenRef = useRef<boolean>(detectTouchAvailable());
  const [touchAvailable, setTouchAvailable] = useState<boolean>(() => touchSeenRef.current);
  const [keyboardAvailable, setKeyboardAvailable] = useState<boolean>(() => hasKeyboardAvailable());
  const [match, setMatch] = useState<StarlightBurstMatch>(() =>
    createMatch(isPhoneViewport() ? '1p' : '2p'),
  );
  const [mascots, setMascots] = useState<[MascotSelection, MascotSelection]>(() =>
    createRandomMascotPair(),
  );
  const [stagePreset, setStagePreset] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(() => getSharedGamePaused());
  const [musicOn, setMusicOn] = useState<boolean>(() => getSharedMusicOn());
  const [sfxOn, setSfxOn] = useState<boolean>(() => getSharedSfxOn());
  const [backgroundIndex, setBackgroundIndex] = useState(1);
  const [nowPlaying, setNowPlaying] = useState<string | null>(
    () => getSharedArcadeAudio().getCurrentTrack()?.title ?? null,
  );
  const [netplay, setNetplay] = useState<NetplayState>(() => getSharedNetplay().getState());
  const [opponentSnapshot, setOpponentSnapshot] = useState<StarlightBurstLiveSnapshot>(() =>
    createSnapshotFromBoard(match.players[0], mascots[1]),
  );
  const [countdown, setCountdown] = useState<number>(2);
  const [countdownKey, setCountdownKey] = useState<number>(0);
  const [countdownLang, setCountdownLang] = useState<CountdownLanguage>(() =>
    pickCountdownLanguage(),
  );
  const pauseMenuRef = useRef<HTMLDivElement | null>(null);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState<number>(20);
  const [overlayOpen, setOverlayOpen] = useState<boolean>(() => getSharedOverlayOpen());

  useEffect(() => {
    const unsubPause = subscribeSharedGamePause((nextPaused) => {
      setPaused(nextPaused);
    });
    const unsubOverlay = subscribeSharedOverlayOpen((nextOpen) => {
      setOverlayOpen(nextOpen);
      if (nextOpen) {
        heldAimKeysRef.current.clear();
      }
    });
    return () => {
      unsubPause();
      unsubOverlay();
      setSharedGamePaused(false);
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touchSeenRef.current = true;
        setTouchAvailable(true);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const matchRef = useRef(match);
  matchRef.current = match;
  const mascotsRef = useRef(mascots);
  mascotsRef.current = mascots;
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;
  const handleNextOrNewRoundRef = useRef<() => void>(() => {});
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomStartedRef = useRef<string | null>(null);
  const onlineOutcomeSentRef = useRef<boolean>(false);
  const heldAimKeysRef = useRef<Map<string, number>>(new Map());
  const gameSectionRef = useRef<HTMLElement>(null);
  const prevShotsRef = useRef<[number, number]>([0, 0]);
  const prevEventIdsRef = useRef<[number, number]>([0, 0]);
  const prevMatchStatusRef = useRef(match.status);

  const activeSbRoom =
    netplay.activeRoom && netplay.activeRoom.gameId === 'starlight-burst'
      ? netplay.activeRoom
      : null;
  const isOnline2P = activeSbRoom !== null;
  const isReadyCheck = activeSbRoom?.status === 'ready_check';
  const isNetworkPaused = Boolean(
    isOnline2P &&
      activeSbRoom?.status === 'playing' &&
      activeSbRoom?.syncStatus === 'paused',
  );
  const syncSecondsLeft = Math.max(
    0,
    Math.ceil((activeSbRoom?.syncRemainingMs ?? 15_000) / 1000),
  );
  const isInviting = netplay.myPendingInvite?.gameId === 'starlight-burst';
  const myRoomPlayer = activeSbRoom?.players.find((p) => p.id === netplay.clientId);
  const myReady = Boolean(myRoomPlayer?.ready);
  const oppReady = Boolean(activeSbRoom?.opponent?.ready);

  const lastSnapshotDigestRef = useRef<string>('');
  useEffect(() => {
    if (!isOnline2P || isReadyCheck) {
      lastSnapshotDigestRef.current = '';
      return undefined;
    }
    const pushSnapshot = () => {
      const p0 = matchRef.current.players[0];
      if (!p0) return;
      const snap = createSnapshotFromBoard(p0, mascotsRef.current[0]);
      const digest = JSON.stringify(snap);
      if (digest === lastSnapshotDigestRef.current) return;
      lastSnapshotDigestRef.current = digest;
      void getSharedNetplay().sendRoomEvent('starlight_state', snap);
    };
    pushSnapshot();
    const id = window.setInterval(pushSnapshot, 500);
    return () => window.clearInterval(id);
  }, [isOnline2P, isReadyCheck]);

  const triggerFreshCountdown = useCallback(() => {
    setCountdownLang(pickCountdownLanguage());
    setCountdown(2);
    setCountdownKey((k) => k + 1);
  }, []);

  const startOnlineRoundWithSeed = useCallback(
    (seed: number, resetWins: boolean, preset = 0) => {
      const rng = mulberry32(seed);
      const grid = preset > 0 ? createStageGrid(preset, rng) : createMatch('1p', rng).players[0].grid;
      const board = createPlayerBoard(rng, grid, preset > 0 ? preset : 1);
      prevShotsRef.current = [0, 0];
      prevEventIdsRef.current = [0, 0];
      prevMatchStatusRef.current = 'playing';
      onlineOutcomeSentRef.current = false;
      setMatch((cur) => ({
        mode: '1p',
        players: [board],
        status: 'playing',
        winner: null,
        wins: resetWins ? [0, 0] : cur.wins,
      }));
      setOpponentSnapshot(createSnapshotFromBoard(board, mascotsRef.current[1]));
      triggerFreshCountdown();
      setSharedGamePaused(false);
    },
    [triggerFreshCountdown],
  );

  useEffect(() => {
    const invite = netplay.myPendingInvite;
    if (!invite || invite.gameId !== 'starlight-burst') {
      setInviteSecondsLeft(20);
      return;
    }
    const updateTimer = () => {
      const elapsed = Date.now() - invite.createdAt;
      const rem = Math.max(0, Math.ceil((INVITE_TIMEOUT_MS - elapsed) / 1000));
      setInviteSecondsLeft(rem);
      if (rem <= 0) {
        void getSharedNetplay().cancelInvite();
      }
    };
    updateTimer();
    const id = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(id);
  }, [netplay.myPendingInvite]);

  useEffect(() => {
    const client = getSharedNetplay();
    const unsubState = client.subscribe((nextState) => {
      setNetplay(nextState);
      const room =
        nextState.activeRoom && nextState.activeRoom.gameId === 'starlight-burst'
          ? nextState.activeRoom
          : null;
      if (room && activeRoomIdRef.current !== room.id) {
        activeRoomIdRef.current = room.id;
        setSharedGamePaused(false);
        if (room.status === 'playing' && activeRoomStartedRef.current !== room.id) {
          activeRoomStartedRef.current = room.id;
          startOnlineRoundWithSeed(room.seed, true, 0);
        }
      } else if (
        room &&
        room.status === 'playing' &&
        activeRoomStartedRef.current !== room.id
      ) {
        activeRoomStartedRef.current = room.id;
        startOnlineRoundWithSeed(room.seed, true, 0);
      } else if (!room && activeRoomIdRef.current !== null) {
        activeRoomIdRef.current = null;
        activeRoomStartedRef.current = null;
      }
    });

    const unsubEvents = client.onRoomEvent((event) => {
      if (event.kind === 'match_start') {
        const payload = event.payload as { gameId?: string; seed?: number; id?: string; roomId?: string } | null;
        if (payload && payload.gameId === 'starlight-burst') {
          const rid = payload.id ?? payload.roomId ?? null;
          if (rid && activeRoomStartedRef.current !== rid) {
            activeRoomIdRef.current = rid;
            activeRoomStartedRef.current = rid;
            startOnlineRoundWithSeed(payload.seed ?? 2026, true, 0);
          }
        }
        return;
      }

      if (event.kind === 'sync_timeout') {
        void client.leaveRoom();
        onExit();
        return;
      }

      if (event.senderId === client.getState().clientId) return;

      if (event.kind === 'starlight_attack') {
        const payload = event.payload as { count?: number; colors?: StarColor[] } | null;
        const colors = Array.isArray(payload?.colors)
          ? payload.colors
          : generateGarbageColors(payload?.count ?? 2, () => 0.3);
        if (colors.length > 0) {
          setMatch((current) => {
            const p0 = current.players[0];
            if (!p0 || p0.status !== 'playing') return current;
            const updated = queueIncomingGarbage(p0, colors);
            return { ...current, players: [updated] };
          });
        }
        return;
      }

      if (event.kind === 'starlight_state') {
        const snapshot = event.payload as StarlightBurstLiveSnapshot | null;
        if (snapshot && Array.isArray(snapshot.grid)) {
          setOpponentSnapshot(snapshot);
        }
        return;
      }

      if (event.kind === 'starlight_outcome') {
        const payload = event.payload as { outcome?: 'cleared' | 'ko' } | null;
        if (payload?.outcome === 'ko') {
          setOpponentSnapshot((prev) => ({ ...prev, status: 'ko' }));
          setMatch((current) => {
            if (current.status === 'round_over') return current;
            return resolveMatchOutcome(current, 0);
          });
        } else if (payload?.outcome === 'cleared') {
          setOpponentSnapshot((prev) => ({ ...prev, status: 'won' }));
          setMatch((current) => {
            if (current.status === 'round_over') return current;
            return resolveMatchOutcome(current, 1);
          });
        }
        return;
      }

      if (event.kind === 'starlight_rematch') {
        const payload = event.payload as { seed?: number; preset?: number } | null;
        const nextPreset = typeof payload?.preset === 'number' ? payload.preset : stagePreset;
        if (nextPreset !== stagePreset) setStagePreset(nextPreset);
        startOnlineRoundWithSeed(payload?.seed ?? Date.now(), false, nextPreset);
      }
    });

    const cur = client.getState();
    if (cur.activeRoom && cur.activeRoom.gameId === 'starlight-burst') {
      activeRoomIdRef.current = cur.activeRoom.id;
      if (cur.activeRoom.status === 'playing') {
        activeRoomStartedRef.current = cur.activeRoom.id;
        startOnlineRoundWithSeed(cur.activeRoom.seed, true, 0);
      }
    }

    return () => {
      unsubState();
      unsubEvents();
    };
  }, [onExit, stagePreset, startOnlineRoundWithSeed]);

  useEffect(() => {
    const audio = getSharedArcadeAudio();
    audio.setPlaylist(STARLIGHT_BURST_PLAYLIST);
    audio.setActive(getSharedMusicOn() && !paused);
    const unsubscribe = subscribeSharedAudio((enabled, trackTitle, nextSfxOn) => {
      setMusicOn(enabled);
      setNowPlaying(trackTitle);
      setSfxOn(nextSfxOn);
    });
    return () => {
      unsubscribe();
    };
  }, [paused]);

  useEffect(() => {
    if (paused || isReadyCheck || isInviting || isNetworkPaused || countdown <= 0) {
      return undefined;
    }
    const audio = getSharedArcadeAudio();
    if (countdown === 2) {
      audio.playCountdownPhrase(countdownLang, 'ready');
      const id = window.setTimeout(() => {
        setCountdown(1);
      }, COUNTDOWN_READY_MS);
      return () => window.clearTimeout(id);
    }
    audio.playCountdownPhrase(countdownLang, 'go');
    const id = window.setTimeout(() => {
      setCountdown(0);
    }, COUNTDOWN_GO_MS);
    return () => window.clearTimeout(id);
  }, [countdown, countdownKey, countdownLang, isInviting, isNetworkPaused, isReadyCheck, paused]);

  useEffect(() => {
    const audio = getSharedArcadeAudio();
    for (let i = 0; i < match.players.length; i += 1) {
      const p = match.players[i];
      if (!p) continue;
      if (p.flying !== null && prevShotsRef.current[i] === 0) {
        prevShotsRef.current[i] = 1;
        audio.sfx.playStarShoot();
      } else if (p.flying === null) {
        prevShotsRef.current[i] = 0;
      }

      const ev = p.lastEvent;
      if (ev && ev.id !== prevEventIdsRef.current[i]) {
        prevEventIdsRef.current[i] = ev.id;
        if (ev.popped.length > 0) {
          audio.sfx.playStarBurst(ev.popped.length, ev.dropped.length);
        }
        const onlineAttack = Math.min(
          12,
          Math.max(0, ev.popped.length - 3) + ev.dropped.length,
        );
        if (ev.sentGarbage > 0 || (isOnline2P && onlineAttack > 0)) {
          audio.sfx.playGarbageSend(isOnline2P ? onlineAttack : ev.sentGarbage);
        }
        if (ev.risenGarbage.length > 0) {
          audio.sfx.playGarbageRise(ev.risenGarbage.length);
        }

        if (isOnline2P && i === 0) {
          if (onlineAttack > 0) {
            const colors = generateGarbageColors(onlineAttack);
            void getSharedNetplay().sendRoomEvent('starlight_attack', {
              count: onlineAttack,
              colors,
            });
          }
          if (ev.clearBonus > 0 && !onlineOutcomeSentRef.current) {
            onlineOutcomeSentRef.current = true;
            void getSharedNetplay().sendRoomEvent('starlight_outcome', { outcome: 'cleared' });
            setOpponentSnapshot((prev) => ({ ...prev, status: 'ko' }));
            setMatch((cur) => (cur.status === 'round_over' ? cur : resolveMatchOutcome(cur, 0)));
          }
          void getSharedNetplay().sendRoomEvent(
            'starlight_state',
            createSnapshotFromBoard(p, mascotsRef.current[0]),
          );
        }
      } else if (!ev) {
        prevEventIdsRef.current[i] = 0;
      }
    }

    const p0 = match.players[0];
    if (isOnline2P && p0 && p0.status === 'ko' && !onlineOutcomeSentRef.current) {
      onlineOutcomeSentRef.current = true;
      void getSharedNetplay().sendRoomEvent('starlight_outcome', { outcome: 'ko' });
      void getSharedNetplay().sendRoomEvent(
        'starlight_state',
        createSnapshotFromBoard(p0, mascotsRef.current[0]),
      );
      setOpponentSnapshot((prev) => ({ ...prev, status: 'won' }));
      setMatch((cur) => (cur.status === 'round_over' ? cur : resolveMatchOutcome(cur, 1)));
    }

    if (match.status === 'round_over' && prevMatchStatusRef.current !== 'round_over') {
      prevMatchStatusRef.current = 'round_over';
      audio.sfx.playRoundEnd(match.winner !== null);
    } else if (match.status === 'playing') {
      prevMatchStatusRef.current = 'playing';
    }
  }, [isOnline2P, match]);

  const anyFlying = match.players.some((p) => p?.flying !== null);

  useEffect(() => {
    if (paused || isReadyCheck || isInviting || isNetworkPaused || countdown > 0 || match.status !== 'playing' || !anyFlying) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setMatch((current) => stepMatch(current));
    }, 16);
    return () => window.clearInterval(id);
  }, [anyFlying, countdown, isInviting, isNetworkPaused, isReadyCheck, match.status, paused]);

  useEffect(() => {
    if (paused || isReadyCheck || isInviting || isNetworkPaused || countdown > 0 || match.status !== 'playing') {
      return undefined;
    }
    const id = window.setInterval(() => {
      setMatch((current) => tickShotTimers(current, 100));
    }, 100);
    return () => window.clearInterval(id);
  }, [countdown, isInviting, isNetworkPaused, isReadyCheck, match.status, paused]);

  useEffect(() => {
    function onInstantResolve(event: Event) {
      const detail = (
        event as CustomEvent<{
          player?: 0 | 1;
          preventPop?: boolean;
          forceClusterPop?: boolean;
          clearStage?: boolean;
        }>
      ).detail;
      const idx: 0 | 1 = detail?.player === 1 ? 1 : 0;
      setMatch((current) => {
        if (detail?.clearStage) {
          const target = current.players[idx];
          if (target) {
            const emptyGrid = target.grid.map((r) => r.map(() => null as StarColor | null));
            const color = target.currentStar;
            emptyGrid[0][3] = color;
            emptyGrid[0][4] = color;
            const updatedTarget: PlayerBoardState = { ...target, aimAngle: 0, grid: emptyGrid };
            const nextPlayers =
              current.players.length === 1
                ? ([updatedTarget] as [PlayerBoardState])
                : idx === 0
                  ? ([updatedTarget, current.players[1]] as [PlayerBoardState, PlayerBoardState])
                  : ([current.players[0], updatedTarget] as [PlayerBoardState, PlayerBoardState]);
            return fireAndResolvePlayer({ ...current, players: nextPlayers }, idx);
          }
        }
        if (detail?.forceClusterPop) {
          const target = current.players[idx];
          if (target) {
            const popGrid = target.grid.map((r) => r.slice());
            const color = target.currentStar;
            for (let r = 0; r < 3; r += 1) {
              for (let c = 0; c < popGrid[r].length; c += 1) {
                if (popGrid[r][c] === null) popGrid[r][c] = color === 'ruby' ? 'azure' : 'ruby';
              }
            }
            popGrid[3][2] = color;
            popGrid[3][3] = color;
            popGrid[3][4] = color;
            popGrid[2][3] = color;
            for (let r = 4; r < popGrid.length; r += 1) {
              for (let c = 0; c < popGrid[r].length; c += 1) {
                popGrid[r][c] = null;
              }
            }
            const updatedTarget: PlayerBoardState = { ...target, aimAngle: 0, grid: popGrid };
            const nextPlayers =
              current.players.length === 1
                ? ([updatedTarget] as [PlayerBoardState])
                : idx === 0
                  ? ([updatedTarget, current.players[1]] as [PlayerBoardState, PlayerBoardState])
                  : ([current.players[0], updatedTarget] as [PlayerBoardState, PlayerBoardState]);
            return fireAndResolvePlayer({ ...current, players: nextPlayers }, idx);
          }
        }
        if (detail?.preventPop) {
          const target = current.players[idx];
          if (target) {
            const safeGrid = target.grid.map((r) => r.slice());
            for (let r = 2; r < safeGrid.length; r += 1) {
              for (let c = 2; c <= 5 && c < safeGrid[r].length; c += 1) {
                if (safeGrid[r][c] === target.currentStar) {
                  safeGrid[r][c] = target.currentStar === 'ruby' ? 'azure' : 'ruby';
                }
              }
            }
            const nextPlayers =
              current.players.length === 1
                ? ([{ ...target, grid: safeGrid }] as [PlayerBoardState])
                : idx === 0
                  ? ([{ ...target, grid: safeGrid }, current.players[1]] as [
                      PlayerBoardState,
                      PlayerBoardState,
                    ])
                  : ([current.players[0], { ...target, grid: safeGrid }] as [
                      PlayerBoardState,
                      PlayerBoardState,
                    ]);
            return fireAndResolvePlayer({ ...current, players: nextPlayers }, idx);
          }
        }
        return fireAndResolvePlayer(current, idx);
      });
    }
    function onQueueGarbage(event: Event) {
      const detail = (event as CustomEvent<{ player?: 0 | 1; count?: number; colors?: StarColor[] }>).detail;
      const idx: 0 | 1 = detail?.player === 1 ? 1 : 0;
      const colors = detail?.colors ?? generateGarbageColors(detail?.count ?? 3, () => 0.2);
      setMatch((current) => {
        const target = current.players[idx];
        if (!target) return current;
        const updated = queueIncomingGarbage(target, colors);
        if (current.players.length === 1) return { ...current, players: [updated] };
        return {
          ...current,
          players: idx === 0 ? [updated, current.players[1]] : [current.players[0], updated],
        };
      });
    }
    function onRoundOutcome(event: Event) {
      const detail = (event as CustomEvent<{ winner?: 0 | 1 | null }>).detail;
      const winner: 0 | 1 | null =
        detail?.winner === 0 ? 0 : detail?.winner === 1 ? 1 : null;
      setMatch((current) => resolveMatchOutcome(current, winner));
    }
    function onSetMascot(event: Event) {
      const detail = (
        event as CustomEvent<{
          player?: 0 | 1;
          character?: CharacterId;
          gender?: MascotGender;
        }>
      ).detail;
      const idx: 0 | 1 = detail?.player === 1 ? 1 : 0;
      const character: CharacterId =
        detail?.character === 'cat' ||
        detail?.character === 'dog' ||
        detail?.character === 'bunny'
          ? detail.character
          : 'fox';
      const gender: MascotGender = detail?.gender === 'girl' ? 'girl' : 'boy';
      setMascots((prev) =>
        idx === 0 ? [{ character, gender }, prev[1]] : [prev[0], { character, gender }],
      );
    }
    window.addEventListener('yolo:starlight:fire-resolve', onInstantResolve);
    window.addEventListener('yolo:starlight:queue-garbage', onQueueGarbage);
    window.addEventListener('yolo:starlight:round-outcome', onRoundOutcome);
    window.addEventListener('yolo:starlight:set-mascot', onSetMascot);
    return () => {
      window.removeEventListener('yolo:starlight:fire-resolve', onInstantResolve);
      window.removeEventListener('yolo:starlight:queue-garbage', onQueueGarbage);
      window.removeEventListener('yolo:starlight:round-outcome', onRoundOutcome);
      window.removeEventListener('yolo:starlight:set-mascot', onSetMascot);
    };
  }, []);

  const startNewRound = useCallback(
    (mode: '2p' | '1p', keepWins = true, preset = stagePreset, unpause = true) => {
      prevShotsRef.current = [0, 0];
      prevEventIdsRef.current = [0, 0];
      prevMatchStatusRef.current = 'playing';
      if (!keepWins) {
        setMascots(createRandomMascotPair());
      }
      setMatch((current) => {
        const wins: [number, number] = keepWins ? current.wins : [0, 0];
        if (preset > 0) {
          const grid = createStageGrid(preset);
          const first = createPlayerBoard(Math.random, grid, preset);
          if (mode === '1p') {
            return { mode: '1p', players: [first], status: 'playing', winner: null, wins };
          }
          const second: PlayerBoardState = { ...first, grid: grid.map((r) => r.slice()), lastEvent: null };
          return { mode: '2p', players: [first, second], status: 'playing', winner: null, wins };
        }
        const nextStage =
          mode === '1p' && keepWins && current.status === 'round_over' && current.winner === 0
            ? ((current.players[0]?.stage ?? 1) % TOTAL_STAGES) + 1
            : 1;
        if (nextStage > 1) {
          const grid = createStageGrid(nextStage, Math.random);
          const first = createPlayerBoard(Math.random, grid, nextStage);
          return { mode: '1p', players: [first], status: 'playing', winner: null, wins };
        }
        return createMatch(mode, Math.random, wins);
      });
      triggerFreshCountdown();
      if (unpause) {
        setSharedGamePaused(false);
        if (getSharedMusicOn()) {
          getSharedArcadeAudio().ensureContext();
        }
        getSharedArcadeAudio().startNewGameTrack();
      }
      setBackgroundIndex((index) => nextBackgroundIndex(index));
    },
    [stagePreset, triggerFreshCountdown],
  );

  useEffect(() => {
    function onResize() {
      const phone = isPhoneViewport();
      if (detectTouchAvailable()) touchSeenRef.current = true;
      setTouchAvailable(touchSeenRef.current || detectTouchAvailable());
      setKeyboardAvailable(hasKeyboardAvailable());
      setPhoneViewport((prevPhone) => {
        if (phone && matchRef.current.mode === '2p') {
          startNewRound('1p', false, stagePreset, false);
        } else if (!phone && prevPhone && matchRef.current.mode === '1p') {
          startNewRound('2p', false, stagePreset, false);
        }
        return phone;
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [stagePreset, startNewRound]);

  const handleHoldAimStart = useCallback(
    (playerIndex: 0 | 1, keyId: string, deltaDeg: number) => {
      if (paused || countdownRef.current > 0 || matchRef.current.status !== 'playing') return;
      const held = heldAimKeysRef.current;
      if (!held.has(keyId)) {
        held.set(keyId, performance.now());
        setMatch((current) => aimPlayer(current, playerIndex, deltaDeg));
      }
    },
    [paused],
  );

  const handleHoldAimEnd = useCallback((keyId: string) => {
    heldAimKeysRef.current.delete(keyId);
  }, []);

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
  }, [paused, overlayOpen, isReadyCheck, isInviting, isNetworkPaused]);

  useEffect(() => {
    const held = heldAimKeysRef.current;

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
        matchRef.current.status === 'round_over'
      ) {
        if (
          !event.repeat &&
          (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')
        ) {
          event.preventDefault();
          event.stopPropagation();
          handleNextOrNewRoundRef.current();
        }
        return;
      }
      if (
        paused ||
        isReadyCheck ||
        isInviting ||
        isNetworkPaused ||
        countdownRef.current > 0 ||
        matchRef.current.status !== 'playing'
      ) {
        return;
      }

      const is2P = matchRef.current.mode === '2p';
      const p2Index: 0 | 1 = is2P ? 1 : 0;

      switch (event.key) {
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
          setMatch((current) => firePlayerStar(current, 0));
          break;

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
          setMatch((current) => firePlayerStar(current, p2Index));
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

    let rafId = 0;
    let lastFrame = performance.now();
    const tapGraceMs = 75;

    function tickAim(now: number) {
      const dtSec = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;

      if (
        !paused &&
        !isReadyCheck &&
        !isInviting &&
        !isNetworkPaused &&
        countdownRef.current <= 0 &&
        matchRef.current.status === 'playing' &&
        held.size > 0 &&
        dtSec > 0
      ) {
        const is2P = matchRef.current.mode === '2p';
        const p2Index: 0 | 1 = is2P ? 1 : 0;

        let p1Delta = 0;
        let p2Delta = 0;

        const aStart = held.get('a');
        if (aStart !== undefined && now - aStart >= tapGraceMs) {
          p1Delta -= aimVelocityDegPerSec(now - aStart) * dtSec;
        }
        const dStart = held.get('d');
        if (dStart !== undefined && now - dStart >= tapGraceMs) {
          p1Delta += aimVelocityDegPerSec(now - dStart) * dtSec;
        }
        const p1TouchLeft = held.get('p1-left');
        if (p1TouchLeft !== undefined && now - p1TouchLeft >= tapGraceMs) {
          p1Delta -= aimVelocityDegPerSec(now - p1TouchLeft) * dtSec;
        }
        const p1TouchRight = held.get('p1-right');
        if (p1TouchRight !== undefined && now - p1TouchRight >= tapGraceMs) {
          p1Delta += aimVelocityDegPerSec(now - p1TouchRight) * dtSec;
        }
        const leftStart = held.get('ArrowLeft');
        if (leftStart !== undefined && now - leftStart >= tapGraceMs) {
          p2Delta -= aimVelocityDegPerSec(now - leftStart) * dtSec;
        }
        const rightStart = held.get('ArrowRight');
        if (rightStart !== undefined && now - rightStart >= tapGraceMs) {
          p2Delta += aimVelocityDegPerSec(now - rightStart) * dtSec;
        }
        const p2TouchLeft = held.get('p2-left');
        if (p2TouchLeft !== undefined && now - p2TouchLeft >= tapGraceMs) {
          p2Delta -= aimVelocityDegPerSec(now - p2TouchLeft) * dtSec;
        }
        const p2TouchRight = held.get('p2-right');
        if (p2TouchRight !== undefined && now - p2TouchRight >= tapGraceMs) {
          p2Delta += aimVelocityDegPerSec(now - p2TouchRight) * dtSec;
        }

        if (p1Delta !== 0 || p2Delta !== 0) {
          setMatch((current) => {
            let next = current;
            if (p1Delta !== 0) next = aimPlayer(next, 0, p1Delta);
            if (p2Delta !== 0) next = aimPlayer(next, p2Index, p2Delta);
            return next;
          });
        }
      }

      rafId = window.requestAnimationFrame(tickAim);
    }

    rafId = window.requestAnimationFrame(tickAim);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isInviting, isNetworkPaused, isReadyCheck, onExit, paused]);

  const art = BACKGROUNDS[backgroundIndex] ?? BACKGROUNDS[0];

  const handleNextOrNewRound = () => {
    const nextPreset =
      match.status === 'round_over' && stagePreset > 0
        ? (stagePreset % TOTAL_STAGES) + 1
        : stagePreset;
    if (nextPreset !== stagePreset) {
      setStagePreset(nextPreset);
    }
    if (isOnline2P) {
      const nextSeed = ((Date.now() & 0x7fffffff) ^ 0x6a09e667) >>> 0 || 2026;
      startOnlineRoundWithSeed(nextSeed, false, nextPreset);
      void getSharedNetplay().sendRoomEvent('starlight_rematch', {
        seed: nextSeed,
        preset: nextPreset,
      });
    } else {
      startNewRound(match.mode, true, nextPreset);
    }
  };
  handleNextOrNewRoundRef.current = handleNextOrNewRound;

  const canSelectLocal2P = !phoneViewport && keyboardAvailable;
  const canSelectOnline2P = netplay.onlineCount > 1 || isOnline2P || isInviting;

  const onlineOpponentBoard = useMemo(
    () => boardStateFromLiveSnapshot(opponentSnapshot),
    [opponentSnapshot],
  );
  const onlineOpponentMascot: MascotSelection = useMemo(() => {
    if (
      opponentSnapshot.mascot &&
      opponentSnapshot.mascot.character !== mascots[0].character
    ) {
      return opponentSnapshot.mascot;
    }
    return mascots[1];
  }, [mascots, opponentSnapshot.mascot]);

  return (
    <section
      className="stack-stage sb-game"
      data-mode={isOnline2P ? '2p' : match.mode}
      aria-label="Starlight Burst game"
      ref={gameSectionRef}
    >
      <div className="stack-art" aria-hidden="true">
        <img className="stack-art-layer is-current" src={art.src} alt="" aria-hidden="true" />
      </div>

      <header className="stack-header sb-header">
        <div className="row">
          <h2 className="stack-title">Starlight Burst</h2>
          {isOnline2P && activeSbRoom ? (
            <span className="sb-tally" data-testid="sb-online-tally" aria-label="Online round wins">
              YOU {match.wins[0]} – {match.wins[1]} {activeSbRoom.opponent.name}
            </span>
          ) : match.mode === '2p' ? (
            <span className="sb-tally" aria-label="Round wins">
              1P {match.wins[0]} – {match.wins[1]} 2P
            </span>
          ) : null}
          <p className="stack-scene sr-only" aria-live="polite">
            Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {art.title}
            {musicOn && nowPlaying ? ` · Music: ${nowPlaying}` : ''}
          </p>
        </div>
      </header>

      {/* Symmetric side-by-side stages for BOTH Local 2P and Online 2P (#352) */}
      <div className="stack-body sb-boards">
        <PlayerArena
          player={match.players[0]}
          playerNumber={1}
          mascot={mascots[0]}
          onRandomizeMascot={() =>
            setMascots(([p1, p2]) => [pickRandomOtherMascot(p1, p2.character), p2])
          }
          isTwoPlayer={match.mode === '2p' || isOnline2P}
          showTouchControls={touchAvailable}
          disabled={
            paused ||
            isReadyCheck ||
            isInviting ||
            isNetworkPaused ||
            countdown > 0 ||
            match.status !== 'playing'
          }
          onAimStep={(delta) => {
            setMatch((current) => aimPlayer(current, 0, delta));
          }}
          onAimDirect={(angle) => {
            setMatch((current) => setPlayerAimAngle(current, 0, angle));
          }}
          onFire={() => {
            setMatch((current) => firePlayerStar(current, 0));
          }}
          onHoldAimStart={(keyId, delta) => {
            handleHoldAimStart(0, keyId, delta);
          }}
          onHoldAimEnd={handleHoldAimEnd}
        />
        {isOnline2P && activeSbRoom ? (
          <PlayerArena
            player={onlineOpponentBoard}
            playerNumber={2}
            mascot={onlineOpponentMascot}
            isTwoPlayer
            showTouchControls={false}
            remoteOpponentName={activeSbRoom.opponent.name}
            disabled
          />
        ) : !isOnline2P && match.mode === '2p' && match.players[1] ? (
          <PlayerArena
            player={match.players[1]}
            playerNumber={2}
            mascot={mascots[1]}
            onRandomizeMascot={() =>
              setMascots(([p1, p2]) => [p1, pickRandomOtherMascot(p2, p1.character)])
            }
            isTwoPlayer
            showTouchControls={touchAvailable}
            disabled={
              paused ||
              isReadyCheck ||
              isInviting ||
              isNetworkPaused ||
              countdown > 0 ||
              match.status !== 'playing'
            }
            onAimStep={(delta) => {
              setMatch((current) => aimPlayer(current, 1, delta));
            }}
            onAimDirect={(angle) => {
              setMatch((current) => setPlayerAimAngle(current, 1, angle));
            }}
            onFire={() => {
              setMatch((current) => firePlayerStar(current, 1));
            }}
            onHoldAimStart={(keyId, delta) => {
              handleHoldAimStart(1, keyId, delta);
            }}
            onHoldAimEnd={handleHoldAimEnd}
          />
        ) : null}
      </div>

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

      {isInviting && !isOnline2P ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="status"
            aria-live="polite"
            data-testid="sb-invite-waiting"
          >
            <span className="game-pause-kicker">2P Online Matchmaking</span>
            <h3 className="game-pause-title">Waiting for player…</h3>
            <p className="game-pause-copy" data-testid="netplay-invite-countdown">
              Invite expires in <strong>{inviteSecondsLeft}s</strong>
            </p>
            <div className="game-pause-actions">
              <button
                type="button"
                data-testid="sb-cancel-invite-btn"
                onClick={() => void getSharedNetplay().cancelInvite()}
              >
                Cancel invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOnline2P && isReadyCheck && activeSbRoom ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="dialog"
            aria-modal="true"
            aria-label="2P Online Ready Check"
            data-testid="netplay-ready-modal"
          >
            <span className="game-pause-kicker">2P Online Starlight Burst</span>
            <h3 className="game-pause-title">Players Ready?</h3>
            <div className="netplay-ready-roster">
              <div className="netplay-ready-row">
                <span>YOU ({netplay.clientName})</span>
                <span className={myReady ? 'netplay-ready-pill is-ready' : 'netplay-ready-pill'}>
                  {myReady ? 'READY ✓' : 'Waiting…'}
                </span>
              </div>
              <div className="netplay-ready-row">
                <span>{activeSbRoom.opponent.name}</span>
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

      {isNetworkPaused && activeSbRoom ? (
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
                {activeSbRoom.laggingPlayerNames?.length
                  ? activeSbRoom.laggingPlayerNames.join(', ')
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
            <span className="game-pause-kicker">Starlight Burst</span>
            <h3 className="game-pause-title">Paused</h3>
            <div className="game-pause-section">
              <span className="stack-label">Game Mode</span>
              <div className="filter-group" role="group" aria-label="Player mode">
                <button
                  type="button"
                  aria-pressed={!isOnline2P && !isInviting && match.mode === '1p'}
                  onClick={() => {
                    if (isOnline2P) void getSharedNetplay().leaveRoom();
                    if (isInviting) void getSharedNetplay().cancelInvite();
                    startNewRound('1p', false);
                  }}
                >
                  1 Player
                </button>
                {canSelectLocal2P ? (
                  <button
                    type="button"
                    aria-pressed={!isOnline2P && !isInviting && match.mode === '2p'}
                    onClick={() => {
                      if (isOnline2P) void getSharedNetplay().leaveRoom();
                      if (isInviting) void getSharedNetplay().cancelInvite();
                      startNewRound('2p', false);
                    }}
                  >
                    2 Player
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="sb-2p-online-btn"
                  aria-pressed={isOnline2P || isInviting}
                  disabled={!canSelectOnline2P}
                  title={
                    canSelectOnline2P
                      ? 'Challenge online players to 2P Starlight Burst'
                      : 'Requires at least 2 players online'
                  }
                  onClick={() => {
                    if (isOnline2P) {
                      void getSharedNetplay().leaveRoom();
                      startNewRound(canSelectLocal2P ? '2p' : '1p', false);
                    } else if (isInviting) {
                      void getSharedNetplay().cancelInvite();
                    } else if (canSelectOnline2P) {
                      if (match.mode === '2p') {
                        startNewRound('1p', false);
                      }
                      setSharedGamePaused(false);
                      void getSharedNetplay().sendInvite('starlight-burst');
                    }
                  }}
                >
                  {isOnline2P
                    ? `2P online (${activeSbRoom.opponent.name})`
                    : isInviting
                      ? `Waiting 2P… (${inviteSecondsLeft}s)`
                      : '2P online'}
                </button>
              </div>
            </div>
            <div className="game-pause-section">
              <span className="stack-label">Constellation</span>
              <div
                className="filter-group sb-stage-stepper"
                role="group"
                aria-label="Constellation selection"
                data-testid="sb-stage-selector"
              >
                <button
                  type="button"
                  aria-label="Previous constellation"
                  title="Previous constellation"
                  onClick={() => {
                    const totalOptions = TOTAL_STAGES + 1;
                    const prevPreset = (stagePreset - 1 + totalOptions) % totalOptions;
                    setStagePreset(prevPreset);
                    startNewRound(match.mode, true, prevPreset);
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  data-testid="sb-stage-button"
                  onClick={() => {
                    const nextPreset = (stagePreset + 1) % (TOTAL_STAGES + 1);
                    setStagePreset(nextPreset);
                    startNewRound(match.mode, true, nextPreset);
                  }}
                  title={`Cycle between random waves and ${TOTAL_STAGES} constellations`}
                >
                  {stagePreset === 0
                    ? 'Wave: Random'
                    : `Stage ${stagePreset}: ${stageTitle(stagePreset)}`}
                </button>
                <button
                  type="button"
                  aria-label="Next constellation"
                  title="Next constellation"
                  onClick={() => {
                    const nextPreset = (stagePreset + 1) % (TOTAL_STAGES + 1);
                    setStagePreset(nextPreset);
                    startNewRound(match.mode, true, nextPreset);
                  }}
                >
                  ›
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
                    getSharedArcadeAudio().setPlaylist(STARLIGHT_BURST_PLAYLIST);
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
                  handleNextOrNewRound();
                  setSharedGamePaused(false);
                }}
              >
                {match.status === 'round_over' ? 'Next round' : 'New game'}
              </button>
              <button
                type="button"
                data-testid="pause-menu-exit"
                aria-label="Close Starlight Burst"
                onClick={onExit}
              >
                Exit to menu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!paused && match.status === 'round_over' ? (
        <p className="stack-over sb-banner" role="status" data-testid="sb-round-banner">
          {isOnline2P && activeSbRoom
            ? match.winner === 0
              ? `YOU WIN! Beat ${activeSbRoom.opponent.name} (${match.wins[0]}–${match.wins[1]}). `
              : `${activeSbRoom.opponent.name} wins the round! (${match.wins[0]}–${match.wins[1]}). `
            : match.mode === '1p'
              ? match.winner === 0
                ? `YOU WIN! Sky cleared — score ${match.players[0].score.toLocaleString()}. `
                : `YOU LOSE — Sky overflow — score ${match.players[0].score.toLocaleString()}. `
              : match.winner !== null
                ? `Player ${match.winner + 1} wins the round! (${match.wins[0]}–${match.wins[1]}). `
                : `Sky overflow — score ${match.players[0].score.toLocaleString()}. `}
          <button type="button" className="primary" onClick={handleNextOrNewRound}>
            Next round
          </button>
        </p>
      ) : null}
    </section>
  );
}
