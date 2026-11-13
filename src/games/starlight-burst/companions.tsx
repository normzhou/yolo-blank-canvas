import {
  characterDisplayName,
  type CharacterId,
  type MascotGender,
  type MascotMood,
} from '../../shared/starlightBurst';

/**
 * Declarative Rigged Vector Companion format for Starlight Burst (#345, #347, #352).
 *
 * Four non-reptilian plush/spirit companions (`fox`, `cat`, `dog`, `bunny`) with
 * distinct Boy and Girl personas, gender-matched names & `--prism-*` token palettes,
 * curved winged eyelashes, ear/crown bows, sakura blossom clip, and planar 2-bone
 * Bezier arm IK channeling a luminous Star-Wand along the orbital focus ring.
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
    // Boy: Ren — Cinnamon-amber fox with snow-cream brush tail tip & cobalt star scarf
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
    // Girl: Kiko — Sakura coral-rose fox with snow-cream tail tip, golden ear bow & pearl necklace
    girl: {
      body: 'var(--prism-1)',
      accent: 'var(--prism-4)',
      secondary: 'var(--prism-2)',
      iris: 'var(--prism-2)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-2)',
      calloutText: 'var(--prism-1)',
      badgeBg: 'var(--prism-1)',
      badgeFg: INK,
    },
    topStarY: -29,
    tailPivot: [11, 5.2],
    leftEarPivot: [-4.0, -17.5],
    rightEarPivot: [7.8, -17.5],
  },
  cat: {
    id: 'cat',
    // Boy: Yuzu — Ginger-marmalade tabby cat with cobalt collar & aqua star tag
    boy: {
      body: 'var(--prism-6)',
      accent: 'var(--prism-4)',
      secondary: 'var(--prism-5)',
      iris: 'var(--prism-3)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-6)',
      badgeBg: 'var(--prism-6)',
      badgeFg: INK,
    },
    // Girl: Mochi — Pastel orchid-lavender kitty with rose ear-base satin bow & golden bell
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
    topStarY: -29,
    tailPivot: [11, 5],
    leftEarPivot: [-3.5, -17.5],
    rightEarPivot: [7.5, -17.5],
  },
  dog: {
    id: 'dog',
    // Boy: Koro — Sunny Shiba gold pup with amber ears & sporty cobalt V-bandana
    boy: {
      body: 'var(--prism-4)',
      accent: 'var(--prism-6)',
      secondary: 'var(--prism-5)',
      iris: 'var(--problem)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-4)',
      badgeBg: 'var(--prism-4)',
      badgeFg: INK,
    },
    // Girl: Hana — Snow-cream & blossom-rose puppy with 5-petal sakura hair clip & rose-pearl collar
    girl: {
      body: 'var(--on-accent)',
      accent: 'var(--prism-1)',
      secondary: 'var(--prism-4)',
      iris: 'var(--accent)',
      belly: 'var(--prism-1)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-1)',
      badgeBg: 'var(--prism-1)',
      badgeFg: INK,
    },
    topStarY: -27,
    tailPivot: [11.5, 4],
    leftEarPivot: [-6.5, -14.5],
    rightEarPivot: [10.5, -14.5],
  },
  bunny: {
    id: 'bunny',
    // Boy: Poko — Sky-cobalt bunny with aqua inner ears & dapper aqua/gold bow-tie
    boy: {
      body: 'var(--prism-5)',
      accent: 'var(--prism-7)',
      secondary: 'var(--prism-4)',
      iris: 'var(--prism-3)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-1)',
      calloutText: 'var(--prism-7)',
      badgeBg: 'var(--prism-7)',
      badgeFg: INK,
    },
    // Girl: Momo — Sweet berry-pink bunny with golden inner ears, plush lop-ear bow & sweetheart ribbon
    girl: {
      body: 'var(--prism-1)',
      accent: 'var(--prism-4)',
      secondary: 'var(--prism-2)',
      iris: 'var(--prism-2)',
      belly: 'var(--on-accent)',
      cheek: 'var(--prism-2)',
      calloutText: 'var(--prism-1)',
      badgeBg: 'var(--prism-1)',
      badgeFg: INK,
    },
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
      <path
        d="M 0 0 C -3.8 -3.4, -6.2 -1.2, -5.2 1.4 C -4.4 3.4, -1.6 2.5, 0 0 Z"
        fill={bowFill}
        stroke={INK}
        strokeWidth="0.95"
        strokeLinejoin="round"
      />
      <path
        d="M 0 0 C 3.8 -3.4, 6.2 -1.2, 5.2 1.4 C 4.4 3.4, 1.6 2.5, 0 0 Z"
        fill={bowFill}
        stroke={INK}
        strokeWidth="0.95"
        strokeLinejoin="round"
      />
      <circle cx="-3.2" cy="-0.6" r="0.7" fill="var(--on-accent)" opacity="0.55" />
      <circle cx="3.2" cy="-0.6" r="0.7" fill="var(--on-accent)" opacity="0.55" />
      <circle cx="0" cy="0.2" r="1.45" fill={knotFill} stroke={INK} strokeWidth="0.9" />
    </g>
  );
}

function BlossomClipSvg({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse
        cx="3.2"
        cy="1.2"
        rx="2.3"
        ry="1.1"
        transform="rotate(25 3.2 1.2)"
        fill="var(--prism-3)"
        stroke={INK}
        strokeWidth="0.8"
      />
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse
          key={i}
          cx="0"
          cy="-2.2"
          rx="1.55"
          ry="2.0"
          transform={`rotate(${i * 72})`}
          fill="var(--on-accent)"
          stroke={INK}
          strokeWidth="0.8"
        />
      ))}
      <circle cx="0" cy="0" r="1.4" fill="var(--prism-1)" stroke={INK} strokeWidth="0.75" />
      <circle cx="-0.3" cy="-0.3" r="0.4" fill="var(--prism-4)" />
    </g>
  );
}

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

  const wandNodeX = -12.6 + Math.cos(orbitRad) * 3.0;
  const wandNodeY = Math.sin(orbitRad) * 4.8;

  const shotLeanDeg = isFiring ? -4.0 : 0;
  const shotLiftY = isFiring ? -1.2 : 0;
  const bodyBobY = (isChanneling ? Math.sin(orbitRad) * 1.3 : 0) + shotLiftY;
  const bodyTiltDeg = (isChanneling ? Math.cos(orbitRad) * 3.8 : 0) + shotLeanDeg;

  const leftFootY = isChanneling ? 9.8 + Math.sin(orbitRad) * 1.2 : 9.8;
  const rightFootY = isChanneling ? 9.8 - Math.sin(orbitRad) * 1.2 : 9.8;

  const tiltRad = (bodyTiltDeg * Math.PI) / 180;
  const cosB = Math.cos(tiltRad);
  const sinB = Math.sin(tiltRad);
  const rootLeftShoulderX = -4.2 * cosB - -1.2 * sinB;
  const rootLeftShoulderY = -4.2 * sinB + -1.2 * cosB + bodyBobY;

  const wandArmIK = solveTwoBoneIK(
    rootLeftShoulderX,
    rootLeftShoulderY,
    wandNodeX,
    wandNodeY,
    6.8,
    7.0,
    -1,
  );

  const nonChannelLeftIK =
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
              11.2 + Math.cos(orbitRad) * 1.4,
              2.2 - Math.sin(orbitRad) * 1.8,
              4.8,
              4.8,
              1,
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
        <radialGradient id={`${gradPrefix}-shine`} cx="32%" cy="24%" r="72%">
          <stop offset="0%" stopColor="var(--on-accent)" stopOpacity="0.34" />
          <stop offset="52%" stopColor="var(--on-accent)" stopOpacity="0.04" />
          <stop offset="100%" stopColor={INK} stopOpacity="0.22" />
        </radialGradient>
      </defs>

      {/* Stationary click hit-box */}
      <rect x={-24} y={-36} width={48} height={54} fill="transparent" />

      {/* Ground starlight aura shadow */}
      <ellipse cx="2.5" cy="11.2" rx="11.5" ry="2.3" fill={INK} opacity="0.52" />

      {/* Outer kinematic group */}
      <g
        transform={`translate(0, ${bodyBobY.toFixed(2)}) rotate(${bodyTiltDeg.toFixed(2)})`}
      >
        <g className={`sb-mascot sb-mascot-${mood}${isFiring ? ' sb-mascot-firing' : ''}`}>
          {/* --- 1. FLUFFY COMPANION TAILS --- */}
          <g
            className="sb-mascot-tail"
            style={{ transformOrigin: `${rig.tailPivot[0]}px ${rig.tailPivot[1]}px` }}
          >
            {character === 'fox' ? (
              /* Big plush curved kitsune / fox brush tail with snow-cream tip */
              <g>
                <path
                  d="M 9.5 6.0 C 17.8 8.0, 23.6 0.4, 20.4 -6.8 C 18.8 -10.4, 13.8 -8.8, 12.6 -3.8 C 11.8 -0.4, 10.6 2.8, 9.5 6.0 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                />
                {/* Fluffy snow-cream fox tail tip */}
                <path
                  d="M 20.4 -6.8 C 22.0 -3.2, 20.6 0.5, 17.8 1.2 C 16.4 -0.8, 16.0 -2.6, 14.2 -3.2 C 14.8 -7.2, 18.8 -10.2, 20.4 -6.8 Z"
                  fill="var(--on-accent)"
                  stroke={INK}
                  strokeWidth="0.95"
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
                <circle cx="13.8" cy="4.4" r="3.9" fill={bellyFill} stroke={INK} strokeWidth="1.15" />
                <circle cx="15.5" cy="3.0" r="2.3" fill={bellyFill} stroke={INK} strokeWidth="0.95" />
                <circle cx="13.3" cy="3.5" r="2.1" fill={bellyFill} />
              </g>
            ) : null}
          </g>

          {/* --- 2. BACK/OUTER RIGHT ARM --- */}
          <g className={mood === 'cheer' ? 'sb-mascot-cheer-arm' : undefined}>
            <ArticulatedLimb ik={rightArmIK} fill={bodyFill} padFill={accentFill} width={3.7} />
          </g>

          {/* --- 3. FEET --- */}
          <g>
            <ellipse
              cx="-2.0"
              cy={leftFootY}
              rx="4.6"
              ry="2.4"
              fill={character === 'fox' ? INK : accentFill}
              stroke={INK}
              strokeWidth="1.15"
            />
            <ellipse
              cx="-2.0"
              cy={leftFootY}
              rx="3.4"
              ry="1.6"
              fill={accentFill}
              opacity={character === 'fox' ? 0.85 : 1}
            />
            <ellipse cx="-3.0" cy={leftFootY - 0.5} rx="1.9" ry="0.8" fill="var(--on-accent)" opacity="0.45" />
            <ellipse
              cx="6.4"
              cy={rightFootY}
              rx="4.6"
              ry="2.4"
              fill={character === 'fox' ? INK : accentFill}
              stroke={INK}
              strokeWidth="1.15"
            />
            <ellipse
              cx="6.4"
              cy={rightFootY}
              rx="3.4"
              ry="1.6"
              fill={accentFill}
              opacity={character === 'fox' ? 0.85 : 1}
            />
            <ellipse cx="5.4" cy={rightFootY - 0.5} rx="1.9" ry="0.8" fill="var(--on-accent)" opacity="0.45" />
          </g>

          {/* --- 4. PLUMP TORSO, TUMMY MARKINGS & GENDER NECKWEAR --- */}
          <ellipse cx="2.8" cy="0.4" rx="9.8" ry="10.0" fill={bodyFill} stroke={INK} strokeWidth="1.35" />
          <ellipse
            cx="1.0"
            cy="1.8"
            rx="6.0"
            ry="6.7"
            fill={bellyFill}
            opacity={character === 'dog' && isGirl ? 0.32 : 0.94}
          />
          {character === 'fox' ? (
            /* Fluffy snow-cream fox chest ruff */
            <path
              d="M -3.2 -2.2 L -1.0 1.4 L 1.1 -0.6 L 3.3 1.4 L 5.2 -2.2 Z"
              fill="var(--on-accent)"
              opacity="0.95"
            />
          ) : null}
          <ellipse cx="2.8" cy="0.4" rx="9.2" ry="9.4" fill={`url(#${gradPrefix}-shine)`} />

          {/* Gender-specific neckwear & collars positioned cleanly below chin */}
          {character === 'fox' ? (
            isGirl ? (
              /* Kiko pearl-and-star sweetheart necklace */
              <g>
                <circle cx="-1.6" cy="-2.4" r="1.15" fill="var(--on-accent)" stroke={INK} strokeWidth="0.7" />
                <circle cx="0.9" cy="-1.9" r="1.45" fill={accentFill} stroke={INK} strokeWidth="0.8" />
                <circle cx="3.4" cy="-2.4" r="1.15" fill="var(--on-accent)" stroke={INK} strokeWidth="0.7" />
              </g>
            ) : (
              /* Ren sporty cobalt star scarf */
              <g>
                <path
                  d="M -4.2 -3.8 Q 1.4 -2.2 7.2 -3.8 L 1.2 0.4 Z"
                  fill={secondaryFill}
                  stroke={INK}
                  strokeWidth="0.9"
                  strokeLinejoin="round"
                />
                <circle cx="1.2" cy="-2.0" r="0.95" fill={accentFill} />
              </g>
            )
          ) : character === 'cat' ? (
            isGirl ? (
              <g>
                <path
                  d="M -4.2 -3.4 Q 1.5 -1.8 7.6 -3.4"
                  fill="none"
                  stroke={accentFill}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="1.2" cy="-1.9" r="2.0" fill={secondaryFill} stroke={INK} strokeWidth="0.9" />
                <line x1="0.3" y1="-1.7" x2="2.1" y2="-1.7" stroke={INK} strokeWidth="0.75" />
              </g>
            ) : (
              <g>
                <path
                  d="M -4.2 -3.4 Q 1.5 -1.8 7.6 -3.4"
                  fill="none"
                  stroke={secondaryFill}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <polygon
                  points="1.2,-3.8 1.8,-2.4 3.2,-2.2 2.1,-1.2 2.4,0.2 1.2,-0.6 0.0,0.2 0.3,-1.2 -0.8,-2.2 0.6,-2.4"
                  fill="var(--prism-7)"
                  stroke={INK}
                  strokeWidth="0.7"
                />
              </g>
            )
          ) : character === 'dog' ? (
            isGirl ? (
              <g>
                <path
                  d="M -4.4 -3.3 Q 1.4 -1.6 7.4 -3.3"
                  fill="none"
                  stroke={accentFill}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="-1.5" cy="-2.3" r="1.2" fill={accentFill} stroke={INK} strokeWidth="0.75" />
                <circle cx="1.1" cy="-1.9" r="1.5" fill={secondaryFill} stroke={INK} strokeWidth="0.8" />
                <circle cx="3.7" cy="-2.3" r="1.2" fill={accentFill} stroke={INK} strokeWidth="0.75" />
              </g>
            ) : (
              <g>
                <path
                  d="M -4.5 -3.8 Q 1.5 -2.2 7.8 -3.8 L 1.2 0.5 Z"
                  fill={secondaryFill}
                  stroke={INK}
                  strokeWidth="0.95"
                  strokeLinejoin="round"
                />
              </g>
            )
          ) : isGirl ? (
            <g>
              <circle cx="-1.2" cy="-2.2" r="1.45" fill="var(--on-accent)" stroke={INK} strokeWidth="0.75" />
              <circle cx="3.4" cy="-2.2" r="1.45" fill="var(--on-accent)" stroke={INK} strokeWidth="0.75" />
              <RibbonBowSvg cx={1.1} cy={-2.0} scale={0.58} bowFill={accentFill} knotFill={secondaryFill} />
            </g>
          ) : (
            <g>
              <polygon points="-2.7,-3.5 1.2,-2.0 -2.7,-0.5" fill={accentFill} stroke={INK} strokeWidth="0.85" />
              <polygon points="5.1,-3.5 1.2,-2.0 5.1,-0.5" fill={accentFill} stroke={INK} strokeWidth="0.85" />
              <circle cx="1.2" cy="-2.0" r="1.3" fill={secondaryFill} stroke={INK} strokeWidth="0.8" />
            </g>
          )}

          {/* --- 5. EARS BEHIND HEAD --- */}
          {character === 'fox' ? (
            <g>
              <g
                className="sb-mascot-ear-left"
                style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
              >
                <path
                  d="M -7.6 -15.0 L -5.0 -27.2 L 1.2 -18.2 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                {/* Dark fox ear tip + snow-cream inner fluff */}
                <polygon points="-5.8,-22.8 -5.0,-27.2 -2.6,-23.4" fill={INK} />
                <polygon points="-5.6,-16.4 -4.4,-22.6 -0.2,-18.2" fill="var(--on-accent)" opacity="0.92" />
              </g>
              <g
                className="sb-mascot-ear-right"
                style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
              >
                <path
                  d="M 2.6 -18.2 L 8.8 -27.2 L 11.4 -15.0 Z"
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <polygon points="6.4,-23.4 8.8,-27.2 9.6,-22.8" fill={INK} />
                <polygon points="4.0,-18.2 8.2,-22.6 9.4,-16.4" fill="var(--on-accent)" opacity="0.92" />
              </g>
            </g>
          ) : null}

          {character === 'cat' ? (
            <g>
              <g
                className="sb-mascot-ear-left"
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
                className="sb-mascot-ear-right"
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
                className="sb-mascot-ear-left"
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
                className="sb-mascot-ear-right"
                style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
              >
                <ellipse
                  cx="6.0"
                  cy="-22.5"
                  rx="2.95"
                  ry="6.4"
                  transform={`rotate(${isGirl ? 22 : 13} 6.0 -22.5)`}
                  fill={bodyFill}
                  stroke={INK}
                  strokeWidth="1.2"
                />
                <ellipse
                  cx="6.0"
                  cy="-22.3"
                  rx="1.45"
                  ry="4.2"
                  transform={`rotate(${isGirl ? 22 : 13} 6.0 -22.3)`}
                  fill={accentFill}
                />
              </g>
            </g>
          ) : null}

          {/* --- 6. SCULPTED CHIBI HEAD & SPECIES FACIAL ANATOMY --- */}
          <ellipse cx="1.8" cy="-11.6" rx="9.6" ry="8.7" fill={bodyFill} stroke={INK} strokeWidth="1.35" />

          {character === 'fox' ? (
            /* Iconic snow-cream fox cheek ruffs framing lower face */
            <g>
              <path
                d="M -7.6 -10.8 C -9.8 -9.4, -9.2 -6.4, -6.2 -5.8 C -3.8 -4.0, -0.5 -3.4, 1.8 -3.4 C 4.2 -3.4, 7.5 -4.0, 9.8 -5.8 C 12.8 -6.4, 13.4 -9.4, 11.2 -10.8 C 8.4 -10.4, 5.2 -9.4, 1.8 -9.4 C -1.6 -9.4, -4.8 -10.4, -7.6 -10.8 Z"
                fill="var(--on-accent)"
                stroke={INK}
                strokeWidth="0.95"
                strokeLinejoin="round"
              />
            </g>
          ) : null}

          {character === 'dog' ? (
            <g>
              {!isGirl ? (
                <>
                  <ellipse cx="1.0" cy="-9.2" rx="7.0" ry="5.0" fill={bellyFill} opacity="0.94" />
                  <ellipse cx="-2.1" cy="-16.1" rx="1.3" ry="0.88" fill={bellyFill} opacity="0.95" />
                  <ellipse cx="4.3" cy="-16.1" rx="1.3" ry="0.88" fill={bellyFill} opacity="0.95" />
                </>
              ) : null}
              <g
                className="sb-mascot-ear-left"
                style={{ transformOrigin: `${rig.leftEarPivot[0]}px ${rig.leftEarPivot[1]}px` }}
              >
                <ellipse
                  cx="-7.4"
                  cy="-11.2"
                  rx="2.9"
                  ry="5.8"
                  transform="rotate(20 -7.4 -11.2)"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.15"
                />
              </g>
              <g
                className="sb-mascot-ear-right"
                style={{ transformOrigin: `${rig.rightEarPivot[0]}px ${rig.rightEarPivot[1]}px` }}
              >
                <ellipse
                  cx="10.6"
                  cy="-11.0"
                  rx="2.9"
                  ry="5.8"
                  transform="rotate(-18 10.6 -11.0)"
                  fill={accentFill}
                  stroke={INK}
                  strokeWidth="1.15"
                />
              </g>
            </g>
          ) : null}

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

          {/* --- 6B. SIGNATURE GIRL HEAD / EAR ACCESSORIES --- */}
          {isGirl ? (
            character === 'fox' ? (
              /* Kiko: Tilted golden satin bow at the base of her right fox ear */
              <RibbonBowSvg cx={7.2} cy={-18.4} scale={0.96} rotateDeg={20} bowFill={accentFill} knotFill={secondaryFill} />
            ) : character === 'cat' ? (
              /* Mochi: Tilted rose satin bow at the base of her right ear */
              <RibbonBowSvg cx={7.2} cy={-18.2} scale={0.9} rotateDeg={22} bowFill={accentFill} knotFill={secondaryFill} />
            ) : character === 'dog' ? (
              /* Hana: 5-petal sakura blossom clip beside her right ear */
              <BlossomClipSvg cx={8.0} cy={-17.0} />
            ) : (
              /* Momo: Big plush golden bow tied around her tilted right lop ear */
              <RibbonBowSvg cx={5.6} cy={-18.4} scale={0.95} rotateDeg={18} bowFill={accentFill} knotFill={secondaryFill} />
            )
          ) : null}

          {/* Rosy cheek blushes */}
          {mood !== 'cry' ? (
            <g opacity={mood === 'celebrate' || mood === 'cheer' ? 0.85 : isGirl ? 0.68 : 0.42}>
              <ellipse cx="-5.0" cy="-9.2" rx={isGirl ? 2.15 : 1.75} ry={isGirl ? 1.28 : 1.05} fill={cheekFill} />
              <ellipse cx="7.6" cy="-9.2" rx={isGirl ? 2.15 : 1.75} ry={isGirl ? 1.28 : 1.05} fill={cheekFill} />
              {isGirl ? (
                <>
                  <circle cx="-5.5" cy="-9.5" r="0.45" fill="var(--on-accent)" opacity="0.85" />
                  <circle cx="7.1" cy="-9.5" r="0.45" fill="var(--on-accent)" opacity="0.85" />
                </>
              ) : null}
            </g>
          ) : null}

          {/* Species snouts & whiskers */}
          {character === 'fox' ? (
            <g>
              <polygon
                points="0.1,-9.7 2.5,-9.7 1.3,-8.2"
                fill={isGirl ? secondaryFill : INK}
                stroke={INK}
                strokeWidth="0.55"
              />
            </g>
          ) : null}

          {character === 'dog' ? (
            <g>
              <ellipse
                cx="0.8"
                cy="-8.5"
                rx="3.7"
                ry="2.45"
                fill="var(--on-accent)"
                stroke={INK}
                strokeWidth="0.9"
              />
              <ellipse
                cx="0.8"
                cy="-9.6"
                rx="1.5"
                ry="1.05"
                fill={isGirl ? accentFill : INK}
                stroke={INK}
                strokeWidth={isGirl ? 0.55 : 0}
              />
              <circle cx="0.3" cy="-9.9" r="0.42" fill="var(--on-accent)" opacity="0.85" />
            </g>
          ) : null}

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

          {/* --- 7. EXPRESSIVE EYES, GIRL EYELASHES, BLINK & MOUTH --- */}
          {mood === 'celebrate' || mood === 'cheer' ? (
            <g>
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
              {isGirl ? (
                <g stroke={INK} strokeWidth="1.15" strokeLinecap="round">
                  <line x1="-4.0" y1="-12.6" x2="-5.7" y2="-14.1" />
                  <line x1="-3.5" y1="-13.4" x2="-5.1" y2="-15.1" />
                  <line x1="6.8" y1="-12.6" x2="8.5" y2="-14.1" />
                  <line x1="6.3" y1="-13.4" x2="7.9" y2="-15.1" />
                </g>
              ) : null}
              <path
                d="M -1.3 -7.2 Q 1.3 -3.6 3.9 -7.2 Z"
                fill="var(--prism-1)"
                stroke={INK}
                strokeWidth="0.95"
                strokeLinejoin="round"
              />
              {character === 'bunny' ? (
                <rect x="0.7" y="-7.2" width="1.2" height="1.3" rx="0.3" fill="var(--on-accent)" />
              ) : null}
            </g>
          ) : mood === 'cry' ? (
            <g>
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
              {isGirl ? (
                <g stroke={INK} strokeWidth="1.1" strokeLinecap="round">
                  <line x1="-4.0" y1="-14.0" x2="-5.6" y2="-15.2" />
                  <line x1="6.8" y1="-14.0" x2="8.4" y2="-15.2" />
                </g>
              ) : null}
              <path
                d="M -1.4 -5.5 Q 1.3 -9.0 4.0 -5.5 Z"
                fill="var(--prism-1)"
                stroke={INK}
                strokeWidth="0.95"
              />
              <g className="sb-mascot-tear sb-mascot-tear-left">
                <ellipse
                  cx="-3.4"
                  cy="-8.8"
                  rx="1.65"
                  ry="2.7"
                  fill="var(--prism-7)"
                  stroke={INK}
                  strokeWidth="0.8"
                />
                <circle cx="-3.8" cy="-9.6" r="0.58" fill="var(--on-accent)" />
              </g>
              <g className="sb-mascot-tear sb-mascot-tear-right">
                <ellipse
                  cx="6.0"
                  cy="-8.8"
                  rx="1.65"
                  ry="2.7"
                  fill="var(--prism-7)"
                  stroke={INK}
                  strokeWidth="0.8"
                />
                <circle cx="5.6" cy="-9.6" r="0.58" fill="var(--on-accent)" />
              </g>
              <circle
                className="sb-mascot-tear sb-mascot-tear-splash"
                cx="-6.4"
                cy="-5.2"
                r="1.35"
                fill="var(--prism-7)"
                stroke={INK}
                strokeWidth="0.65"
              />
              <circle
                className="sb-mascot-tear sb-mascot-tear-splash"
                cx="9.0"
                cy="-5.2"
                r="1.35"
                fill="var(--prism-7)"
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

              <g className="sb-mascot-eyes-open">
                {isGirl ? (
                  <g stroke={INK} strokeWidth="1.2" strokeLinecap="round" fill="none">
                    <path d="M -3.5 -15.3 Q -5.0 -16.6 -5.8 -17.5" />
                    <path d="M -4.2 -13.9 Q -5.8 -14.7 -6.6 -15.5" />
                    <path d="M 6.0 -15.3 Q 7.5 -16.6 8.3 -17.5" />
                    <path d="M 6.6 -13.9 Q 8.2 -14.7 9.0 -15.5" />
                  </g>
                ) : null}

                {/* Left eye */}
                <ellipse
                  cx="-1.7"
                  cy="-12.9"
                  rx="2.65"
                  ry="3.35"
                  fill="var(--on-accent)"
                  stroke={INK}
                  strokeWidth={isGirl ? 1.15 : 1.0}
                />
                <ellipse
                  cx={isFiring ? -1.9 : -2.1}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 1.25 : 1.75}
                  ry={mood === 'hurry' ? 1.45 : 2.2}
                  fill={irisFill}
                />
                <ellipse
                  cx={isFiring ? -1.95 : -2.15}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 0.85 : 1.15}
                  ry={mood === 'hurry' ? 1.0 : 1.55}
                  fill={INK}
                />
                <circle cx="-2.7" cy="-14.0" r={isGirl ? 0.88 : 0.78} fill="var(--on-accent)" />
                <circle cx="-1.3" cy="-11.7" r="0.45" fill="var(--on-accent)" opacity="0.9" />

                {/* Right eye */}
                <ellipse
                  cx="4.3"
                  cy="-12.9"
                  rx="2.5"
                  ry="3.2"
                  fill="var(--on-accent)"
                  stroke={INK}
                  strokeWidth={isGirl ? 1.15 : 1.0}
                />
                <ellipse
                  cx={isFiring ? 4.0 : 3.85}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 1.2 : 1.65}
                  ry={mood === 'hurry' ? 1.4 : 2.1}
                  fill={irisFill}
                />
                <ellipse
                  cx={isFiring ? 3.95 : 3.8}
                  cy={isFiring ? -13.4 : -12.7}
                  rx={mood === 'hurry' ? 0.8 : 1.1}
                  ry={mood === 'hurry' ? 0.95 : 1.48}
                  fill={INK}
                />
                <circle cx="3.3" cy="-14.0" r={isGirl ? 0.82 : 0.72} fill="var(--on-accent)" />
                <circle cx="4.6" cy="-11.7" r="0.42" fill="var(--on-accent)" opacity="0.9" />
              </g>

              {mood === 'normal' ? (
                <g className="sb-mascot-eyes-blink" stroke={INK} strokeWidth="1.35" strokeLinecap="round" fill="none">
                  <path d="M -4.1 -12.7 Q -1.7 -11.5 0.7 -12.7" />
                  <path d="M 1.9 -12.7 Q 4.3 -11.5 6.7 -12.7" />
                  {isGirl ? (
                    <>
                      <line x1="-4.1" y1="-12.7" x2="-5.5" y2="-13.6" />
                      <line x1="6.7" y1="-12.7" x2="8.1" y2="-13.6" />
                    </>
                  ) : null}
                </g>
              ) : null}

              {mood === 'hurry' ? (
                <ellipse
                  cx="1.2"
                  cy="-6.9"
                  rx="1.6"
                  ry="1.8"
                  fill="var(--prism-1)"
                  stroke={INK}
                  strokeWidth="0.85"
                />
              ) : character === 'cat' || character === 'bunny' || character === 'fox' ? (
                <path
                  d="M -0.8 -7.3 Q 0.2 -6.0 1.3 -7.3 Q 2.4 -6.0 3.4 -7.3"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
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
                    fill="var(--prism-1)"
                    stroke={INK}
                    strokeWidth="0.6"
                  />
                </g>
              )}
            </g>
          )}

          {/* --- 8. NON-CHANNELING LEFT ARM --- */}
          {!isChanneling ? (
            <ArticulatedLimb ik={nonChannelLeftIK} fill={bodyFill} padFill={accentFill} width={3.8} />
          ) : null}

          {/* --- 9. CELEBRATION SPARKLES & HURRY SWEAT DROPS --- */}
          {mood === 'celebrate' ? (
            <g aria-hidden="true">
              <polygon
                className="sb-mascot-sparkle sb-mascot-sparkle-1"
                points="-13,-23 -11.3,-19.8 -8,-18.1 -11.3,-16.4 -13,-13.2 -14.7,-16.4 -18,-18.1 -14.7,-19.8"
                fill="var(--prism-4)"
                stroke={INK}
                strokeWidth="0.75"
              />
              <polygon
                className="sb-mascot-sparkle sb-mascot-sparkle-2"
                points="15.5,-24 16.9,-21.2 19.7,-19.8 16.9,-18.4 15.5,-15.6 14.1,-18.4 11.3,-19.8 14.1,-21.2"
                fill="var(--prism-1)"
                stroke={INK}
                strokeWidth="0.75"
              />
              <polygon
                className="sb-mascot-sparkle sb-mascot-sparkle-1"
                points={`2,${rig.topStarY - 3.8} 3.1,${rig.topStarY - 1.1} 5.8,${rig.topStarY} 3.1,${rig.topStarY + 1.1} 2,${rig.topStarY + 3.8} 0.9,${rig.topStarY + 1.1} -1.8,${rig.topStarY} 0.9,${rig.topStarY - 1.1}`}
                fill="var(--prism-3)"
                stroke={INK}
                strokeWidth="0.7"
              />
            </g>
          ) : mood === 'cheer' ? (
            <g aria-hidden="true">
              <polygon
                className="sb-mascot-sparkle sb-mascot-sparkle-1"
                points="15,-22 16.3,-19.3 19,-18 16.3,-16.7 15,-14 13.7,-16.7 11,-18 13.7,-19.3"
                fill="var(--prism-4)"
                stroke={INK}
                strokeWidth="0.75"
              />
              <polygon
                className="sb-mascot-sparkle sb-mascot-sparkle-2"
                points={`1.8,${rig.topStarY - 2.8} 2.6,${rig.topStarY - 0.8} 4.6,${rig.topStarY} 2.6,${rig.topStarY + 0.8} 1.8,${rig.topStarY + 2.8} 1.0,${rig.topStarY + 0.8} -1.0,${rig.topStarY} 1.0,${rig.topStarY - 0.8}`}
                fill="var(--prism-7)"
                stroke={INK}
                strokeWidth="0.65"
              />
            </g>
          ) : null}

          {mood === 'hurry' ? (
            <g className="sb-mascot-sweat" fill="var(--prism-7)" stroke={INK} strokeWidth="0.7">
              <path d="M 13.5 -19.2 C 15.2 -16.8, 15.2 -14.8, 13.5 -14.8 C 11.8 -14.8, 11.8 -16.8, 13.5 -19.2 Z" />
              <path d="M 16.8 -13.8 C 18.1 -11.9, 18.1 -10.4, 16.8 -10.4 C 15.5 -10.4, 15.5 -11.9, 16.8 -13.8 Z" />
            </g>
          ) : null}
        </g>
      </g>

      {/* Foreground curved 2-bone IK channeling arm & glowing Star-Wand crystal node */}
      {isChanneling ? (
        <g>
          <ArticulatedLimb ik={wandArmIK} fill={bodyFill} padFill={accentFill} width={3.9} />
          {/* Luminous 4-point star-wand crystal tip channeling the orbital focus ring */}
          <polygon
            points={`${wandArmIK.handX},${wandArmIK.handY - 4.4} ${wandArmIK.handX + 1.4},${wandArmIK.handY - 1.4} ${wandArmIK.handX + 4.4},${wandArmIK.handY} ${wandArmIK.handX + 1.4},${wandArmIK.handY + 1.4} ${wandArmIK.handX},${wandArmIK.handY + 4.4} ${wandArmIK.handX - 1.4},${wandArmIK.handY + 1.4} ${wandArmIK.handX - 4.4},${wandArmIK.handY} ${wandArmIK.handX - 1.4},${wandArmIK.handY - 1.4}`}
            fill="var(--prism-4)"
            stroke={INK}
            strokeWidth="0.85"
          />
        </g>
      ) : null}
    </g>
  );
}
