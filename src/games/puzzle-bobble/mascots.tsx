import { characterDisplayName, type CharacterId, type MascotMood } from '../../shared/puzzleBobble';

/**
 * Declarative Rigged Vector Puppet format for Puzzle Bobble mascots (#345, #342).
 *
 * Why this representation was chosen over raster sprite sheets or external
 * Lottie/Rive runtimes:
 * 1. Continuous `0.5°` hand-crank 2-bone inverse kinematics (`solveTwoBoneIK`)
 *    with smooth quadratic Bezier limbs keeps the mascot's cranking paw
 *    physically gripping the crank pin across every aim micro-adjustment —
 *    including during `cheer` right after popping bubbles (#342).
 * 2. Infinite Retina/4K vector sharpness across responsive `148px`–`560px`
 *    boards with zero external texture downloads (self-contained inside the
 *    lazy `/games/puzzle-bobble-*.js` chunk from #306).
 * 3. Strict CSS theme-token compliance (`test/theme-tokens.test.ts`), using
 *    `var(--cabinet-well)` for dark arcade ink & glossy pupils so dark (`dusk`)
 *    mode never inverts pupils/outlines to white.
 */

export interface MascotTokenPalette {
  readonly body: string;
  readonly accent: string;
  readonly iris: string;
  readonly belly: string;
  readonly cheek: string;
}

export interface MascotSpeciesRig {
  readonly id: CharacterId;
  readonly palettes: readonly [MascotTokenPalette, MascotTokenPalette];
  readonly topStarY: number;
  readonly tailPivot: readonly [number, number];
  readonly leftEarPivot: readonly [number, number];
  readonly rightEarPivot: readonly [number, number];
}

export const MASCOT_RIGS: Readonly<Record<CharacterId, MascotSpeciesRig>> = {
  dragon: {
    id: 'dragon',
    palettes: [
      {
        body: 'var(--tetromino-s)',
        accent: 'var(--tetromino-l)',
        iris: 'var(--positive)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-z)',
      },
      {
        body: 'var(--tetromino-j)',
        accent: 'var(--tetromino-o)',
        iris: 'var(--accent)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-z)',
      },
    ],
    topStarY: -26,
    tailPivot: [11, 5.5],
    leftEarPivot: [-0.5, -18.5],
    rightEarPivot: [5.5, -18.5],
  },
  cat: {
    id: 'cat',
    palettes: [
      {
        body: 'var(--tetromino-l)',
        accent: 'var(--tetromino-z)',
        iris: 'var(--tetromino-s)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-z)',
      },
      {
        body: 'var(--tetromino-t)',
        accent: 'var(--tetromino-o)',
        iris: 'var(--tetromino-i)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-z)',
      },
    ],
    topStarY: -28,
    tailPivot: [11, 5],
    leftEarPivot: [-3.5, -17.5],
    rightEarPivot: [7.5, -17.5],
  },
  dog: {
    id: 'dog',
    palettes: [
      {
        body: 'var(--tetromino-o)',
        accent: 'var(--tetromino-l)',
        iris: 'var(--problem)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-z)',
      },
      {
        body: 'var(--tetromino-l)',
        accent: 'var(--tetromino-z)',
        iris: 'var(--problem)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-z)',
      },
    ],
    topStarY: -26,
    tailPivot: [11.5, 4],
    leftEarPivot: [-6.5, -14.5],
    rightEarPivot: [10.5, -14.5],
  },
  bunny: {
    id: 'bunny',
    palettes: [
      {
        body: 'var(--tetromino-t)',
        accent: 'var(--tetromino-z)',
        iris: 'var(--tetromino-z)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-z)',
      },
      {
        body: 'var(--tetromino-z)',
        accent: 'var(--tetromino-o)',
        iris: 'var(--tetromino-t)',
        belly: 'var(--on-accent)',
        cheek: 'var(--tetromino-o)',
      },
    ],
    topStarY: -31,
    tailPivot: [12.5, 5.5],
    leftEarPivot: [-1.5, -18],
    rightEarPivot: [5.8, -18],
  },
};

export interface ArmIKSolution {
  readonly shoulderX: number;
  readonly shoulderY: number;
  readonly elbowX: number;
  readonly elbowY: number;
  readonly handX: number;
  readonly handY: number;
}

/**
 * Exact 2-bone planar inverse kinematics solver (shoulder -> elbow -> paw)
 * using the law of cosines, softly clamping reach so extreme crank positions
 * never detach or NaN.
 */
export function solveTwoBoneIK(
  shoulderX: number,
  shoulderY: number,
  targetX: number,
  targetY: number,
  upperLen: number,
  foreLen: number,
  bendDirection: 1 | -1 = -1,
): ArmIKSolution {
  const dx = targetX - shoulderX;
  const dy = targetY - shoulderY;
  const rawDist = Math.hypot(dx, dy);
  const minReach = Math.abs(upperLen - foreLen) + 0.35;
  const maxReach = upperLen + foreLen - 0.2;
  const dist = Math.min(maxReach, Math.max(minReach, rawDist || minReach));

  const baseAngle = Math.atan2(dy, dx);
  const cosShoulder =
    (upperLen * upperLen + dist * dist - foreLen * foreLen) / (2 * upperLen * dist);
  const clampedCos = Math.max(-1, Math.min(1, cosShoulder));
  const shoulderOffset = Math.acos(clampedCos) * bendDirection;
  const elbowAngle = baseAngle + shoulderOffset;

  const elbowX = shoulderX + Math.cos(elbowAngle) * upperLen;
  const elbowY = shoulderY + Math.sin(elbowAngle) * upperLen;
  const scale = rawDist > maxReach && rawDist > 0 ? maxReach / rawDist : 1;

  return {
    shoulderX,
    shoulderY,
    elbowX,
    elbowY,
    handX: shoulderX + dx * scale,
    handY: shoulderY + dy * scale,
  };
}

const INK = 'var(--cabinet-well)';

export function mascotPalette(
  character: CharacterId,
  playerNumber: 1 | 2,
): MascotTokenPalette {
  return MASCOT_RIGS[character].palettes[playerNumber === 1 ? 0 : 1];
}

/**
 * Smooth quadratic Bezier chibi arm (`Q elbow hand`) so arms bend organically
 * like plush Taito arcade sprites without robotic 90-degree polyline kinks.
 */
function ArticulatedLimb({
  ik,
  fill,
  padFill,
  width = 3.9,
}: {
  ik: ArmIKSolution;
  fill: string;
  padFill: string;
  width?: number;
}) {
  const d = `M ${ik.shoulderX.toFixed(2)} ${ik.shoulderY.toFixed(2)} Q ${ik.elbowX.toFixed(2)} ${ik.elbowY.toFixed(2)} ${ik.handX.toFixed(2)} ${ik.handY.toFixed(2)}`;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={INK}
        strokeWidth={width + 2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={fill}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Plump rounded paw with inner pad */}
      <circle
        cx={ik.handX}
        cy={ik.handY}
        r={3.05}
        fill={fill}
        stroke={INK}
        strokeWidth="1.15"
      />
      <circle cx={ik.handX - 0.45} cy={ik.handY - 0.55} r={1.05} fill={padFill} opacity="0.88" />
    </g>
  );
}

export function CharacterMascotSvg({
  x,
  y,
  playerNumber,
  character,
  mood,
  aimAngle,
  isFiring = false,
  onCycleCharacter,
}: {
  x: number;
  y: number;
  playerNumber: 1 | 2;
  character: CharacterId;
  mood: MascotMood;
  aimAngle: number;
  isFiring?: boolean;
  onCycleCharacter?: () => void;
}) {
  const rig = MASCOT_RIGS[character];
  const palette = mascotPalette(character, playerNumber);
  const { body: bodyFill, accent: accentFill, iris: irisFill, belly: bellyFill, cheek: cheekFill } = palette;

  // #342: Keep the cranking arm actively gripping and spinning the wheel across ALL live-play moods
  // (`normal`, `hurry`, AND `cheer`), detaching only when the round ends (`celebrate` or `cry`).
  const isCranking = mood === 'normal' || mood === 'hurry' || mood === 'cheer';
  const crankDeg = Math.round(-aimAngle * 18);
  const crankRad = (-aimAngle * 18 * Math.PI) / 180;

  // Mascot sits at (LAUNCHER_X + 44, LAUNCHER_Y + 6), putting the crank wheel center at (-17, 0)
  // with handle pin radius 5.2 in mascot-local space.
  const crankPinX = -17 + Math.cos(crankRad) * 5.2;
  const crankPinY = Math.sin(crankRad) * 5.2;

  // Outer kinematic transform (kept strictly on a separate <g> from CSS keyframe classes so CSS never overrides SVG transform!).
  const shotLeanDeg = isFiring ? -4.0 : 0;
  const shotLiftY = isFiring ? -1.2 : 0;
  const bodyBobY = (isCranking ? Math.sin(crankRad) * 1.3 : 0) + shotLiftY;
  const bodyTiltDeg = (isCranking ? Math.cos(crankRad) * 3.8 : 0) + shotLeanDeg;

  const leftFootY = isCranking ? 9.8 + Math.sin(crankRad) * 1.2 : 9.8;
  const rightFootY = isCranking ? 9.8 - Math.sin(crankRad) * 1.2 : 9.8;

  // Shoulder in mascot-root space follows the outer kinematic lean/bob, while the elbow hangs
  // naturally downward (`bendDirection = -1`) and the paw stays pixel-locked onto `(crankPinX, crankPinY)`.
  const tiltRad = (bodyTiltDeg * Math.PI) / 180;
  const cosB = Math.cos(tiltRad);
  const sinB = Math.sin(tiltRad);
  const rootLeftShoulderX = -4.2 * cosB - -1.2 * sinB;
  const rootLeftShoulderY = -4.2 * sinB + -1.2 * cosB + bodyBobY;

  const crankArmIK = solveTwoBoneIK(
    rootLeftShoulderX,
    rootLeftShoulderY,
    crankPinX,
    crankPinY,
    9.6,
    9.8,
    -1,
  );

  // Outward-flared chibi arms for celebrate (\o/) and cry (rubbing outer cheeks) so arms NEVER cross the face!
  const nonCrankLeftIK =
    mood === 'celebrate'
      ? solveTwoBoneIK(-5.8, -3.2, -12.6, -15.2, 6.8, 6.8, -1)
      : solveTwoBoneIK(-5.8, -2.5, -7.8, -8.2, 4.2, 4.2, -1);

  const rightArmIK =
    mood === 'celebrate'
      ? solveTwoBoneIK(9.2, -3.2, 15.8, -15.2, 6.8, 6.8, 1)
      : mood === 'cheer'
        ? solveTwoBoneIK(9.4, -2.4, 16.8, -12.6, 6.6, 6.6, 1)
        : mood === 'cry'
          ? solveTwoBoneIK(9.2, -2.5, 10.6, -8.2, 4.2, 4.2, 1)
          : solveTwoBoneIK(
              8.6,
              -1.6,
              11.2 + Math.cos(crankRad) * 1.4,
              2.2 - Math.sin(crankRad) * 1.8,
              4.8,
              4.8,
              1,
            );

  const reportedHand = isCranking ? crankArmIK : nonCrankLeftIK;
  const gradPrefix = `pb-mascot-${playerNumber}-${character}`;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      data-testid={`p${playerNumber}-mascot`}
      data-character={character}
      data-mood={mood}
      data-crank-angle={crankDeg}
      data-crank-x={reportedHand.handX.toFixed(1)}
      data-crank-y={reportedHand.handY.toFixed(1)}
      role="button"
      tabIndex={0}
      aria-label={`Switch Player ${playerNumber} character (${characterDisplayName(character, playerNumber)})`}
      style={{ cursor: 'pointer', outline: 'none' }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onCycleCharacter?.();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onCycleCharacter?.();
        }
      }}
    >
      <defs>
        {/* Top-left arcade rim-light + cel-shading volume gradient */}
        <radialGradient id={`${gradPrefix}-shine`} cx="32%" cy="24%" r="72%">
          <stop offset="0%" stopColor="var(--on-accent)" stopOpacity="0.34" />
          <stop offset="52%" stopColor="var(--on-accent)" stopOpacity="0.04" />
          <stop offset="100%" stopColor={INK} stopOpacity="0.22" />
        </radialGradient>
      </defs>

      {/* Stationary click hit-box so clicking the animal works reliably while it bobs/cranks */}
      <rect x={-24} y={-35} width={48} height={52} fill="transparent" />

      {/* Ground contact shadow anchored directly on top of the launcher pedestal */}
      <ellipse cx="2.5" cy="11.2" rx="11.2" ry="2.2" fill={INK} opacity="0.55" />

      {/* Outer kinematic group: continuous aimAngle crank lean & bob (never overridden by CSS keyframes) */}
      <g
        transform={`translate(0, ${bodyBobY.toFixed(2)}) rotate(${bodyTiltDeg.toFixed(2)})`}
      >
        {/* Inner secondary-motion group: idle breathing, cheer bounce, hurry shiver, victory jump, cry sob */}
        <g className={`pb-mascot pb-mascot-${mood}${isFiring ? ' pb-mascot-firing' : ''}`}>
          {/* --- 1. TAIL & DORSAL CRESTS (behind body, with secondary wag/swish) --- */}
          <g
            className="pb-mascot-tail"
            style={{ transformOrigin: `${rig.tailPivot[0]}px ${rig.tailPivot[1]}px` }}
          >
            {character === 'dragon' ? (
              <g>
                {/* Plump curled Bub/Bob dino tail */}
                <path
                  d="M 9 4.5 Q 17.8 6.5 19.2 0.2 Q 20.2 -4.2 16.0 -3.4 Q 14.3 -2.7 15.0 0"
                  fill="none"
                  stroke={INK}
                  strokeWidth="5.2"
                  strokeLinecap="round"
                />
                <path
                  d="M 9 4.5 Q 17.8 6.5 19.2 0.2 Q 20.2 -4.2 16.0 -3.4 Q 14.3 -2.7 15.0 0"
                  fill="none"
                  stroke={bodyFill}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                {/* Chunky rounded Taito dorsal spikes along head & back */}
                <path
                  d="M 8.8 -16.8 Q 15.8 -19.8 13.0 -12.4 Z"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.05"
                  strokeLinejoin="round"
                />
                <path
                  d="M 10.8 -10.8 Q 17.8 -13.2 14.8 -5.8 Z"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.05"
                  strokeLinejoin="round"
                />
                <path
                  d="M 11.6 -4.2 Q 18.2 -5.8 15.2 0.8 Z"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.05"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}

            {character === 'cat' ? (
              <g>
                <path
                  d="M 10.5 4.8 C 18.2 4.5, 21.2 -3.8, 17.2 -9.6 C 15.2 -12.2, 12.6 -9.8, 14.3 -7.2"
                  fill="none"
                  stroke={INK}
                  strokeWidth="4.9"
                  strokeLinecap="round"
                />
                <path
                  d="M 10.5 4.8 C 18.2 4.5, 21.2 -3.8, 17.2 -9.6 C 15.2 -12.2, 12.6 -9.8, 14.3 -7.2"
                  fill="none"
                  stroke={bodyFill}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="15.1" cy="-8.9" r="1.85" fill={accentFill} stroke={INK} strokeWidth="0.9" />
              </g>
            ) : null}

            {character === 'dog' ? (
              <g>
                {/* Fluffy curled Shiba donut tail */}
                <path
                  d="M 10.5 3.8 C 17.5 3.8, 19.6 -2.8, 15.0 -5.2 C 12.0 -6.4, 11.0 -2.2, 13.6 -1.0"
                  fill="none"
                  stroke={INK}
                  strokeWidth="5.6"
                  strokeLinecap="round"
                />
                <path
                  d="M 10.5 3.8 C 17.5 3.8, 19.6 -2.8, 15.0 -5.2"
                  fill="none"
                  stroke={bodyFill}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="14.0" cy="-3.0" r="2.0" fill={bellyFill} />
              </g>
            ) : null}

            {character === 'bunny' ? (
              <g>
                {/* Fluffy cotton-puff tail */}
                <circle cx="13.8" cy="4.4" r="3.9" fill={bellyFill} stroke={INK} strokeWidth="1.15" />
                <circle cx="15.5" cy="3.0" r="2.3" fill={bellyFill} stroke={INK} strokeWidth="0.95" />
                <circle cx="13.3" cy="3.5" r="2.1" fill={bellyFill} />
              </g>
            ) : null}
          </g>

          {/* --- 2. BACK/OUTER RIGHT ARM (pumps high in cheer/celebrate, rests naturally otherwise) --- */}
          <g className={mood === 'cheer' ? 'pb-mascot-cheer-arm' : undefined}>
            <ArticulatedLimb ik={rightArmIK} fill={bodyFill} padFill={accentFill} width={3.7} />
          </g>

          {/* --- 3. FEET (planted on pedestal, pedaling in phase with crank wheel) --- */}
          <g>
            <ellipse
              cx="-2.0"
              cy={leftFootY}
              rx="4.6"
              ry="2.4"
              fill={accentFill}
              stroke={INK}
              strokeWidth="1.15"
            />
            <ellipse cx="-3.0" cy={leftFootY - 0.5} rx="1.9" ry="0.8" fill="var(--on-accent)" opacity="0.45" />
            <ellipse
              cx="6.4"
              cy={rightFootY}
              rx="4.6"
              ry="2.4"
              fill={accentFill}
              stroke={INK}
              strokeWidth="1.15"
            />
            <ellipse cx="5.4" cy={rightFootY - 0.5} rx="1.9" ry="0.8" fill="var(--on-accent)" opacity="0.45" />
          </g>

          {/* --- 4. PLUMP TORSO, TUMMY MARKINGS & CEL-SHADING --- */}
          <ellipse cx="2.8" cy="0.4" rx="9.8" ry="10.0" fill={bodyFill} stroke={INK} strokeWidth="1.35" />
          {/* Plush cream tummy patch */}
          <ellipse cx="1.0" cy="1.8" rx="6.0" ry="6.7" fill={bellyFill} opacity="0.94" />
          {/* Dragon horizontal belly-scale plates */}
          {character === 'dragon' ? (
            <g stroke={accentFill} strokeWidth="0.95" strokeLinecap="round" fill="none" opacity="0.8">
              <path d="M -3.4 -0.9 Q 0.9 0.3 5.2 -0.9" />
              <path d="M -3.8 2.1 Q 0.9 3.4 5.5 2.1" />
              <path d="M -3.0 5.1 Q 0.9 6.2 4.8 5.1" />
            </g>
          ) : null}
          {/* Torso 3D cel-shade overlay */}
          <ellipse cx="2.8" cy="0.4" rx="9.2" ry="9.4" fill={`url(#${gradPrefix}-shine)`} />

          {/* Cat gold bell collar / Bunny ribbon bow at neck */}
          {character === 'cat' ? (
            <g>
              <path
                d="M -4.2 -5.2 Q 1.8 -3.3 8.0 -5.2"
                fill="none"
                stroke={accentFill}
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <circle cx="1.2" cy="-3.6" r="2.0" fill="var(--tetromino-o)" stroke={INK} strokeWidth="0.95" />
              <line x1="0.3" y1="-3.3" x2="2.1" y2="-3.3" stroke={INK} strokeWidth="0.75" />
            </g>
          ) : character === 'bunny' ? (
            <g>
              <polygon points="-2.5,-4.6 1.2,-3.2 -2.5,-1.7" fill={accentFill} stroke={INK} strokeWidth="0.85" />
              <polygon points="4.9,-4.6 1.2,-3.2 4.9,-1.7" fill={accentFill} stroke={INK} strokeWidth="0.85" />
              <circle cx="1.2" cy="-3.2" r="1.25" fill="var(--tetromino-o)" stroke={INK} strokeWidth="0.8" />
            </g>
          ) : null}

          {/* --- 5. EARS / CROWN CRESTS BEHIND HEAD --- */}
          {character === 'dragon' ? (
            <g>
              <g
                className="pb-mascot-ear-left"
                style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
              >
                <path
                  d="M -2.8 -18.2 C -3.0 -23.4, 1.8 -23.8, 2.4 -19.2 Z"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.05"
                  strokeLinejoin="round"
                />
              </g>
              <g
                className="pb-mascot-ear-right"
                style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
              >
                <path
                  d="M 3.2 -19.2 C 4.2 -24.2, 9.0 -23.2, 8.2 -17.6 Z"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.05"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          ) : null}

          {character === 'cat' ? (
            <g>
              <g
                className="pb-mascot-ear-left"
                style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
              >
                <path
                  d="M -6.8 -15.8 L -3.4 -25.4 L 1.2 -18.4 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <polygon points="-5.0,-16.8 -3.2,-22.9 -0.2,-18.4" fill={accentFill} />
              </g>
              <g
                className="pb-mascot-ear-right"
                style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
              >
                <path
                  d="M 2.8 -18.4 L 7.8 -25.4 L 10.6 -15.6 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <polygon points="4.2,-18.4 7.4,-22.9 9.0,-16.6" fill={accentFill} />
              </g>
            </g>
          ) : null}

          {character === 'bunny' ? (
            <g>
              <g
                className="pb-mascot-ear-left"
                style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
              >
                <ellipse
                  cx="-1.8"
                  cy="-22.8"
                  rx="2.95"
                  ry="6.6"
                  transform="rotate(-11 -1.8 -22.8)"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.2"
                />
                <ellipse
                  cx="-1.8"
                  cy="-22.6"
                  rx="1.45"
                  ry="4.3"
                  transform="rotate(-11 -1.8 -22.6)"
                  fill={accentFill}
                />
              </g>
              <g
                className="pb-mascot-ear-right"
                style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
              >
                <ellipse
                  cx="6.0"
                  cy="-22.5"
                  rx="2.95"
                  ry="6.4"
                  transform="rotate(15 6.0 -22.5)"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.2"
                />
                <ellipse
                  cx="6.0"
                  cy="-22.3"
                  rx="1.45"
                  ry="4.2"
                  transform="rotate(15 6.0 -22.3)"
                  fill={accentFill}
                />
              </g>
            </g>
          ) : null}

          {/* --- 6. SCULPTED CHIBI HEAD & SPECIES FACIAL ANATOMY --- */}
          <ellipse cx="1.8" cy="-11.6" rx="9.6" ry="8.7" fill={bodyFill} stroke={INK} strokeWidth="1.35" />

          {/* Dog Shiba urajiro cream lower-face mask & floppy puppy ears */}
          {character === 'dog' ? (
            <g>
              <ellipse cx="1.0" cy="-9.2" rx="7.0" ry="5.0" fill={bellyFill} opacity="0.94" />
              {/* Iconic round Shiba maru-mayu brow spots */}
              <ellipse cx="-2.1" cy="-16.1" rx="1.3" ry="0.88" fill={bellyFill} opacity="0.95" />
              <ellipse cx="4.3" cy="-16.1" rx="1.3" ry="0.88" fill={bellyFill} opacity="0.95" />
              <g
                className="pb-mascot-ear-left"
                style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
              >
                <ellipse
                  cx="-7.4"
                  cy="-11.2"
                  rx="2.8"
                  ry="5.6"
                  transform="rotate(20 -7.4 -11.2)"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.15"
                />
              </g>
              <g
                className="pb-mascot-ear-right"
                style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
              >
                <ellipse
                  cx="10.6"
                  cy="-11.0"
                  rx="2.8"
                  ry="5.6"
                  transform="rotate(-18 10.6 -11.0)"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.15"
                />
              </g>
            </g>
          ) : null}

          {/* Cat forehead tabby stripes */}
          {character === 'cat' ? (
            <g stroke={accentFill} strokeWidth="1.25" strokeLinecap="round" opacity="0.88">
              <line x1="1.5" y1="-19.2" x2="1.5" y2="-16.8" />
              <line x1="-1.1" y1="-18.7" x2="-0.5" y2="-16.9" />
              <line x1="4.1" y1="-18.7" x2="3.5" y2="-16.9" />
            </g>
          ) : null}

          {/* Head 3D cel-shade & specular crown highlight */}
          <ellipse cx="1.8" cy="-11.6" rx="9.0" ry="8.1" fill={`url(#${gradPrefix}-shine)`} />
          <ellipse
            cx="-2.2"
            cy="-16.5"
            rx="3.0"
            ry="1.2"
            transform="rotate(-18 -2.2 -16.5)"
            fill="var(--on-accent)"
            opacity="0.38"
          />

          {/* Soft rosy arcade cheek blushes */}
          {mood !== 'cry' ? (
            <g opacity={mood === 'celebrate' || mood === 'cheer' ? 0.78 : 0.45}>
              <ellipse cx="-4.8" cy="-9.5" rx="1.8" ry="1.1" fill={cheekFill} />
              <ellipse cx="7.4" cy="-9.5" rx="1.8" ry="1.1" fill={cheekFill} />
            </g>
          ) : null}

          {/* Dragon integrated Taito Bub/Bob snout (clean bridge highlight + cute nostrils, zero double-mouth line) */}
          {character === 'dragon' ? (
            <g>
              <ellipse cx="0.6" cy="-9.3" rx="2.7" ry="1.05" fill="var(--on-accent)" opacity="0.28" />
              <circle cx="-0.8" cy="-9.2" r="0.62" fill={INK} />
              <circle cx="2.0" cy="-9.2" r="0.62" fill={INK} />
            </g>
          ) : null}

          {/* Dog sculpted snout & glossy button nose */}
          {character === 'dog' ? (
            <g>
              <ellipse cx="0.8" cy="-8.5" rx="3.8" ry="2.5" fill={bellyFill} stroke={INK} strokeWidth="0.9" />
              <ellipse cx="0.8" cy="-9.6" rx="1.6" ry="1.1" fill={INK} />
              <circle cx="0.3" cy="-9.9" r="0.42" fill="var(--on-accent)" opacity="0.8" />
            </g>
          ) : null}

          {/* Cat plush muzzle pads, pink nose & springy whiskers */}
          {character === 'cat' ? (
            <g>
              <circle cx="-0.2" cy="-8.4" r="1.75" fill={bellyFill} opacity="0.92" />
              <circle cx="2.6" cy="-8.4" r="1.75" fill={bellyFill} opacity="0.92" />
              <polygon points="0.2,-9.8 2.2,-9.8 1.2,-8.4" fill={accentFill} stroke={INK} strokeWidth="0.55" />
              <g stroke={INK} strokeWidth="0.8" strokeLinecap="round">
                <line x1="-9.0" y1="-10.1" x2="-4.6" y2="-9.5" />
                <line x1="-8.8" y1="-8.1" x2="-4.6" y2="-8.5" />
                <line x1="7.2" y1="-9.5" x2="11.4" y2="-10.1" />
                <line x1="7.2" y1="-8.5" x2="11.2" y2="-8.1" />
              </g>
            </g>
          ) : null}

          {/* Bunny plush cheeks, pink twitching nose & whiskers */}
          {character === 'bunny' ? (
            <g>
              <circle cx="-0.1" cy="-8.5" r="1.7" fill={bellyFill} opacity="0.92" />
              <circle cx="2.5" cy="-8.5" r="1.7" fill={bellyFill} opacity="0.92" />
              <ellipse cx="1.2" cy="-9.4" rx="1.3" ry="0.9" fill={accentFill} stroke={INK} strokeWidth="0.55" />
              <g stroke={INK} strokeWidth="0.75" strokeLinecap="round">
                <line x1="-8.2" y1="-9.6" x2="-4.4" y2="-9.1" />
                <line x1="-8.0" y1="-7.9" x2="-4.4" y2="-8.2" />
                <line x1="6.8" y1="-9.1" x2="10.6" y2="-9.6" />
                <line x1="6.8" y1="-8.2" x2="10.4" y2="-7.9" />
              </g>
            </g>
          ) : null}

          {/* --- 7. EXPRESSIVE ARCADE EYES, EYEBROWS, BLINK & MOUTH BY MOOD --- */}
          {mood === 'celebrate' || mood === 'cheer' ? (
            <g>
              {/* Happy curved arc eyes (^ ^) */}
              <path
                d="M -4.0 -12.4 Q -1.8 -15.4 0.4 -12.4"
                fill="none"
                stroke={INK}
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <path
                d="M 2.4 -12.4 Q 4.6 -15.4 6.8 -12.4"
                fill="none"
                stroke={INK}
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              {/* Joyful open grin with cute fang / tooth */}
              <path
                d="M -1.3 -7.2 Q 1.3 -3.6 3.9 -7.2 Z"
                fill="var(--tetromino-z)"
                stroke={INK}
                strokeWidth="0.95"
                strokeLinejoin="round"
              />
              {character === 'dragon' ? (
                <polygon points="-0.7,-7.1 0.2,-5.8 0.9,-7.1" fill="var(--on-accent)" />
              ) : character === 'bunny' ? (
                <rect x="0.7" y="-7.2" width="1.2" height="1.3" rx="0.3" fill="var(--on-accent)" />
              ) : null}
            </g>
          ) : mood === 'cry' ? (
            <g>
              {/* Quivering crying eyes (> <) */}
              <path
                d="M -4.0 -14.0 L -0.5 -12.3 L -4.0 -10.6"
                fill="none"
                stroke={INK}
                strokeWidth="1.45"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 6.8 -14.0 L 3.3 -12.3 L 6.8 -10.6"
                fill="none"
                stroke={INK}
                strokeWidth="1.45"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Wailing downturned mouth */}
              <path
                d="M -1.4 -5.5 Q 1.3 -9.0 4.0 -5.5 Z"
                fill="var(--tetromino-z)"
                stroke={INK}
                strokeWidth="0.95"
              />
              {/* Streaming tear fountains & cascading teardrops */}
              <g className="pb-mascot-tear pb-mascot-tear-left">
                <ellipse
                  cx="-3.4"
                  cy="-8.8"
                  rx="1.65"
                  ry="2.7"
                  fill="var(--tetromino-i)"
                  stroke={INK}
                  strokeWidth="0.8"
                />
                <circle cx="-3.8" cy="-9.6" r="0.58" fill="var(--on-accent)" />
              </g>
              <g className="pb-mascot-tear pb-mascot-tear-right">
                <ellipse
                  cx="6.0"
                  cy="-8.8"
                  rx="1.65"
                  ry="2.7"
                  fill="var(--tetromino-i)"
                  stroke={INK}
                  strokeWidth="0.8"
                />
                <circle cx="5.6" cy="-9.6" r="0.58" fill="var(--on-accent)" />
              </g>
              <circle
                className="pb-mascot-tear pb-mascot-tear-splash"
                cx="-6.4"
                cy="-5.2"
                r="1.35"
                fill="var(--tetromino-i)"
                stroke={INK}
                strokeWidth="0.65"
              />
              <circle
                className="pb-mascot-tear pb-mascot-tear-splash"
                cx="9.0"
                cy="-5.2"
                r="1.35"
                fill="var(--tetromino-i)"
                stroke={INK}
                strokeWidth="0.65"
              />
            </g>
          ) : (
            <g>
              {mood === 'hurry' ? (
                <g stroke={INK} strokeWidth="1.15" strokeLinecap="round">
                  <line x1="-4.2" y1="-16.8" x2="-0.2" y2="-15.5" />
                  <line x1="6.8" y1="-16.8" x2="2.8" y2="-15.5" />
                </g>
              ) : null}

              {/* Glossy multi-layered arcade eyes (sclera + colored iris + deep pupil + dual catchlights) */}
              <g className="pb-mascot-eyes-open">
                <ellipse
                  cx="-1.7"
                  cy="-12.9"
                  rx="2.65"
                  ry="3.35"
                  fill="var(--on-accent)"
                  stroke={INK}
                  strokeWidth="1.0"
                />
                <ellipse
                  cx={isFiring ? -1.9 : -2.1}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 1.25 : 1.7}
                  ry={mood === 'hurry' ? 1.45 : 2.15}
                  fill={irisFill}
                />
                <ellipse
                  cx={isFiring ? -1.95 : -2.15}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 0.85 : 1.15}
                  ry={mood === 'hurry' ? 1.0 : 1.55}
                  fill={INK}
                />
                <circle cx="-2.7" cy="-14.0" r="0.78" fill="var(--on-accent)" />
                <circle cx="-1.3" cy="-11.7" r="0.42" fill="var(--on-accent)" opacity="0.88" />

                <ellipse
                  cx="4.3"
                  cy="-12.9"
                  rx="2.5"
                  ry="3.2"
                  fill="var(--on-accent)"
                  stroke={INK}
                  strokeWidth="1.0"
                />
                <ellipse
                  cx={isFiring ? 4.0 : 3.85}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 1.2 : 1.6}
                  ry={mood === 'hurry' ? 1.4 : 2.05}
                  fill={irisFill}
                />
                <ellipse
                  cx={isFiring ? 3.95 : 3.8}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 0.8 : 1.1}
                  ry={mood === 'hurry' ? 0.95 : 1.48}
                  fill={INK}
                />
                <circle cx="3.3" cy="-14.0" r="0.72" fill="var(--on-accent)" />
                <circle cx="4.6" cy="-11.7" r="0.4" fill="var(--on-accent)" opacity="0.88" />
              </g>

              {mood === 'normal' ? (
                <g className="pb-mascot-eyes-blink" stroke={INK} strokeWidth="1.35" strokeLinecap="round" fill="none">
                  <path d="M -4.1 -12.7 Q -1.7 -11.5 0.7 -12.7" />
                  <path d="M 1.9 -12.7 Q 4.3 -11.5 6.7 -12.7" />
                </g>
              ) : null}

              {mood === 'hurry' ? (
                <ellipse
                  cx="1.2"
                  cy="-6.9"
                  rx="1.6"
                  ry="1.8"
                  fill="var(--tetromino-z)"
                  stroke={INK}
                  strokeWidth="0.85"
                />
              ) : character === 'cat' || character === 'bunny' ? (
                <path
                  d="M -0.8 -7.3 Q 0.2 -6.1 1.2 -7.3 Q 2.2 -6.1 3.2 -7.3"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : character === 'dog' ? (
                <g>
                  <path
                    d="M -0.8 -7.4 Q 0.8 -5.9 2.5 -7.4"
                    fill="none"
                    stroke={INK}
                    strokeWidth="1.05"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 0.3 -6.7 Q 0.9 -4.9 1.6 -6.7 Z"
                    fill="var(--tetromino-z)"
                    stroke={INK}
                    strokeWidth="0.6"
                  />
                </g>
              ) : (
                <g>
                  <path
                    d="M -1.2 -6.8 Q 0.8 -5.2 2.9 -6.8"
                    fill="none"
                    stroke={INK}
                    strokeWidth="1.05"
                    strokeLinecap="round"
                  />
                  <polygon points="-0.4,-6.5 0.2,-5.5 0.7,-6.4" fill="var(--on-accent)" />
                </g>
              )}
            </g>
          )}

          {/* --- 8. NON-CRANKING LEFT ARM (outward-flared victory / cheek-rubbing cry poses) --- */}
          {!isCranking ? (
            <ArticulatedLimb ik={nonCrankLeftIK} fill={bodyFill} padFill={accentFill} width={3.8} />
          ) : null}

          {/* --- 9. CELEBRATION SPARKLES & HURRY SWEAT DROPS --- */}
          {mood === 'celebrate' ? (
            <g aria-hidden="true">
              <polygon
                className="pb-mascot-sparkle pb-mascot-sparkle-1"
                points="-13,-23 -11.3,-19.8 -8,-18.1 -11.3,-16.4 -13,-13.2 -14.7,-16.4 -18,-18.1 -14.7,-19.8"
                fill="var(--tetromino-o)"
                stroke={INK}
                strokeWidth="0.75"
              />
              <polygon
                className="pb-mascot-sparkle pb-mascot-sparkle-2"
                points="15.5,-24 16.9,-21.2 19.7,-19.8 16.9,-18.4 15.5,-15.6 14.1,-18.4 11.3,-19.8 14.1,-21.2"
                fill="var(--tetromino-z)"
                stroke={INK}
                strokeWidth="0.75"
              />
              <polygon
                className="pb-mascot-sparkle pb-mascot-sparkle-1"
                points={`2,${rig.topStarY - 3.8} 3.1,${rig.topStarY - 1.1} 5.8,${rig.topStarY} 3.1,${rig.topStarY + 1.1} 2,${rig.topStarY + 3.8} 0.9,${rig.topStarY + 1.1} -1.8,${rig.topStarY} 0.9,${rig.topStarY - 1.1}`}
                fill="var(--tetromino-s)"
                stroke={INK}
                strokeWidth="0.7"
              />
            </g>
          ) : mood === 'cheer' ? (
            <g aria-hidden="true">
              <polygon
                className="pb-mascot-sparkle pb-mascot-sparkle-1"
                points="15,-22 16.3,-19.3 19,-18 16.3,-16.7 15,-14 13.7,-16.7 11,-18 13.7,-19.3"
                fill="var(--tetromino-o)"
                stroke={INK}
                strokeWidth="0.75"
              />
              <polygon
                className="pb-mascot-sparkle pb-mascot-sparkle-2"
                points={`1.8,${rig.topStarY - 2.8} 2.6,${rig.topStarY - 0.8} 4.6,${rig.topStarY} 2.6,${rig.topStarY + 0.8} 1.8,${rig.topStarY + 2.8} 1.0,${rig.topStarY + 0.8} -1.0,${rig.topStarY} 1.0,${rig.topStarY - 0.8}`}
                fill="var(--tetromino-i)"
                stroke={INK}
                strokeWidth="0.65"
              />
            </g>
          ) : null}

          {mood === 'hurry' ? (
            <g className="pb-mascot-sweat" fill="var(--tetromino-i)" stroke={INK} strokeWidth="0.7">
              <path d="M 13.5 -19.2 C 15.2 -16.8, 15.2 -14.8, 13.5 -14.8 C 11.8 -14.8, 11.8 -16.8, 13.5 -19.2 Z" />
              <path d="M 16.8 -13.8 C 18.1 -11.9, 18.1 -10.4, 16.8 -10.4 C 15.5 -10.4, 15.5 -11.9, 16.8 -13.8 Z" />
            </g>
          ) : null}
        </g>
      </g>

      {/* Foreground curved 2-bone IK cranking arm & brass crank handle pinned onto (crankPinX, crankPinY) */}
      {isCranking ? (
        <g>
          <circle
            cx={crankArmIK.handX}
            cy={crankArmIK.handY}
            r={2.5}
            fill="var(--warning)"
            stroke={INK}
            strokeWidth="1"
          />
          <ArticulatedLimb ik={crankArmIK} fill={bodyFill} padFill={accentFill} width={3.9} />
        </g>
      ) : null}
    </g>
  );
}

/**
 * Miniature 12x12 mascot emblem for the arcade fighter select strip (#215, #345).
 */
export function CharacterTokenIcon({ id }: { id: CharacterId }) {
  switch (id) {
    case 'dragon':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="3,4 5,1 7,1 9,4" fill="var(--tetromino-l)" />
          <circle cx="6" cy="7" r="4" fill="var(--tetromino-s)" stroke={INK} strokeWidth="1" />
          <circle cx="4.8" cy="6.3" r="0.9" fill={INK} />
          <circle cx="7.2" cy="6.3" r="0.9" fill={INK} />
        </svg>
      );
    case 'cat':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="2,6 2.5,1.5 5.5,4" fill="var(--tetromino-l)" stroke={INK} strokeWidth="0.9" />
          <polygon points="10,6 9.5,1.5 6.5,4" fill="var(--tetromino-l)" stroke={INK} strokeWidth="0.9" />
          <circle cx="6" cy="7" r="3.8" fill="var(--tetromino-l)" stroke={INK} strokeWidth="1" />
          <circle cx="4.8" cy="6.5" r="0.9" fill={INK} />
          <circle cx="7.2" cy="6.5" r="0.9" fill={INK} />
        </svg>
      );
    case 'dog':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <ellipse cx="2.2" cy="7" rx="1.4" ry="2.8" fill="var(--tetromino-l)" stroke={INK} strokeWidth="0.9" />
          <ellipse cx="9.8" cy="7" rx="1.4" ry="2.8" fill="var(--tetromino-l)" stroke={INK} strokeWidth="0.9" />
          <circle cx="6" cy="6.8" r="3.8" fill="var(--tetromino-o)" stroke={INK} strokeWidth="1" />
          <circle cx="4.8" cy="6.2" r="0.9" fill={INK} />
          <circle cx="7.2" cy="6.2" r="0.9" fill={INK} />
        </svg>
      );
    case 'bunny':
      return (
        <svg className="pb-char-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <ellipse cx="4.3" cy="3" rx="1.2" ry="2.6" fill="var(--tetromino-t)" stroke={INK} strokeWidth="0.9" />
          <ellipse cx="7.7" cy="3" rx="1.2" ry="2.6" fill="var(--tetromino-t)" stroke={INK} strokeWidth="0.9" />
          <circle cx="6" cy="7.6" r="3.5" fill="var(--tetromino-t)" stroke={INK} strokeWidth="1" />
          <circle cx="4.8" cy="7.2" r="0.9" fill={INK} />
          <circle cx="7.2" cy="7.2" r="0.9" fill={INK} />
        </svg>
      );
  }
}
