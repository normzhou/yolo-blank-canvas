import {
  characterDisplayName,
  type CharacterId,
  type MascotGender,
  type MascotMood,
} from '../../shared/starlightBurst';

/**
 * Declarative Rigged Storybook-Plush Vector Companion format for Starlight Burst
 * (#345, #347, #352, #368).
 *
 * Four kid-friendly plush companions (`fox`, `cat`, `dog`, `bunny`) with distinct
 * Boy and Girl personas (Ren/Kiko, Yuzu/Mochi, Koro/Hana, Poko/Momo), squishy
 * pear-mochi silhouettes, soulful glossy jewel eyes, airbrushed radial rosy
 * cheeks, independent animated head/ears/tail, floating hearts & twinkling stars,
 * and planar 2-bone Bezier arm IK channeling a luminous Star-Wand along the
 * orbital focus ring.
 */

export interface CompanionTokenPalette {
  readonly body: string;
  readonly accent: string;
  readonly secondary: string;
  readonly iris: string;
  readonly belly: string;
  readonly cheek: string;
  readonly calloutText: string;
  readonly badgeBg: string;
  readonly badgeFg: string;
}

export interface CompanionSpeciesRig {
  readonly id: CharacterId;
  readonly boy: CompanionTokenPalette;
  readonly girl: CompanionTokenPalette;
  readonly topStarY: number;
  readonly tailPivot: readonly [number, number];
  readonly leftEarPivot: readonly [number, number];
  readonly rightEarPivot: readonly [number, number];
}

const INK = 'var(--stage-well)';

export const MASCOT_RIGS: Readonly<Record<CharacterId, CompanionSpeciesRig>> = {
  fox: {
    id: 'fox',
    // Boy: Ren — Warm cinnamon-amber fox with cream brush tail & cobalt star scarf
    boy: {
      body: 'var(--prism-6)',
      accent: 'var(--prism-4)',
      secondary: 'var(--prism-5)',
      iris: 'var(--positive)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-6)',
      badgeBg: 'var(--prism-6)',
      badgeFg: INK,
    },
    // Girl: Kiko — Peachy-coral fox with golden satin ear bow & violet star pendant
    girl: {
      body: 'var(--prism-1)',
      accent: 'var(--prism-4)',
      secondary: 'var(--prism-7)',
      iris: 'var(--prism-4)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-1)',
      badgeBg: 'var(--prism-1)',
      badgeFg: INK,
    },
    topStarY: -31,
    tailPivot: [9.2, 6.2],
    leftEarPivot: [-5.2, -19.2],
    rightEarPivot: [7.8, -19.2],
  },
  cat: {
    id: 'cat',
    // Boy: Yuzu — Sunny golden-butter tabby cat with aqua star collar
    boy: {
      body: 'var(--prism-4)',
      accent: 'var(--prism-2)',
      secondary: 'var(--prism-5)',
      iris: 'var(--prism-2)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-4)',
      badgeBg: 'var(--prism-4)',
      badgeFg: INK,
    },
    // Girl: Mochi — Pastel orchid-lavender kitty with rose satin bow & golden jingle bell
    girl: {
      body: 'var(--prism-7)',
      accent: 'var(--prism-1)',
      secondary: 'var(--prism-4)',
      iris: 'var(--prism-4)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-7)',
      badgeBg: 'var(--prism-7)',
      badgeFg: INK,
    },
    topStarY: -30,
    tailPivot: [10.0, 5.8],
    leftEarPivot: [-5.2, -19.2],
    rightEarPivot: [7.8, -19.2],
  },
  dog: {
    id: 'dog',
    // Boy: Koro — Mint-sage friendly puppy with tangerine kerchief & happy Shiba brows
    boy: {
      body: 'var(--prism-3)',
      accent: 'var(--prism-6)',
      secondary: 'var(--prism-4)',
      iris: 'var(--prism-4)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-3)',
      badgeBg: 'var(--prism-3)',
      badgeFg: INK,
    },
    // Girl: Hana — Sky-mint pastel puppy with sakura blossom clip & rose-gold ribbon
    girl: {
      body: 'var(--prism-2)',
      accent: 'var(--prism-1)',
      secondary: 'var(--prism-4)',
      iris: 'var(--prism-7)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-2)',
      badgeBg: 'var(--prism-2)',
      badgeFg: INK,
    },
    topStarY: -30,
    tailPivot: [10.2, 5.2],
    leftEarPivot: [-8.2, -15.4],
    rightEarPivot: [10.6, -15.4],
  },
  bunny: {
    id: 'bunny',
    // Boy: Poko — Sky-blue plush bunny with sunny star bow-tie & floppy right ear tip
    boy: {
      body: 'var(--prism-5)',
      accent: 'var(--prism-4)',
      secondary: 'var(--prism-2)',
      iris: 'var(--prism-4)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-5)',
      badgeBg: 'var(--prism-5)',
      badgeFg: INK,
    },
    // Girl: Momo — Berry-pink plush bunny with golden satin bow & floppy right ear tip
    girl: {
      body: 'var(--prism-1)',
      accent: 'var(--prism-4)',
      secondary: 'var(--prism-2)',
      iris: 'var(--prism-4)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-6)',
      calloutText: 'var(--prism-1)',
      badgeBg: 'var(--prism-1)',
      badgeFg: INK,
    },
    topStarY: -32,
    tailPivot: [11.2, 5.8],
    leftEarPivot: [-2.8, -19.5],
    rightEarPivot: [5.8, -19.5],
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
 * using the law of cosines, softly clamping reach so extreme orbital positions
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

export function mascotPalette(
  character: CharacterId,
  genderOrPlayer: MascotGender | 1 | 2 = 'boy',
): CompanionTokenPalette {
  const rig = MASCOT_RIGS[character];
  if (genderOrPlayer === 'girl' || genderOrPlayer === 2) return rig.girl;
  return rig.boy;
}

function RibbonBowSvg({
  cx,
  cy,
  scale = 1,
  rotateDeg = 0,
  bowFill,
  knotFill,
}: {
  cx: number;
  cy: number;
  scale?: number;
  rotateDeg?: number;
  bowFill: string;
  knotFill: string;
}) {
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${rotateDeg}) scale(${scale})`}>
      {/* Soft puffy satin ribbon loops */}
      <path
        d="M 0 0 C -3.6 -3.8, -6.8 -1.8, -5.6 1.5 C -4.6 3.8, -1.6 2.6, 0 0 Z"
        fill={bowFill}
        stroke={INK}
        strokeWidth="0.95"
        strokeLinejoin="round"
      />
      <path
        d="M 0 0 C 3.6 -3.8, 6.8 -1.8, 5.6 1.5 C 4.6 3.8, 1.6 2.6, 0 0 Z"
        fill={bowFill}
        stroke={INK}
        strokeWidth="0.95"
        strokeLinejoin="round"
      />
      {/* Cute dainty ribbon tail wisps */}
      <path
        d="M -0.6 1.0 L -2.6 4.4 L -0.4 3.4 Z M 0.6 1.0 L 2.6 4.4 L 0.4 3.4 Z"
        fill={bowFill}
        stroke={INK}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <ellipse cx="-3.3" cy="-0.8" rx="1.15" ry="0.65" transform="rotate(-18 -3.3 -0.8)" fill="var(--on-accent)" opacity="0.6" />
      <ellipse cx="3.3" cy="-0.8" rx="1.15" ry="0.65" transform="rotate(18 3.3 -0.8)" fill="var(--on-accent)" opacity="0.6" />
      <circle cx="0" cy="0.2" r="1.55" fill={knotFill} stroke={INK} strokeWidth="0.85" />
      <circle cx="-0.45" cy="-0.25" r="0.45" fill="var(--on-accent)" opacity="0.7" />
    </g>
  );
}

function BlossomClipSvg({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse
        cx="3.5"
        cy="1.4"
        rx="2.4"
        ry="1.15"
        transform="rotate(24 3.5 1.4)"
        fill="var(--prism-3)"
        stroke={INK}
        strokeWidth="0.78"
      />
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse
          key={i}
          cx="0"
          cy="-2.25"
          rx="1.65"
          ry="2.1"
          transform={`rotate(${i * 72})`}
          fill="var(--on-accent)"
          stroke={INK}
          strokeWidth="0.76"
        />
      ))}
      <circle cx="0" cy="0" r="1.45" fill="var(--prism-1)" stroke={INK} strokeWidth="0.7" />
      <circle cx="-0.35" cy="-0.35" r="0.48" fill="var(--prism-4)" />
    </g>
  );
}

/**
 * Soulful, warm storybook kawaii jewel eye (NO staring white sclera rings!).
 * Uses a glossy deep-ink oval + luminous colored lower-iris crescent + big
 * top-left catchlight + tiny bottom-right twinkle sparkle.
 */
function KawaiiJewelEye({
  cx,
  cy,
  irisFill,
  isGirl,
  side,
  scale = 1,
  starry = false,
}: {
  cx: number;
  cy: number;
  irisFill: string;
  isGirl: boolean;
  side: 'left' | 'right';
  scale?: number;
  starry?: boolean;
}) {
  const rx = 2.35 * scale;
  const ry = 2.75 * scale;
  const lashSign = side === 'left' ? -1 : 1;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Delicate cute outer corner lash curl for Girl personas */}
      {isGirl ? (
        <path
          d={`M ${(lashSign * (rx - 0.35)).toFixed(2)} ${(-ry * 0.45).toFixed(2)} Q ${(lashSign * (rx + 1.35)).toFixed(2)} ${(-ry * 0.72).toFixed(2)}, ${(lashSign * (rx + 1.65)).toFixed(2)} ${(-ry * 1.05).toFixed(2)}`}
          fill="none"
          stroke={INK}
          strokeWidth="1.05"
          strokeLinecap="round"
        />
      ) : null}
      {/* Deep glossy dark-espresso jewel base */}
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill={INK} />
      {/* Luminous colored lower iris crescent glow */}
      <path
        d={`M ${(-rx * 0.72).toFixed(2)} ${(ry * 0.25).toFixed(2)} A ${(rx * 0.76).toFixed(2)} ${(ry * 0.72).toFixed(2)} 0 0 0 ${(rx * 0.72).toFixed(2)} ${(ry * 0.25).toFixed(2)} Q 0 ${(ry * 0.62).toFixed(2)}, ${(-rx * 0.72).toFixed(2)} ${(ry * 0.25).toFixed(2)} Z`}
        fill={irisFill}
        opacity="0.92"
      />
      {starry ? (
        /* Excited golden starlight sparkle right inside the eye on victories! */
        <path
          d="M 0 -1.55 L 0.48 -0.48 L 1.55 0 L 0.48 0.48 L 0 1.55 L -0.48 0.48 L -1.55 0 L -0.48 -0.48 Z"
          fill="var(--prism-4)"
        />
      ) : (
        <>
          {/* Big warm top-left catchlight */}
          <ellipse
            cx={-rx * 0.36}
            cy={-ry * 0.36}
            rx={0.95 * scale}
            ry={1.12 * scale}
            transform={`rotate(-18 ${(-rx * 0.36).toFixed(2)} ${(-ry * 0.36).toFixed(2)})`}
            fill="var(--on-accent)"
          />
          {/* Tiny bottom-right pinpoint twinkle */}
          <circle cx={rx * 0.36} cy={ry * 0.42} r={0.44 * scale} fill="var(--on-accent)" opacity="0.95" />
        </>
      )}
    </g>
  );
}

/**
 * Cute floating pastel heart emblem for cheering & celebration moods.
 */
function FloatingHeartSvg({
  cx,
  cy,
  fill,
  scale = 1,
  className,
}: {
  cx: number;
  cy: number;
  fill: string;
  scale?: number;
  className?: string;
}) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <g className={className}>
        <path
          d="M 0 2.0 C -3.2 -0.2, -3.6 -2.8, -1.5 -3.0 C -0.4 -3.1, 0 -2.0, 0 -1.4 C 0 -2.0, 0.4 -3.1, 1.5 -3.0 C 3.6 -2.8, 3.2 -0.2, 0 2.0 Z"
          fill={fill}
          stroke={INK}
          strokeWidth="0.65"
          strokeLinejoin="round"
        />
        <circle cx="-1.15" cy="-1.65" r="0.45" fill="var(--on-accent)" opacity="0.7" />
      </g>
    </g>
  );
}

function ArticulatedLimb({
  ik,
  fill,
  padFill,
  width = 3.0,
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
        strokeWidth={width + 1.9}
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
      {/* Cute plump plush paw with soft pad highlight */}
      <circle
        cx={ik.handX}
        cy={ik.handY}
        r={2.65}
        fill={fill}
        stroke={INK}
        strokeWidth="1.0"
      />
      <circle cx={ik.handX - 0.35} cy={ik.handY - 0.4} r={0.95} fill={padFill} opacity="0.88" />
    </g>
  );
}

export function CompanionSvg({
  x,
  y,
  playerNumber,
  character,
  gender,
  mood,
  aimAngle,
  isFiring = false,
  onCycleCharacter,
}: {
  x: number;
  y: number;
  playerNumber: 1 | 2;
  character: CharacterId;
  gender: MascotGender;
  mood: MascotMood;
  aimAngle: number;
  isFiring?: boolean;
  onCycleCharacter?: () => void;
}) {
  const rig = MASCOT_RIGS[character];
  const palette = mascotPalette(character, gender);
  const {
    body: bodyFill,
    accent: accentFill,
    secondary: secondaryFill,
    iris: irisFill,
    belly: bellyFill,
    cheek: cheekFill,
  } = palette;
  const isGirl = gender === 'girl';
  const displayName = characterDisplayName(character, gender);

  // Keep the channeling wand arm actively piloting the orbital focus ring across all
  // live-play moods (`normal`, `hurry`, and `cheer`), detaching only on round end.
  const isChanneling = mood === 'normal' || mood === 'hurry' || mood === 'cheer';
  const orbitDeg = Math.round(-aimAngle * 18);
  const orbitRad = (-aimAngle * 18 * Math.PI) / 180;

  const wandNodeX = -10.8 + Math.cos(orbitRad) * 2.5;
  const wandNodeY = 0.8 + Math.sin(orbitRad) * 4.0;

  const shotLeanDeg = isFiring ? -4.5 : 0;
  const shotLiftY = isFiring ? -1.4 : 0;
  const bodyBobY = (isChanneling ? Math.sin(orbitRad) * 1.15 : 0) + shotLiftY;
  const bodyTiltDeg = (isChanneling ? Math.cos(orbitRad) * 3.4 : 0) + shotLeanDeg;

  const leftFootY = isChanneling ? 10.2 + Math.sin(orbitRad) * 1.0 : 10.2;
  const rightFootY = isChanneling ? 10.2 - Math.sin(orbitRad) * 1.0 : 10.2;

  const tiltRad = (bodyTiltDeg * Math.PI) / 180;
  const cosB = Math.cos(tiltRad);
  const sinB = Math.sin(tiltRad);
  const rootLeftShoulderX = -4.6 * cosB - -0.4 * sinB;
  const rootLeftShoulderY = -4.6 * sinB + -0.4 * cosB + bodyBobY;

  const wandArmIK = solveTwoBoneIK(
    rootLeftShoulderX,
    rootLeftShoulderY,
    wandNodeX,
    wandNodeY,
    3.6,
    3.8,
    -1,
  );

  const nonChannelLeftIK =
    mood === 'celebrate'
      ? solveTwoBoneIK(-5.6, -2.0, -11.6, -13.4, 6.2, 6.2, -1)
      : solveTwoBoneIK(-5.4, -1.0, -6.2, -5.2, 3.0, 3.0, -1);

  const rightArmIK =
    mood === 'celebrate'
      ? solveTwoBoneIK(8.6, -2.0, 14.6, -13.4, 6.2, 6.2, 1)
      : mood === 'cheer'
        ? solveTwoBoneIK(8.8, -1.4, 15.2, -11.0, 6.0, 6.0, 1)
        : mood === 'cry'
          ? solveTwoBoneIK(8.4, -1.0, 9.2, -5.2, 3.0, 3.0, 1)
          : solveTwoBoneIK(
              8.0,
              -0.4,
              9.8 + Math.cos(orbitRad) * 1.0,
              4.6 - Math.sin(orbitRad) * 1.3,
              3.0,
              3.0,
              -1,
            );

  const reportedHand = isChanneling ? wandArmIK : nonChannelLeftIK;
  const gradPrefix = `sb-companion-${playerNumber}-${character}-${gender}`;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      data-testid={`p${playerNumber}-mascot`}
      data-character={character}
      data-gender={gender}
      data-mascot-name={displayName}
      data-mood={mood}
      data-sling-angle={orbitDeg}
      data-wand-x={reportedHand.handX.toFixed(1)}
      data-wand-y={reportedHand.handY.toFixed(1)}
      role="button"
      tabIndex={0}
      aria-label={`Switch Player ${playerNumber} companion (${displayName}, ${gender} ${character})`}
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
        {/* Warm sunlit-top to cozy shadowed-underside velvet plush lighting */}
        <radialGradient id={`${gradPrefix}-velvet`} cx="36%" cy="24%" r="74%">
          <stop offset="0%" stopColor="var(--on-accent)" stopOpacity="0.34" />
          <stop offset="56%" stopColor="var(--on-accent)" stopOpacity="0.02" />
          <stop offset="100%" stopColor={INK} stopOpacity="0.22" />
        </radialGradient>
        {/* Soft airbrushed storybook rosy cheek blush */}
        <radialGradient id={`${gradPrefix}-blush`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={cheekFill} stopOpacity="0.88" />
          <stop offset="58%" stopColor={cheekFill} stopOpacity="0.44" />
          <stop offset="100%" stopColor={cheekFill} stopOpacity="0" />
        </radialGradient>
        {/* Soft golden shimmer behind the twinkling Star-Wand crystal */}
        <radialGradient id={`${gradPrefix}-wand-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--prism-4)" stopOpacity="0.72" />
          <stop offset="55%" stopColor={accentFill} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accentFill} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Stationary click hit-box */}
      <rect x={-25} y={-38} width={52} height={56} fill="transparent" />

      {/* Soft grounded shadow cushion */}
      <ellipse cx="1.8" cy="11.6" rx="11.8" ry="2.4" fill={INK} opacity="0.46" />

      {/* Outer kinematic group */}
      <g transform={`translate(0, ${bodyBobY.toFixed(2)}) rotate(${bodyTiltDeg.toFixed(2)})`}>
        <g className={`sb-mascot sb-mascot-${mood}${isFiring ? ' sb-mascot-firing' : ''}`}>
          {/* --- 1. FLUFFY ANIMATED TAILS --- */}
          <g
            className="sb-mascot-tail"
            style={{ transformOrigin: `${rig.tailPivot[0]}px ${rig.tailPivot[1]}px` }}
          >
            {character === 'fox' ? (
              /* Lush swishing plush fox brush tail with scalloped snow-cream tip */
              <g>
                <path
                  d="M 8.6 6.2 C 16.5 8.8, 22.8 4.4, 21.8 -3.0 C 20.6 -8.8, 14.8 -9.4, 13.0 -4.8 C 11.4 -0.8, 12.6 2.6, 8.6 4.0 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.15"
                  strokeLinejoin="round"
                />
                <path
                  d="M 21.6 -2.6 C 20.6 -8.4, 15.2 -9.0, 13.4 -4.8 C 14.8 -3.4, 16.2 -4.4, 17.6 -3.2 C 19.0 -2.0, 20.2 -3.4, 21.6 -2.6 Z"
                  fill={bellyFill}
                  stroke={INK}
                  strokeWidth="0.82"
                  strokeLinejoin="round"
                />
              </g>
            ) : character === 'cat' ? (
              /* Graceful curling plush kitty tail with sweet cream tip */
              <g>
                <path
                  d="M 9.6 5.8 C 17.4 6.6, 20.8 0.2, 17.8 -5.4 C 16.0 -8.4, 13.2 -7.4, 14.2 -4.8"
                  fill="none"
                  stroke={INK}
                  strokeWidth="5.0"
                  strokeLinecap="round"
                />
                <path
                  d="M 9.6 5.8 C 17.4 6.6, 20.8 0.2, 17.8 -5.4 C 16.0 -8.4, 13.2 -7.4, 14.2 -4.8"
                  fill="none"
                  stroke={bodyFill}
                  strokeWidth="2.9"
                  strokeLinecap="round"
                />
                <circle cx="14.4" cy="-5.2" r="1.55" fill={bellyFill} />
              </g>
            ) : character === 'dog' ? (
              /* Bouncy curly fluffy Shiba/puppy tail with cream underside */
              <g>
                <path
                  d="M 9.6 5.4 C 16.8 6.4, 20.2 0.8, 17.6 -3.4 C 15.6 -6.2, 11.4 -4.8, 12.2 -1.2 C 12.8 1.2, 11.6 3.0, 9.4 3.4 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                />
                <path
                  d="M 17.3 -3.1 C 15.6 -5.5, 12.2 -4.5, 12.6 -1.8 C 14.2 -1.0, 16.2 -1.6, 17.3 -3.1 Z"
                  fill={bellyFill}
                  opacity="0.92"
                />
              </g>
            ) : (
              /* Fluffy cloud-puff snow-white cotton bunny tail */
              <g>
                <circle cx="12.2" cy="5.2" r="3.6" fill={bellyFill} stroke={INK} strokeWidth="1.05" />
                <circle cx="14.2" cy="3.6" r="2.2" fill={bellyFill} stroke={INK} strokeWidth="0.95" />
                <circle cx="11.2" cy="3.4" r="2.1" fill={bellyFill} />
                <circle cx="13.2" cy="5.8" r="2.0" fill={bellyFill} />
              </g>
            )}
          </g>

          {/* --- 2. COZY STUBBY PLUSH FEET --- */}
          <ellipse
            cx="-2.6"
            cy={leftFootY}
            rx="4.2"
            ry="2.55"
            fill={bodyFill}
            stroke={INK}
            strokeWidth="1.15"
          />
          <ellipse cx="-3.3" cy={leftFootY - 0.15} rx="1.6" ry="0.95" fill={bellyFill} opacity="0.88" />
          <ellipse
            cx="6.4"
            cy={rightFootY}
            rx="4.2"
            ry="2.55"
            fill={bodyFill}
            stroke={INK}
            strokeWidth="1.15"
          />
          <ellipse cx="7.1" cy={rightFootY - 0.15} rx="1.6" ry="0.95" fill={bellyFill} opacity="0.88" />

          {/* --- 3. SQUISHY PEAR-SHAPED PLUSH TUMMY --- */}
          <path
            d="M -7.6 1.8 C -8.0 -3.8, -4.4 -6.4, 1.8 -6.4 C 8.0 -6.4, 11.8 -3.6, 11.6 1.8 C 11.4 7.6, 7.8 10.6, 1.8 10.6 C -4.2 10.6, -7.2 7.6, -7.6 1.8 Z"
            fill={bodyFill}
            stroke={INK}
            strokeWidth="1.15"
          />
          {/* Soft velvet shading over tummy */}
          <path
            d="M -7.6 1.8 C -8.0 -3.8, -4.4 -6.4, 1.8 -6.4 C 8.0 -6.4, 11.8 -3.6, 11.6 1.8 C 11.4 7.6, 7.8 10.6, 1.8 10.6 C -4.2 10.6, -7.2 7.6, -7.6 1.8 Z"
            fill={`url(#${gradPrefix}-velvet)`}
          />
          {/* Cozy warm cream plush belly patch */}
          <path
            d="M -3.8 2.6 C -4.0 -1.6, -1.6 -3.8, 1.4 -3.8 C 4.4 -3.8, 6.8 -1.6, 6.6 2.6 C 6.4 6.6, 4.2 8.4, 1.4 8.4 C -1.4 8.4, -3.6 6.6, -3.8 2.6 Z"
            fill={bellyFill}
            opacity="0.94"
          />

          {/* --- 4. COZY NECK ACCESSORY (Neckerchief / Star Collar / Jingle Bell / Bow-Tie) --- */}
          {character === 'fox' ? (
            isGirl ? (
              <g>
                <path
                  d="M -4.8 -4.0 Q 1.4 -1.4, 7.6 -4.0"
                  fill="none"
                  stroke={secondaryFill}
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
                <path
                  d="M 1.4 -2.2 L 2.2 -0.4 L 4.0 0.0 L 2.5 1.1 L 2.9 2.9 L 1.4 1.9 L -0.1 2.9 L 0.3 1.1 L -1.2 0.0 L 0.6 -0.4 Z"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="0.7"
                  strokeLinejoin="round"
                />
              </g>
            ) : (
              <g>
                <path
                  d="M -5.4 -4.2 Q 1.4 -1.2, 8.2 -4.2 L 5.6 -0.2 L 1.4 2.4 L -2.8 -0.2 Z"
                  fill={secondaryFill}
                  stroke={INK}
                  strokeWidth="0.9"
                  strokeLinejoin="round"
                />
                <circle cx="1.4" cy="-0.4" r="1.25" fill={accentFill} stroke={INK} strokeWidth="0.6" />
              </g>
            )
          ) : character === 'cat' ? (
            <g>
              <path
                d="M -5.2 -4.0 Q 1.4 -1.4, 8.0 -4.0"
                fill="none"
                stroke={accentFill}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="1.4" cy="-1.2" r="2.0" fill={secondaryFill} stroke={INK} strokeWidth="0.8" />
              <line x1="0.2" y1="-0.8" x2="2.6" y2="-0.8" stroke={INK} strokeWidth="0.65" />
              <circle cx="0.7" cy="-1.8" r="0.45" fill="var(--on-accent)" opacity="0.7" />
            </g>
          ) : character === 'dog' ? (
            <g>
              <path
                d="M -5.4 -4.0 Q 1.4 -1.0, 8.2 -4.0 L 5.0 0.4 L 1.4 2.6 L -2.2 0.4 Z"
                fill={accentFill}
                stroke={INK}
                strokeWidth="0.9"
                strokeLinejoin="round"
              />
              <circle cx="1.4" cy="-0.5" r="1.1" fill={secondaryFill} />
            </g>
          ) : (
            <RibbonBowSvg
              cx={1.4}
              cy={-2.8}
              scale={isGirl ? 0.72 : 0.78}
              bowFill={accentFill}
              knotFill={secondaryFill}
            />
          )}

          {/* --- 5. INDEPENDENTLY BOBBING HEAD GROUP (Ears + Head + Face + Accessories) --- */}
          <g className="sb-mascot-head">
            {/* 5A. SPECIES-DISTINCT PLUSH EARS */}
            {character === 'fox' ? (
              <g>
                {/* Left fluffy leaf-curved fox ear */}
                <g
                  className="sb-mascot-ear-left"
                  style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
                >
                  <path
                    d="M -7.6 -16.8 C -9.6 -23.0, -7.8 -28.8, -4.4 -29.2 C -1.2 -29.4, 0.2 -23.4, -0.4 -19.2 Z"
                    fill={bodyFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M -6.2 -19.4 C -7.0 -23.4, -5.8 -26.4, -4.2 -26.4 C -2.6 -26.2, -1.8 -23.0, -2.0 -19.6 Z"
                    fill={bellyFill}
                    opacity="0.94"
                  />
                </g>
                {/* Right fluffy leaf-curved fox ear */}
                <g
                  className="sb-mascot-ear-right"
                  style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
                >
                  <path
                    d="M 3.2 -19.2 C 3.0 -23.4, 4.6 -29.4, 8.0 -29.2 C 11.4 -28.8, 12.6 -22.8, 10.6 -16.8 Z"
                    fill={bodyFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 4.6 -19.6 C 4.8 -23.0, 5.8 -26.2, 7.6 -26.4 C 9.2 -26.4, 10.0 -23.4, 9.0 -19.4 Z"
                    fill={bellyFill}
                    opacity="0.94"
                  />
                </g>
              </g>
            ) : character === 'cat' ? (
              <g>
                {/* Left soft rounded plush kitty ear */}
                <g
                  className="sb-mascot-ear-left"
                  style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
                >
                  <path
                    d="M -7.8 -16.2 C -9.4 -21.8, -7.4 -27.0, -4.2 -26.8 C -1.4 -26.6, 0.0 -22.0, -0.4 -19.0 Z"
                    fill={bodyFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M -6.2 -18.8 C -6.8 -22.0, -5.6 -24.4, -4.1 -24.2 C -2.6 -24.0, -1.8 -21.6, -2.0 -19.2 Z"
                    fill={cheekFill}
                    opacity="0.72"
                  />
                </g>
                {/* Right soft rounded plush kitty ear */}
                <g
                  className="sb-mascot-ear-right"
                  style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
                >
                  <path
                    d="M 3.2 -19.0 C 3.2 -22.0, 4.8 -26.6, 7.8 -26.8 C 11.0 -27.0, 12.6 -21.8, 10.8 -16.2 Z"
                    fill={bodyFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 4.8 -19.2 C 5.0 -21.6, 6.0 -24.0, 7.5 -24.2 C 9.0 -24.4, 9.8 -22.0, 9.0 -18.8 Z"
                    fill={cheekFill}
                    opacity="0.72"
                  />
                </g>
              </g>
            ) : character === 'dog' ? (
              <g>
                {/* Big velvety floppy left puppy ear */}
                <g
                  className="sb-mascot-ear-left"
                  style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
                >
                  <path
                    d="M -7.4 -17.2 C -12.6 -16.8, -14.8 -10.8, -12.6 -5.2 C -11.2 -2.4, -7.8 -3.0, -7.6 -7.2 C -7.4 -10.8, -6.2 -14.2, -7.4 -17.2 Z"
                    fill={accentFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <ellipse cx="-10.6" cy="-10.4" rx="1.4" ry="3.2" transform="rotate(14 -10.6 -10.4)" fill="var(--on-accent)" opacity="0.22" />
                </g>
                {/* Big velvety floppy right puppy ear */}
                <g
                  className="sb-mascot-ear-right"
                  style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
                >
                  <path
                    d="M 10.2 -17.2 C 15.2 -16.8, 17.4 -10.8, 15.2 -5.2 C 13.8 -2.4, 10.4 -3.0, 10.2 -7.2 C 10.0 -10.8, 9.0 -14.2, 10.2 -17.2 Z"
                    fill={accentFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <ellipse cx="13.2" cy="-10.4" rx="1.4" ry="3.2" transform="rotate(-14 13.2 -10.4)" fill="var(--on-accent)" opacity="0.22" />
                </g>
              </g>
            ) : (
              <g>
                {/* Left tall perky plush bunny ear */}
                <g
                  className="sb-mascot-ear-left"
                  style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
                >
                  <path
                    d="M -5.4 -18.8 C -8.6 -26.0, -7.4 -35.0, -3.6 -35.2 C 0.0 -35.4, 0.8 -26.8, -0.8 -19.2 Z"
                    fill={bodyFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M -4.2 -21.0 C -5.8 -26.2, -5.2 -31.8, -3.5 -31.8 C -1.8 -31.8, -1.4 -26.4, -2.0 -21.0 Z"
                    fill={bellyFill}
                    opacity="0.9"
                  />
                </g>
                {/* Right expressive plush bunny ear with adorable folded/bent tip! */}
                <g
                  className="sb-mascot-ear-right"
                  style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
                >
                  <path
                    d="M 3.2 -19.2 C 2.4 -26.4, 4.4 -33.2, 8.2 -32.6 C 12.2 -32.0, 14.4 -26.6, 12.6 -22.2 C 11.4 -19.6, 8.6 -20.8, 8.8 -24.2 C 8.9 -26.2, 7.6 -27.2, 7.0 -18.8 Z"
                    fill={bodyFill}
                    stroke={INK}
                    strokeWidth="1.12"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 4.8 -21.4 C 4.6 -25.8, 5.8 -29.6, 8.0 -29.4 C 10.0 -29.2, 11.4 -26.2, 10.6 -23.6 C 9.4 -23.4, 8.4 -26.4, 7.2 -21.2 Z"
                    fill={bellyFill}
                    opacity="0.88"
                  />
                </g>
              </g>
            )}

            {/* 5B. SQUISHY MOCHI-PEAR CHUBBY-CHEEKED HEAD */}
            <path
              d={
                character === 'fox'
                  ? /* Fox: cute soft side cheek-fluff tufts seamlessly integrated into pear head! */
                    'M -9.2 -13.6 C -9.6 -19.4, -5.0 -21.8, 1.4 -21.8 C 7.8 -21.8, 12.4 -19.4, 12.0 -13.6 C 14.0 -11.4, 14.2 -9.4, 12.2 -8.2 C 11.4 -4.8, 7.6 -3.2, 1.4 -3.2 C -4.8 -3.2, -8.6 -4.8, -9.4 -8.2 C -11.4 -9.4, -11.2 -11.4, -9.2 -13.6 Z'
                  : /* Cat / Dog / Bunny: plump huggable pear-mochi head */
                    'M -9.2 -13.4 C -9.4 -19.4, -4.8 -21.8, 1.4 -21.8 C 7.6 -21.8, 12.2 -19.4, 12.0 -13.4 C 12.9 -7.6, 9.2 -3.2, 1.4 -3.2 C -6.4 -3.2, -10.1 -7.6, -9.2 -13.4 Z'
              }
              fill={bodyFill}
              stroke={INK}
              strokeWidth="1.18"
              strokeLinejoin="round"
            />

            {/* Species facial markings */}
            {character === 'fox' ? (
              /* Warm curved cream fox lower-cheek & muzzle mask */
              <path
                d="M -9.6 -9.4 C -6.2 -10.8, -2.6 -10.0, 1.4 -11.0 C 5.4 -10.0, 9.0 -10.8, 12.4 -9.4 C 11.2 -5.0, 7.4 -3.4, 1.4 -3.4 C -4.6 -3.4, -8.4 -5.0, -9.6 -9.4 Z"
                fill={bellyFill}
                opacity="0.94"
              />
            ) : character === 'cat' ? (
              /* Cute soft tabby forehead stripes + sweet cream muzzle puff */
              <g>
                <path
                  d="M -1.2 -20.6 L -0.4 -18.2 M 1.4 -21.0 L 1.4 -17.9 M 4.0 -20.6 L 3.2 -18.2"
                  fill="none"
                  stroke={isGirl ? accentFill : secondaryFill}
                  strokeWidth="1.15"
                  strokeLinecap="round"
                  opacity="0.72"
                />
                <ellipse cx="1.4" cy="-7.6" rx="4.4" ry="2.7" fill={bellyFill} opacity="0.92" />
              </g>
            ) : character === 'dog' ? (
              /* Friendly cream puppy muzzle puff + adorable Shiba brow dots */
              <g>
                <ellipse cx="1.4" cy="-7.6" rx="5.0" ry="3.1" fill={bellyFill} opacity="0.95" />
                <ellipse cx="-2.9" cy="-16.4" rx="1.45" ry="0.9" transform="rotate(-14 -2.9 -16.4)" fill={bellyFill} opacity="0.95" />
                <ellipse cx="5.7" cy="-16.4" rx="1.45" ry="0.9" transform="rotate(14 5.7 -16.4)" fill={bellyFill} opacity="0.95" />
              </g>
            ) : (
              /* Bunny: cute soft cream muzzle puff + fluffy plush forehead hair-tuft */
              <g>
                <ellipse cx="1.4" cy="-7.6" rx="4.2" ry="2.6" fill={bellyFill} opacity="0.94" />
                <path
                  d="M -0.6 -21.2 C -0.4 -24.0, 2.2 -24.4, 3.2 -22.2 C 2.0 -22.0, 1.2 -21.2, 1.0 -20.8 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="0.95"
                  strokeLinejoin="round"
                />
              </g>
            )}

            {/* Velvet 3D plush lighting over head (no harsh plastic pill!) */}
            <path
              d="M -9.2 -13.4 C -9.4 -19.4, -4.8 -21.8, 1.4 -21.8 C 7.6 -21.8, 12.2 -19.4, 12.0 -13.4 C 12.9 -7.6, 9.2 -3.2, 1.4 -3.2 C -6.4 -3.2, -10.1 -7.6, -9.2 -13.4 Z"
              fill={`url(#${gradPrefix}-velvet)`}
            />

            {/* Signature Girl Head / Ear Accessories */}
            {isGirl ? (
              character === 'fox' ? (
                <RibbonBowSvg cx={7.6} cy={-19.4} scale={0.95} rotateDeg={20} bowFill={accentFill} knotFill={secondaryFill} />
              ) : character === 'cat' ? (
                <RibbonBowSvg cx={7.4} cy={-19.2} scale={0.92} rotateDeg={22} bowFill={accentFill} knotFill={secondaryFill} />
              ) : character === 'dog' ? (
                <BlossomClipSvg cx={8.2} cy={-18.2} />
              ) : (
                <RibbonBowSvg cx={6.4} cy={-19.6} scale={0.94} rotateDeg={16} bowFill={accentFill} knotFill={secondaryFill} />
              )
            ) : null}

            {/* Soft airbrushed storybook rosy cheeks */}
            {mood !== 'cry' ? (
              <g opacity={mood === 'celebrate' || mood === 'cheer' ? 0.96 : isGirl ? 0.84 : 0.68}>
                <ellipse cx="-6.1" cy="-8.6" rx="3.0" ry="1.85" fill={`url(#${gradPrefix}-blush)`} />
                <ellipse cx="8.9" cy="-8.6" rx="3.0" ry="1.85" fill={`url(#${gradPrefix}-blush)`} />
              </g>
            ) : null}

            {/* Delicate cat whiskers */}
            {character === 'cat' ? (
              <g stroke={INK} strokeWidth="0.65" strokeLinecap="round" opacity="0.68">
                <line x1="-11.4" y1="-9.8" x2="-7.8" y2="-9.2" />
                <line x1="-11.2" y1="-7.8" x2="-7.8" y2="-8.0" />
                <line x1="10.6" y1="-9.2" x2="14.2" y2="-9.8" />
                <line x1="10.6" y1="-8.0" x2="14.0" y2="-7.8" />
              </g>
            ) : null}

            {/* --- 5C. EXPRESSIVE KAWAII EYES (Wide-Set, Soulful, Zero Bug-Eyes!) --- */}
            {mood === 'cheer' ? (
              /* Joyful happy-squint `◠ ◠` arcs! */
              <g fill="none" stroke={INK} strokeWidth="1.75" strokeLinecap="round">
                <path d="M -5.4 -11.6 Q -3.2 -14.6, -1.0 -11.6" />
                <path d="M 3.8 -11.6 Q 6.0 -14.6, 8.2 -11.6" />
                {isGirl ? (
                  <>
                    <path d="M -5.4 -11.8 L -6.6 -12.8" strokeWidth="1.05" />
                    <path d="M 8.2 -11.8 L 9.4 -12.8" strokeWidth="1.05" />
                  </>
                ) : null}
              </g>
            ) : mood === 'celebrate' ? (
              /* Starry-eyed excitement (`✦ ✦` inside big sparkling jewel eyes!) */
              <g>
                <KawaiiJewelEye cx={-3.2} cy={-11.9} irisFill={irisFill} isGirl={isGirl} side="left" scale={1.06} starry />
                <KawaiiJewelEye cx={6.0} cy={-11.9} irisFill={irisFill} isGirl={isGirl} side="right" scale={1.06} starry />
              </g>
            ) : mood === 'cry' ? (
              /* Endearing squishy `> <` cartoon pout with shimmering teardrop bubbles! */
              <g>
                <path
                  d="M -5.2 -13.2 L -1.6 -11.6 L -5.2 -10.0"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.55"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 8.0 -13.2 L 4.4 -11.6 L 8.0 -10.0"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.55"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <ellipse cx="-4.2" cy="-8.8" rx="1.2" ry="1.8" fill="var(--prism-2)" className="sb-mascot-tear" />
                <ellipse cx="7.0" cy="-8.8" rx="1.2" ry="1.8" fill="var(--prism-2)" className="sb-mascot-tear sb-mascot-tear-right" />
                <circle cx="-5.6" cy="-5.8" r="0.95" fill="var(--prism-5)" className="sb-mascot-tear sb-mascot-tear-splash" />
                <circle cx="8.4" cy="-5.8" r="0.95" fill="var(--prism-5)" className="sb-mascot-tear sb-mascot-tear-splash" />
              </g>
            ) : mood === 'hurry' ? (
              /* Playful wide-eyed "uh-oh!" cartoon energy + bobbing waterdrop */
              <g>
                <KawaiiJewelEye cx={-3.2} cy={-11.9} irisFill={irisFill} isGirl={isGirl} side="left" scale={1.08} />
                <KawaiiJewelEye cx={6.0} cy={-11.9} irisFill={irisFill} isGirl={isGirl} side="right" scale={1.08} />
                <path
                  d="M -5.4 -15.6 Q -3.4 -17.0, -1.4 -15.8 M 4.2 -15.8 Q 6.2 -17.0, 8.2 -15.6"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.0"
                  strokeLinecap="round"
                />
                <path
                  d="M 11.4 -17.2 C 13.0 -14.8, 12.8 -12.6, 11.4 -12.6 C 10.0 -12.6, 9.8 -14.8, 11.4 -17.2 Z"
                  fill="var(--prism-2)"
                  stroke={INK}
                  strokeWidth="0.7"
                  className="sb-mascot-sweat"
                />
              </g>
            ) : (
              /* Cozy soulful jewel eyes with periodic happy smile-blink! */
              <g>
                <g className="sb-mascot-eyes-open">
                  <KawaiiJewelEye cx={-3.2} cy={-11.9} irisFill={irisFill} isGirl={isGirl} side="left" />
                  <KawaiiJewelEye cx={6.0} cy={-11.9} irisFill={irisFill} isGirl={isGirl} side="right" />
                </g>
                <g className="sb-mascot-eyes-blink" fill="none" stroke={INK} strokeWidth="1.55" strokeLinecap="round">
                  <path d="M -5.2 -11.6 Q -3.2 -13.4, -1.2 -11.6" />
                  <path d="M 4.0 -11.6 Q 6.0 -13.4, 8.0 -11.6" />
                </g>
              </g>
            )}

            {/* --- 5D. TINY CUTE NOSE & WARM EXPRESSIVE MOUTH --- */}
            <ellipse
              cx="1.4"
              cy="-9.5"
              rx={character === 'dog' ? 1.55 : 1.15}
              ry={character === 'dog' ? 1.05 : 0.78}
              fill={character === 'cat' || character === 'bunny' ? 'var(--prism-1)' : INK}
            />
            {character === 'dog' ? (
              <circle cx="1.0" cy="-9.85" r="0.38" fill="var(--on-accent)" opacity="0.65" />
            ) : null}

            {mood === 'celebrate' || mood === 'cheer' ? (
              /* Big delighted laugh smile with rosy tongue peek! */
              <g>
                <path
                  d="M -1.4 -7.7 Q 1.4 -4.1, 4.2 -7.7 Z"
                  fill="var(--prism-1)"
                  stroke={INK}
                  strokeWidth="0.95"
                  strokeLinejoin="round"
                />
                {character === 'bunny' ? (
                  <rect x="0.7" y="-7.6" width="1.4" height="1.15" rx="0.3" fill="var(--on-accent)" />
                ) : null}
              </g>
            ) : mood === 'hurry' ? (
              /* Cute tiny surprised `:o` mouth */
              <ellipse cx="1.4" cy="-6.8" rx="1.45" ry="1.7" fill="var(--prism-1)" stroke={INK} strokeWidth="0.95" />
            ) : mood === 'cry' ? (
              /* Tiny wobbly adorable pout */
              <path
                d="M -1.0 -6.4 Q 1.4 -8.2, 3.8 -6.4"
                fill="none"
                stroke={INK}
                strokeWidth="1.15"
                strokeLinecap="round"
              />
            ) : character === 'dog' ? (
              /* Friendly happy puppy smile with cute tiny pink blep tongue! */
              <g>
                <path
                  d="M -1.1 -7.6 Q 0.1 -6.2, 1.4 -7.4 Q 2.7 -6.2, 3.9 -7.6"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.05"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 0.5 -6.8 C 0.4 -5.1, 2.4 -5.1, 2.3 -6.8 Z"
                  fill="var(--prism-1)"
                  stroke={INK}
                  strokeWidth="0.65"
                />
              </g>
            ) : (
              /* Classic sweet `:3` storybook plush smile */
              <path
                d="M -1.1 -7.6 Q 0.1 -6.2, 1.4 -7.4 Q 2.7 -6.2, 3.9 -7.6"
                fill="none"
                stroke={INK}
                strokeWidth="1.05"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>

          {/* --- 6. RIGHT PLUSH PAW (Resting / Cheering / Victory Wave) --- */}
          <g className={mood === 'cheer' || mood === 'celebrate' ? 'sb-mascot-cheer-arm' : undefined}>
            <ArticulatedLimb ik={rightArmIK} fill={bodyFill} padFill={bellyFill} width={2.9} />
          </g>

          {/* Non-channeling left paw on victory / pout */}
          {!isChanneling ? (
            <ArticulatedLimb ik={nonChannelLeftIK} fill={bodyFill} padFill={bellyFill} width={2.9} />
          ) : null}

          {/* --- 7. JOYFUL FLOATING HEARTS & TWINKLING STARS --- */}
          {mood === 'celebrate' || mood === 'cheer' ? (
            <g>
              <FloatingHeartSvg
                cx={-11.8}
                cy={-24.0}
                fill="var(--prism-1)"
                scale={0.95}
                className="sb-mascot-heart"
              />
              <path
                d="M 14.2 -25.8 L 15.2 -23.0 L 18.0 -22.0 L 15.2 -21.0 L 14.2 -18.2 L 13.2 -21.0 L 10.4 -22.0 L 13.2 -23.0 Z"
                fill="var(--prism-4)"
                className="sb-mascot-sparkle"
              />
              {mood === 'celebrate' ? (
                <FloatingHeartSvg
                  cx={1.4}
                  cy={rig.topStarY - 1.5}
                  fill="var(--prism-4)"
                  scale={1.08}
                  className="sb-mascot-heart sb-mascot-heart-2"
                />
              ) : null}
            </g>
          ) : null}
        </g>
      </g>

      {/* --- 8. DAINTY PLUSH CHANNELING PAW & TWINKLING STAR-WAND (2-Bone IK!) --- */}
      {isChanneling ? (
        <g>
          {/* Golden Star-Wand shaft + soft glowing halo + twinkling 4-point star gem */}
          <line
            x1={wandArmIK.handX + 1.4}
            y1={wandArmIK.handY + 1.8}
            x2={wandNodeX - 5.2}
            y2={wandNodeY - 4.4}
            stroke={INK}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <line
            x1={wandArmIK.handX + 1.4}
            y1={wandArmIK.handY + 1.8}
            x2={wandNodeX - 5.2}
            y2={wandNodeY - 4.4}
            stroke="var(--prism-4)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <g transform={`translate(${(wandNodeX - 5.6).toFixed(2)}, ${(wandNodeY - 4.8).toFixed(2)})`}>
            <g className="sb-mascot-wand-star">
              <circle cx="0" cy="0" r="6.2" fill={`url(#${gradPrefix}-wand-glow)`} />
              <path
                d="M 0 -4.2 L 1.2 -1.2 L 4.2 0 L 1.2 1.2 L 0 4.2 L -1.2 1.2 L -4.2 0 L -1.2 -1.2 Z"
                fill={accentFill}
                stroke={INK}
                strokeWidth="0.72"
                strokeLinejoin="round"
              />
              <circle cx="0" cy="0" r="1.2" fill="var(--on-accent)" />
            </g>
          </g>
          <ArticulatedLimb ik={wandArmIK} fill={bodyFill} padFill={bellyFill} width={2.8} />
        </g>
      ) : null}
    </g>
  );
}
