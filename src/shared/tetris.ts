/**
 * Classic Tetris rules as pure functions.
 *
 * A game is canvas content a request produced, not a GitHub record: the board
 * and score are local to the view and are never written back to the repository.
 * Kept in `src/shared` so the client view and the deterministic tests use one
 * implementation.
 */

export type Tetromino = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Cell = Tetromino | null;
export type Board = Cell[][];

export interface Piece {
  type: Tetromino;
  /** 0..3, clockwise from the spawn orientation. */
  rotation: number;
  /** Board column of the piece bounding-box top-left. */
  x: number;
  /** Board row of the piece bounding-box top-left. */
  y: number;
}

export interface TetrisState {
  board: Board;
  piece: Piece | null;
  next: Tetromino;
  score: number;
  lines: number;
  level: number;
  status: 'playing' | 'over';
  /** Remaining pieces of the current 7-bag. */
  bag: Tetromino[];
  /** Number of four-line clears so far, used to cycle the view's backdrop. */
  tetrisCount: number;
}

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const TETROMINOES: readonly Tetromino[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

const BASE_SHAPES: Record<Tetromino, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
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

const ROTATIONS: Record<Tetromino, number[][][]> = (() => {
  const result = {} as Record<Tetromino, number[][][]>;
  for (const type of TETROMINOES) {
    const states: number[][][] = [BASE_SHAPES[type]];
    for (let index = 1; index < 4; index += 1) {
      states.push(rotateMatrix(states[index - 1]));
    }
    result[type] = states;
  }
  return result;
})();

/** The occupied cells of a piece for a rotation, relative to its bounding box. */
export function rotationCells(type: Tetromino, rotation: number): Array<[number, number]> {
  const matrix = ROTATIONS[type][((rotation % 4) + 4) % 4];
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (matrix[y][x] === 1) cells.push([x, y]);
    }
  }
  return cells;
}

export function pieceSize(type: Tetromino): number {
  return BASE_SHAPES[type].length;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null));
}

/** A full 7-bag shuffled once, so pieces are fair without visible repetition. */
export function shuffledBag(rng: () => number = Math.random): Tetromino[] {
  const bag = [...TETROMINOES];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function takeFromBag(bag: Tetromino[], rng: () => number): { type: Tetromino; bag: Tetromino[] } {
  const current = bag.length > 0 ? bag : shuffledBag(rng);
  const [type, ...rest] = current;
  return { type, bag: rest };
}

export function spawnPiece(type: Tetromino): Piece {
  const size = pieceSize(type);
  return { type, rotation: 0, x: Math.floor((BOARD_WIDTH - size) / 2), y: 0 };
}

export function collides(board: Board, piece: Piece): boolean {
  for (const [dx, dy] of rotationCells(piece.type, piece.rotation)) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return true;
    if (y >= 0 && board[y][x] !== null) return true;
  }
  return false;
}

function tryMove(board: Board, piece: Piece, dx: number, dy: number): Piece | null {
  const moved: Piece = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return collides(board, moved) ? null : moved;
}

const KICKS = [0, -1, 1, -2, 2];

export function tryRotate(board: Board, piece: Piece, direction: 1 | -1): Piece {
  const rotation = (piece.rotation + direction + 4) % 4;
  for (const kick of KICKS) {
    const candidate: Piece = { ...piece, rotation, x: piece.x + kick };
    if (!collides(board, candidate)) return candidate;
  }
  return piece;
}

export function mergePiece(board: Board, piece: Piece): Board {
  const next = board.map((row) => row.slice());
  for (const [dx, dy] of rotationCells(piece.type, piece.rotation)) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) next[y][x] = piece.type;
  }
  return next;
}

export function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const cleared = BOARD_HEIGHT - remaining.length;
  const empty = Array.from({ length: cleared }, () => Array<Cell>(BOARD_WIDTH).fill(null));
  return { board: [...empty, ...remaining], cleared };
}

const LINE_SCORES = [0, 100, 300, 500, 800];

export function scoreForLines(cleared: number, level: number): number {
  return (LINE_SCORES[cleared] ?? 0) * level;
}

export function levelForLines(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

/** Gravity interval in milliseconds; faster as the level rises. */
export function dropInterval(level: number): number {
  return Math.max(100, 800 - (level - 1) * 70);
}

function withPiece(state: TetrisState, type: Tetromino): TetrisState {
  const piece = spawnPiece(type);
  if (collides(state.board, piece)) return { ...state, piece: null, status: 'over' };
  return { ...state, piece };
}

export function createGame(rng: () => number = Math.random): TetrisState {
  const afterFirst = takeFromBag(shuffledBag(rng), rng);
  const afterSecond = takeFromBag(afterFirst.bag, rng);
  const base: TetrisState = {
    board: createEmptyBoard(),
    piece: null,
    next: afterSecond.type,
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    bag: afterSecond.bag,
    tetrisCount: 0,
  };
  return withPiece(base, afterFirst.type);
}

function lockAndSpawn(state: TetrisState, rng: () => number): TetrisState {
  if (!state.piece || state.status !== 'playing') return state;
  const merged = mergePiece(state.board, state.piece);
  const { board, cleared } = clearLines(merged);
  const lines = state.lines + cleared;
  const level = levelForLines(lines);
  const score = state.score + scoreForLines(cleared, state.level);
  const tetrisCount = state.tetrisCount + (cleared === 4 ? 1 : 0);
  const taken = takeFromBag(state.bag, rng);
  const next: TetrisState = {
    ...state,
    board,
    lines,
    level,
    score,
    next: taken.type,
    bag: taken.bag,
    tetrisCount,
  };
  return withPiece(next, state.next);
}

function requirePlaying(state: TetrisState): state is TetrisState & { piece: Piece } {
  return state.status === 'playing' && state.piece !== null;
}

export function moveLeft(state: TetrisState): TetrisState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, -1, 0);
  return moved ? { ...state, piece: moved } : state;
}

export function moveRight(state: TetrisState): TetrisState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, 1, 0);
  return moved ? { ...state, piece: moved } : state;
}

export function rotate(state: TetrisState, direction: 1 | -1 = 1): TetrisState {
  if (!requirePlaying(state)) return state;
  return { ...state, piece: tryRotate(state.board, state.piece, direction) };
}

/** One gravity step. Locks the piece and spawns the next when it cannot fall. */
export function tick(state: TetrisState, rng: () => number = Math.random): TetrisState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, 0, 1);
  return moved ? { ...state, piece: moved } : lockAndSpawn(state, rng);
}

/** Move down one row, scoring one point; lock immediately when blocked. */
export function softDrop(state: TetrisState, rng: () => number = Math.random): TetrisState {
  if (!requirePlaying(state)) return state;
  const moved = tryMove(state.board, state.piece, 0, 1);
  if (moved) return { ...state, piece: moved, score: state.score + 1 };
  return lockAndSpawn(state, rng);
}

/** Drop to the floor, scoring two points per row, then lock. */
export function hardDrop(state: TetrisState, rng: () => number = Math.random): TetrisState {
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

/** The board plus the active piece, for rendering. */
export function displayBoard(state: TetrisState): Board {
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
