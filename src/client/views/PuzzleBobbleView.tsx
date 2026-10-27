import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  getSharedArcadeAudio,
  getSharedMusicOn,
  subscribeSharedAudio,
} from '../audio/tetrisMusic';
import { PUZZLE_BOBBLE_PLAYLIST } from '../../shared/tetrisMusic';
import { BACKGROUNDS, nextBackgroundIndex } from '../../shared/tetrisBackgrounds';
import {
  AIM_STEP_DEG,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BUBBLE_RADIUS,
  CHARACTER_OPTIONS,
  DANGER_LINE_Y,
  LAUNCHER_X,
  LAUNCHER_Y,
  ROW_STEP,
  aimAngleFromBoardPoint,
  aimGuidePoints,
  aimPlayer,
  aimVelocityDegPerSec,
  bubbleCenter,
  characterDisplayName,
  colsForRow,
  createMatch,
  createPlayerBoard,
  createStageGrid,
  decomposeGarbageOrbs,
  deriveMascotMood,
  fireAndResolvePlayer,
  firePlayerBubble,
  formatAimAngle,
  generateGarbageColors,
  hurryCountdownSeconds,
  queueIncomingGarbage,
  resolveMatchOutcome,
  setPlayerAimAngle,
  shotsPerCeilingDrop,
  stageTitle,
  stepMatch,
  tickShotTimers,
  TOTAL_STAGES,
  type BubbleColor,
  type CharacterId,
  type MascotMood,
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
  if (!ev) return null;
  const parts: string[] = [];
  if (ev.popped.length > 0) {
    parts.push(`Popped ${ev.popped.length} (+${ev.popScore})`);
  }
  if (ev.dropped.length > 0) {
    parts.push(`Avalanche ${ev.dropped.length} (+${ev.dropScore.toLocaleString()})`);
  }
  if (ev.sentGarbage > 0) {
    parts.push(`Sent +${ev.sentGarbage} attack!`);
  }
  if (ev.risenGarbage.length > 0) {
    parts.push(`+${ev.risenGarbage.length} rose up`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Subtle inner emblem inside each bubble, inspired by the trapped bubble
 * spirits in Taito's arcade Puzzle Bobble (also aids colour-blind play).
 */
function BubbleEmblem({ cx, cy, color, r }: { cx: number; cy: number; color: BubbleColor; r: number }) {
  const s = r * 0.36;
  switch (color) {
    case 'ruby':
      // 4-point star
      return (
        <polygon
          points={`${cx},${cy - s} ${cx + s * 0.38},${cy - s * 0.38} ${cx + s},${cy} ${cx + s * 0.38},${cy + s * 0.38} ${cx},${cy + s} ${cx - s * 0.38},${cy + s * 0.38} ${cx - s},${cy} ${cx - s * 0.38},${cy - s * 0.38}`}
          fill="var(--on-accent)"
          opacity="0.45"
        />
      );
    case 'amber':
      // Triangle crest
      return (
        <polygon
          points={`${cx},${cy - s * 0.9} ${cx + s * 0.85},${cy + s * 0.7} ${cx - s * 0.85},${cy + s * 0.7}`}
          fill="var(--on-accent)"
          opacity="0.45"
        />
      );
    case 'emerald':
      // Clover / plus
      return (
        <g fill="var(--on-accent)" opacity="0.45">
          <rect x={cx - s * 0.28} y={cy - s * 0.85} width={s * 0.56} height={s * 1.7} rx={1.5} />
          <rect x={cx - s * 0.85} y={cy - s * 0.28} width={s * 1.7} height={s * 0.56} rx={1.5} />
        </g>
      );
    case 'azure':
      // Ring / moon orb
      return (
        <circle
          cx={cx}
          cy={cy}
          r={s * 0.65}
          fill="none"
          stroke="var(--on-accent)"
          strokeWidth={1.6}
          opacity="0.5"
        />
      );
    case 'amethyst':
      // Diamond gem
      return (
        <polygon
          points={`${cx},${cy - s} ${cx + s * 0.8},${cy} ${cx},${cy + s} ${cx - s * 0.8},${cy}`}
          fill="var(--on-accent)"
          opacity="0.45"
        />
      );
    case 'coral':
      // Twin dots
      return (
        <g fill="var(--on-accent)" opacity="0.5">
          <circle cx={cx - s * 0.42} cy={cy} r={s * 0.32} />
          <circle cx={cx + s * 0.42} cy={cy} r={s * 0.32} />
        </g>
      );
  }
}

function BubbleSvg({
  cx,
  cy,
  color,
  radius = BUBBLE_RADIUS - 0.8,
  className,
  style,
}: {
  cx: number;
  cy: number;
  color: BubbleColor;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <g className={className} style={style}>
      {/* Base colour sphere */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={BUBBLE_TOKEN[color]}
        stroke="var(--text)"
        strokeWidth="1.2"
      />
      {/* 3D radial depth shading */}
      <circle cx={cx} cy={cy} r={radius} fill="url(#pb-sphere-shade)" />
      {/* Inner rim light */}
      <circle
        cx={cx}
        cy={cy}
        r={radius - 1.8}
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="0.9"
        opacity="0.35"
      />
      {/* Trapped spirit emblem */}
      <BubbleEmblem cx={cx} cy={cy + 0.5} color={color} r={radius} />
      {/* 3D radial specular highlight + crisp arcade shine */}
      <circle cx={cx} cy={cy} r={radius} fill="url(#pb-sphere-shine)" />
      <ellipse
        cx={cx - radius * 0.32}
        cy={cy - radius * 0.34}
        rx={radius * 0.28}
        ry={radius * 0.17}
        transform={`rotate(-28 ${cx - radius * 0.32} ${cy - radius * 0.34})`}
        fill="var(--on-accent)"
        opacity="0.88"
      />
      <circle
        cx={cx - radius * 0.1}
        cy={cy - radius * 0.52}
        r={radius * 0.09}
        fill="var(--on-accent)"
        opacity="0.75"
      />
    </g>
  );
}

function mascotPalette(character: CharacterId, playerNumber: 1 | 2): { body: string; accent: string } {
  switch (character) {
    case 'dragon':
      return {
        body: playerNumber === 1 ? 'var(--tetromino-s)' : 'var(--tetromino-j)',
        accent: playerNumber === 1 ? 'var(--tetromino-l)' : 'var(--tetromino-o)',
      };
    case 'cat':
      return {
        body: playerNumber === 1 ? 'var(--tetromino-l)' : 'var(--tetromino-t)',
        accent: playerNumber === 1 ? 'var(--tetromino-z)' : 'var(--tetromino-o)',
      };
    case 'dog':
      return {
        body: playerNumber === 1 ? 'var(--tetromino-o)' : 'var(--tetromino-l)',
        accent: playerNumber === 1 ? 'var(--tetromino-l)' : 'var(--tetromino-z)',
      };
    case 'bunny':
      return {
        body: playerNumber === 1 ? 'var(--tetromino-t)' : 'var(--tetromino-z)',
        accent: playerNumber === 1 ? 'var(--tetromino-z)' : 'var(--tetromino-o)',
      };
  }
}

/**
 * Cute selectable mascot beside the catapult wheel (#204):
 * - Supports `'dragon'`, `'cat'`, `'dog'`, and `'bunny'`
 * - Turns the crank as the player aims, cheers on combos, panics on `HURRY UP!`,
 *   celebrates with a jumping victory dance and sparkles when the player wins (`celebrate`),
 *   and cries with trembling sobs and cascading teardrops when the player loses (`cry`).
 */
function CharacterMascotSvg({
  x,
  y,
  playerNumber,
  character,
  mood,
  aimAngle,
}: {
  x: number;
  y: number;
  playerNumber: 1 | 2;
  character: CharacterId;
  mood: MascotMood;
  aimAngle: number;
}) {
  const { body: bodyFill, accent: accentFill } = mascotPalette(character, playerNumber);
  const crankRad = (aimAngle * Math.PI) / 45;
  const crankDx = mood === 'normal' || mood === 'hurry' ? Math.sin(crankRad) * 1.8 : 0;
  const crankDy = mood === 'normal' || mood === 'hurry' ? Math.cos(crankRad) * 1.8 : 0;
  const leftArmY =
    mood === 'celebrate'
      ? -11.5
      : mood === 'cheer'
        ? -8.5
        : mood === 'cry'
          ? -4.2
          : -2 + crankDy;
  const leftArmX =
    mood === 'celebrate'
      ? -7.6
      : mood === 'cheer'
        ? -7.2
        : mood === 'cry'
          ? -7.2
          : -6 + crankDx;
  const rightArmY =
    mood === 'celebrate'
      ? -11.5
      : mood === 'cheer'
        ? -8.5
        : mood === 'cry'
          ? -4.2
          : -1;
  const rightArmX =
    mood === 'celebrate'
      ? 11.2
      : mood === 'cheer'
        ? 10.6
        : mood === 'cry'
          ? 9.8
          : 10;
  const topStarY = character === 'bunny' ? -30 : character === 'cat' ? -27 : -24;

  return (
    <g transform={`translate(${x}, ${y})`} aria-hidden="true">
      <g
        className={`pb-mascot pb-mascot-${mood}`}
        data-testid={`p${playerNumber}-mascot`}
        data-character={character}
        data-mood={mood}
      >
        {/* Character-specific tail / dorsal crests behind the body */}
        {character === 'dragon' ? (
          <g>
            <polygon points="9,-16 14,-20 12,-13" fill={accentFill} stroke="var(--text)" strokeWidth="0.8" />
            <polygon points="10,-10 15,-14 14,-7" fill={accentFill} stroke="var(--text)" strokeWidth="0.8" />
            <polygon points="12,-4 17,-7 15,0" fill={accentFill} stroke="var(--text)" strokeWidth="0.8" />
            <polygon points="11,3 17,2 13,7" fill={accentFill} stroke="var(--text)" strokeWidth="0.8" />
          </g>
        ) : null}
        {character === 'cat' ? (
          <g>
            <path
              d="M 11 5 Q 19 2 17 -6 Q 16 -10 13 -8"
              fill="none"
              stroke="var(--text)"
              strokeWidth="4.4"
              strokeLinecap="round"
            />
            <path
              d="M 11 5 Q 19 2 17 -6 Q 16 -10 13 -8"
              fill="none"
              stroke={bodyFill}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        ) : null}
        {character === 'dog' ? (
          <ellipse
            cx="14"
            cy="3"
            rx="4.2"
            ry="2.2"
            transform="rotate(-28 14 3)"
            fill={accentFill}
            stroke="var(--text)"
            strokeWidth="0.9"
          />
        ) : null}
        {character === 'bunny' ? (
          <circle
            cx="13.5"
            cy="5"
            r="3.6"
            fill="var(--on-accent)"
            stroke="var(--text)"
            strokeWidth="0.9"
          />
        ) : null}

        {/* Body & tummy */}
        <ellipse cx="4" cy="0" rx="10" ry="11" fill={bodyFill} stroke="var(--text)" strokeWidth="1.2" />
        <ellipse cx="1.5" cy="2" rx="5.8" ry="7" fill="var(--on-accent)" opacity="0.88" />

        {/* Character-specific ears behind/on the head */}
        {character === 'cat' ? (
          <g>
            <polygon points="-5,-16 -2,-24 2,-17" fill={bodyFill} stroke="var(--text)" strokeWidth="1" />
            <polygon points="-3.8,-17 -2,-22 0.6,-17.5" fill={accentFill} />
            <polygon points="3,-17 7,-24 10,-16" fill={bodyFill} stroke="var(--text)" strokeWidth="1" />
            <polygon points="4.4,-17.5 7,-22 8.6,-17" fill={accentFill} />
          </g>
        ) : null}
        {character === 'bunny' ? (
          <g>
            <ellipse
              cx="-1.5"
              cy="-22"
              rx="2.7"
              ry="6.8"
              transform="rotate(-8 -1.5 -22)"
              fill={bodyFill}
              stroke="var(--text)"
              strokeWidth="1"
            />
            <ellipse
              cx="-1.5"
              cy="-22"
              rx="1.3"
              ry="4.4"
              transform="rotate(-8 -1.5 -22)"
              fill={accentFill}
            />
            <ellipse
              cx="5.5"
              cy="-22"
              rx="2.7"
              ry="6.8"
              transform="rotate(8 5.5 -22)"
              fill={bodyFill}
              stroke="var(--text)"
              strokeWidth="1"
            />
            <ellipse
              cx="5.5"
              cy="-22"
              rx="1.3"
              ry="4.4"
              transform="rotate(8 5.5 -22)"
              fill={accentFill}
            />
          </g>
        ) : null}

        {/* Head */}
        <circle cx="2" cy="-11" r="8.6" fill={bodyFill} stroke="var(--text)" strokeWidth="1.2" />

        {/* Floppy dog ears & snout */}
        {character === 'dog' ? (
          <g>
            <ellipse
              cx="-6"
              cy="-10"
              rx="2.6"
              ry="5.5"
              transform="rotate(16 -6 -10)"
              fill={accentFill}
              stroke="var(--text)"
              strokeWidth="1"
            />
            <ellipse
              cx="10"
              cy="-10"
              rx="2.6"
              ry="5.5"
              transform="rotate(-16 10 -10)"
              fill={accentFill}
              stroke="var(--text)"
              strokeWidth="1"
            />
            <ellipse cx="1.2" cy="-8.6" rx="3.4" ry="2.3" fill="var(--on-accent)" opacity="0.9" />
            <circle cx="1.2" cy="-9.6" r="1.2" fill="var(--text)" />
          </g>
        ) : null}

        {/* Cat nose & whiskers */}
        {character === 'cat' ? (
          <g>
            <polygon points="0.4,-9.5 2,-9.5 1.2,-8.3" fill={accentFill} />
            <line x1="-7.5" y1="-10" x2="-3.5" y2="-9.5" stroke="var(--text)" strokeWidth="0.7" />
            <line x1="-7.5" y1="-8.2" x2="-3.5" y2="-8.5" stroke="var(--text)" strokeWidth="0.7" />
            <line x1="6" y1="-9.5" x2="10" y2="-10" stroke="var(--text)" strokeWidth="0.7" />
            <line x1="6" y1="-8.5" x2="10" y2="-8.2" stroke="var(--text)" strokeWidth="0.7" />
          </g>
        ) : null}

        {/* Bunny nose & whiskers */}
        {character === 'bunny' ? (
          <g>
            <ellipse cx="1.2" cy="-9.1" rx="1.2" ry="0.85" fill="var(--tetromino-z)" />
            <line x1="-6.8" y1="-9.5" x2="-3.5" y2="-9.2" stroke="var(--text)" strokeWidth="0.65" />
            <line x1="6" y1="-9.2" x2="9.3" y2="-9.5" stroke="var(--text)" strokeWidth="0.65" />
          </g>
        ) : null}

        {/* Eyes & facial expression by mood */}
        {mood === 'celebrate' || mood === 'cheer' ? (
          <g>
            {/* Happy curved arc eyes (^ ^) */}
            <path
              d="M -3.8 -12.2 Q -1.8 -15 0.2 -12.2"
              fill="none"
              stroke="var(--text)"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path
              d="M 2.2 -12.2 Q 4.2 -15 6.2 -12.2"
              fill="none"
              stroke="var(--text)"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            {/* Rosy blush cheeks */}
            <circle cx="-4.2" cy="-9.8" r="1.5" fill="var(--tetromino-z)" opacity="0.7" />
            <circle cx="6.6" cy="-9.8" r="1.5" fill="var(--tetromino-z)" opacity="0.7" />
            {/* Joyful open grin */}
            <path
              d="M -1.2 -8 Q 1.2 -4.6 3.8 -8 Z"
              fill="var(--tetromino-z)"
              stroke="var(--text)"
              strokeWidth="0.8"
            />
          </g>
        ) : mood === 'cry' ? (
          <g>
            {/* Quivering crying eyes (> <) */}
            <path
              d="M -3.8 -13.6 L -0.4 -12.1 L -3.8 -10.6"
              fill="none"
              stroke="var(--text)"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 6.2 -13.6 L 2.8 -12.1 L 6.2 -10.6"
              fill="none"
              stroke="var(--text)"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Wailing downturned mouth */}
            <path
              d="M -1.4 -6.0 Q 1.2 -9.3 3.8 -6.0 Z"
              fill="var(--tetromino-z)"
              stroke="var(--text)"
              strokeWidth="0.8"
            />
            {/* Streaming tear trails & animated cascading teardrops on both cheeks */}
            <g className="pb-mascot-tear pb-mascot-tear-left">
              <ellipse
                cx="-3.0"
                cy="-8.8"
                rx="1.65"
                ry="2.7"
                fill="var(--tetromino-i)"
                stroke="var(--text)"
                strokeWidth="0.7"
              />
              <circle cx="-3.4" cy="-9.6" r="0.55" fill="var(--on-accent)" />
            </g>
            <g className="pb-mascot-tear pb-mascot-tear-right">
              <ellipse
                cx="5.4"
                cy="-8.8"
                rx="1.65"
                ry="2.7"
                fill="var(--tetromino-i)"
                stroke="var(--text)"
                strokeWidth="0.7"
              />
              <circle cx="5.0" cy="-9.6" r="0.55" fill="var(--on-accent)" />
            </g>
            <circle
              className="pb-mascot-tear pb-mascot-tear-splash"
              cx="-5.8"
              cy="-5.8"
              r="1.35"
              fill="var(--tetromino-i)"
              stroke="var(--text)"
              strokeWidth="0.55"
            />
            <circle
              className="pb-mascot-tear pb-mascot-tear-splash"
              cx="8.2"
              cy="-5.8"
              r="1.35"
              fill="var(--tetromino-i)"
              stroke="var(--text)"
              strokeWidth="0.55"
            />
          </g>
        ) : (
          <g>
            {/* Big glossy arcade eyes */}
            <ellipse
              cx="-1.5"
              cy="-12.5"
              rx="2.5"
              ry="3.1"
              fill="var(--on-accent)"
              stroke="var(--text)"
              strokeWidth="0.8"
            />
            <circle cx="-1.9" cy="-12.5" r={mood === 'hurry' ? 0.9 : 1.3} fill="var(--text)" />
            <circle cx="-2.3" cy="-13.4" r="0.6" fill="var(--on-accent)" />
            <ellipse
              cx="4.1"
              cy="-12.5"
              rx="2.3"
              ry="2.9"
              fill="var(--on-accent)"
              stroke="var(--text)"
              strokeWidth="0.8"
            />
            <circle cx="3.7" cy="-12.5" r={mood === 'hurry' ? 0.9 : 1.2} fill="var(--text)" />
            <circle cx="3.3" cy="-13.4" r="0.55" fill="var(--on-accent)" />
            {mood === 'hurry' ? (
              <circle
                cx="1.2"
                cy="-7.5"
                r="1.4"
                fill="var(--tetromino-z)"
                stroke="var(--text)"
                strokeWidth="0.7"
              />
            ) : (
              <path
                d="M -0.6 -7.8 Q 1.2 -6.2 3.1 -7.8"
                fill="none"
                stroke="var(--text)"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
            )}
          </g>
        )}

        {/* Left & right paws (drawn in front so raised celebration/cheer/cry poses read clearly) */}
        <circle
          cx={leftArmX}
          cy={leftArmY}
          r="3.1"
          fill={bodyFill}
          stroke="var(--text)"
          strokeWidth="1"
        />
        <circle
          cx={rightArmX}
          cy={rightArmY}
          r="3"
          fill={bodyFill}
          stroke="var(--text)"
          strokeWidth="1"
        />

        {/* Feet */}
        <ellipse cx="-2" cy="11" rx="4.5" ry="2.2" fill={accentFill} stroke="var(--text)" strokeWidth="1" />
        <ellipse cx="6" cy="11" rx="4.5" ry="2.2" fill={accentFill} stroke="var(--text)" strokeWidth="1" />

        {/* Celebratory 4-point stars & sparkles on round win (`celebrate`) or combo (`cheer`) */}
        {mood === 'celebrate' ? (
          <g aria-hidden="true">
            <polygon
              className="pb-mascot-sparkle pb-mascot-sparkle-1"
              points="-11,-22 -9.5,-19 -6.5,-17.5 -9.5,-16 -11,-13 -12.5,-16 -15.5,-17.5 -12.5,-19"
              fill="var(--tetromino-o)"
              stroke="var(--text)"
              strokeWidth="0.6"
            />
            <polygon
              className="pb-mascot-sparkle pb-mascot-sparkle-2"
              points="14,-23 15.2,-20.5 17.8,-19.3 15.2,-18.1 14,-15.6 12.8,-18.1 10.2,-19.3 12.8,-20.5"
              fill="var(--tetromino-z)"
              stroke="var(--text)"
              strokeWidth="0.6"
            />
            <polygon
              className="pb-mascot-sparkle pb-mascot-sparkle-1"
              points={`2,${topStarY - 3.5} 3,${topStarY - 1} 5.5,${topStarY} 3,${topStarY + 1} 2,${topStarY + 3.5} 1,${topStarY + 1} -1.5,${topStarY} 1,${topStarY - 1}`}
              fill="var(--tetromino-s)"
              stroke="var(--text)"
              strokeWidth="0.55"
            />
          </g>
        ) : mood === 'cheer' ? (
          <polygon
            className="pb-mascot-sparkle pb-mascot-sparkle-1"
            points="13,-20 14.2,-17.5 16.8,-16.3 14.2,-15.1 13,-12.6 11.8,-15.1 9.2,-16.3 11.8,-17.5"
            fill="var(--tetromino-o)"
            stroke="var(--text)"
            strokeWidth="0.6"
          />
        ) : null}

        {/* Hurry sweat drops */}
        {mood === 'hurry' ? (
          <g className="pb-mascot-sweat" fill="var(--tetromino-i)" stroke="var(--text)" strokeWidth="0.55">
            <circle cx="13" cy="-16" r="1.8" />
            <circle cx="16" cy="-11" r="1.4" />
          </g>
        ) : null}
      </g>
    </g>
  );
}

/**
 * Neo-Geo style mechanical catapult / pointer launcher with rotating toothed
 * gears, aiming arrow shaft, next-bubble cradle, and selectable cute mascot.
 */
function LauncherMechanismSvg({
  player,
  playerNumber,
  character,
}: {
  player: PlayerBoardState;
  playerNumber: 1 | 2;
  character: CharacterId;
}) {
  const gearRotation = player.aimAngle * 2.2;
  const crankRotation = -player.aimAngle * 3.6;
  const mood = deriveMascotMood(player);

  return (
    <g>
      {/* Pedestal base */}
      <rect
        x={LAUNCHER_X - 44}
        y={LAUNCHER_Y + 13}
        width={88}
        height={10}
        rx={4}
        fill="var(--neutral-weak)"
        stroke="var(--border)"
        strokeWidth="1.2"
      />

      {/* Main toothed gear wheel (rotates with aimAngle) */}
      <g transform={`translate(${LAUNCHER_X}, ${LAUNCHER_Y}) rotate(${gearRotation})`}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x={-2.5}
            y={-24}
            width={5}
            height={6}
            rx={1}
            fill="var(--border-hover)"
            stroke="var(--text)"
            strokeWidth="0.8"
            transform={`rotate(${i * 30})`}
          />
        ))}
        <circle
          cx={0}
          cy={0}
          r={20}
          fill="var(--surface)"
          stroke="var(--text)"
          strokeWidth="1.4"
        />
        <circle
          cx={0}
          cy={0}
          r={14}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
      </g>

      {/* Secondary hand-crank gear wheel on the right */}
      <g transform={`translate(${LAUNCHER_X + 27}, ${LAUNCHER_Y + 6}) rotate(${crankRotation})`}>
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x={-1.8}
            y={-12}
            width={3.6}
            height={4}
            fill="var(--warning-weak)"
            stroke="var(--text)"
            strokeWidth="0.7"
            transform={`rotate(${i * 45})`}
          />
        ))}
        <circle cx={0} cy={0} r={9.5} fill="var(--warning-weak)" stroke="var(--text)" strokeWidth="1.2" />
        <line x1={-7.5} y1={0} x2={7.5} y2={0} stroke="var(--border-hover)" strokeWidth="1.2" />
        <line x1={0} y1={-7.5} x2={0} y2={7.5} stroke="var(--border-hover)" strokeWidth="1.2" />
        <circle cx={0} cy={0} r={3.2} fill="var(--surface)" stroke="var(--text)" strokeWidth="1" />
        <circle cx={5.2} cy={0} r={2} fill="var(--accent)" stroke="var(--text)" strokeWidth="0.9" />
      </g>

      {/* Rotating ornate pointer arrow */}
      <g transform={`translate(${LAUNCHER_X}, ${LAUNCHER_Y}) rotate(${player.aimAngle})`}>
        {/* Pointer side wings */}
        <polygon
          points="-11,-8 -4,-28 4,-28 11,-8"
          fill="var(--accent-weak)"
          stroke="var(--text)"
          strokeWidth="1.1"
        />
        {/* Pointer main shaft */}
        <rect
          x={-3}
          y={-42}
          width={6}
          height={28}
          rx={2}
          fill="var(--accent)"
          stroke="var(--text)"
          strokeWidth="1.1"
        />
        {/* Ornate arrowhead tip */}
        <polygon
          points="0,-54 -9,-38 -3,-40 0,-43 3,-40 9,-38"
          fill="var(--warning-weak)"
          stroke="var(--text)"
          strokeWidth="1.2"
        />
      </g>

      {/* Active bubble loaded in the launcher chamber */}
      {player.flying === null ? (
        <BubbleSvg cx={LAUNCHER_X} cy={LAUNCHER_Y} color={player.currentBubble} />
      ) : (
        <circle
          cx={LAUNCHER_X}
          cy={LAUNCHER_Y}
          r={BUBBLE_RADIUS - 3}
          fill="var(--field)"
          stroke="var(--border)"
          strokeDasharray="3 2"
        />
      )}

      {/* On-deck NEXT bubble tray on the left of the catapult */}
      <g transform={`translate(${LAUNCHER_X - 56}, ${LAUNCHER_Y + 6})`}>
        <ellipse
          cx={0}
          cy={10}
          rx={14}
          ry={4}
          fill="var(--neutral-weak)"
          stroke="var(--border)"
          strokeWidth="1"
        />
        <BubbleSvg cx={0} cy={-1} color={player.nextBubble} radius={BUBBLE_RADIUS - 3} />
      </g>

      {/* Selectable cute mascot turning the crank on the right (#204) */}
      <CharacterMascotSvg
        x={LAUNCHER_X + 52}
        y={LAUNCHER_Y + 4}
        playerNumber={playerNumber}
        character={character}
        mood={mood}
        aimAngle={player.aimAngle}
      />
    </g>
  );
}

/**
 * Renders the Neo-Geo yellow (1-bubble) and red (5-bubble) garbage warning orbs.
 */
function GarbageOrbsRow({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  const orbs = decomposeGarbageOrbs(count);
  return (
    <span className="pb-orbs" aria-label={label} title={label}>
      {orbs.map((kind, idx) => (
        <span
          key={idx}
          className={kind === 'red' ? 'pb-orb pb-orb-red' : 'pb-orb pb-orb-yellow'}
        />
      ))}
    </span>
  );
}

/**
 * Miniature 12x12 mascot emblem for the arcade fighter select strip (#215).
 * Marked `aria-hidden="true"` so the button's accessible name remains the character label.
 */
function CharacterTokenIcon({ id }: { id: CharacterId }) {
  switch (id) {
    case 'dragon':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="3,4 5,1 7,1 9,4" fill="var(--tetromino-l)" />
          <circle cx="6" cy="7" r="4" fill="var(--tetromino-s)" stroke="var(--text)" strokeWidth="1" />
          <circle cx="4.8" cy="6.3" r="0.9" fill="var(--text)" />
          <circle cx="7.2" cy="6.3" r="0.9" fill="var(--text)" />
        </svg>
      );
    case 'cat':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="2,6 2.5,1.5 5.5,4" fill="var(--tetromino-i)" stroke="var(--text)" strokeWidth="0.9" />
          <polygon points="10,6 9.5,1.5 6.5,4" fill="var(--tetromino-i)" stroke="var(--text)" strokeWidth="0.9" />
          <circle cx="6" cy="7" r="3.8" fill="var(--tetromino-i)" stroke="var(--text)" strokeWidth="1" />
          <circle cx="4.8" cy="6.5" r="0.9" fill="var(--text)" />
          <circle cx="7.2" cy="6.5" r="0.9" fill="var(--text)" />
        </svg>
      );
    case 'dog':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <ellipse cx="2.2" cy="7" rx="1.4" ry="2.8" fill="var(--tetromino-z)" stroke="var(--text)" strokeWidth="0.9" />
          <ellipse cx="9.8" cy="7" rx="1.4" ry="2.8" fill="var(--tetromino-z)" stroke="var(--text)" strokeWidth="0.9" />
          <circle cx="6" cy="6.8" r="3.8" fill="var(--tetromino-o)" stroke="var(--text)" strokeWidth="1" />
          <circle cx="4.8" cy="6.2" r="0.9" fill="var(--text)" />
          <circle cx="7.2" cy="6.2" r="0.9" fill="var(--text)" />
        </svg>
      );
    case 'bunny':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <ellipse cx="4.3" cy="3" rx="1.2" ry="2.6" fill="var(--tetromino-t)" stroke="var(--text)" strokeWidth="0.9" />
          <ellipse cx="7.7" cy="3" rx="1.2" ry="2.6" fill="var(--tetromino-t)" stroke="var(--text)" strokeWidth="0.9" />
          <circle cx="6" cy="7.6" r="3.5" fill="var(--tetromino-t)" stroke="var(--text)" strokeWidth="1" />
          <circle cx="4.8" cy="7.2" r="0.9" fill="var(--text)" />
          <circle cx="7.2" cy="7.2" r="0.9" fill="var(--text)" />
        </svg>
      );
  }
}

function PlayerArena({
  player,
  playerNumber,
  character,
  onSelectCharacter,
  controlsLabel,
  isTwoPlayer,
  disabled,
  onAimStep,
  onAimDirect,
  onFire,
  onHoldAimStart,
  onHoldAimEnd,
}: {
  player: PlayerBoardState;
  playerNumber: 1 | 2;
  character: CharacterId;
  onSelectCharacter: (character: CharacterId) => void;
  controlsLabel: string;
  isTwoPlayer: boolean;
  disabled: boolean;
  onAimStep: (deltaDeg: number) => void;
  onAimDirect: (targetAngle: number) => void;
  onFire: () => void;
  onHoldAimStart: (keyId: string, deltaDeg: number) => void;
  onHoldAimEnd: (keyId: string) => void;
}) {
  const dragPointerIdRef = useRef<number | null>(null);
  const boardSvgRef = useRef<SVGSVGElement | null>(null);

  const aimFromPointerEvent = (event: ReactPointerEvent<Element>) => {
    if (disabled || player.status !== 'playing') return;
    const svgEl = boardSvgRef.current ?? event.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH;
    const svgY = ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT;
    onAimDirect(aimAngleFromBoardPoint(svgX, svgY));
  };
  const ceilingY = player.ceilingDrop * ROW_STEP;
  const guide = aimGuidePoints(player.aimAngle, player.ceilingDrop);
  const polylinePoints = guide.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const summary = eventSummary(player);
  const hurrySeconds = hurryCountdownSeconds(player);
  const dropInterval = shotsPerCeilingDrop(player.grid);
  const shotsLeftUntilDrop = Math.max(1, dropInterval - player.shotsSinceDrop);
  const charName = characterDisplayName(character, playerNumber);
  const mood = deriveMascotMood(player);

  let settledCount = 0;
  for (const row of player.grid) {
    for (const cell of row) {
      if (cell !== null) settledCount += 1;
    }
  }

  const lastEv = player.lastEvent;
  const risenKeySet = new Set<string>(
    (lastEv?.risenGarbage ?? []).map((cell) => `${cell.row},${cell.col}`),
  );
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
    <div className="pb-player-card" data-player={playerNumber}>
      {/* Compact single-line arcade marquee + character picker (#215, #226) */}
      <div className="pb-player-header">
        <div className="pb-player-id">
          <span className={`pb-up-badge pb-up-${playerNumber}`} aria-hidden="true">
            {playerNumber}UP
          </span>
          <span className="pb-player-title" data-testid={`p${playerNumber}-title`}>
            {`${playerNumber}P · ${charName}`}
          </span>
        </div>
        <div
          className="pb-char-options"
          role="group"
          aria-label={`Player ${playerNumber} character`}
          data-testid={`p${playerNumber}-character-picker`}
        >
          {CHARACTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={character === opt.id ? 'pb-char-btn is-selected' : 'pb-char-btn'}
              aria-pressed={character === opt.id}
              title={`Play as ${opt.label}`}
              onClick={(event) => {
                onSelectCharacter(opt.id);
                event.currentTarget.blur();
              }}
            >
              <CharacterTokenIcon id={opt.id} />
              <span className="sr-only">{opt.label}</span>
            </button>
          ))}
        </div>
        <div className="pb-status-pills">
          {hurrySeconds !== null ? (
            <span className="badge problem pb-hurry-badge" role="status">
              HURRY UP! {hurrySeconds}
            </span>
          ) : player.incomingGarbage > 0 ? (
            <span className="badge waiting" role="status">
              ATK +{player.incomingGarbage}
            </span>
          ) : (
            <span className={player.ceilingWarning ? 'badge waiting' : 'badge'}>
              {player.status === 'won'
                ? 'WINNER!'
                : player.status === 'ko'
                  ? 'KO'
                  : player.ceilingWarning
                    ? 'DROP NEXT!'
                    : `STAGE ${player.stage}`}
            </span>
          )}
        </div>
      </div>

      <div
        className="pb-arena-row"
        onPointerDown={(event) => {
          if (disabled || player.status !== 'playing') return;
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
          className="pb-board"
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          viewBox={`0 0 ${ARENA_WIDTH} ${ARENA_HEIGHT}`}
          role="img"
          aria-label={`Player ${playerNumber} bubble board`}
        >
          <defs>
            <radialGradient id="pb-sphere-shine" cx="32%" cy="28%" r="55%">
              <stop offset="0%" stopColor="var(--on-accent)" stopOpacity="0.55" />
              <stop offset="55%" stopColor="var(--on-accent)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pb-sphere-shade" cx="45%" cy="42%" r="60%">
              <stop offset="60%" stopColor="var(--text)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--text)" stopOpacity="0.28" />
            </radialGradient>
            <pattern
              id={`pb-diamond-grid-${playerNumber}`}
              width={BUBBLE_RADIUS * 2}
              height={ROW_STEP}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${BUBBLE_RADIUS} 0 L ${BUBBLE_RADIUS * 2} ${ROW_STEP / 2} L ${BUBBLE_RADIUS} ${ROW_STEP} L 0 ${ROW_STEP / 2} Z`}
                fill="none"
                stroke="var(--border)"
                strokeWidth="0.6"
                opacity="0.45"
              />
            </pattern>
          </defs>

          {/* Subtle arcade diamond backdrop grid aligned to bubble diameter & row step */}
          <rect
            x={0}
            y={ceilingY}
            width={ARENA_WIDTH}
            height={DANGER_LINE_Y - ceilingY}
            fill={`url(#pb-diamond-grid-${playerNumber})`}
          />

          {/* Side bounce rails */}
          <rect x={0} y={0} width={3} height={ARENA_HEIGHT} fill="var(--border-hover)" opacity="0.55" />
          <rect
            x={ARENA_WIDTH - 3}
            y={0}
            width={3}
            height={ARENA_HEIGHT}
            fill="var(--border-hover)"
            opacity="0.55"
          />

          {/* Industrial arcade compressor pistons & beam when ceiling drops */}
          {ceilingY > 0 ? (
            <g aria-hidden="true">
              <rect
                x={0}
                y={0}
                width={ARENA_WIDTH}
                height={ceilingY}
                fill="var(--neutral-weak)"
              />
              {/* Left and right mechanical piston shafts */}
              <rect
                x={36}
                y={0}
                width={18}
                height={ceilingY}
                fill="var(--closed-weak)"
                stroke="var(--text)"
                strokeWidth="1.2"
              />
              <rect
                x={ARENA_WIDTH - 54}
                y={0}
                width={18}
                height={ceilingY}
                fill="var(--closed-weak)"
                stroke="var(--text)"
                strokeWidth="1.2"
              />
              {/* Compressor girder beam */}
              <rect
                x={0}
                y={Math.max(0, ceilingY - 8)}
                width={ARENA_WIDTH}
                height={8}
                fill="var(--closed-weak)"
                stroke="var(--text)"
                strokeWidth="1.2"
              />
              {Array.from({ length: 7 }, (_, i) => (
                <circle
                  key={i}
                  cx={16 + i * 32}
                  cy={Math.max(4, ceilingY - 4)}
                  r={1.8}
                  fill="var(--text)"
                />
              ))}
            </g>
          ) : null}

          <line
            x1={0}
            y1={ceilingY}
            x2={ARENA_WIDTH}
            y2={ceilingY}
            stroke="var(--text)"
            strokeWidth={2}
          />

          {/* Arcade deadline / danger line above the launcher */}
          <line
            x1={0}
            y1={DANGER_LINE_Y}
            x2={ARENA_WIDTH}
            y2={DANGER_LINE_Y}
            stroke="var(--problem-border)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />

          {/* Multi-bounce aiming sight line */}
          {player.status === 'playing' ? (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="4 4"
              opacity={0.82}
            />
          ) : null}

          {/* Rising bubble motion trails when incoming attack bubbles shoot up from the bottom */}
          {lastEv && lastEv.risenGarbage.length > 0 ? (
            <g key={`rise-trails-${lastEv.id}`} aria-hidden="true">
              {lastEv.risenGarbage.map((cell, idx) => (
                <line
                  key={`trail-${idx}`}
                  className="pb-rise-trail"
                  x1={cell.x}
                  y1={stagingY}
                  x2={cell.x}
                  y2={cell.y}
                  stroke={BUBBLE_TOKEN[cell.color]}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              ))}
            </g>
          ) : null}

          {/* Settled hexagonal grid bubbles (trembles rapidly with 0.5px amplitude when ceilingWarning is active) */}
          <g className={player.ceilingWarning ? 'pb-cluster-warning' : undefined}>
            {player.grid.map((row, r) =>
              Array.from({ length: colsForRow(r) }, (_, c) => {
                const color = row[c];
                if (!color) return null;
                const center = bubbleCenter(r, c, player.ceilingDrop);
                const coordKey = `${r},${c}`;
                const justRose = risenKeySet.has(coordKey) && lastEv !== null;
                return (
                  <BubbleSvg
                    key={justRose ? `${coordKey}-rise-${lastEv.id}` : coordKey}
                    cx={center.x}
                    cy={center.y}
                    color={color}
                    className={justRose ? 'pb-rise-bubble' : undefined}
                    style={
                      justRose
                        ? ({ '--pb-rise-from': `${stagingY - center.y}px` } as CSSProperties)
                        : undefined
                    }
                  />
                );
              }),
            )}
          </g>

          {/* On-board indicator of attack bubbles sent from the other side and about to come up (#186) */}
          {player.incomingGarbage > 0 ? (
            <g
              className="pb-incoming-tray"
              data-testid={`p${playerNumber}-incoming-indicator`}
              aria-label={`${player.incomingGarbage} incoming attack bubbles about to rise`}
            >
              {/* Side-rail Neo-Geo warning orb gauge (red = 5, yellow = 1) */}
              {orbList.map((orbKind, idx) => {
                const orbY = DANGER_LINE_Y - 12 - idx * 14;
                const isRed = orbKind === 'red';
                return (
                  <circle
                    key={`orb-${idx}`}
                    cx={gaugeX}
                    cy={orbY}
                    r={isRed ? 5.5 : 4.2}
                    fill={isRed ? 'var(--tetromino-z)' : 'var(--tetromino-o)'}
                    stroke="var(--text)"
                    strokeWidth="1.2"
                  />
                );
              })}

              {/* Bottom staging preview of the exact bubbles about to shoot up from the bottom */}
              {incomingPreview.map((color, idx) => {
                const count = incomingPreview.length;
                const span = Math.min(168, Math.max(36, (count - 1) * 28));
                const startX = LAUNCHER_X - span / 2;
                const bx = count === 1 ? LAUNCHER_X - 34 : startX + (idx * span) / (count - 1);
                return (
                  <g key={`stage-${idx}`} className="pb-incoming-preview-bubble">
                    <polygon
                      points={`${bx},${stagingY - 15} ${bx - 4},${stagingY - 9} ${bx + 4},${stagingY - 9}`}
                      fill="var(--problem)"
                    />
                    <BubbleSvg cx={bx} cy={stagingY} color={color} radius={8.5} />
                  </g>
                );
              })}
            </g>
          ) : null}

          {/* Pop burst rings & tumbling avalanche bubbles from the latest shot */}
          {lastEv && lastEv.popped.length > 0 ? (
            <g key={`fx-${lastEv.id}`} aria-hidden="true">
              {lastEv.popped.map((cell, idx) => (
                <circle
                  key={`pop-${idx}`}
                  className="pb-pop-ring"
                  cx={cell.x}
                  cy={cell.y}
                  r={BUBBLE_RADIUS}
                  fill="none"
                  stroke={BUBBLE_TOKEN[cell.color]}
                  strokeWidth="2.5"
                />
              ))}
              {lastEv.dropped.map((cell, idx) => (
                <BubbleSvg
                  key={`drop-${idx}`}
                  className="pb-drop-bubble"
                  cx={cell.x}
                  cy={cell.y}
                  color={cell.color}
                />
              ))}
            </g>
          ) : null}

          {/* In-flight bubble */}
          {player.flying ? (
            <BubbleSvg
              cx={player.flying.x}
              cy={player.flying.y}
              color={player.flying.color}
            />
          ) : null}

          {/* Mechanical gear catapult, pointer arrow, on-deck bubble & selectable cute mascot */}
          <LauncherMechanismSvg
            player={player}
            playerNumber={playerNumber}
            character={character}
          />

          {/* In-board arcade win/lose marquee plaque (#215) */}
          {player.status !== 'playing' ? (
            <g aria-hidden="true">
              <rect
                x={28}
                y={104}
                width={ARENA_WIDTH - 56}
                height={44}
                rx={8}
                fill="var(--surface)"
                stroke="var(--text)"
                strokeWidth="2.5"
              />
              <rect
                x={32}
                y={108}
                width={ARENA_WIDTH - 64}
                height={36}
                rx={5}
                fill={player.status === 'won' ? 'var(--accent-weak)' : 'var(--problem-weak)'}
                stroke={player.status === 'won' ? 'var(--accent)' : 'var(--problem-border)'}
                strokeWidth="1.5"
              />
              <text
                x={LAUNCHER_X}
                y={131}
                textAnchor="middle"
                fontSize="16"
                fontWeight="700"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fill={player.status === 'won' ? 'var(--accent-weak-text)' : 'var(--problem)'}
              >
                {player.status === 'won' ? '★ WINNER! ★' : '× GAME OVER ×'}
              </text>
            </g>
          ) : null}
        </svg>

        <aside className="tetris-side pb-side">
          <div className="tetris-stat pb-score-slot">
            <span className="tetris-label">Score</span>
            <span className="tetris-value pb-score-value" aria-live="polite" data-testid={`p${playerNumber}-score`}>
              {player.score.toLocaleString()}
            </span>
          </div>

          <div className="tetris-stat pb-next-dome">
            <span className="tetris-label">Next</span>
            <div className="pb-next-orb-well">
              <svg
                width={BUBBLE_RADIUS * 2 + 6}
                height={BUBBLE_RADIUS * 2 + 6}
                viewBox={`0 0 ${BUBBLE_RADIUS * 2 + 10} ${BUBBLE_RADIUS * 2 + 10}`}
                aria-label={`Player ${playerNumber} next bubble ${player.nextBubble}`}
              >
                <BubbleSvg
                  cx={BUBBLE_RADIUS + 5}
                  cy={BUBBLE_RADIUS + 5}
                  color={player.nextBubble}
                />
              </svg>
            </div>
          </div>

          <div className="pb-telemetry-grid">
            <div className="tetris-stat">
              <span className="tetris-label">Angle</span>
              <span className="pb-stat-small" data-testid={`p${playerNumber}-aim`}>
                {formatAimAngle(player.aimAngle)}
              </span>
            </div>
            <div className="tetris-stat">
              <span className="tetris-label">Drop</span>
              <span className="pb-stat-small" title="Shots until the compressor drops one row">
                {shotsLeftUntilDrop}
              </span>
            </div>
            <div className="tetris-stat">
              <span className="tetris-label">Shots</span>
              <span className="pb-stat-small" data-testid={`p${playerNumber}-shots`}>
                {player.shotsFired}
              </span>
            </div>
            {isTwoPlayer ? (
              <div className="tetris-stat">
                <span className="tetris-label">Warn</span>
                <span className="pb-stat-small" data-testid={`p${playerNumber}-incoming`}>
                  {player.incomingGarbage}
                  <GarbageOrbsRow
                    count={player.incomingGarbage}
                    label={`${player.incomingGarbage} incoming attack bubbles`}
                  />
                </span>
              </div>
            ) : (
              <div className="tetris-stat">
                <span className="tetris-label">Left</span>
                <span className="pb-stat-small">{settledCount}</span>
              </div>
            )}
          </div>

          <div
            className={
              hurrySeconds !== null
                ? 'pb-combo-bar is-active pb-combo-cry'
                : statusLine
                  ? `pb-combo-bar is-active pb-combo-${mood}`
                  : 'pb-combo-bar'
            }
            role={statusLine || hurrySeconds !== null ? 'status' : undefined}
          >
            {hurrySeconds !== null
              ? `HURRY! ${hurrySeconds}s`
              : statusLine ?? (player.ceilingWarning ? 'DROP NEXT!' : `STAGE ${player.stage}`)}
          </div>
        </aside>
      </div>
      <div
        className="pb-touch-bar"
        role="group"
        aria-label={`Player ${playerNumber} touch controls`}
        data-testid={`p${playerNumber}-touch-controls`}
      >
        <button
          type="button"
          className="pb-touch-btn pb-touch-rocker"
          data-testid={`p${playerNumber}-touch-left`}
          aria-label={`Player ${playerNumber} aim left`}
          disabled={disabled || player.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            if (event.currentTarget.setPointerCapture) {
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Synthetic pointer events in tests may not register an active pointer id.
              }
            }
            onHoldAimStart(`p${playerNumber}-left`, -AIM_STEP_DEG);
          }}
          onPointerUp={() => onHoldAimEnd(`p${playerNumber}-left`)}
          onPointerCancel={() => onHoldAimEnd(`p${playerNumber}-left`)}
          onPointerLeave={() => onHoldAimEnd(`p${playerNumber}-left`)}
          onClick={(event) => {
            if (event.detail === 0) onAimStep(-AIM_STEP_DEG);
          }}
        >
          ◀ AIM
        </button>
        <button
          type="button"
          className="primary pb-touch-btn pb-touch-fire"
          data-testid={`p${playerNumber}-touch-fire`}
          aria-label={`Player ${playerNumber} fire bubble`}
          disabled={disabled || player.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            onFire();
          }}
          onClick={(event) => {
            if (event.detail === 0) onFire();
          }}
        >
          ● FIRE
        </button>
        <button
          type="button"
          className="pb-touch-btn pb-touch-rocker"
          data-testid={`p${playerNumber}-touch-right`}
          aria-label={`Player ${playerNumber} aim right`}
          disabled={disabled || player.status !== 'playing'}
          onPointerDown={(event) => {
            event.preventDefault();
            if (event.currentTarget.setPointerCapture) {
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Synthetic pointer events in tests may not register an active pointer id.
              }
            }
            onHoldAimStart(`p${playerNumber}-right`, AIM_STEP_DEG);
          }}
          onPointerUp={() => onHoldAimEnd(`p${playerNumber}-right`)}
          onPointerCancel={() => onHoldAimEnd(`p${playerNumber}-right`)}
          onPointerLeave={() => onHoldAimEnd(`p${playerNumber}-right`)}
          onClick={(event) => {
            if (event.detail === 0) onAimStep(AIM_STEP_DEG);
          }}
        >
          AIM ▶
        </button>
      </div>
    </div>
  );
}

const PHONE_PORTRAIT_MAX_WIDTH = 560;
const PHONE_LANDSCAPE_MAX_WIDTH = 900;
const PHONE_LANDSCAPE_MAX_HEIGHT = 440;

/**
 * Distinguishes phones from tablets (#212, #222):
 * - Phone portrait has `innerWidth < 560` (e.g. 360x640, 390x844, 430x932).
 * - Phone landscape has `innerWidth < 900 && innerHeight < 440` (e.g. 844x390).
 * - Tablets in MS Edge / Safari / Chrome (portrait >= 600px like 600x960, 712x1138,
 *   744x1133, 768x1024, or landscape >= 900px / height >= 440px even when browser
 *   tabs/address bars reduce innerHeight to ~460–540px) return `false` so 2 Players
 *   mode is available and selectable.
 */
function isPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < PHONE_PORTRAIT_MAX_WIDTH) return true;
  if (w < PHONE_LANDSCAPE_MAX_WIDTH && h < PHONE_LANDSCAPE_MAX_HEIGHT) return true;
  return false;
}

export function PuzzleBobbleView({ onExit }: { onExit: () => void }) {
  const [phoneViewport, setPhoneViewport] = useState<boolean>(() => isPhoneViewport());
  const [match, setMatch] = useState<PuzzleBobbleMatch>(() =>
    createMatch(isPhoneViewport() ? '1p' : '2p'),
  );
  const [characters, setCharacters] = useState<[CharacterId, CharacterId]>(['dragon', 'dragon']);
  const [stagePreset, setStagePreset] = useState<number>(0); // 0 = random wave, 1..5 = classic Taito stages
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState<boolean>(() => getSharedMusicOn());
  const [backgroundIndex, setBackgroundIndex] = useState(1);
  const [nowPlaying, setNowPlaying] = useState<string | null>(
    () => getSharedArcadeAudio().getCurrentTrack()?.title ?? null,
  );

  const matchRef = useRef(match);
  matchRef.current = match;
  const heldAimKeysRef = useRef<Map<string, number>>(new Map());
  const gameSectionRef = useRef<HTMLElement>(null);
  const prevShotsRef = useRef<[number, number]>([0, 0]);
  const prevEventIdsRef = useRef<[number, number]>([0, 0]);
  const prevMatchStatusRef = useRef(match.status);

  useEffect(() => {
    const audio = getSharedArcadeAudio();
    audio.setPlaylist(PUZZLE_BOBBLE_PLAYLIST);
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

  // Audio playback follows active match state.
  useEffect(() => {
    getSharedArcadeAudio().setActive(musicOn && match.status === 'playing' && !paused);
  }, [musicOn, paused, match.status]);

  // #234: Trigger real-time Tone.js-style SFX when players shoot bubbles, pop
  // clusters, send/receive rising attack bubbles, or finish a round.
  useEffect(() => {
    const sfx = getSharedArcadeAudio().sfx;
    match.players.forEach((p, idx) => {
      const i = idx as 0 | 1;
      if (p.shotsFired > prevShotsRef.current[i]) {
        sfx.playBubbleShoot();
      }
      prevShotsRef.current[i] = p.shotsFired;

      const ev = p.lastEvent;
      if (ev && ev.id !== prevEventIdsRef.current[i]) {
        prevEventIdsRef.current[i] = ev.id;
        if (ev.popped.length > 0) {
          sfx.playBubblePop(ev.popped.length, ev.dropped.length);
        }
        if (ev.sentGarbage > 0) {
          sfx.playGarbageSend(ev.sentGarbage);
        }
        if (ev.risenGarbage.length > 0) {
          sfx.playGarbageRise(ev.risenGarbage.length);
        }
      } else if (!ev) {
        prevEventIdsRef.current[i] = 0;
      }
    });

    if (match.status === 'round_over' && prevMatchStatusRef.current === 'playing') {
      sfx.playRoundEnd(match.winner !== null);
    }
    prevMatchStatusRef.current = match.status;
  }, [match]);

  // Advance flying bubbles and the 10s HURRY UP! shot clock at ~60fps.
  useEffect(() => {
    if (paused || match.status !== 'playing') return;
    let lastTime = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dtMs = Math.min(64, Math.max(0, now - lastTime));
      lastTime = now;
      setMatch((current) => {
        const stepped = stepMatch(current);
        return tickShotTimers(stepped, dtMs);
      });
    }, 16);
    return () => window.clearInterval(id);
  }, [match.status, paused]);

  // Deterministic E2E / test hooks to resolve a player's shot or queue incoming attack bubbles.
  useEffect(() => {
    function onInstantResolve(event: Event) {
      const detail = (event as CustomEvent<{ player?: 0 | 1; preventPop?: boolean }>).detail;
      const idx: 0 | 1 = detail?.player === 1 ? 1 : 0;
      setMatch((current) => {
        if (detail?.preventPop) {
          const target = current.players[idx];
          if (target) {
            const safeGrid = target.grid.map((r) => r.slice());
            // Clear row 3 center neighbors so the test shot never accidentally pops 3 of a kind.
            for (let r = 2; r < safeGrid.length; r += 1) {
              for (let c = 2; c <= 5 && c < safeGrid[r].length; c += 1) {
                if (safeGrid[r][c] === target.currentBubble) {
                  safeGrid[r][c] = target.currentBubble === 'ruby' ? 'azure' : 'ruby';
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
      const detail = (event as CustomEvent<{ player?: 0 | 1; count?: number; colors?: BubbleColor[] }>).detail;
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
    window.addEventListener('yolo:puzzle-bobble:fire-resolve', onInstantResolve);
    window.addEventListener('yolo:puzzle-bobble:queue-garbage', onQueueGarbage);
    window.addEventListener('yolo:puzzle-bobble:round-outcome', onRoundOutcome);
    return () => {
      window.removeEventListener('yolo:puzzle-bobble:fire-resolve', onInstantResolve);
      window.removeEventListener('yolo:puzzle-bobble:queue-garbage', onQueueGarbage);
      window.removeEventListener('yolo:puzzle-bobble:round-outcome', onRoundOutcome);
    };
  }, []);

  const startNewRound = useCallback(
    (mode: '2p' | '1p', keepWins = true, preset = stagePreset) => {
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
        return createMatch(mode, Math.random, wins);
      });
      setPaused(false);
      setBackgroundIndex((index) => nextBackgroundIndex(index));
    },
    [stagePreset],
  );

  // #212, #222: Enforce 1-Player mode on phone viewports while allowing
  // 2-Player side-by-side play on all tablets (including 600–759px portrait and
  // landscape with MS Edge toolbars) and desktops.
  useEffect(() => {
    function onResize() {
      const phone = isPhoneViewport();
      setPhoneViewport((prevPhone) => {
        if (phone && matchRef.current.mode === '2p') {
          startNewRound('1p', false);
        } else if (!phone && prevPhone && matchRef.current.mode === '1p') {
          startNewRound('2p', false);
        }
        return phone;
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [startNewRound]);

  const handleHoldAimStart = useCallback(
    (playerIndex: 0 | 1, keyId: string, deltaDeg: number) => {
      if (paused || matchRef.current.status !== 'playing') return;
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

  // Smooth 60fps aiming + keyboard controls:
  // - Single tap steps by `AIM_STEP_DEG = 0.5°` for high-precision bank shots.
  // - Holding an aim key glides smoothly every frame (`requestAnimationFrame`),
  //   starting at `38°/s` for micro-lining-up and ramping to `115°/s` for sweeps.
  // - Player 1 (left board, or solo): A / D aim; S / F / W shoot.
  // - Player 2 (right board in 2P, or solo fallback): ArrowLeft / ArrowRight aim; ArrowUp / ArrowDown / Space / Enter shoot.
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

    let rafId = 0;
    let lastFrame = performance.now();
    const tapGraceMs = 75;

    function tickAim(now: number) {
      const dtSec = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;

      if (!paused && matchRef.current.status === 'playing' && held.size > 0 && dtSec > 0) {
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
  }, [onExit, paused]);

  const art = BACKGROUNDS[backgroundIndex] ?? BACKGROUNDS[0];

  return (
    <section
      className="tetris pb-game"
      data-mode={match.mode}
      aria-label="Puzzle Bobble game"
      ref={gameSectionRef}
    >
      <div className="tetris-art" aria-hidden="true">
        <img className="tetris-art-layer is-current" src={art.src} alt="" aria-hidden="true" />
      </div>

      <header className="tetris-header pb-header">
        <div className="row">
          <h2 className="tetris-title">Puzzle Bobble</h2>
          {match.mode === '2p' ? (
            <span className="pb-tally" aria-label="Round wins">
              1P {match.wins[0]} – {match.wins[1]} 2P
            </span>
          ) : null}
          <p className="tetris-scene" aria-live="polite">
            Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {art.title}
            {musicOn && nowPlaying ? ` · Music: ${nowPlaying}` : ''}
          </p>
        </div>
        <div className="row">
          {!phoneViewport ? (
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
          ) : null}
          <div className="filter-group pb-stage-stepper" role="group" aria-label="Stage selection" data-testid="pb-stage-selector">
            <button
              type="button"
              aria-label="Previous stage"
              title="Previous stage"
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
              data-testid="pb-stage-button"
              onClick={() => {
                const nextPreset = (stagePreset + 1) % (TOTAL_STAGES + 1);
                setStagePreset(nextPreset);
                startNewRound(match.mode, true, nextPreset);
              }}
              title={`Cycle between random waves and ${TOTAL_STAGES} classic arcade stages`}
            >
              {stagePreset === 0
                ? 'Wave: Random'
                : `Stage ${stagePreset}: ${stageTitle(stagePreset)}`}
            </button>
            <button
              type="button"
              aria-label="Next stage"
              title="Next stage"
              onClick={() => {
                const nextPreset = (stagePreset + 1) % (TOTAL_STAGES + 1);
                setStagePreset(nextPreset);
                startNewRound(match.mode, true, nextPreset);
              }}
            >
              ›
            </button>
          </div>
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
            onClick={() => {
              if (match.status === 'round_over' && stagePreset > 0) {
                const advanced = (stagePreset % TOTAL_STAGES) + 1;
                setStagePreset(advanced);
                startNewRound(match.mode, true, advanced);
              } else {
                startNewRound(match.mode, true);
              }
            }}
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
          character={characters[0]}
          onSelectCharacter={(c) => setCharacters(([_, p2]) => [c, p2])}
          controlsLabel={
            match.mode === '2p'
              ? 'ASDF or Drag · S/F or FIRE'
              : 'Touch Drag / ASDF / Arrows'
          }
          isTwoPlayer={match.mode === '2p'}
          disabled={paused || match.status !== 'playing'}
          onAimStep={(delta) => setMatch((current) => aimPlayer(current, 0, delta))}
          onAimDirect={(angle) => setMatch((current) => setPlayerAimAngle(current, 0, angle))}
          onFire={() => setMatch((current) => firePlayerBubble(current, 0))}
          onHoldAimStart={(keyId, delta) => handleHoldAimStart(0, keyId, delta)}
          onHoldAimEnd={handleHoldAimEnd}
        />
        {match.mode === '2p' && match.players[1] ? (
          <PlayerArena
            player={match.players[1]}
            playerNumber={2}
            character={characters[1]}
            onSelectCharacter={(c) => setCharacters(([p1]) => [p1, c])}
            controlsLabel="Arrows or Drag · ↑/↓ or FIRE"
            isTwoPlayer
            disabled={paused || match.status !== 'playing'}
            onAimStep={(delta) => setMatch((current) => aimPlayer(current, 1, delta))}
            onAimDirect={(angle) => setMatch((current) => setPlayerAimAngle(current, 1, angle))}
            onFire={() => setMatch((current) => firePlayerBubble(current, 1))}
            onHoldAimStart={(keyId, delta) => handleHoldAimStart(1, keyId, delta)}
            onHoldAimEnd={handleHoldAimEnd}
          />
        ) : null}
      </div>

      {match.status === 'round_over' ? (
        <p className="tetris-over pb-banner" role="status">
          {match.winner !== null
            ? `Player ${match.winner + 1} wins the round! (${match.wins[0]}–${match.wins[1]}). Press Next round to battle again.`
            : `Game over — score ${match.players[0].score.toLocaleString()}. Press Next round to play again.`}
        </p>
      ) : null}
    </section>
  );
}
