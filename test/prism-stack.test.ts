import { describe, expect, it } from 'vitest';
import {
  addHazardLines,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  clearLines,
  collides,
  createEmptyBoard,
  createGame,
  displayBoard,
  dropInterval,
  hardDrop,
  hazardForLines,
  landingGuide,
  levelForLines,
  mergePiece,
  moveLeft,
  moveRight,
  pendingHazardCount,
  PRISM_SHAPES,
  queuePrismHazard,
  rotationCells,
  scoreForLines,
  shuffledBag,
  softDrop,
  spawnPiece,
  tick,
  type Board,
  type Cell,
  type PolyId,
  type PrismStackState,
} from '../src/shared/prismStack';

function boardWith(rows: Partial<Record<number, Partial<Record<number, Cell>>>>): Board {
  const board = createEmptyBoard();
  for (const [y, columns] of Object.entries(rows)) {
    for (const [x, type] of Object.entries(columns ?? {})) {
      if (type) board[Number(y)][Number(x)] = type;
    }
  }
  return board;
}

function withPiece(
  state: PrismStackState,
  type: PolyId,
  x: number,
  y: number,
  rotation = 0,
): PrismStackState {
  return { ...state, piece: { type, rotation, x, y } };
}

describe('Prism Stack 9x18 board and crystal polyominoes (#352)', () => {
  it('creates a 9x18 empty board', () => {
    expect(BOARD_WIDTH).toBe(9);
    expect(BOARD_HEIGHT).toBe(18);
    const board = createEmptyBoard();
    expect(board).toHaveLength(BOARD_HEIGHT);
    expect(board[0]).toHaveLength(BOARD_WIDTH);
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });

  it('has four occupied cells for every prism polyomino in every rotation', () => {
    for (const type of PRISM_SHAPES) {
      for (let rotation = 0; rotation < 4; rotation += 1) {
        expect(rotationCells(type, rotation)).toHaveLength(4);
      }
    }
  });

  it('keeps the quad piece within a 2x2 bounding box when rotated', () => {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      for (const [x, y] of rotationCells('quad', rotation)) {
        expect(x).toBeLessThan(2);
        expect(y).toBeLessThan(2);
      }
    }
  });

  it('spawns each piece horizontally centered at the top of the 9-column board', () => {
    for (const type of PRISM_SHAPES) {
      const piece = spawnPiece(type);
      expect(piece.y).toBe(0);
      expect(piece.x).toBe(Math.floor((BOARD_WIDTH - (type === 'bar' ? 4 : type === 'quad' ? 2 : 3)) / 2));
    }
  });

  it('detects walls, the floor and settled cells', () => {
    const empty = createEmptyBoard();
    expect(collides(empty, { type: 'quad', rotation: 0, x: -1, y: 0 })).toBe(true);
    expect(collides(empty, { type: 'quad', rotation: 0, x: BOARD_WIDTH - 1, y: 0 })).toBe(true);
    expect(collides(empty, { type: 'quad', rotation: 0, x: 3, y: BOARD_HEIGHT - 1 })).toBe(true);
    expect(collides(empty, { type: 'quad', rotation: 0, x: 3, y: 0 })).toBe(false);
    expect(collides(boardWith({ 0: { 3: 'bar' } }), { type: 'quad', rotation: 0, x: 3, y: 0 })).toBe(true);
  });
});

describe('Prism Stack line clearing, solid Hazard Lock Bars, and scoring (#352)', () => {
  it('removes a full playable row, adds an empty row on top and counts the clear', () => {
    const full = createEmptyBoard().map((row, y) =>
      y === BOARD_HEIGHT - 1 ? row.map(() => 'bar' as Cell) : row,
    );
    const { board, cleared, shatteredHazards } = clearLines(full);
    expect(cleared).toBe(1);
    expect(shatteredHazards).toBe(0);
    expect(board).toHaveLength(BOARD_HEIGHT);
    expect(board[0].every((cell) => cell === null)).toBe(true);
    expect(board[BOARD_HEIGHT - 1].every((cell) => cell === null)).toBe(true);
  });

  it('does NOT auto-clear solid H hazard rows on their own, and shatters contiguous H bars when an adjacent playable row clears', () => {
    const b = createEmptyBoard();
    // Bottom 2 rows are full-width solid Hazard Lock Bars ('H')
    b[BOARD_HEIGHT - 1] = Array<Cell>(BOARD_WIDTH).fill('H');
    b[BOARD_HEIGHT - 2] = Array<Cell>(BOARD_WIDTH).fill('H');
    expect(clearLines(b).cleared).toBe(0);
    expect(clearLines(b).shatteredHazards).toBe(0);

    // Complete a playable row immediately above the 2 hazard bars -> shatters both!
    b[BOARD_HEIGHT - 3] = Array<Cell>(BOARD_WIDTH).fill('crest');
    const res = clearLines(b);
    expect(res.cleared).toBe(1);
    expect(res.shatteredHazards).toBe(2);
    expect(res.board.flat().every((c) => c === null)).toBe(true);
  });

  it('scores line values plus hazard shatter bonus scaled by level', () => {
    expect(scoreForLines(0, 1)).toBe(0);
    expect(scoreForLines(1, 1)).toBe(100);
    expect(scoreForLines(2, 1)).toBe(300);
    expect(scoreForLines(3, 1)).toBe(500);
    expect(scoreForLines(4, 1)).toBe(800);
    expect(scoreForLines(1, 2, 2)).toBe((100 + 100) * 2);
  });

  it('levels up every ten lines and speeds up gravity', () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(9)).toBe(1);
    expect(levelForLines(10)).toBe(2);
    expect(dropInterval(1)).toBe(800);
    expect(dropInterval(2)).toBeLessThan(dropInterval(1));
    expect(dropInterval(99)).toBeGreaterThanOrEqual(100);
  });
});

describe('Prism Stack game flow & landing guide (#352)', () => {
  it('uses a 7-bag so every piece appears once per bag', () => {
    const bag = shuffledBag(() => 0.42);
    expect([...bag].sort()).toEqual([...PRISM_SHAPES].sort());
  });

  it('starts a game with a piece and a preview', () => {
    const game = createGame(() => 0.5);
    expect(game.status).toBe('playing');
    expect(game.piece).not.toBeNull();
    expect(PRISM_SHAPES).toContain(game.next);
    expect(game.board.flat().every((cell) => cell === null)).toBe(true);
    expect(game.quadClearCount).toBe(0);
  });

  it('moves the piece and stops at the wall', () => {
    const game = createGame(() => 0.5);
    const left = moveLeft(game);
    expect(left.piece?.x).toBe(game.piece!.x - 1);
    let atWall = left;
    for (let i = 0; i < 20; i += 1) atWall = moveLeft(atWall);
    expect(atWall.piece?.x).toBe(0);
    expect(moveRight(atWall).piece?.x).toBe(1);
  });

  it('soft-drops one row and scores one point', () => {
    const game = createGame(() => 0.5);
    const dropped = softDrop(game);
    expect(dropped.piece?.y).toBe(game.piece!.y + 1);
    expect(dropped.score).toBe(game.score + 1);
  });

  it('hard-drops to the floor, scores two per row and spawns the next piece', () => {
    const game = createGame(() => 0.5);
    const started = withPiece(game, 'quad', 3, 0);
    const locked = hardDrop(started);
    const droppedRows = BOARD_HEIGHT - 2;
    expect(locked.score).toBe(started.score + droppedRows * 2);
    expect(locked.board[BOARD_HEIGHT - 1][3]).toBe('quad');
    expect(locked.board[BOARD_HEIGHT - 1][4]).toBe('quad');
    expect(locked.status).toBe('playing');
  });

  it('computes column guide rails + floor landing ticks without rendering a ghost piece', () => {
    const game = createGame(() => 0.5);
    const airborne = withPiece(game, 'quad', 3, 2);
    const guide = landingGuide(airborne);
    expect([...guide.columns].sort()).toEqual([3, 4]);
    expect(guide.floorTicks).toEqual([
      { x: 3, y: BOARD_HEIGHT - 1 },
      { x: 4, y: BOARD_HEIGHT - 1 },
    ]);

    const resting = withPiece(game, 'quad', 3, BOARD_HEIGHT - 2);
    expect(landingGuide(resting).floorTicks).toEqual([]);
  });

  it('implements Versus solid Hazard Lock Bars (0 / 1 / 2 / 4), countering, and bottom-up rising (#352)', () => {
    expect(hazardForLines(1)).toBe(0);
    expect(hazardForLines(2)).toBe(1);
    expect(hazardForLines(3)).toBe(2);
    expect(hazardForLines(4)).toBe(4);

    let game = createGame(() => 0.5);
    game = queuePrismHazard(game, 2);
    expect(pendingHazardCount(game)).toBe(2);

    // Lock a piece without clearing lines -> 2 full-width solid 'H' Hazard Lock Bars rise!
    const locked = hardDrop(withPiece(game, 'quad', 0, 0));
    expect(pendingHazardCount(locked)).toBe(0);
    expect(locked.lastLockEvent?.risenHazard).toBe(2);
    expect(locked.board[BOARD_HEIGHT - 1].every((c) => c === 'H')).toBe(true);
    expect(locked.board[BOARD_HEIGHT - 2].every((c) => c === 'H')).toBe(true);
    expect(locked.board[BOARD_HEIGHT - 3][0]).toBe('quad');

    // Countering pending hazard with a 4-line quad clear
    const rows: Partial<Record<number, Partial<Record<number, Cell>>>> = {};
    for (let y = BOARD_HEIGHT - 4; y < BOARD_HEIGHT; y += 1) {
      const columns: Partial<Record<number, Cell>> = {};
      for (let x = 0; x < BOARD_WIDTH - 1; x += 1) columns[x] = 'bar';
      rows[y] = columns;
    }
    const prepared = queuePrismHazard({ ...createGame(() => 0.5), board: boardWith(rows) }, 1);
    const vertical = withPiece(prepared, 'bar', BOARD_WIDTH - 3, 0, 1);
    const after = hardDrop(vertical);
    expect(after.lastLockEvent?.cleared).toBe(4);
    expect(after.lastLockEvent?.canceledHazard).toBe(1);
    expect(after.lastLockEvent?.sentHazard).toBe(3);
    expect(after.hazardSent).toBe(3);
    expect(pendingHazardCount(after)).toBe(0);

    const added = addHazardLines(createEmptyBoard(), [{ lines: 3 }]);
    expect(added.added).toBe(3);
    expect(added.board[BOARD_HEIGHT - 1].every((c) => c === 'H')).toBe(true);
  });

  it('renders the active piece on top of the settled board', () => {
    const game = createGame(() => 0.5);
    const piece = withPiece(game, 'crest', 3, 5);
    const display = displayBoard(piece);
    const occupied = display.flat().filter((cell) => cell === 'crest');
    expect(occupied).toHaveLength(4);
    expect(mergePiece(createEmptyBoard(), piece.piece!).flat().filter((cell) => cell === 'crest')).toHaveLength(4);
  });
});
