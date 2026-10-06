import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  clearLines,
  collides,
  createEmptyBoard,
  createGame,
  displayBoard,
  dropInterval,
  hardDrop,
  levelForLines,
  mergePiece,
  moveLeft,
  moveRight,
  rotationCells,
  scoreForLines,
  shuffledBag,
  softDrop,
  spawnPiece,
  TETROMINOES,
  tick,
  type Board,
  type Tetromino,
  type TetrisState,
} from '../src/shared/tetris';

function boardWith(rows: Partial<Record<number, Partial<Record<number, Tetromino>>>>): Board {
  const board = createEmptyBoard();
  for (const [y, columns] of Object.entries(rows)) {
    for (const [x, type] of Object.entries(columns ?? {})) {
      if (type) board[Number(y)][Number(x)] = type;
    }
  }
  return board;
}

function withPiece(state: TetrisState, type: Tetromino, x: number, y: number, rotation = 0): TetrisState {
  return { ...state, piece: { type, rotation, x, y } };
}

describe('tetris board and pieces', () => {
  it('creates a 10x20 empty board', () => {
    const board = createEmptyBoard();
    expect(board).toHaveLength(BOARD_HEIGHT);
    expect(board[0]).toHaveLength(BOARD_WIDTH);
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });

  it('has four occupied cells for every tetromino in every rotation', () => {
    for (const type of TETROMINOES) {
      for (let rotation = 0; rotation < 4; rotation += 1) {
        expect(rotationCells(type, rotation)).toHaveLength(4);
      }
    }
  });

  it('keeps the O piece within a 2x2 bounding box when rotated', () => {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      for (const [x, y] of rotationCells('O', rotation)) {
        expect(x).toBeLessThan(2);
        expect(y).toBeLessThan(2);
      }
    }
  });

  it('spawns each piece horizontally centered at the top', () => {
    for (const type of TETROMINOES) {
      const piece = spawnPiece(type);
      expect(piece.y).toBe(0);
      expect(piece.x).toBe(Math.floor((BOARD_WIDTH - (type === 'I' ? 4 : type === 'O' ? 2 : 3)) / 2));
    }
  });

  it('detects walls, the floor and settled cells', () => {
    const empty = createEmptyBoard();
    expect(collides(empty, { type: 'O', rotation: 0, x: -1, y: 0 })).toBe(true);
    expect(collides(empty, { type: 'O', rotation: 0, x: BOARD_WIDTH - 1, y: 0 })).toBe(true);
    expect(collides(empty, { type: 'O', rotation: 0, x: 4, y: BOARD_HEIGHT - 1 })).toBe(true);
    expect(collides(empty, { type: 'O', rotation: 0, x: 4, y: 0 })).toBe(false);
    expect(collides(boardWith({ 0: { 4: 'I' } }), { type: 'O', rotation: 0, x: 4, y: 0 })).toBe(true);
  });
});

describe('tetris line clearing and scoring', () => {
  it('removes a full row, adds an empty row on top and counts the clear', () => {
    const full = createEmptyBoard().map((row, y) => (y === BOARD_HEIGHT - 1 ? row.map(() => 'I' as Tetromino) : row));
    const { board, cleared } = clearLines(full);
    expect(cleared).toBe(1);
    expect(board).toHaveLength(BOARD_HEIGHT);
    expect(board[0].every((cell) => cell === null)).toBe(true);
    expect(board[BOARD_HEIGHT - 1].every((cell) => cell === null)).toBe(true);
  });

  it('leaves a non-full row untouched', () => {
    const board = boardWith({ 5: { 0: 'T', 1: 'T' } });
    const result = clearLines(board);
    expect(result.cleared).toBe(0);
    expect(result.board[5][0]).toBe('T');
  });

  it('scores classic line values scaled by level', () => {
    expect(scoreForLines(0, 1)).toBe(0);
    expect(scoreForLines(1, 1)).toBe(100);
    expect(scoreForLines(2, 1)).toBe(300);
    expect(scoreForLines(3, 1)).toBe(500);
    expect(scoreForLines(4, 1)).toBe(800);
    expect(scoreForLines(4, 3)).toBe(2400);
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

describe('tetris game flow', () => {
  it('uses a 7-bag so every piece appears once per bag', () => {
    const bag = shuffledBag(() => 0.42);
    expect([...bag].sort()).toEqual([...TETROMINOES].sort());
  });

  it('starts a game with a piece and a preview', () => {
    const game = createGame(() => 0.5);
    expect(game.status).toBe('playing');
    expect(game.piece).not.toBeNull();
    expect(TETROMINOES).toContain(game.next);
    expect(game.board.flat().every((cell) => cell === null)).toBe(true);
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
    const started = withPiece(game, 'O', 4, 0);
    const locked = hardDrop(started);
    const droppedRows = BOARD_HEIGHT - 2; // O is two cells tall
    expect(locked.score).toBe(started.score + droppedRows * 2);
    expect(locked.board[BOARD_HEIGHT - 1][4]).toBe('O');
    expect(locked.board[BOARD_HEIGHT - 1][5]).toBe('O');
    expect(locked.status).toBe('playing');
  });

  it('locks and spawns on gravity when the piece cannot fall', () => {
    const game = createGame(() => 0.5);
    const atFloor = withPiece(game, 'O', 4, BOARD_HEIGHT - 2);
    const after = tick(atFloor);
    expect(after.board[BOARD_HEIGHT - 1][4]).toBe('O');
    expect(after.piece).not.toBeNull(); // the next piece
  });

  it('ends the game when the next piece cannot spawn', () => {
    const game = createGame(() => 0.5);
    // Block columns 3-6 near the top without completing a row, so clearing cannot free them.
    const blocked = boardWith({ 0: { 3: 'I', 4: 'I', 5: 'I', 6: 'I' }, 1: { 3: 'I', 4: 'I', 5: 'I', 6: 'I' } });
    const stuck: TetrisState = { ...withPiece(game, 'O', 4, BOARD_HEIGHT - 2), board: blocked };
    const after = tick(stuck);
    expect(after.status).toBe('over');
    expect(after.piece).toBeNull();
  });

  it('renders the active piece on top of the settled board', () => {
    const game = createGame(() => 0.5);
    const piece = withPiece(game, 'T', 4, 5);
    const display = displayBoard(piece);
    const occupied = display.flat().filter((cell) => cell === 'T');
    expect(occupied).toHaveLength(4);
    expect(mergePiece(createEmptyBoard(), piece.piece!).flat().filter((cell) => cell === 'T')).toHaveLength(4);
  });
});
