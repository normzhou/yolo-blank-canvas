/**
 * Prism Stack — 9×18 falling crystal polyomino engine (#352).
 *
 * Pure functional state machine shared by the client view and deterministic
 * unit tests:
 * - Playfield: 9 columns × 18 rows (1:2 aspect ratio, non-10×20 geometry).
 * - Seven crystal polyominoes (`bar`, `hookL`, `hookR`, `quad`, `stepR`, `crest`, `stepL`).
 * - Landing indicator: vertical column guide rails + floor target ticks (no ghost silhouette).
 * - Multiplayer attacks: full-width solid Hazard Lock Bars (`'H'`) shattered by any
 *   adjacent horizontal prism line clear.
 */

export type PolyId = 'bar' | 'hookL' | 'hookR' | 'quad' | 'stepR' | 'crest' | 'stepL';
export type Cell = PolyId | 'H' | null;
export type Board = Cell[][];

export interface HazardBatch {
  lines: number;
}

export interface PrismLockEvent {
  id: number;
  cleared: number;
  shatteredHazards: number;
  sentHazard: number;
  canceledHazard: number;
  risenHazard: number;
}

export interface PrismPiece {
  type: PolyId;
  /** 0..3, clockwise from spawn orientation. */
  rotation: number;
  /** Board column of the piece bounding-box top-left. */
  x: number;
  /** Board row of the piece bounding-box top-left. */
  y: number;
}

export interface LandingGuide {
  /** Active piece's occupied board columns (`0..8`). */
  columns: ReadonlySet<number>;
  /** Bottom-most landing cell `(x, y)` per column where the piece will settle. */
  floorTicks: ReadonlyArray<{ x: number; y: number }>;
}

export interface PrismStackState {
  board: Board;
  piece: PrismPiece | null;
  next: PolyId;
  score: number;
  lines: number;
  level: number;
  status: 'playing' | 'over';
  /** Remaining pieces of the current 7-bag. */
  bag: PolyId[];
  /** Number of 4-line quad clears so far, used to cycle stage backdrops. */
  quadClearCount: number;
  /** Pending incoming hazard bar batches from a 2P opponent. */
  pendingHazard: HazardBatch[];
  /** Total hazard lines sent to the opponent across this match. */
  hazardSent: number;
  /** Monotonic event descriptor for the most recent piece lock. */
  lastLockEvent: PrismLockEvent | null;
}

export const BOARD_WIDTH = 9;
export const BOARD_HEIGHT = 18;

export const PRISM_SHAPES: readonly PolyId[] = [
  'bar',
  'hookL',
  'hookR',
  'quad',
  'stepR',
  'crest',
  'stepL',
];

const BASE_SHAPES: Record<PolyId, number[][]> = {
  bar: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  hookL: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  hookR: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  quad: [
    [1, 1],
    [1, 1],
  ],
  stepR: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  crest: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  stepL: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

function rotateMatrix(matrix: number[][]): number[][] {
  const size = matrix.length;
  const out: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      out[x][size - 1 - y] = matrix[y][x];
    }
  }
  return out;
}

const ROTATIONS: Record<PolyId, number[][][]> = (() => {
  const result = {} as Record<PolyId, number[][][]>;
  for (const type of PRISM_SHAPES) {
    const states: number[][][] = [BASE_SHAPES[type]];
    for (let index = 1; index < 4; index += 1) {
      states.push(rotateMatrix(states[index - 1]));
    }
    result[type] = states;
  }
  return result;
})();

/** Occupied cells of a prism shape for a rotation, relative to its bounding box. */
export function rotationCells(type: PolyId, rotation: number): Array<[number, number]> {
  const matrix = ROTATIONS[type][((rotation % 4) + 4) % 4];
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (matrix[y][x] === 1) cells.push([x, y]);
    }
  }
  return cells;
}

export function pieceSize(type: PolyId): number {
  return BASE_SHAPES[type].length;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null));
}

/** A full 7-bag shuffled once so draws stay balanced without streaky drought. */
export function shuffledBag(rng: () => number = Math.random): PolyId[] {
  const bag = [...PRISM_SHAPES];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function takeFromBag(bag: PolyId[], rng: () => number): { type: PolyId; bag: PolyId[] } {
  const current = bag.length > 0 ? bag : shuffledBag(rng);
  const [type, ...rest] = current;
  return { type, bag: rest };
}

export function spawnPiece(type: PolyId): PrismPiece {
  const size = pieceSize(type);
  return { type, rotation: 0, x: Math.floor((BOARD_WIDTH - size) / 2), y: 0 };
}

export function collides(board: Board, piece: PrismPiece): boolean {
  for (const [dx, dy] of rotationCells(piece.type, piece.rotation)) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return true;
    if (y >= 0 && board[y][x] !== null) return true;
  }
  return false;
}

function tryMove(board: Board, piece: PrismPiece, dx: number, dy: number): PrismPiece | null {
  const moved: PrismPiece = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return collides(board, moved) ? null : moved;
}

const KICKS = [0, -1, 1, -2, 2];

export function tryRotate(board: Board, piece: PrismPiece, direction: 1 | -1): PrismPiece {
  const rotation = (piece.rotation + direction + 4) % 4;
  for (const kick of KICKS) {
    const candidate: PrismPiece = { ...piece, rotation, x: piece.x + kick };
    if (!collides(board, candidate)) return candidate;
  }
  return piece;
}

export function mergePiece(board: Board, piece: PrismPiece): Board {
  const next = board.map((row) => row.slice());
  for (const [dx, dy] of rotationCells(piece.type, piece.rotation)) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) next[y][x] = piece.type;
  }
  return next;
}

function isPureHazardRow(row: readonly Cell[]): boolean {
  return row.length > 0 && row.every((cell) => cell === 'H');
}

function isPlayableFullRow(row: readonly Cell[]): boolean {
  return row.every((cell) => cell !== null) && row.some((cell) => cell !== 'H');
}

/**
 * Clears completed horizontal prism rows AND shatters any contiguous solid `'H'`
 * Hazard Lock Bars immediately adjacent above or below a cleared row (#352).
 */
export function clearLines(board: Board): {
  board: Board;
  cleared: number;
  shatteredHazards: number;
} {
  const toRemove = new Set<number>();
  let cleared = 0;
  for (let y = 0; y < board.length; y += 1) {
    if (isPlayableFullRow(board[y]!)) {
      toRemove.add(y);
      cleared += 1;
    }
  }

  let shatteredHazards = 0;
  if (cleared > 0) {
    const matchedRows = [...toRemove];
    for (const r of matchedRows) {
      for (let down = r + 1; down < board.length && isPureHazardRow(board[down]!); down += 1) {
        if (!toRemove.has(down)) {
          toRemove.add(down);
          shatteredHazards += 1;
        }
      }
      for (let up = r - 1; up >= 0 && isPureHazardRow(board[up]!); up -= 1) {
        if (!toRemove.has(up)) {
          toRemove.add(up);
          shatteredHazards += 1;
        }
      }
    }
  }

  if (toRemove.size === 0) {
    return { board, cleared: 0, shatteredHazards: 0 };
  }

  const remaining = board.filter((_, idx) => !toRemove.has(idx));
  const empty = Array.from({ length: BOARD_HEIGHT - remaining.length }, () =>
    Array<Cell>(BOARD_WIDTH).fill(null),
  );
  return { board: [...empty, ...remaining], cleared, shatteredHazards };
}

const LINE_SCORES = [0, 100, 300, 500, 800];
const HAZARD_ATTACK_TABLE = [0, 0, 1, 2, 4];

export function scoreForLines(cleared: number, level: number, shatteredHazards = 0): number {
  return ((LINE_SCORES[cleared] ?? 0) + shatteredHazards * 50) * level;
}

/**
 * Competitive multiplayer hazard attack table:
 * 1 line -> 0, 2 lines -> 1, 3 lines -> 2, 4 lines -> 4 solid Hazard Lock Bars.
 */
export function hazardForLines(cleared: number): number {
  return HAZARD_ATTACK_TABLE[cleared] ?? 0;
}

/** Total number of pending incoming hazard bars queued on a board. */
export function pendingHazardCount(state: Pick<PrismStackState, 'pendingHazard'>): number {
  return state.pendingHazard.reduce((sum, batch) => sum + Math.max(0, batch.lines), 0);
}

/** Queue incoming solid Hazard Lock Bars from a 2P opponent. */
export function queuePrismHazard(state: PrismStackState, lines: number): PrismStackState {
  const count = Math.max(0, Math.trunc(lines));
  if (count === 0 || state.status !== 'playing') return state;
  return {
    ...state,
    pendingHazard: [...state.pendingHazard, { lines: count }],
  };
}

/**
 * Push solid full-width `'H'` Hazard Lock Bars up from the bottom of the 9×18 board (#352).
 * Unlike grey 1-hole rows, every cell in a Hazard Lock Bar is `'H'`, cleared by matching
 * an adjacent horizontal prism line.
 */
export function addHazardLines(
  board: Board,
  batches: readonly HazardBatch[],
): { board: Board; added: number } {
  const hazardRows: Cell[][] = [];
  for (const batch of batches) {
    const count = Math.max(0, Math.trunc(batch.lines));
    for (let i = 0; i < count; i += 1) {
      hazardRows.push(Array<Cell>(BOARD_WIDTH).fill('H'));
    }
  }
  if (hazardRows.length === 0) return { board, added: 0 };
  const combined = [...board, ...hazardRows];
  const nextBoard = combined.slice(combined.length - BOARD_HEIGHT);
  return { board: nextBoard, added: hazardRows.length };
}

export function levelForLines(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

/** Gravity interval in milliseconds; faster as the level rises. */
export function dropInterval(level: number): number {
  return Math.max(100, 800 - (level - 1) * 70);
}

function withPiece(state: PrismStackState, type: PolyId): PrismStackState {
  const piece = spawnPiece(type);
  if (collides(state.board, piece)) return { ...state, piece: null, status: 'over' };
  return { ...state, piece };
}

export function createGame(rng: () => number = Math.random): PrismStackState {
  const afterFirst = takeFromBag(shuffledBag(rng), rng);
  const afterSecond = takeFromBag(afterFirst.bag, rng);
  const base: PrismStackState = {
    board: createEmptyBoard(),
    piece: null,
    next: afterSecond.type,
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    bag: afterSecond.bag,
    quadClearCount: 0,
    pendingHazard: [],
    hazardSent: 0,
    lastLockEvent: null,
  };
  return withPiece(base, afterFirst.type);
}

function lockAndSpawn(state: PrismStackState, rng: () => number): PrismStackState {
  if (!state.piece || state.status !== 'playing') return state;
  const merged = mergePiece(state.board, state.piece);
  const { board: clearedBoard, cleared, shatteredHazards } = clearLines(merged);
  const lines = state.lines + cleared;
  const level = levelForLines(lines);
  const score = state.score + scoreForLines(cleared, state.level, shatteredHazards);
  const quadClearCount = state.quadClearCount + (cleared === 4 ? 1 : 0);

  let remainingPending = state.pendingHazard.map((b) => ({ ...b }));
  let sentHazard = 0;
  let canceledHazard = 0;
  let risenHazard = 0;
  let board = clearedBoard;

  if (cleared > 0) {
    let attack = hazardForLines(cleared);
    while (attack > 0 && remainingPending.length > 0) {
      const first = remainingPending[0]!;
      if (first.lines <= attack) {
        attack -= first.lines;
        canceledHazard += first.lines;
        remainingPending.shift();
      } else {
        first.lines -= attack;
        canceledHazard += attack;
        attack = 0;
      }
    }
    sentHazard = attack;
  } else if (remainingPending.length > 0) {
    const addedResult = addHazardLines(board, remainingPending);
    board = addedResult.board;
    risenHazard = addedResult.added;
    remainingPending = [];
  }

  const nextEventId = (state.lastLockEvent?.id ?? 0) + 1;
  const taken = takeFromBag(state.bag, rng);
  const next: PrismStackState = {
    ...state,
    board,
    lines,
    level,
    score,
    next: taken.type,
    bag: taken.bag,
    quadClearCount,
    pendingHazard: remainingPending,
    hazardSent: state.hazardSent + sentHazard,
    lastLockEvent: {
      id: nextEventId,
      cleared,
      shatteredHazards,
      sentHazard,
      canceledHazard,
      risenHazard,
    },
  };
  return withPiece(next, state.next);
}

function requirePlaying(state: PrismStackState): state is PrismStackState & { piece: PrismPiece } {
  return state.status === 'playing' && state.piece !== null;
}

export function moveLeft(state: PrismStackState): PrismStackState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, -1, 0);
  return moved ? { ...state, piece: moved } : state;
}

export function moveRight(state: PrismStackState): PrismStackState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, 1, 0);
  return moved ? { ...state, piece: moved } : state;
}

export function rotate(state: PrismStackState, direction: 1 | -1 = 1): PrismStackState {
  if (!requirePlaying(state)) return state;
  return { ...state, piece: tryRotate(state.board, state.piece, direction) };
}

/** One gravity step. Locks the piece and spawns the next when it cannot fall. */
export function tick(state: PrismStackState, rng: () => number = Math.random): PrismStackState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, 0, 1);
  return moved ? { ...state, piece: moved } : lockAndSpawn(state, rng);
}

/** Move down one row, scoring one point; lock immediately when blocked. */
export function softDrop(state: PrismStackState, rng: () => number = Math.random): PrismStackState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, 0, 1);
  if (moved) return { ...state, piece: moved, score: state.score + 1 };
  return lockAndSpawn(state, rng);
}

/** Drop to the floor, scoring two points per row, then lock. */
export function hardDrop(state: PrismStackState, rng: () => number = Math.random): PrismStackState {
  if (!requirePlaying(state)) return state;
  let piece = state.piece;
  let dropped = 0;
  for (;;) {
    const moved = tryMove(state.board, piece, 0, 1);
    if (!moved) break;
    piece = moved;
    dropped += 1;
  }
  return lockAndSpawn({ ...state, piece, score: state.score + dropped * 2 }, rng);
}

/**
 * Computes subtle column guide rails + bottom floor landing target ticks for
 * the active piece without rendering a translucent ghost-piece silhouette (#352).
 */
export function landingGuide(state: PrismStackState): LandingGuide {
  if (!requirePlaying(state)) {
    return { columns: new Set<number>(), floorTicks: [] };
  }
  let landed = state.piece;
  for (;;) {
    const moved = tryMove(state.board, landed, 0, 1);
    if (!moved) break;
    landed = moved;
  }
  const cols = new Set<number>();
  const bottomByCol = new Map<number, number>();
  for (const [dx, dy] of rotationCells(landed.type, landed.rotation)) {
    const x = landed.x + dx;
    const y = landed.y + dy;
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) continue;
    cols.add(x);
    const prev = bottomByCol.get(x);
    if (prev === undefined || y > prev) {
      bottomByCol.set(x, y);
    }
  }
  const floorTicks: Array<{ x: number; y: number }> = [];
  if (landed.y > state.piece.y) {
    for (const [x, y] of bottomByCol.entries()) {
      floorTicks.push({ x, y });
    }
    floorTicks.sort((a, b) => a.x - b.x);
  }
  return { columns: cols, floorTicks };
}

/** Settled prisms plus the active falling prism (no ghost silhouette). */
export function displayBoard(state: PrismStackState): Board {
  const display = state.board.map((row) => row.slice());
  if (state.piece) {
    for (const [dx, dy] of rotationCells(state.piece.type, state.piece.rotation)) {
      const x = state.piece.x + dx;
      const y = state.piece.y + dy;
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) display[y][x] = state.piece.type;
    }
  }
  return display;
}
