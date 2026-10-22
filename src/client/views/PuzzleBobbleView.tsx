import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { TetrisMusic } from '../audio/tetrisMusic';
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
  shotsPerCeilingDrop,
  stepMatch,
  tickShotTimers,
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
        accent: playerNumber === 1 ? 'var(--tetromino-z)' : 'var(--tetromino-i)',
      };
    case 'dog':
      return {
        body: playerNumber === 1 ? 'var(--tetromino-o)' : 'var(--tetromino-i)',
        accent: playerNumber === 1 ? 'var(--tetromino-l)' : 'var(--tetromino-j)',
      };
    case 'bunny':
      return {
        body: playerNumber === 1 ? 'var(--tetromino-i)' : 'var(--tetromino-z)',
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
      ? -9
      : mood === 'cheer'
        ? -7
        : mood === 'cry'
          ? -6
          : -2 + crankDy;
  const leftArmX = mood === 'cry' ? -3.5 : -6 + crankDx;
  const rightArmY = mood === 'celebrate' ? -9 : mood === 'cry' ? -6 : -1;
  const rightArmX = mood === 'celebrate' ? 11 : mood === 'cry' ? 7.5 : 10;

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
            <polygon points="10,-10 15,-14 14,-7" fill={accentFill} stroke="var(--text)" strokeWidth="0.8" />
            <polygon points="12,-4 17,-7 15,0" fill={accentFill} stroke="var(--text)" strokeWidth="0.8" />
            <polygon points="11,3 17,2 13,7" fill={accentFill} stroke="var(--text)" strokeWidth="0.8" />
          </g>
        ) : null}
        {character === 'cat' ? (
          <path
            d="M 11 5 Q 19 2 17 -6 Q 16 -10 13 -8"
            fill="none"
            stroke={bodyFill}
            strokeWidth="3"
            strokeLinecap="round"
          />
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

        {/* Right arm (visible when celebrating or crying) */}
        <circle
          cx={rightArmX}
          cy={rightArmY}
          r="3"
          fill={bodyFill}
          stroke="var(--text)"
          strokeWidth="1"
        />

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

        {/* Floppy dog ears on the sides of the head */}
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
            <circle cx="-4.2" cy="-9.8" r="1.5" fill="var(--tetromino-z)" opacity="0.65" />
            <circle cx="6.6" cy="-9.8" r="1.5" fill="var(--tetromino-z)" opacity="0.65" />
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
            {/* Quivering crying eyes (> <) with watery pools */}
            <path
              d="M -3.8 -13.6 L -0.4 -12.1 L -3.8 -10.6"
              fill="none"
              stroke="var(--text)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 6.2 -13.6 L 2.8 -12.1 L 6.2 -10.6"
              fill="none"
              stroke="var(--text)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Wailing downturned mouth */}
            <path
              d="M -1.4 -6.2 Q 1.2 -9.4 3.8 -6.2 Z"
              fill="var(--tetromino-z)"
              stroke="var(--text)"
              strokeWidth="0.8"
            />
            {/* Streaming tear trails & animated cascading teardrops */}
            <ellipse
              className="pb-mascot-tear pb-mascot-tear-left"
              cx="-2.6"
              cy="-9.2"
              rx="1.5"
              ry="2.4"
              fill="var(--tetromino-i)"
              stroke="var(--text)"
              strokeWidth="0.5"
            />
            <ellipse
              className="pb-mascot-tear pb-mascot-tear-right"
              cx="5"
              cy="-9.2"
              rx="1.5"
              ry="2.4"
              fill="var(--tetromino-i)"
              stroke="var(--text)"
              strokeWidth="0.5"
            />
            <circle
              className="pb-mascot-tear pb-mascot-tear-splash"
              cx="-4.2"
              cy="-4.5"
              r="1.2"
              fill="var(--tetromino-i)"
            />
            <circle
              className="pb-mascot-tear pb-mascot-tear-splash"
              cx="6.8"
              cy="-4.5"
              r="1.2"
              fill="var(--tetromino-i)"
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

        {/* Left arm cranking, cheering, celebrating, or wiping tears */}
        <circle
          cx={leftArmX}
          cy={leftArmY}
          r="3.2"
          fill={bodyFill}
          stroke="var(--text)"
          strokeWidth="1"
        />

        {/* Feet */}
        <ellipse cx="-2" cy="11" rx="4.5" ry="2.2" fill={accentFill} stroke="var(--text)" strokeWidth="1" />
        <ellipse cx="6" cy="11" rx="4.5" ry="2.2" fill={accentFill} stroke="var(--text)" strokeWidth="1" />

        {/* Celebratory stars & sparkles on round win (`celebrate`) or combo (`cheer`) */}
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
            <circle
              className="pb-mascot-sparkle pb-mascot-sparkle-1"
              cx="2"
              cy="-25"
              r="2"
              fill="var(--tetromino-s)"
              stroke="var(--text)"
              strokeWidth="0.5"
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
          <g className="pb-mascot-sweat" fill="var(--tetromino-i)">
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

      {/* Secondary hand-crank gear on the right */}
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
        <line x1={0} y1={0} x2={0} y2={-7} stroke="var(--text)" strokeWidth="1.4" />
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

function PlayerArena({
  player,
  playerNumber,
  character,
  onSelectCharacter,
  controlsLabel,
  isTwoPlayer,
}: {
  player: PlayerBoardState;
  playerNumber: 1 | 2;
  character: CharacterId;
  onSelectCharacter: (character: CharacterId) => void;
  controlsLabel: string;
  isTwoPlayer: boolean;
}) {
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
      <div className="pb-player-header">
        <div>
          <span className="pb-player-title" data-testid={`p${playerNumber}-title`}>
            {isTwoPlayer
              ? `${playerNumber}P · ${charName}`
              : `1P · ${charName} · Stage ${player.stage}`}
          </span>
          <span className="pb-player-controls">{controlsLabel}</span>
        </div>
        <div className="pb-status-pills">
          {hurrySeconds !== null ? (
            <span className="badge problem pb-hurry-badge" role="status">
              HURRY UP! {hurrySeconds}
            </span>
          ) : player.incomingGarbage > 0 ? (
            <span className="badge waiting" role="status">
              Incoming +{player.incomingGarbage}
            </span>
          ) : (
            <span className={player.ceilingWarning ? 'badge waiting' : 'badge'}>
              {player.status === 'won'
                ? 'YOU WIN!'
                : player.status === 'ko'
                  ? 'LOST'
                  : player.ceilingWarning
                    ? 'Drop next!'
                    : `${settledCount} bubbles`}
            </span>
          )}
        </div>
      </div>

      <div
        className="pb-char-bar"
        role="group"
        aria-label={`Player ${playerNumber} character`}
        data-testid={`p${playerNumber}-character-picker`}
      >
        <span className="pb-char-label">Character</span>
        <div className="pb-char-options">
          {CHARACTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={character === opt.id ? 'pb-char-btn is-selected' : 'pb-char-btn'}
              aria-pressed={character === opt.id}
              onClick={(event) => {
                onSelectCharacter(opt.id);
                event.currentTarget.blur();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
        </svg>

        <aside className="tetris-side pb-side">
          <div className="tetris-stat">
            <span className="tetris-label">Score</span>
            <span className="tetris-value" aria-live="polite" data-testid={`p${playerNumber}-score`}>
              {player.score.toLocaleString()}
            </span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Aim</span>
            <span className="pb-stat-small" data-testid={`p${playerNumber}-aim`}>
              {formatAimAngle(player.aimAngle)}
            </span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Shots</span>
            <span className="pb-stat-small" data-testid={`p${playerNumber}-shots`}>
              {player.shotsFired}
            </span>
          </div>
          <div className="tetris-stat">
            <span className="tetris-label">Ceiling</span>
            <span className="pb-stat-small" title="Shots until the compressor drops one row">
              {shotsLeftUntilDrop} {shotsLeftUntilDrop === 1 ? 'shot' : 'shots'}
            </span>
          </div>
          {isTwoPlayer ? (
            <div className="tetris-stat">
              <span className="tetris-label">Incoming</span>
              <span className="pb-stat-small" data-testid={`p${playerNumber}-incoming`}>
                {player.incomingGarbage}
                <GarbageOrbsRow
                  count={player.incomingGarbage}
                  label={`${player.incomingGarbage} incoming attack bubbles`}
                />
              </span>
            </div>
          ) : null}
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
        </aside>
      </div>
      <div
        className={
          statusLine ? `pb-combo-bar is-active pb-combo-${mood}` : 'pb-combo-bar'
        }
        role={statusLine ? 'status' : undefined}
      >
        {statusLine ?? 'Ready'}
      </div>
    </div>
  );
}

export function PuzzleBobbleView({ onExit }: { onExit: () => void }) {
  const [match, setMatch] = useState<PuzzleBobbleMatch>(() => createMatch('2p'));
  const [characters, setCharacters] = useState<[CharacterId, CharacterId]>(['dragon', 'dragon']);
  const [stagePreset, setStagePreset] = useState<number>(0); // 0 = random wave, 1..5 = classic Taito stages
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
  const heldAimKeysRef = useRef<Map<string, number>>(new Map());

  // Audio playback follows active match state.
  useEffect(() => {
    musicRef.current?.setActive(musicOn && match.status === 'playing' && !paused);
  }, [musicOn, paused, match.status]);

  useEffect(() => () => musicRef.current?.dispose(), []);

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
      const detail = (event as CustomEvent<{ player?: 0 | 1 }>).detail;
      const idx: 0 | 1 = detail?.player === 1 ? 1 : 0;
      setMatch((current) => fireAndResolvePlayer(current, idx));
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
        const leftStart = held.get('ArrowLeft');
        if (leftStart !== undefined && now - leftStart >= tapGraceMs) {
          p2Delta -= aimVelocityDegPerSec(now - leftStart) * dtSec;
        }
        const rightStart = held.get('ArrowRight');
        if (rightStart !== undefined && now - rightStart >= tapGraceMs) {
          p2Delta += aimVelocityDegPerSec(now - rightStart) * dtSec;
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
    <section className="tetris pb-game" aria-label="Puzzle Bobble game">
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
            onClick={() => {
              const nextPreset = (stagePreset + 1) % 6;
              setStagePreset(nextPreset);
              startNewRound(match.mode, true, nextPreset);
            }}
            title="Cycle between random waves and classic Taito arcade stage formations"
          >
            {stagePreset === 0 ? 'Wave: Random' : `Stage ${stagePreset}`}
          </button>
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
          character={characters[0]}
          onSelectCharacter={(c) => setCharacters(([_, p2]) => [c, p2])}
          controlsLabel={
            match.mode === '2p'
              ? 'ASDF — A/D fine aim · S/F shoot'
              : 'ASDF or Arrows — A/D or ←/→ aim · S/F or ↑ shoot'
          }
          isTwoPlayer={match.mode === '2p'}
        />
        {match.mode === '2p' && match.players[1] ? (
          <PlayerArena
            player={match.players[1]}
            playerNumber={2}
            character={characters[1]}
            onSelectCharacter={(c) => setCharacters(([p1]) => [p1, c])}
            controlsLabel="Arrows — ←/→ fine aim · ↑/↓ shoot"
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
            : `Game over — score ${match.players[0].score.toLocaleString()}. Press Next round to play again.`}
        </p>
      ) : (
        <p className="tetris-help">
          {match.mode === '2p'
            ? '1P: A/D aim, S/F fire · 2P: ←/→ aim, ↑/↓ fire · Pop 4+ & drop clusters to send attacks'
            : 'A/D or ←/→ aim (0.5° tap, hold sweep) · S/F or Space fire · Drop clusters for avalanche bonus'}
          {paused ? ' · Paused' : ''}
        </p>
      )}
    </section>
  );
}
