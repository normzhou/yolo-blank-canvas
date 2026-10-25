/**
 * Puzzle Bobble (Bust-A-Move) arcade rules as pure functions (#181, #183, #186).
 *
 * Implements the 1994 Taito / Neo-Geo arcade mechanics:
 * - Fine sub-degree tap aiming (`0.5°`) + smooth 60fps continuous sweep
 * - Exponential dropped-bubble scoring (`20 * 2^(n-1)`, capped at `1,310,720` for 17+)
 * - 2-Player Versus attack transfer (`popped - 3` on 4+ pops plus all dropped
 *   hanging bubbles) into the opponent's `incomingQueue` with on-board preview
 *   and bottom-up rising placement (`risenGarbage`)
 * - Dynamic ceiling drop interval scaled by the number of remaining bubble colours,
 *   with a 1-shot pre-drop compressor tremor warning
 * - 10-second shot timer with 5-second `HURRY UP!` countdown and auto-fire
 * - Classic arcade stage formations and fast-clear stage bonus
 *
 * All game state is local to the canvas view and is never written to GitHub.
 */

export type BubbleColor = 'ruby' | 'amber' | 'emerald' | 'azure' | 'amethyst' | 'coral';
export type BubbleCell = BubbleColor | null;
export type BubbleGrid = BubbleCell[][];

export type CharacterId = 'dragon' | 'cat' | 'dog' | 'bunny';
export type MascotMood = 'normal' | 'cheer' | 'hurry' | 'celebrate' | 'cry';

export interface CharacterOption {
  id: CharacterId;
  label: string;
  p1Name: string;
  p2Name: string;
}

export const CHARACTER_OPTIONS: readonly CharacterOption[] = [
  { id: 'dragon', label: 'Dragon', p1Name: 'Bub', p2Name: 'Bob' },
  { id: 'cat', label: 'Cat', p1Name: 'Mochi', p2Name: 'Yuzu' },
  { id: 'dog', label: 'Dog', p1Name: 'Pochi', p2Name: 'Koro' },
  { id: 'bunny', label: 'Bunny', p1Name: 'Usagi', p2Name: 'Momo' },
];

export function characterDisplayName(character: CharacterId, playerNumber: 1 | 2): string {
  const found = CHARACTER_OPTIONS.find((opt) => opt.id === character) ?? CHARACTER_OPTIONS[0];
  return playerNumber === 1 ? found.p1Name : found.p2Name;
}

export const BUBBLE_COLORS: readonly BubbleColor[] = [
  'ruby',
  'amber',
  'emerald',
  'azure',
  'amethyst',
  'coral',
];

export const BUBBLE_RADIUS = 14;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2; // 28
export const EVEN_COLS = 8;
export const ODD_COLS = 7;
export const ROW_STEP = 24;
export const MAX_ROWS = 12;
export const DANGER_ROW = 9;
export const INITIAL_ROWS = 4;

export const ARENA_WIDTH = EVEN_COLS * BUBBLE_DIAMETER; // 224
export const DANGER_LINE_Y = BUBBLE_RADIUS + DANGER_ROW * ROW_STEP; // 230
export const LAUNCHER_X = ARENA_WIDTH / 2; // 112
export const LAUNCHER_Y = 268;
export const ARENA_HEIGHT = 296;

export const MIN_AIM_ANGLE = -75;
export const MAX_AIM_ANGLE = 75;
/** Fine single-tap micro-adjustment in degrees (`0.5°` per tap). */
export const AIM_STEP_DEG = 0.5;
export const BUBBLE_SPEED = 14;
export const CEILING_DROP_SHOTS = 8;

export const SHOT_TIME_LIMIT_MS = 10_000;
export const HURRY_WARNING_MS = 5_000;
export const MAX_DROP_SCORE = 1_310_720;

export interface FlyingBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
}

export interface GridCoord {
  row: number;
  col: number;
}

export interface ColoredCell extends GridCoord {
  color: BubbleColor;
  x: number;
  y: number;
}

export interface ShotEvent {
  id: number;
  popped: ColoredCell[];
  dropped: ColoredCell[];
  /** Attack bubbles that just rose from the bottom onto this player's grid. */
  risenGarbage: ColoredCell[];
  popScore: number;
  dropScore: number;
  clearBonus: number;
  stackedGarbage: number;
  sentGarbage: number;
}

export interface PlayerBoardState {
  grid: BubbleGrid;
  aimAngle: number;
  currentBubble: BubbleColor;
  nextBubble: BubbleColor;
  flying: FlyingBubble | null;
  score: number;
  shotsFired: number;
  shotsSinceDrop: number;
  ceilingDrop: number;
  ceilingWarning: boolean;
  /** Bubbles stored in this player's attack stack. */
  attackStack: number;
  /** Count of attack bubbles queued to rise onto this player's playfield. */
  incomingGarbage: number;
  /** Exact colors of the queued attack bubbles staged at the bottom of this player's board. */
  incomingQueue: BubbleColor[];
  /** Remaining milliseconds before the launcher auto-fires (`10_000` down to `0`). */
  shotTimerMs: number;
  /** Elapsed milliseconds in the current stage, used for the arcade speed bonus. */
  stageElapsedMs: number;
  stage: number;
  status: 'playing' | 'won' | 'ko';
  lastEvent: ShotEvent | null;
}

export interface PuzzleBobbleMatch {
  mode: '2p' | '1p';
  players: [PlayerBoardState] | [PlayerBoardState, PlayerBoardState];
  status: 'playing' | 'round_over';
  /** 0 for Player 1, 1 for Player 2, or null on 1P game over. */
  winner: 0 | 1 | null;
  wins: [number, number];
}

export function colsForRow(row: number): number {
  return row % 2 === 0 ? EVEN_COLS : ODD_COLS;
}

export function createEmptyGrid(rows = MAX_ROWS): BubbleGrid {
  return Array.from({ length: rows }, (_, row) => Array<BubbleCell>(colsForRow(row)).fill(null));
}

export function cloneGrid(grid: BubbleGrid): BubbleGrid {
  return grid.map((row) => row.slice());
}

/** Pixel center `(x, y)` of a hexagonal grid cell. */
export function bubbleCenter(row: number, col: number, ceilingDrop = 0): { x: number; y: number } {
  const stagger = row % 2 === 1 ? BUBBLE_RADIUS : 0;
  return {
    x: BUBBLE_RADIUS + col * BUBBLE_DIAMETER + stagger,
    y: BUBBLE_RADIUS + (row + ceilingDrop) * ROW_STEP,
  };
}

/** Valid 6-way hexagonal neighbors for `(row, col)`. */
export function hexNeighbors(row: number, col: number, totalRows = MAX_ROWS): GridCoord[] {
  const odd = row % 2 === 1;
  const diagLeft = odd ? col : col - 1;
  const diagRight = odd ? col + 1 : col;
  const candidates: GridCoord[] = [
    { row, col: col - 1 },
    { row, col: col + 1 },
    { row: row - 1, col: diagLeft },
    { row: row - 1, col: diagRight },
    { row: row + 1, col: diagLeft },
    { row: row + 1, col: diagRight },
  ];
  return candidates.filter(
    (cell) => cell.row >= 0 && cell.row < totalRows && cell.col >= 0 && cell.col < colsForRow(cell.row),
  );
}

/** Colors currently present on a grid; falls back to the full palette when empty. */
export function activeColorsOnGrid(grid: BubbleGrid): BubbleColor[] {
  const present = new Set<BubbleColor>();
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) present.add(cell);
    }
  }
  return present.size > 0 ? BUBBLE_COLORS.filter((c) => present.has(c)) : [...BUBBLE_COLORS];
}

export function pickBubbleColor(grid: BubbleGrid, rng: () => number = Math.random): BubbleColor {
  const pool = activeColorsOnGrid(grid);
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[index];
}

/**
 * Authentic Neo-Geo scoring:
 * - Each popped bubble scores 10 points (`30` for a triple, `40` for a quad, etc.).
 * - Dropped bubbles score exponentially: `1 -> 20`, `2 -> 40`, `3 -> 80`, ...,
 *   `20 * 2^(n - 1)`, capped at `1,310,720` for `17` or more bubbles dropped at once.
 */
export function scoreForPop(poppedCount: number): number {
  return poppedCount >= 3 ? poppedCount * 10 : 0;
}

export function scoreForDroppedBubbles(droppedCount: number): number {
  if (droppedCount <= 0) return 0;
  if (droppedCount >= 17) return MAX_DROP_SCORE;
  return 20 * 2 ** (droppedCount - 1);
}

/**
 * Arcade stage clear speed bonus:
 * - `0..5` seconds: `50,000` points
 * - `6..64` seconds: steps down from `49,160` (`6s`) to `440` (`64s`)
 * - `65+` seconds: `0` points
 */
export function scoreForStageClearBonus(elapsedMs: number): number {
  const sec = Math.max(0, Math.floor(elapsedMs / 1000));
  if (sec <= 5) return 50_000;
  if (sec >= 65) return 0;
  return Math.max(440, 50_000 - (sec - 5) * 840);
}

/**
 * Dynamic ceiling drop interval based on how many distinct bubble colours
 * remain on the playfield (fewer colours remaining = faster ceiling drops,
 * matching the Neo-Geo arcade rule).
 */
export function shotsPerCeilingDrop(grid: BubbleGrid): number {
  const colorCount = activeColorsOnGrid(grid).length;
  return Math.max(4, Math.min(CEILING_DROP_SHOTS, 3 + colorCount));
}

/**
 * Decomposes an attack/garbage bubble count into Neo-Geo indicator orbs:
 * red orbs represent 5 bubbles, yellow orbs represent 1 bubble.
 */
export function decomposeGarbageOrbs(count: number): Array<'red' | 'yellow'> {
  const safe = Math.max(0, Math.min(20, Math.floor(count)));
  const reds = Math.floor(safe / 5);
  const yellows = safe % 5;
  return [...Array<'red'>(reds).fill('red'), ...Array<'yellow'>(yellows).fill('yellow')];
}

export interface StageDefinition {
  stage: number;
  title: string;
  template: readonly (readonly string[])[];
}

/**
 * 15 classic Taito / Neo-Geo arcade stage formations (#183, #210)
 * with distinct geometry, bank-shot channels, and hanging avalanche anchors.
 * Every cell in every template has a connected path to row 0 (ceiling).
 */
export const STAGE_CATALOG: readonly StageDefinition[] = [
  {
    stage: 1,
    title: 'Paired Blocks',
    template: [
      ['R', 'R', 'Y', 'Y', 'G', 'G', 'B', 'B'],
      ['R', 'R', 'Y', 'Y', 'G', 'G', 'B'],
      ['B', 'B', 'G', 'G', 'Y', 'Y', 'R', 'R'],
      ['B', 'G', 'G', 'Y', 'Y', 'R', 'R'],
    ],
  },
  {
    stage: 2,
    title: 'Pendulum Stem',
    template: [
      ['.', '.', '.', 'R', 'R', '.', '.', '.'],
      ['.', '.', '.', 'Y', '.', '.', '.'],
      ['.', '.', 'G', 'G', 'B', '.', '.', '.'],
      ['.', '.', 'Y', 'P', 'B', '.', '.'],
      ['.', '.', '.', 'C', 'C', '.', '.', '.'],
    ],
  },
  {
    stage: 3,
    title: 'Twin Bridges',
    template: [
      ['R', 'R', '.', '.', '.', '.', 'B', 'B'],
      ['Y', 'G', 'G', 'P', 'P', 'Y', 'B'],
      ['R', '.', '.', 'C', 'C', '.', '.', 'B'],
      ['Y', 'G', '.', 'P', '.', 'Y', 'B'],
    ],
  },
  {
    stage: 4,
    title: 'Twin Towers',
    template: [
      ['.', 'G', 'G', '.', '.', 'P', 'P', '.'],
      ['.', 'R', 'Y', '.', 'B', 'C', '.'],
      ['.', 'R', 'Y', '.', '.', 'B', 'C', '.'],
      ['.', 'G', 'G', '.', 'P', 'P', '.'],
      ['.', 'Y', 'R', '.', '.', 'C', 'B', '.'],
    ],
  },
  {
    stage: 5,
    title: 'Diamond Lattice',
    template: [
      ['R', 'Y', 'G', 'B', 'B', 'G', 'Y', 'R'],
      ['R', '.', 'G', 'P', 'G', '.', 'R'],
      ['.', 'Y', 'C', 'P', 'P', 'C', 'Y', '.'],
      ['.', 'Y', '.', 'C', '.', 'Y', '.'],
    ],
  },
  {
    stage: 6,
    title: 'Chevron Wedge',
    template: [
      ['R', 'R', 'Y', 'G', 'G', 'Y', 'B', 'B'],
      ['.', 'R', 'Y', 'G', 'Y', 'B', '.'],
      ['.', '.', 'Y', 'P', 'P', 'Y', '.', '.'],
      ['.', '.', 'C', 'P', 'C', '.', '.'],
      ['.', '.', '.', 'C', 'C', '.', '.', '.'],
    ],
  },
  {
    stage: 7,
    title: 'Honeycomb Arch',
    template: [
      ['B', 'B', 'G', 'Y', 'Y', 'G', 'R', 'R'],
      ['B', 'G', '.', '.', '.', 'G', 'R'],
      ['P', 'P', '.', '.', '.', '.', 'C', 'C'],
      ['P', '.', '.', '.', '.', '.', 'C'],
      ['Y', 'Y', '.', '.', '.', '.', 'Y', 'Y'],
    ],
  },
  {
    stage: 8,
    title: 'Zigzag Steps',
    template: [
      ['R', 'R', 'Y', 'Y', '.', '.', '.', '.'],
      ['.', 'R', 'Y', 'G', 'G', '.', '.'],
      ['.', '.', 'Y', 'G', 'B', 'B', '.', '.'],
      ['.', '.', '.', 'G', 'B', 'P', 'P'],
      ['.', '.', '.', '.', 'B', 'P', 'C', 'C'],
    ],
  },
  {
    stage: 9,
    title: 'Hourglass Pinch',
    template: [
      ['.', 'R', 'R', 'Y', 'Y', 'B', 'B', '.'],
      ['.', '.', 'G', 'P', 'G', '.', '.'],
      ['.', '.', '.', 'C', 'C', '.', '.', '.'],
      ['.', '.', 'Y', 'C', 'Y', '.', '.'],
      ['.', 'B', 'B', 'G', 'G', 'R', 'R', '.'],
      ['.', '.', 'B', 'G', 'R', '.', '.'],
    ],
  },
  {
    stage: 10,
    title: 'Triple Chandelier',
    template: [
      ['R', 'R', '.', 'G', 'G', '.', 'B', 'B'],
      ['Y', '.', '.', 'P', '.', '.', 'C'],
      ['Y', 'R', '.', 'P', 'G', '.', 'C', 'B'],
      ['R', '.', '.', 'G', '.', '.', 'B'],
      ['.', 'Y', '.', 'C', 'C', '.', 'P', '.'],
    ],
  },
  {
    stage: 11,
    title: 'Spiral Bastion',
    template: [
      ['.', '.', 'P', 'P', 'C', 'C', 'B', 'B'],
      ['.', 'G', 'G', '.', '.', '.', 'B'],
      ['.', 'G', '.', 'R', 'R', '.', '.', 'Y'],
      ['.', 'Y', 'R', 'Y', '.', '.', 'Y'],
      ['.', '.', 'Y', 'Y', 'G', 'G', 'P', 'P'],
    ],
  },
  {
    stage: 12,
    title: 'Fortress Gate',
    template: [
      ['R', 'Y', 'G', 'B', 'B', 'G', 'Y', 'R'],
      ['R', 'Y', '.', 'B', '.', 'Y', 'R'],
      ['P', 'C', '.', 'C', 'C', '.', 'C', 'P'],
      ['P', '.', '.', '.', '.', '.', 'P'],
      ['G', 'G', '.', '.', '.', '.', 'G', 'G'],
    ],
  },
  {
    stage: 13,
    title: 'Crossroads X',
    template: [
      ['R', 'R', '.', '.', '.', '.', 'B', 'B'],
      ['.', 'Y', 'Y', '.', 'G', 'G', '.'],
      ['.', '.', 'P', 'C', 'C', 'P', '.', '.'],
      ['.', 'G', 'G', 'C', 'Y', 'Y', '.'],
      ['B', 'B', '.', '.', '.', '.', 'R', 'R'],
    ],
  },
  {
    stage: 14,
    title: 'Sniper Alley',
    template: [
      ['R', 'R', 'Y', '.', '.', 'G', 'B', 'B'],
      ['R', 'Y', 'P', '.', 'C', 'G', 'B'],
      ['Y', 'P', 'C', '.', '.', 'P', 'G', 'Y'],
      ['P', 'C', '.', '.', '.', 'P', 'G'],
      ['C', 'R', 'R', '.', '.', 'B', 'B', 'Y'],
      ['R', 'Y', '.', '.', '.', 'Y', 'B'],
    ],
  },
  {
    stage: 15,
    title: "Emperor's Citadel",
    template: [
      ['R', 'Y', 'G', 'P', 'P', 'G', 'Y', 'R'],
      ['R', 'C', 'B', 'P', 'B', 'C', 'R'],
      ['Y', 'C', '.', 'G', 'G', '.', 'C', 'Y'],
      ['Y', '.', 'R', 'B', 'R', '.', 'Y'],
      ['G', 'P', 'R', '.', '.', 'R', 'P', 'G'],
      ['P', 'C', '.', '.', '.', 'C', 'P'],
    ],
  },
];

export const TOTAL_STAGES = STAGE_CATALOG.length;

export function stageTitle(stage: number): string {
  if (stage <= 0) return 'Random Wave';
  const def = STAGE_CATALOG[(stage - 1) % STAGE_CATALOG.length];
  return def ? def.title : `Stage ${stage}`;
}

const STAGE_TEMPLATES: readonly (readonly (readonly string[])[])[] = STAGE_CATALOG.map(
  (s) => s.template,
);

const TEMPLATE_COLOR_MAP: Record<string, number> = {
  R: 0,
  Y: 1,
  G: 2,
  B: 3,
  P: 4,
  C: 5,
};

export function createStageGrid(stage = 1, rng: () => number = Math.random): BubbleGrid {
  if (stage <= 0) return createInitialGrid(rng);
  const templateIndex = (stage - 1) % STAGE_TEMPLATES.length;
  const template = STAGE_TEMPLATES[templateIndex];
  const grid = createEmptyGrid();
  const offset = Math.floor(rng() * BUBBLE_COLORS.length);
  for (let row = 0; row < template.length && row < MAX_ROWS; row += 1) {
    const line = template[row];
    for (let col = 0; col < line.length && col < colsForRow(row); col += 1) {
      const token = line[col];
      if (token in TEMPLATE_COLOR_MAP) {
        const colorIdx = (TEMPLATE_COLOR_MAP[token] + offset) % BUBBLE_COLORS.length;
        grid[row][col] = BUBBLE_COLORS[colorIdx];
      }
    }
  }
  return grid;
}

/**
 * Generates an initial arcade puzzle wave in the top `INITIAL_ROWS` rows.
 * Pairs are grouped along rows while avoiding giant monochrome blobs so the
 * opening board is varied and rewards both bank shots and avalanche drops.
 */
export function createInitialGrid(rng: () => number = Math.random): BubbleGrid {
  const grid = createEmptyGrid();
  const palette = BUBBLE_COLORS.slice(0, 5);
  for (let row = 0; row < INITIAL_ROWS; row += 1) {
    const cols = colsForRow(row);
    let col = 0;
    while (col < cols) {
      const rawIndex = Math.min(palette.length - 1, Math.max(0, Math.floor(rng() * palette.length)));
      const neighborColors = new Set<BubbleColor>();
      for (const n of hexNeighbors(row, col, INITIAL_ROWS)) {
        const c = grid[n.row]?.[n.col];
        if (c) neighborColors.add(c);
      }
      let chosen = palette[(rawIndex + row + col) % palette.length];
      for (let offset = 0; offset < palette.length; offset += 1) {
        const candidate = palette[(rawIndex + offset) % palette.length];
        if (!neighborColors.has(candidate)) {
          chosen = candidate;
          break;
        }
      }
      grid[row][col] = chosen;
      if (col + 1 < cols && rng() < 0.45) {
        const nextUpperSame = hexNeighbors(row, col + 1, INITIAL_ROWS).some(
          (n) => n.row < row && grid[n.row]?.[n.col] === chosen,
        );
        if (!nextUpperSame) {
          grid[row][col + 1] = chosen;
          col += 2;
          continue;
        }
      }
      col += 1;
    }
  }
  return grid;
}

export function createPlayerBoard(
  rng: () => number = Math.random,
  initialGrid?: BubbleGrid,
  stage = 1,
): PlayerBoardState {
  const grid = initialGrid ? cloneGrid(initialGrid) : createInitialGrid(rng);
  const currentBubble = pickBubbleColor(grid, rng);
  const nextBubble = pickBubbleColor(grid, rng);
  return {
    grid,
    aimAngle: 0,
    currentBubble,
    nextBubble,
    flying: null,
    score: 0,
    shotsFired: 0,
    shotsSinceDrop: 0,
    ceilingDrop: 0,
    ceilingWarning: false,
    attackStack: 0,
    incomingGarbage: 0,
    incomingQueue: [],
    shotTimerMs: SHOT_TIME_LIMIT_MS,
    stageElapsedMs: 0,
    stage,
    status: 'playing',
    lastEvent: null,
  };
}

/**
 * Creates a 2-player (or 1-player) match. In 2-player mode, both boards start
 * with the identical opening wave and opening bubbles for a fair match.
 */
export function createMatch(
  mode: '2p' | '1p' = '2p',
  rng: () => number = Math.random,
  wins: [number, number] = [0, 0],
): PuzzleBobbleMatch {
  const sharedGrid = createInitialGrid(rng);
  const first = createPlayerBoard(rng, sharedGrid, 1);
  if (mode === '1p') {
    return {
      mode: '1p',
      players: [first],
      status: 'playing',
      winner: null,
      wins,
    };
  }
  const second: PlayerBoardState = {
    ...first,
    grid: cloneGrid(sharedGrid),
    incomingQueue: [],
    lastEvent: null,
  };
  return {
    mode: '2p',
    players: [first, second],
    status: 'playing',
    winner: null,
    wins,
  };
}

export function clampAimAngle(angle: number): number {
  const clamped = Math.max(MIN_AIM_ANGLE, Math.min(MAX_AIM_ANGLE, angle));
  return Math.round(clamped * 10) / 10;
}

export function formatAimAngle(angle: number): string {
  const rounded = Math.round(angle * 10) / 10;
  const text = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return rounded > 0 ? `+${text}°` : `${text}°`;
}

/**
 * Smooth angular velocity (degrees per second) while holding an aim key:
 * starts gentle (`38°/s`) for fine adjustments during the first `180ms`, then
 * smoothly accelerates up to `115°/s` for sweeping across the arena.
 */
export function aimVelocityDegPerSec(holdDurationMs: number): number {
  const clampedHold = Math.max(0, holdDurationMs);
  if (clampedHold <= 180) return 38;
  const ramp = Math.min(1, (clampedHold - 180) / 340);
  return Math.round((38 + ramp * 77) * 10) / 10;
}

export function aimPlayer(
  match: PuzzleBobbleMatch,
  playerIndex: 0 | 1,
  deltaDeg: number,
): PuzzleBobbleMatch {
  if (match.status !== 'playing') return match;
  const player = match.players[playerIndex];
  if (!player || player.status !== 'playing') return match;
  const nextAngle = clampAimAngle(player.aimAngle + deltaDeg);
  if (nextAngle === player.aimAngle) return match;
  return replacePlayer(match, playerIndex, { ...player, aimAngle: nextAngle });
}

/**
 * Sets a player's aim angle directly (used by touch/pointer drag-to-aim, #212),
 * quantized to 0.5° increments within `[-75°, +75°]`.
 */
export function setPlayerAimAngle(
  match: PuzzleBobbleMatch,
  playerIndex: 0 | 1,
  targetAngle: number,
): PuzzleBobbleMatch {
  if (match.status !== 'playing') return match;
  const player = match.players[playerIndex];
  if (!player || player.status !== 'playing') return match;
  const quantized = clampAimAngle(Math.round(targetAngle * 2) / 2);
  if (quantized === player.aimAngle) return match;
  return replacePlayer(match, playerIndex, { ...player, aimAngle: quantized });
}

/**
 * Computes the launcher aim angle in degrees (`[-75°, +75°]`, quantized to `0.5°`)
 * from a pointer position `(svgX, svgY)` in the `224 × 296` board coordinate space (#212).
 */
export function aimAngleFromBoardPoint(svgX: number, svgY: number): number {
  const dx = svgX - LAUNCHER_X;
  const dy = Math.max(12, LAUNCHER_Y - svgY);
  const rawDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return clampAimAngle(Math.round(rawDeg * 2) / 2);
}

/**
 * Computes a multi-segment aiming sight line from the launcher, including up to
 * two wall bounces, so players can line up narrow bank shots accurately.
 */
export function aimGuidePoints(
  aimAngle: number,
  ceilingDrop = 0,
): Array<{ x: number; y: number }> {
  const rad = (clampAimAngle(aimAngle) * Math.PI) / 180;
  let dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const topY = BUBBLE_RADIUS + ceilingDrop * ROW_STEP;
  const points: Array<{ x: number; y: number }> = [{ x: LAUNCHER_X, y: LAUNCHER_Y }];

  if (Math.abs(dx) < 1e-4) {
    points.push({ x: LAUNCHER_X, y: topY });
    return points;
  }

  let curX = LAUNCHER_X;
  let curY = LAUNCHER_Y;
  let remainingLength = 340;

  for (let bounce = 0; bounce < 2 && remainingLength > 0 && curY > topY; bounce += 1) {
    const wallX = dx > 0 ? ARENA_WIDTH - BUBBLE_RADIUS : BUBBLE_RADIUS;
    const tWall = (wallX - curX) / dx;
    const tTop = (topY - curY) / dy;
    const tStep = Math.min(tWall, tTop, remainingLength);

    curX = Math.max(BUBBLE_RADIUS, Math.min(ARENA_WIDTH - BUBBLE_RADIUS, curX + dx * tStep));
    curY = Math.max(topY, curY + dy * tStep);
    points.push({ x: Math.round(curX * 10) / 10, y: Math.round(curY * 10) / 10 });

    remainingLength -= tStep;
    if (Math.abs(tStep - tWall) < 1e-3 && curY > topY) {
      dx = -dx;
    } else {
      break;
    }
  }

  return points;
}

/** Fires the active bubble from the player's launcher if no bubble is already in flight. */
export function firePlayerBubble(
  match: PuzzleBobbleMatch,
  playerIndex: 0 | 1,
): PuzzleBobbleMatch {
  if (match.status !== 'playing') return match;
  const player = match.players[playerIndex];
  if (!player || player.status !== 'playing' || player.flying !== null) return match;

  const rad = (player.aimAngle * Math.PI) / 180;
  const flying: FlyingBubble = {
    x: LAUNCHER_X,
    y: LAUNCHER_Y,
    vx: Math.sin(rad) * BUBBLE_SPEED,
    vy: -Math.cos(rad) * BUBBLE_SPEED,
    color: player.currentBubble,
  };
  return replacePlayer(match, playerIndex, {
    ...player,
    flying,
    shotTimerMs: SHOT_TIME_LIMIT_MS,
  });
}

/**
 * Advances each player's 10-second shot countdown timer and stage clock.
 * In the Neo-Geo arcade game, if a player waits more than 10 seconds without
 * shooting (after a 5-second `HURRY UP!` countdown), the bubble is auto-fired.
 */
export function tickShotTimers(
  match: PuzzleBobbleMatch,
  deltaMs: number,
  rng: () => number = Math.random,
): PuzzleBobbleMatch {
  if (match.status !== 'playing' || deltaMs <= 0) return match;
  let current = match;

  for (let index = 0; index < current.players.length; index += 1) {
    const playerIndex = index as 0 | 1;
    const player = current.players[playerIndex];
    if (!player || player.status !== 'playing') continue;

    const stageElapsedMs = player.stageElapsedMs + deltaMs;
    if (player.flying !== null) {
      current = replacePlayer(current, playerIndex, { ...player, stageElapsedMs });
      continue;
    }

    const remaining = player.shotTimerMs - deltaMs;
    if (remaining <= 0) {
      const withClock = replacePlayer(current, playerIndex, {
        ...player,
        stageElapsedMs,
        shotTimerMs: SHOT_TIME_LIMIT_MS,
      });
      current = firePlayerBubble(withClock, playerIndex);
    } else {
      current = replacePlayer(current, playerIndex, {
        ...player,
        stageElapsedMs,
        shotTimerMs: remaining,
      });
    }
  }

  void rng;
  return current;
}

/** Returns the 5..1 integer countdown when `HURRY UP!` is active, or `null` otherwise. */
export function hurryCountdownSeconds(player: PlayerBoardState): number | null {
  if (player.status !== 'playing' || player.flying !== null) return null;
  if (player.shotTimerMs > HURRY_WARNING_MS) return null;
  return Math.max(1, Math.ceil(player.shotTimerMs / 1000));
}

/**
 * Derives the character mascot's animation mood from the player's board state (#204):
 * - `'celebrate'` when the player wins the round (`status === 'won'`)
 * - `'cry'` when the player loses the round (`status === 'ko'`)
 * - `'hurry'` during the 5-second `HURRY UP!` shot countdown
 * - `'cheer'` after popping 3+ bubbles or dropping an avalanche cluster
 * - `'normal'` during ordinary aiming and firing
 */
export function deriveMascotMood(player: PlayerBoardState): MascotMood {
  if (player.status === 'won') return 'celebrate';
  if (player.status === 'ko') return 'cry';
  if (hurryCountdownSeconds(player) !== null) return 'hurry';
  if (
    player.lastEvent !== null &&
    (player.lastEvent.popped.length >= 3 || player.lastEvent.dropped.length > 0)
  ) {
    return 'cheer';
  }
  return 'normal';
}

/**
 * Resolves a round outcome (`winner = 0 | 1` or `null` for a 1P KO), setting the
 * winning player's status to `'won'` and the losing player's status to `'ko'`.
 */
export function resolveMatchOutcome(
  match: PuzzleBobbleMatch,
  winner: 0 | 1 | null,
): PuzzleBobbleMatch {
  const wins: [number, number] = [match.wins[0], match.wins[1]];
  if (winner === 0 || winner === 1) {
    wins[winner] += 1;
  }
  if (match.players.length === 1) {
    const p0: PlayerBoardState = {
      ...match.players[0],
      flying: null,
      status: winner === 0 ? 'won' : 'ko',
    };
    return {
      ...match,
      players: [p0],
      status: 'round_over',
      winner: winner === 0 ? 0 : null,
      wins,
    };
  }
  const p0: PlayerBoardState = {
    ...match.players[0],
    flying: null,
    status: winner === 0 ? 'won' : 'ko',
  };
  const p1: PlayerBoardState = {
    ...match.players[1],
    flying: null,
    status: winner === 1 ? 'won' : 'ko',
  };
  return {
    ...match,
    players: [p0, p1],
    status: 'round_over',
    winner,
    wins,
  };
}

/**
 * Connected same-color cluster starting from `(startRow, startCol)`.
 */
export function findConnectedColorCluster(
  grid: BubbleGrid,
  startRow: number,
  startCol: number,
): GridCoord[] {
  const target = grid[startRow]?.[startCol] ?? null;
  if (!target) return [];

  const visited = new Set<string>([`${startRow},${startCol}`]);
  const queue: GridCoord[] = [{ row: startRow, col: startCol }];
  const cluster: GridCoord[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    cluster.push(current);
    for (const neighbor of hexNeighbors(current.row, current.col, grid.length)) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (visited.has(key)) continue;
      if (grid[neighbor.row]?.[neighbor.col] === target) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }
  return cluster;
}

/**
 * Finds all occupied cells that are no longer anchored to the ceiling (`row === 0`).
 */
export function findFloatingBubbles(grid: BubbleGrid): GridCoord[] {
  const anchored = new Set<string>();
  const queue: GridCoord[] = [];

  for (let col = 0; col < colsForRow(0); col += 1) {
    if (grid[0]?.[col] !== null) {
      anchored.add(`0,${col}`);
      queue.push({ row: 0, col });
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of hexNeighbors(current.row, current.col, grid.length)) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (anchored.has(key)) continue;
      if (grid[neighbor.row]?.[neighbor.col] !== null) {
        anchored.add(key);
        queue.push(neighbor);
      }
    }
  }

  const floating: GridCoord[] = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < colsForRow(row); col += 1) {
      if (grid[row][col] !== null && !anchored.has(`${row},${col}`)) {
        floating.push({ row, col });
      }
    }
  }
  return floating;
}

/**
 * Chooses the nearest valid empty hexagonal cell to `(x, y)`.
 * Prefers empty cells that touch the ceiling (`row === 0`) or an existing bubble.
 */
export function findSnapCell(
  grid: BubbleGrid,
  x: number,
  y: number,
  ceilingDrop = 0,
): GridCoord {
  const attachedCandidates: GridCoord[] = [];
  const allEmpty: GridCoord[] = [];

  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < colsForRow(row); col += 1) {
      if (grid[row][col] !== null) continue;
      const coord = { row, col };
      allEmpty.push(coord);
      const touchesCeiling = row === 0;
      const touchesBubble = hexNeighbors(row, col, grid.length).some(
        (n) => grid[n.row]?.[n.col] !== null,
      );
      if (touchesCeiling || touchesBubble) {
        attachedCandidates.push(coord);
      }
    }
  }

  const pool = attachedCandidates.length > 0 ? attachedCandidates : allEmpty;
  let best = pool[0] ?? { row: 0, col: 0 };
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const candidate of pool) {
    const center = bubbleCenter(candidate.row, candidate.col, ceilingDrop);
    const dx = center.x - x;
    const dy = center.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = candidate;
    }
  }
  return best;
}

export function isBoardEmpty(grid: BubbleGrid): boolean {
  return grid.every((row) => row.every((cell) => cell === null));
}

export function hasCrossedDangerLine(grid: BubbleGrid, ceilingDrop: number): boolean {
  for (let row = 0; row < grid.length; row += 1) {
    if (grid[row].some((cell) => cell !== null)) {
      if (row + ceilingDrop >= DANGER_ROW) return true;
    }
  }
  return false;
}

/**
 * Generates `count` incoming attack bubble colors from the full 6-colour palette.
 */
export function generateGarbageColors(
  count: number,
  rng: () => number = Math.random,
): BubbleColor[] {
  const safe = Math.max(0, Math.min(12, Math.floor(count)));
  return Array.from({ length: safe }, () => {
    const idx = Math.min(BUBBLE_COLORS.length - 1, Math.max(0, Math.floor(rng() * BUBBLE_COLORS.length)));
    return BUBBLE_COLORS[idx];
  });
}

/**
 * Sends `count` (or explicit `colors`) attack bubbles into a player's incoming
 * queue so they are staged at the bottom of that player's board, ready to rise
 * up on their next non-clearing shot.
 */
export function queueIncomingGarbage(
  player: PlayerBoardState,
  colors: BubbleColor[],
): PlayerBoardState {
  if (colors.length === 0) return player;
  const nextQueue = [...player.incomingQueue, ...colors].slice(0, 12);
  return {
    ...player,
    incomingQueue: nextQueue,
    incomingGarbage: nextQueue.length,
  };
}

/**
 * Launches up to 6 queued attack bubbles from the bottom of the playfield onto
 * open frontier cells of `grid`, returning the updated grid, the exact
 * `ColoredCell[]` that rose into place (for the bottom-up rising animation),
 * and any remaining queued colors.
 */
export function launchIncomingGarbage(
  grid: BubbleGrid,
  queue: BubbleColor[],
  ceilingDrop = 0,
  rng: () => number = Math.random,
): { grid: BubbleGrid; placed: ColoredCell[]; remainingQueue: BubbleColor[] } {
  if (queue.length === 0) {
    return { grid, placed: [], remainingQueue: [] };
  }
  const next = cloneGrid(grid);
  const toLaunch = queue.slice(0, 6);
  const remainingQueue = queue.slice(toLaunch.length);
  const placed: ColoredCell[] = [];

  for (const color of toLaunch) {
    const candidates: GridCoord[] = [];
    for (let row = 0; row < DANGER_ROW; row += 1) {
      for (let col = 0; col < colsForRow(row); col += 1) {
        if (next[row][col] !== null) continue;
        const connected =
          row === 0 ||
          hexNeighbors(row, col, next.length).some((n) => next[n.row]?.[n.col] !== null);
        if (connected) candidates.push({ row, col });
      }
    }
    if (candidates.length === 0) break;
    const chosen = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
    next[chosen.row][chosen.col] = color;
    const center = bubbleCenter(chosen.row, chosen.col, ceilingDrop);
    placed.push({
      row: chosen.row,
      col: chosen.col,
      color,
      x: center.x,
      y: center.y,
    });
  }

  return { grid: next, placed, remainingQueue };
}

/**
 * Compatibility helper for tests that apply a numeric count of incoming garbage.
 */
export function applyIncomingGarbage(
  grid: BubbleGrid,
  count: number,
  rng: () => number = Math.random,
): BubbleGrid {
  const colors = generateGarbageColors(count, rng);
  return launchIncomingGarbage(grid, colors, 0, rng).grid;
}

/**
 * Places a bubble at `(row, col)` and resolves matches, floating drops,
 * exponential scoring, 2P attack transfer + rising garbage, dynamic ceiling
 * drops, and win/KO state.
 */
export function settleBubbleAt(
  match: PuzzleBobbleMatch,
  playerIndex: 0 | 1,
  row: number,
  col: number,
  color: BubbleColor,
  rng: () => number = Math.random,
): PuzzleBobbleMatch {
  const player = match.players[playerIndex];
  if (!player || player.status !== 'playing') return match;

  let grid = cloneGrid(player.grid);
  grid[row][col] = color;

  const matched = findConnectedColorCluster(grid, row, col);
  const popped: ColoredCell[] = [];
  const dropped: ColoredCell[] = [];

  if (matched.length >= 3) {
    for (const cell of matched) {
      const cellColor = grid[cell.row][cell.col] ?? color;
      const center = bubbleCenter(cell.row, cell.col, player.ceilingDrop);
      popped.push({ ...cell, color: cellColor, x: center.x, y: center.y });
      grid[cell.row][cell.col] = null;
    }
    const floating = findFloatingBubbles(grid);
    for (const cell of floating) {
      const cellColor = grid[cell.row][cell.col] ?? color;
      const center = bubbleCenter(cell.row, cell.col, player.ceilingDrop);
      dropped.push({ ...cell, color: cellColor, x: center.x, y: center.y });
      grid[cell.row][cell.col] = null;
    }
  }

  const popScore = scoreForPop(popped.length);
  const dropScore = scoreForDroppedBubbles(dropped.length);

  // 2P versus attack transfer:
  // - Popping 4+ bubbles generates `popped.length - 3` bonus attack bubbles.
  // - Dropping hanging bubbles generates `dropped.length` attack bubbles.
  // - Any generated attack bubbles (plus any legacy `attackStack`) are immediately
  //   sent to the opponent's `incomingQueue` so the opponent sees them staged at
  //   the bottom of their playfield, ready to rise up!
  const extraFromQuad = Math.max(0, popped.length - 3);
  const totalAttack = player.attackStack + extraFromQuad + dropped.length;
  const sentGarbage = match.mode === '2p' && totalAttack > 0 ? Math.min(12, totalAttack) : 0;
  const attackStack = 0;

  // If this player did NOT pop a cluster on this shot and has incoming attack
  // bubbles waiting at the bottom of their playfield, those bubbles now shoot
  // upward from the bottom onto open frontier cells!
  let risenGarbage: ColoredCell[] = [];
  const activeQueue =
    player.incomingQueue.length > 0
      ? player.incomingQueue
      : player.incomingGarbage > 0
        ? generateGarbageColors(player.incomingGarbage, rng)
        : [];
  let nextIncomingQueue = activeQueue;

  const shotsFired = player.shotsFired + 1;
  const dropInterval = shotsPerCeilingDrop(grid);
  const nextShotsSinceDrop = player.shotsSinceDrop + 1;
  let ceilingDrop = player.ceilingDrop;
  let shotsSinceDrop = nextShotsSinceDrop;

  if (nextShotsSinceDrop >= dropInterval || shotsFired % CEILING_DROP_SHOTS === 0) {
    ceilingDrop += 1;
    shotsSinceDrop = 0;
  }
  const ceilingWarning = shotsSinceDrop === dropInterval - 1;

  if (popped.length === 0 && activeQueue.length > 0 && !isBoardEmpty(grid)) {
    const launched = launchIncomingGarbage(grid, activeQueue, ceilingDrop, rng);
    grid = launched.grid;
    risenGarbage = launched.placed;
    nextIncomingQueue = launched.remainingQueue;
  }

  let clearBonus = 0;
  let score = player.score + popScore + dropScore;
  let stage = player.stage;
  let stageElapsedMs = player.stageElapsedMs;
  let playerStatus: PlayerBoardState['status'] = 'playing';

  if (isBoardEmpty(grid)) {
    clearBonus = scoreForStageClearBonus(player.stageElapsedMs);
    score += clearBonus;
    if (match.mode === '2p') {
      playerStatus = 'won';
    } else {
      stage += 1;
      ceilingDrop = 0;
      shotsSinceDrop = 0;
      stageElapsedMs = 0;
      grid = createStageGrid(stage, rng);
    }
  } else if (hasCrossedDangerLine(grid, ceilingDrop)) {
    playerStatus = 'ko';
  }

  const currentBubble = player.nextBubble;
  const nextBubble = pickBubbleColor(grid, rng);

  const updatedPlayer: PlayerBoardState = {
    ...player,
    grid,
    currentBubble,
    nextBubble,
    flying: null,
    score,
    shotsFired,
    shotsSinceDrop,
    ceilingDrop,
    ceilingWarning,
    attackStack,
    incomingGarbage: nextIncomingQueue.length,
    incomingQueue: nextIncomingQueue,
    shotTimerMs: SHOT_TIME_LIMIT_MS,
    stageElapsedMs,
    stage,
    status: playerStatus,
    lastEvent: {
      id: shotsFired,
      popped,
      dropped,
      risenGarbage,
      popScore,
      dropScore,
      clearBonus,
      stackedGarbage: extraFromQuad,
      sentGarbage,
    },
  };

  let nextMatch = replacePlayer(match, playerIndex, updatedPlayer);

  // Deliver newly generated attack bubbles to the opponent's bottom incoming tray in 2P mode.
  if (match.mode === '2p' && sentGarbage > 0) {
    const opponentIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const opponent = nextMatch.players[opponentIndex];
    if (opponent && opponent.status === 'playing') {
      const newColors = generateGarbageColors(sentGarbage, rng);
      nextMatch = replacePlayer(nextMatch, opponentIndex, queueIncomingGarbage(opponent, newColors));
    }
  }

  if (playerStatus === 'won') {
    const wins: [number, number] = [nextMatch.wins[0], nextMatch.wins[1]];
    wins[playerIndex] += 1;
    const opponentIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const opponent = nextMatch.players[opponentIndex];
    if (opponent) {
      nextMatch = replacePlayer(nextMatch, opponentIndex, { ...opponent, status: 'ko', flying: null });
    }
    return {
      ...nextMatch,
      status: 'round_over',
      winner: playerIndex,
      wins,
    };
  }

  if (playerStatus === 'ko') {
    if (match.mode === '2p') {
      const winnerIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
      const wins: [number, number] = [nextMatch.wins[0], nextMatch.wins[1]];
      wins[winnerIndex] += 1;
      const winnerBoard = nextMatch.players[winnerIndex];
      if (winnerBoard) {
        nextMatch = replacePlayer(nextMatch, winnerIndex, {
          ...winnerBoard,
          status: 'won',
          flying: null,
        });
      }
      return {
        ...nextMatch,
        status: 'round_over',
        winner: winnerIndex,
        wins,
      };
    }
    return {
      ...nextMatch,
      status: 'round_over',
      winner: null,
    };
  }

  return nextMatch;
}

function collidesWithCeilingOrBubble(
  grid: BubbleGrid,
  x: number,
  y: number,
  ceilingDrop: number,
): boolean {
  const topY = BUBBLE_RADIUS + ceilingDrop * ROW_STEP;
  if (y <= topY) return true;

  const hitThresholdSq = (BUBBLE_DIAMETER * 0.88) ** 2;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < colsForRow(row); col += 1) {
      if (grid[row][col] === null) continue;
      const center = bubbleCenter(row, col, ceilingDrop);
      const dx = center.x - x;
      const dy = center.y - y;
      if (dx * dx + dy * dy <= hitThresholdSq) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Advances flying projectiles for one frame (substepped so high-speed shots
 * never tunnel past a wall or bubble).
 */
export function stepMatch(
  match: PuzzleBobbleMatch,
  rng: () => number = Math.random,
): PuzzleBobbleMatch {
  if (match.status !== 'playing') return match;
  let current = match;

  for (let index = 0; index < current.players.length; index += 1) {
    const playerIndex = index as 0 | 1;
    const player = current.players[playerIndex];
    if (!player || player.status !== 'playing' || !player.flying) continue;

    let { x, y, vx, vy } = player.flying;
    const { color } = player.flying;
    const substeps = 4;
    let landed = false;

    for (let s = 0; s < substeps; s += 1) {
      x += vx / substeps;
      y += vy / substeps;

      if (x < BUBBLE_RADIUS) {
        x = BUBBLE_RADIUS + (BUBBLE_RADIUS - x);
        vx = Math.abs(vx);
      } else if (x > ARENA_WIDTH - BUBBLE_RADIUS) {
        x = ARENA_WIDTH - BUBBLE_RADIUS - (x - (ARENA_WIDTH - BUBBLE_RADIUS));
        vx = -Math.abs(vx);
      }

      if (collidesWithCeilingOrBubble(player.grid, x, y, player.ceilingDrop)) {
        landed = true;
        break;
      }
    }

    if (landed) {
      const snap = findSnapCell(player.grid, x, y, player.ceilingDrop);
      current = settleBubbleAt(current, playerIndex, snap.row, snap.col, color, rng);
      if (current.status !== 'playing') break;
    } else {
      current = replacePlayer(current, playerIndex, {
        ...player,
        flying: { x, y, vx, vy, color },
      });
    }
  }

  return current;
}

/**
 * Fires and steps a player's shot to completion (useful for deterministic tests
 * and instant resolution).
 */
export function fireAndResolvePlayer(
  match: PuzzleBobbleMatch,
  playerIndex: 0 | 1,
  rng: () => number = Math.random,
): PuzzleBobbleMatch {
  let state = firePlayerBubble(match, playerIndex);
  let safety = 0;
  while (state.status === 'playing' && state.players[playerIndex]?.flying !== null && safety < 120) {
    state = stepMatch(state, rng);
    safety += 1;
  }
  return state;
}

function replacePlayer(
  match: PuzzleBobbleMatch,
  playerIndex: 0 | 1,
  nextPlayer: PlayerBoardState,
): PuzzleBobbleMatch {
  if (match.players.length === 1) {
    return { ...match, players: [nextPlayer] };
  }
  const nextPlayers: [PlayerBoardState, PlayerBoardState] =
    playerIndex === 0 ? [nextPlayer, match.players[1]] : [match.players[0], nextPlayer];
  return { ...match, players: nextPlayers };
}
