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
  type PuzzleBobbleRadarSnapshot,
} from '../netplay';
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

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRadarFromBoard(board: PlayerBoardState): PuzzleBobbleRadarSnapshot {
  return {
    grid: board.grid.map((row) => row.slice()),
    ceilingDrop: board.ceilingDrop,
    score: board.score,
    status: board.status,
    incomingGarbage: board.incomingGarbage,
    aimAngle: Math.round(board.aimAngle * 2) / 2,
    currentBubble: board.currentBubble,
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

interface RadarTransientFx {
  key: string;
  x: number;
  y: number;
  color: BubbleColor;
  kind: 'pop' | 'drop' | 'rise';
}

const OpponentBubbleRadar = memo(function OpponentBubbleRadar({
  opponentName,
  radar,
}: {
  opponentName: string;
  radar: PuzzleBobbleRadarSnapshot;
}) {
  const ceilingY = radar.ceilingDrop * ROW_STEP;
  const statusLabel =
    radar.status === 'ko' ? 'KO' : radar.status === 'won' ? 'WIN' : 'LIVE';

  const prevGridRef = useRef<PlayerBoardState['grid'] | null>(null);
  const prevCeilingRef = useRef<number>(radar.ceilingDrop);
  const prevEventIdRef = useRef<number>(0);
  const fxSeqRef = useRef<number>(0);
  const [transientFx, setTransientFx] = useState<RadarTransientFx[]>([]);
  const [risenCoordKeys, setRisenCoordKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const prevGrid = prevGridRef.current;
    const prevCeiling = prevCeilingRef.current;
    prevGridRef.current = radar.grid;
    prevCeilingRef.current = radar.ceilingDrop;

    const addedFx: RadarTransientFx[] = [];
    const nextRisen = new Set<string>();
    const ev = radar.lastEvent;

    if (ev && ev.id !== prevEventIdRef.current) {
      prevEventIdRef.current = ev.id;
      for (const cell of ev.popped ?? []) {
        addedFx.push({
          key: `pop-${++fxSeqRef.current}`,
          x: cell.x,
          y: cell.y,
          color: cell.color,
          kind: 'pop',
        });
      }
      for (const cell of ev.dropped ?? []) {
        addedFx.push({
          key: `drop-${++fxSeqRef.current}`,
          x: cell.x,
          y: cell.y,
          color: cell.color,
          kind: 'drop',
        });
      }
      for (const cell of ev.risenGarbage ?? []) {
        nextRisen.add(`${cell.row},${cell.col}`);
        addedFx.push({
          key: `rise-${++fxSeqRef.current}`,
          x: cell.x,
          y: cell.y,
          color: cell.color,
          kind: 'rise',
        });
      }
    } else if (prevGrid) {
      // Also diff grids directly when a raw pb_state snapshot arrives without lastEvent (#256).
      for (let r = 0; r < Math.max(prevGrid.length, radar.grid.length); r += 1) {
        const cols = colsForRow(r);
        for (let c = 0; c < cols; c += 1) {
          const before = prevGrid[r]?.[c] ?? null;
          const after = radar.grid[r]?.[c] ?? null;
          if (before && !after) {
            const center = bubbleCenter(r, c, prevCeiling);
            addedFx.push({
              key: `diff-pop-${++fxSeqRef.current}`,
              x: center.x,
              y: center.y,
              color: before,
              kind: 'pop',
            });
          } else if (!before && after) {
            const center = bubbleCenter(r, c, radar.ceilingDrop);
            nextRisen.add(`${r},${c}`);
            addedFx.push({
              key: `diff-rise-${++fxSeqRef.current}`,
              x: center.x,
              y: center.y,
              color: after,
              kind: 'rise',
            });
          }
        }
      }
    }

    if (addedFx.length > 0 || nextRisen.size > 0) {
      setRisenCoordKeys(nextRisen);
      setTransientFx((cur) => [...cur.slice(-24), ...addedFx]);
      const id = window.setTimeout(() => {
        setTransientFx([]);
        setRisenCoordKeys(new Set());
      }, 520);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [radar.grid, radar.ceilingDrop, radar.lastEvent]);

  const stagingY = DANGER_LINE_Y + 12;

  return (
    <div
      className="netplay-radar-card pb-radar-card"
      data-testid="pb-opponent-radar"
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
          data-testid="pb-opponent-status"
        >
          {statusLabel}
        </span>
      </div>
      <svg
        className="pb-radar-svg"
        viewBox={`0 0 ${ARENA_WIDTH} ${ARENA_HEIGHT}`}
        role="img"
        aria-label={`${opponentName} bubble radar, score ${radar.score}`}
      >
        {ceilingY > 0 ? (
          <rect
            x={0}
            y={0}
            width={ARENA_WIDTH}
            height={ceilingY}
            fill="var(--closed-weak)"
          />
        ) : null}
        <line
          x1={4}
          y1={DANGER_LINE_Y}
          x2={ARENA_WIDTH - 4}
          y2={DANGER_LINE_Y}
          stroke="var(--tetromino-z)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        {/* Rising garbage trails on opponent mini-radar (#256) */}
        {transientFx
          .filter((fx) => fx.kind === 'rise')
          .map((fx) => (
            <line
              key={`trail-${fx.key}`}
              className="pb-rise-trail"
              x1={fx.x}
              y1={stagingY}
              x2={fx.x}
              y2={fx.y}
              stroke={BUBBLE_TOKEN[fx.color]}
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}
        {radar.grid.map((row, r) =>
          row.slice(0, colsForRow(r)).map((color, c) => {
            if (!color) return null;
            const center = bubbleCenter(r, c, radar.ceilingDrop);
            const coordKey = `${r},${c}`;
            const justRose = risenCoordKeys.has(coordKey);
            return (
              <circle
                key={justRose ? `${coordKey}-rise` : coordKey}
                className={justRose ? 'pb-rise-bubble' : undefined}
                style={
                  justRose
                    ? ({ '--pb-rise-from': `${stagingY - center.y}px` } as CSSProperties)
                    : undefined
                }
                cx={center.x}
                cy={center.y}
                r={BUBBLE_RADIUS - 1}
                fill={BUBBLE_TOKEN[color]}
                stroke="var(--text)"
                strokeWidth="1.2"
              />
            );
          }),
        )}
        {/* Popped & dropped (avalanche) bubble animations on opponent mini-radar (#256) */}
        {transientFx
          .filter((fx) => fx.kind === 'pop' || fx.kind === 'drop')
          .map((fx) => (
            <circle
              key={fx.key}
              className={fx.kind === 'pop' ? 'pb-radar-pop-fx' : 'pb-radar-drop-fx'}
              cx={fx.x}
              cy={fx.y}
              r={BUBBLE_RADIUS - 1}
              fill={BUBBLE_TOKEN[fx.color]}
              stroke="var(--text)"
              strokeWidth="1.2"
            />
          ))}
        {/* Flying projectile bubble on opponent mini-radar (#256) */}
        {radar.flying ? (
          <circle
            className="pb-radar-flying-bubble"
            cx={radar.flying.x}
            cy={radar.flying.y}
            r={BUBBLE_RADIUS - 1}
            fill={BUBBLE_TOKEN[radar.flying.color]}
            stroke="var(--text)"
            strokeWidth="1.2"
          />
        ) : null}
        {/* Smoothly interpolated opponent aiming needle (#256) */}
        <g
          className="pb-radar-aim-group"
          data-testid="pb-opponent-aim"
          style={
            {
              transform: `rotate(${radar.aimAngle}deg)`,
              transformOrigin: `${LAUNCHER_X}px ${LAUNCHER_Y}px`,
            } as CSSProperties
          }
        >
          <line
            x1={LAUNCHER_X}
            y1={LAUNCHER_Y}
            x2={LAUNCHER_X}
            y2={LAUNCHER_Y - 34}
            stroke="var(--tetromino-o)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <circle
          cx={LAUNCHER_X}
          cy={LAUNCHER_Y}
          r={BUBBLE_RADIUS - 2}
          fill={BUBBLE_TOKEN[radar.currentBubble]}
          stroke="var(--text)"
          strokeWidth="1.2"
        />
      </svg>
      <div className="netplay-radar-stats">
        <span data-testid="pb-opponent-score">{radar.score} pts</span>
      </div>
    </div>
  );
});

const SettledBubbleGridSvg = memo(function SettledBubbleGridSvg({
  grid,
  ceilingDrop,
  ceilingWarning,
  lastEvent,
}: {
  grid: PlayerBoardState['grid'];
  ceilingDrop: number;
  ceilingWarning: boolean;
  lastEvent: PlayerBoardState['lastEvent'];
}) {
  const stagingY = DANGER_LINE_Y + 12;
  const risenKeySet = new Set<string>(
    (lastEvent?.risenGarbage ?? []).map((cell) => `${cell.row},${cell.col}`),
  );
  return (
    <g className={ceilingWarning ? 'pb-cluster-warning' : undefined}>
      {grid.map((row, r) =>
        Array.from({ length: colsForRow(r) }, (_, c) => {
          const color = row[c];
          if (!color) return null;
          const center = bubbleCenter(r, c, ceilingDrop);
          const coordKey = `${r},${c}`;
          const justRose = risenKeySet.has(coordKey) && lastEvent !== null;
          return (
            <BubbleSvg
              key={justRose ? `${coordKey}-rise-${lastEvent.id}` : coordKey}
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
  );
});

function PlayerArena({
  player,
  playerNumber,
  character,
  onSelectCharacter,
  isTwoPlayer,
  showTouchControls,
  onlineOpponent,
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
  isTwoPlayer: boolean;
  showTouchControls: boolean;
  onlineOpponent?: { name: string; radar: PuzzleBobbleRadarSnapshot } | null;
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
  const polylinePoints = useMemo(() => {
    const guide = aimGuidePoints(player.aimAngle, player.ceilingDrop);
    return guide.map((pt) => `${pt.x},${pt.y}`).join(' ');
  }, [player.aimAngle, player.ceilingDrop]);
  const summary = eventSummary(player);
  const hurrySeconds = hurryCountdownSeconds(player);
  const charName = characterDisplayName(character, playerNumber);
  const mood = deriveMascotMood(player);

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
          {player.incomingGarbage > 0 ? (
            <span className="badge waiting" role="status">
              ATK +{player.incomingGarbage}
            </span>
          ) : player.status !== 'playing' || player.ceilingWarning ? (
            <span className={player.ceilingWarning ? 'badge waiting' : 'badge'}>
              {player.status === 'won'
                ? 'WINNER!'
                : player.status === 'ko'
                  ? 'KO'
                  : 'DROP NEXT!'}
            </span>
          ) : null}
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
            if (!disabled && player.status === 'playing') {
              aimFromPointerEvent(event);
              onFire();
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
          <SettledBubbleGridSvg
            grid={player.grid}
            ceilingDrop={player.ceilingDrop}
            ceilingWarning={player.ceilingWarning}
            lastEvent={lastEv}
          />

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
          ) : hurrySeconds !== null && player.status === 'playing' ? (
            <text
              x={LAUNCHER_X}
              y={ARENA_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="20"
              fontWeight="800"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="var(--tetromino-z)"
              stroke="var(--cabinet-well)"
              strokeWidth="4"
              paintOrder="stroke fill"
              role="status"
              data-testid={`p${playerNumber}-hurry-overlay`}
            >
              HURRY UP! {hurrySeconds}
            </text>
          ) : null}
        </svg>

        <aside className="tetris-side pb-side">
          <div className="tetris-stat pb-score-slot">
            <span className="tetris-label">Score</span>
            <span className="tetris-value pb-score-value" aria-live="polite" data-testid={`p${playerNumber}-score`}>
              {player.score.toLocaleString()}
            </span>
          </div>

          {onlineOpponent ? (
            <OpponentBubbleRadar
              opponentName={onlineOpponent.name}
              radar={onlineOpponent.radar}
            />
          ) : (
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
          )}

          {/* Screen-reader / test telemetry hooks kept invisible so the arcade cabinet stays uncluttered (#248) */}
          <span className="sr-only" data-testid={`p${playerNumber}-aim`}>
            {formatAimAngle(player.aimAngle)}
          </span>
          <span className="sr-only" data-testid={`p${playerNumber}-shots`}>
            {player.shotsFired}
          </span>

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
          ) : null}

          <span className="sr-only" role={statusLine || hurrySeconds !== null ? 'status' : undefined}>
            {hurrySeconds !== null
              ? `HURRY! ${hurrySeconds}s`
              : statusLine ?? (player.ceilingWarning ? 'DROP NEXT!' : `STAGE ${player.stage}`)}
          </span>
        </aside>
      </div>
      {showTouchControls ? (
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
            ◀
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
            ●
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
            ▶
          </button>
        </div>
      ) : null}
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

function motionReduced(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function PuzzleBobbleView({ onExit }: { onExit: () => void }) {
  const [phoneViewport, setPhoneViewport] = useState<boolean>(() => isPhoneViewport());
  const touchSeenRef = useRef<boolean>(detectTouchAvailable());
  const [touchAvailable, setTouchAvailable] = useState<boolean>(() => touchSeenRef.current);
  const [keyboardAvailable, setKeyboardAvailable] = useState<boolean>(() => hasKeyboardAvailable());
  const [match, setMatch] = useState<PuzzleBobbleMatch>(() =>
    createMatch(isPhoneViewport() ? '1p' : '2p'),
  );
  const [characters, setCharacters] = useState<[CharacterId, CharacterId]>(['dragon', 'dragon']);
  const [stagePreset, setStagePreset] = useState<number>(0); // 0 = random wave, 1..5 = classic Taito stages
  const [paused, setPaused] = useState<boolean>(() => {
    if (!getSharedNetplay().getState().activeRoom) {
      setSharedGamePaused(true);
      return true;
    }
    return getSharedGamePaused();
  });
  const [musicOn, setMusicOn] = useState<boolean>(() => getSharedMusicOn());
  const [backgroundIndex, setBackgroundIndex] = useState(1);
  const [nowPlaying, setNowPlaying] = useState<string | null>(
    () => getSharedArcadeAudio().getCurrentTrack()?.title ?? null,
  );
  const [netplay, setNetplay] = useState<NetplayState>(() => getSharedNetplay().getState());
  const [opponentRadar, setOpponentRadar] = useState<PuzzleBobbleRadarSnapshot>(() =>
    createRadarFromBoard(match.players[0]),
  );
  const [countdown, setCountdown] = useState<number>(3);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState<number>(20);

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
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomStartedRef = useRef<string | null>(null);
  const onlineOutcomeSentRef = useRef<boolean>(false);
  const heldAimKeysRef = useRef<Map<string, number>>(new Map());
  const gameSectionRef = useRef<HTMLElement>(null);
  const prevShotsRef = useRef<[number, number]>([0, 0]);
  const prevEventIdsRef = useRef<[number, number]>([0, 0]);
  const prevMatchStatusRef = useRef(match.status);

  const activePbRoom =
    netplay.activeRoom && netplay.activeRoom.gameId === 'puzzle-bobble'
      ? netplay.activeRoom
      : null;
  const isOnline2P = activePbRoom !== null;
  const isReadyCheck = activePbRoom?.status === 'ready_check';
  const isNetworkPaused = Boolean(
    isOnline2P &&
      activePbRoom?.status === 'playing' &&
      activePbRoom?.syncStatus === 'paused',
  );
  const syncSecondsLeft = Math.max(
    0,
    Math.ceil((activePbRoom?.syncRemainingMs ?? 15_000) / 1000),
  );
  const isInviting = netplay.myPendingInvite?.gameId === 'puzzle-bobble';
  const myRoomPlayer = activePbRoom?.players.find((p) => p.id === netplay.clientId);
  const myReady = Boolean(myRoomPlayer?.ready);
  const oppReady = Boolean(activePbRoom?.opponent?.ready);

  useEffect(() => {
    if (activePbRoom?.syncStatus === 'timeout') {
      void getSharedNetplay().leaveRoom();
      onExit();
    }
  }, [activePbRoom?.syncStatus, onExit]);

  // Continuous 2P keep-alive and live board radar push (#250, #254: deduplicated).
  const lastRadarDigestRef = useRef<string>('');
  useEffect(() => {
    if (!isOnline2P || isReadyCheck || isNetworkPaused || match.status !== 'playing') return;
    const pushRadar = () => {
      const p0 = matchRef.current.players[0];
      if (!p0) return;
      const snap = createRadarFromBoard(p0);
      const digest = JSON.stringify(snap);
      if (digest === lastRadarDigestRef.current) return;
      lastRadarDigestRef.current = digest;
      void getSharedNetplay().sendRoomEvent('pb_state', snap);
    };
    pushRadar();
    const id = window.setInterval(pushRadar, 500);
    return () => window.clearInterval(id);
  }, [isOnline2P, isReadyCheck, isNetworkPaused, match.status]);

  const startOnlineRoundWithSeed = useCallback(
    (seed: number, resetWins = false, preset = stagePreset) => {
      const rng = mulberry32(seed);
      prevShotsRef.current = [0, 0];
      prevEventIdsRef.current = [0, 0];
      prevMatchStatusRef.current = 'playing';
      onlineOutcomeSentRef.current = false;

      let nextBoard: PlayerBoardState;
      if (preset > 0) {
        const grid = createStageGrid(preset, rng);
        nextBoard = createPlayerBoard(rng, grid, preset);
      } else {
        const seeded = createMatch('1p', rng);
        nextBoard = seeded.players[0];
      }
      const initialRadar = createRadarFromBoard(nextBoard);
      setOpponentRadar(initialRadar);
      setMatch((current) => ({
        mode: '1p',
        players: [nextBoard],
        status: 'playing',
        winner: null,
        wins: resetWins ? [0, 0] : current.wins,
      }));
      setSharedGamePaused(false);
      setCountdown(3);
    },
    [stagePreset],
  );

  // 20-second invite countdown timer (#248).
  useEffect(() => {
    const invite = netplay.myPendingInvite;
    if (!invite || invite.gameId !== 'puzzle-bobble') {
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

  // 3, 2, 1 car-race start countdown with sound effects (#248, #252, #256: 2s per beat).
  useEffect(() => {
    if (countdown <= 0 || paused || isReadyCheck || isInviting || isNetworkPaused) return;
    getSharedArcadeAudio().sfx.playCountdown(countdown);
    const id = window.setTimeout(() => {
      setCountdown((c) => {
        const next = Math.max(0, c - 1);
        if (next === 0) {
          getSharedArcadeAudio().sfx.playCountdown(0);
        }
        return next;
      });
    }, 2000);
    return () => window.clearTimeout(id);
  }, [countdown, paused, isReadyCheck, isInviting, isNetworkPaused]);

  useEffect(() => {
    const client = getSharedNetplay();
    const unsubState = client.subscribe((nextState) => {
      setNetplay(nextState);
      const room =
        nextState.activeRoom && nextState.activeRoom.gameId === 'puzzle-bobble'
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
      }
    });

    const unsubEvents = client.onRoomEvent((event) => {
      if (event.kind === 'match_start') {
        const payload = event.payload as { gameId?: string; seed?: number; id?: string; roomId?: string } | null;
        if (payload && payload.gameId === 'puzzle-bobble') {
          const rid = payload.id ?? payload.roomId ?? null;
          if (rid && activeRoomStartedRef.current !== rid) {
            activeRoomIdRef.current = rid;
            activeRoomStartedRef.current = rid;
            startOnlineRoundWithSeed(payload.seed ?? 2026, true);
          }
        }
        return;
      }

      if (event.kind === 'sync_resumed') {
        setCountdown(3);
        return;
      }

      if (event.kind === 'sync_timeout') {
        void getSharedNetplay().leaveRoom();
        onExit();
        return;
      }

      if (event.senderId === client.getState().clientId) return;

      if (event.kind === 'pb_attack') {
        const payload = event.payload as { count?: number; colors?: BubbleColor[] } | null;
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

      if (event.kind === 'pb_state') {
        const snapshot = event.payload as PuzzleBobbleRadarSnapshot | null;
        if (snapshot && Array.isArray(snapshot.grid)) {
          setOpponentRadar(snapshot);
        }
        return;
      }

      if (event.kind === 'pb_outcome') {
        const payload = event.payload as { outcome?: 'cleared' | 'ko' } | null;
        if (payload?.outcome === 'ko') {
          setOpponentRadar((prev) => ({ ...prev, status: 'ko' }));
          setMatch((current) => {
            if (current.status === 'round_over') return current;
            onlineOutcomeSentRef.current = true;
            return resolveMatchOutcome(current, 0);
          });
        } else if (payload?.outcome === 'cleared') {
          setOpponentRadar((prev) => ({ ...prev, status: 'won' }));
          setMatch((current) => {
            if (current.status === 'round_over') return current;
            onlineOutcomeSentRef.current = true;
            return resolveMatchOutcome(current, 1);
          });
        }
        return;
      }

      if (event.kind === 'pb_rematch') {
        const payload = event.payload as { seed?: number; preset?: number } | null;
        const nextPreset = typeof payload?.preset === 'number' ? payload.preset : stagePreset;
        if (nextPreset !== stagePreset) setStagePreset(nextPreset);
        startOnlineRoundWithSeed(payload?.seed ?? Date.now(), false, nextPreset);
        return;
      }

      if (event.kind === 'player_left') {
        setOpponentRadar((prev) => ({ ...prev, status: 'ko' }));
        setMatch((current) => {
          if (current.status === 'round_over') return current;
          onlineOutcomeSentRef.current = true;
          return resolveMatchOutcome(current, 0);
        });
      }
    });

    return () => {
      unsubState();
      unsubEvents();
    };
  }, [stagePreset, startOnlineRoundWithSeed]);

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
    getSharedArcadeAudio().setActive(musicOn && match.status === 'playing');
  }, [musicOn, match.status]);

  // #234, #236: Trigger real-time Tone.js-style SFX when players shoot bubbles, pop
  // clusters, send/receive rising attack bubbles, or finish a round, and relay
  // 2P Online attacks, radar state, and round outcomes.
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
        const onlineAttack =
          isOnline2P && i === 0
            ? Math.min(12, Math.max(0, ev.popped.length - 3) + ev.dropped.length)
            : 0;
        if (ev.sentGarbage > 0 || onlineAttack > 0) {
          sfx.playGarbageSend(Math.max(ev.sentGarbage, onlineAttack));
        }
        if (ev.risenGarbage.length > 0) {
          sfx.playGarbageRise(ev.risenGarbage.length);
        }

        if (isOnline2P && i === 0) {
          if (onlineAttack > 0) {
            const colors = generateGarbageColors(onlineAttack);
            void getSharedNetplay().sendRoomEvent('pb_attack', {
              count: onlineAttack,
              colors,
            });
          }
          if (ev.clearBonus > 0 && !onlineOutcomeSentRef.current) {
            onlineOutcomeSentRef.current = true;
            void getSharedNetplay().sendRoomEvent('pb_outcome', { outcome: 'cleared' });
            setOpponentRadar((prev) => ({ ...prev, status: 'ko' }));
            setMatch((cur) => (cur.status === 'round_over' ? cur : resolveMatchOutcome(cur, 0)));
          }
          void getSharedNetplay().sendRoomEvent('pb_state', createRadarFromBoard(p));
        }
      } else if (!ev) {
        prevEventIdsRef.current[i] = 0;
      }
    });

    const p0 = match.players[0];
    if (isOnline2P && p0 && p0.status === 'ko' && !onlineOutcomeSentRef.current) {
      onlineOutcomeSentRef.current = true;
      void getSharedNetplay().sendRoomEvent('pb_outcome', { outcome: 'ko' });
      void getSharedNetplay().sendRoomEvent('pb_state', createRadarFromBoard(p0));
      setOpponentRadar((prev) => ({ ...prev, status: 'won' }));
      setMatch((cur) => (cur.status === 'round_over' ? cur : resolveMatchOutcome(cur, 1)));
    }

    if (match.status === 'round_over' && prevMatchStatusRef.current === 'playing') {
      sfx.playRoundEnd(match.winner !== null);
    }
    prevMatchStatusRef.current = match.status;
  }, [isOnline2P, match]);

  // Advance flying bubbles and the 10s HURRY UP! shot clock at ~60fps (#254: skip React state allocation when no bubble is flying and hurrySeconds is unchanged).
  useEffect(() => {
    if (paused || isReadyCheck || isInviting || isNetworkPaused || match.status !== 'playing') return;
    let lastTime = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dtMs = Math.min(64, Math.max(0, now - lastTime));
      lastTime = now;
      setMatch((current) => {
        const anyFlying = current.players.some((p) => p && p.flying !== null);
        const stepped = anyFlying ? stepMatch(current) : current;
        if (countdown > 0) return stepped;

        let needsRender = stepped !== current;
        for (const p of stepped.players) {
          if (!p || p.status !== 'playing') continue;
          if (p.flying !== null) {
            p.stageElapsedMs += dtMs;
            continue;
          }
          const prevHurry = hurryCountdownSeconds(p);
          const nextRemaining = p.shotTimerMs - dtMs;
          if (nextRemaining <= 0) {
            needsRender = true;
            break;
          }
          const nextHurry =
            nextRemaining > 5000 ? null : Math.max(1, Math.ceil(nextRemaining / 1000));
          if (nextHurry !== prevHurry) {
            needsRender = true;
            break;
          }
        }
        if (!needsRender) {
          for (const p of stepped.players) {
            if (!p || p.status !== 'playing' || p.flying !== null) continue;
            p.stageElapsedMs += dtMs;
            p.shotTimerMs -= dtMs;
          }
          return current;
        }
        return tickShotTimers(stepped, dtMs);
      });
    }, 16);
    return () => window.clearInterval(id);
  }, [match.status, paused, isReadyCheck, isInviting, isNetworkPaused, countdown]);

  // Deterministic E2E / test hooks to resolve a player's shot or queue incoming attack bubbles.
  useEffect(() => {
    function onInstantResolve(event: Event) {
      const detail = (
        event as CustomEvent<{ player?: 0 | 1; preventPop?: boolean; forceClusterPop?: boolean }>
      ).detail;
      const idx: 0 | 1 = detail?.player === 1 ? 1 : 0;
      setMatch((current) => {
        if (detail?.forceClusterPop) {
          const target = current.players[idx];
          if (target) {
            const popGrid = target.grid.map((r) => r.slice());
            const color = target.currentBubble;
            // Create a 4-bubble matching cluster around the center frontier (row 3, cols 2..4)
            // so a straight-up shot at 0° pops 5 bubbles -> sends 2+ garbage bubbles to opponent.
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
    (mode: '2p' | '1p', keepWins = true, preset = stagePreset, unpause = true) => {
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
      if (unpause) {
        setSharedGamePaused(false);
      }
      setCountdown(3);
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
        event.preventDefault();
        toggleSharedGamePaused();
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
      void getSharedNetplay().sendRoomEvent('pb_rematch', {
        seed: nextSeed,
        preset: nextPreset,
      });
    } else {
      startNewRound(match.mode, true, nextPreset);
    }
  };

  const canSelectLocal2P = !phoneViewport && keyboardAvailable;
  const canSelectOnline2P = netplay.onlineCount > 1 || isOnline2P || isInviting;

  return (
    <section
      className="tetris pb-game"
      data-mode={isOnline2P ? '1p' : match.mode}
      aria-label="Puzzle Bobble game"
      ref={gameSectionRef}
    >
      <div className="tetris-art" aria-hidden="true">
        <img className="tetris-art-layer is-current" src={art.src} alt="" aria-hidden="true" />
      </div>

      <header className="tetris-header pb-header">
        <div className="row">
          <h2 className="tetris-title">Puzzle Bobble</h2>
          {isOnline2P && activePbRoom ? (
            <span className="pb-tally" data-testid="pb-online-tally" aria-label="Online round wins">
              YOU {match.wins[0]} – {match.wins[1]} {activePbRoom.opponent.name}
            </span>
          ) : match.mode === '2p' ? (
            <span className="pb-tally" aria-label="Round wins">
              1P {match.wins[0]} – {match.wins[1]} 2P
            </span>
          ) : null}
          <p className="tetris-scene sr-only" aria-live="polite">
            Scene {backgroundIndex + 1}/{BACKGROUNDS.length}: {art.title}
            {musicOn && nowPlaying ? ` · Music: ${nowPlaying}` : ''}
          </p>
        </div>
      </header>

      <div className="tetris-body pb-boards">
        <PlayerArena
          player={match.players[0]}
          playerNumber={1}
          character={characters[0]}
          onSelectCharacter={(c) => setCharacters(([_, p2]) => [c, p2])}
          isTwoPlayer={match.mode === '2p' || isOnline2P}
          showTouchControls={touchAvailable}
          onlineOpponent={
            isOnline2P && activePbRoom
              ? { name: activePbRoom.opponent.name, radar: opponentRadar }
              : null
          }
          disabled={paused || isReadyCheck || match.status !== 'playing'}
          onAimStep={(delta) => {
            setMatch((current) => aimPlayer(current, 0, delta));
          }}
          onAimDirect={(angle) => {
            setMatch((current) => setPlayerAimAngle(current, 0, angle));
          }}
          onFire={() => {
            setMatch((current) => firePlayerBubble(current, 0));
          }}
          onHoldAimStart={(keyId, delta) => {
            handleHoldAimStart(0, keyId, delta);
          }}
          onHoldAimEnd={handleHoldAimEnd}
        />
        {!isOnline2P && match.mode === '2p' && match.players[1] ? (
          <PlayerArena
            player={match.players[1]}
            playerNumber={2}
            character={characters[1]}
            onSelectCharacter={(c) => setCharacters(([p1]) => [p1, c])}
            isTwoPlayer
            showTouchControls={touchAvailable}
            disabled={paused || isReadyCheck || match.status !== 'playing'}
            onAimStep={(delta) => {
              setMatch((current) => aimPlayer(current, 1, delta));
            }}
            onAimDirect={(angle) => {
              setMatch((current) => setPlayerAimAngle(current, 1, angle));
            }}
            onFire={() => {
              setMatch((current) => firePlayerBubble(current, 1));
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
          role="status"
          aria-live="polite"
        >
          <span className="arcade-countdown-digit">{countdown}</span>
        </div>
      ) : null}

      {isInviting && !isOnline2P ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="status"
            aria-live="polite"
            data-testid="pb-invite-waiting"
          >
            <span className="game-pause-kicker">2P Online Matchmaking</span>
            <h3 className="game-pause-title">Waiting for player…</h3>
            <p className="game-pause-copy" data-testid="netplay-invite-countdown">
              Invite expires in <strong>{inviteSecondsLeft}s</strong>
            </p>
            <div className="game-pause-actions">
              <button
                type="button"
                data-testid="pb-cancel-invite-btn"
                onClick={() => void getSharedNetplay().cancelInvite()}
              >
                Cancel invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOnline2P && isReadyCheck && activePbRoom ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="dialog"
            aria-modal="true"
            aria-label="2P Online Ready Check"
            data-testid="netplay-ready-modal"
          >
            <span className="game-pause-kicker">2P Online Puzzle Bobble</span>
            <h3 className="game-pause-title">Players Ready?</h3>
            <div className="netplay-ready-roster">
              <div className="netplay-ready-row">
                <span>YOU ({netplay.clientName})</span>
                <span className={myReady ? 'netplay-ready-pill is-ready' : 'netplay-ready-pill'}>
                  {myReady ? 'READY ✓' : 'Waiting…'}
                </span>
              </div>
              <div className="netplay-ready-row">
                <span>{activePbRoom.opponent.name}</span>
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

      {isNetworkPaused && activePbRoom ? (
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
                {activePbRoom.laggingPlayerNames?.length
                  ? activePbRoom.laggingPlayerNames.join(', ')
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
          >
            <span className="game-pause-kicker">Puzzle Bobble</span>
            <h3 className="game-pause-title">Paused</h3>
            <div className="game-pause-section">
              <span className="tetris-label">Game Mode</span>
              <div className="filter-group" role="group" aria-label="Player mode">
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
                    2 Players
                  </button>
                ) : null}
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
                <button
                  type="button"
                  data-testid="pb-2p-online-btn"
                  aria-pressed={isOnline2P || isInviting}
                  disabled={!canSelectOnline2P}
                  title={
                    canSelectOnline2P
                      ? 'Challenge online players to 2P Puzzle Bobble'
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
                      void getSharedNetplay().sendInvite('puzzle-bobble');
                    }
                  }}
                >
                  {isOnline2P
                    ? `2P Online (${activePbRoom.opponent.name})`
                    : isInviting
                      ? `Waiting 2P… (${inviteSecondsLeft}s)`
                      : '2P Online'}
                </button>
              </div>
            </div>
            <div className="game-pause-section">
              <span className="tetris-label">Stage</span>
              <div
                className="filter-group pb-stage-stepper"
                role="group"
                aria-label="Stage selection"
                data-testid="pb-stage-selector"
              >
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
                  handleNextOrNewRound();
                  setSharedGamePaused(false);
                }}
              >
                {match.status === 'round_over' ? 'Next round' : 'New game'}
              </button>
              <button
                type="button"
                data-testid="pause-menu-exit"
                aria-label="Close Puzzle Bobble"
                onClick={onExit}
              >
                Exit to menu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {match.status === 'round_over' ? (
        <p className="tetris-over pb-banner" role="status" data-testid="pb-round-banner">
          {isOnline2P && activePbRoom
            ? match.winner === 0
              ? `YOU WIN! Beat ${activePbRoom.opponent.name} (${match.wins[0]}–${match.wins[1]}). `
              : `${activePbRoom.opponent.name} wins the round! (${match.wins[0]}–${match.wins[1]}). `
            : match.winner !== null
              ? `Player ${match.winner + 1} wins the round! (${match.wins[0]}–${match.wins[1]}). `
              : `Game over — score ${match.players[0].score.toLocaleString()}. `}
          <button type="button" className="primary" onClick={handleNextOrNewRound}>
            Next round
          </button>
        </p>
      ) : null}
    </section>
  );
}
