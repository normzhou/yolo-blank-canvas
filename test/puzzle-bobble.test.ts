import { describe, expect, it } from 'vitest';
import {
  ARENA_WIDTH,
  BUBBLE_DIAMETER,
  BUBBLE_RADIUS,
  CEILING_DROP_SHOTS,
  DANGER_ROW,
  EVEN_COLS,
  MAX_AIM_ANGLE,
  MIN_AIM_ANGLE,
  ODD_COLS,
  aimGuidePoints,
  aimPlayer,
  bubbleCenter,
  colsForRow,
  createEmptyGrid,
  createMatch,
  findConnectedColorCluster,
  findFloatingBubbles,
  fireAndResolvePlayer,
  firePlayerBubble,
  hexNeighbors,
  settleBubbleAt,
  stepMatch,
} from '../src/shared/puzzleBobble';

describe('Puzzle Bobble (Bust-A-Move) rules', () => {
  it('lays out an 8/7 staggered hexagonal grid with exact 6-way neighbors', () => {
    expect(colsForRow(0)).toBe(EVEN_COLS);
    expect(colsForRow(1)).toBe(ODD_COLS);
    expect(bubbleCenter(0, 0)).toEqual({ x: BUBBLE_RADIUS, y: BUBBLE_RADIUS });
    expect(bubbleCenter(1, 0).x).toBe(BUBBLE_RADIUS + BUBBLE_RADIUS);

    // Even row (0, 1) touches (0,0), (0,2), and (1,0), (1,1).
    expect(hexNeighbors(0, 1)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);

    // Odd row (1, 1) touches (1,0), (1,2), (0,1), (0,2), (2,1), (2,2).
    expect(hexNeighbors(1, 1)).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it('starts a 2-player match with identical opening boards and bubble queues for fairness', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 48271) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const match = createMatch('2p', rng);
    expect(match.players).toHaveLength(2);
    expect(match.players[0].grid).toEqual(match.players[1]?.grid);
    expect(match.players[0].currentBubble).toBe(match.players[1]?.currentBubble);
    expect(match.players[0].nextBubble).toBe(match.players[1]?.nextBubble);
  });

  it('clamps aiming between -75 and +75 degrees and computes wall-bounce guide rays', () => {
    let match = createMatch('2p', () => 0.2);
    match = aimPlayer(match, 0, -200);
    expect(match.players[0].aimAngle).toBe(MIN_AIM_ANGLE);
    expect(match.players[1]?.aimAngle).toBe(0);

    match = aimPlayer(match, 1, 200);
    expect(match.players[1]?.aimAngle).toBe(MAX_AIM_ANGLE);

    const straight = aimGuidePoints(0);
    expect(straight).toHaveLength(2);
    expect(straight[0].x).toBe( straight[1].x );

    const banked = aimGuidePoints(60);
    expect(banked).toHaveLength(3);
    expect(banked[1].x).toBe(ARENA_WIDTH - BUBBLE_RADIUS);
  });

  it('bounces flying bubbles off the side walls and snaps them onto the hex grid', () => {
    let match = createMatch('1p', () => 0.1);
    match.players[0].grid = createEmptyGrid();
    match = aimPlayer(match, 0, 65);
    match = firePlayerBubble(match, 0);
    expect(match.players[0].flying).not.toBeNull();

    let bouncedRightWall = false;
    for (let i = 0; i < 60 && match.players[0].flying; i += 1) {
      const prevVx = match.players[0].flying.vx;
      match = stepMatch(match, () => 0.1);
      if (match.players[0].flying && prevVx > 0 && match.players[0].flying.vx < 0) {
        bouncedRightWall = true;
      }
    }
    expect(bouncedRightWall).toBe(true);
    expect(match.players[0].flying).toBeNull();
    // Should have snapped into row 0 on the empty board.
    expect(match.players[0].grid[0].some((cell) => cell !== null)).toBe(true);
  });

  it('pops connected groups of 3+ matching bubbles and drops unanchored hanging clusters', () => {
    const grid = createEmptyGrid();
    // Anchor two ruby bubbles in row 0: (0, 2) and (0, 3)
    grid[0][2] = 'ruby';
    grid[0][3] = 'ruby';
    // Hang an emerald and an amber bubble below (0, 2) so they depend on the ruby bridge:
    grid[1][2] = 'emerald';
    grid[2][2] = 'amber';

    expect(findConnectedColorCluster(grid, 0, 2)).toHaveLength(2);
    expect(findFloatingBubbles(grid)).toHaveLength(0);

    let match = createMatch('2p', () => 0.3);
    match.players[0].grid = grid;
    // Place a third ruby bubble at (1, 1), which touches (0, 2)
    match = settleBubbleAt(match, 0, 1, 1, 'ruby', () => 0.3);

    const p1 = match.players[0];
    expect(p1.lastEvent?.popped).toHaveLength(3);
    expect(p1.lastEvent?.dropped).toHaveLength(2);
    expect(p1.score).toBeGreaterThan(30);
    // In 2P mode, dropping 2 hanging bubbles sends 2 attack garbage bubbles to Player 2!
    expect(p1.lastEvent?.sentGarbage).toBe(2);
    expect(match.players[1]?.incomingGarbage).toBe(2);
  });

  it('applies incoming garbage on a non-popping shot and drops the ceiling every 8 shots', () => {
    let match = createMatch('2p', () => 0.4);
    const grid = createEmptyGrid();
    grid[0][0] = 'ruby';
    match.players[0].grid = grid;
    match.players[0].incomingGarbage = 3;
    match.players[0].shotsFired = CEILING_DROP_SHOTS - 1;

    // Settle a non-matching azure bubble at (0, 4): no pop occurs, so incoming garbage drops
    // and the 8th shot increments ceilingDrop.
    match = settleBubbleAt(match, 0, 0, 4, 'azure', () => 0.4);
    expect(match.players[0].incomingGarbage).toBe(0);
    expect(match.players[0].ceilingDrop).toBe(1);

    const occupiedCount = match.players[0].grid.flat().filter((cell) => cell !== null).length;
    expect(occupiedCount).toBe(2 + 3);
  });

  it('awards the round to the opponent when a player crosses the danger line, and to the clearer on board clear', () => {
    let match = createMatch('2p', () => 0.2);
    const koGrid = createEmptyGrid();
    koGrid[0][0] = 'ruby';
    koGrid[DANGER_ROW - 1][0] = 'amber';
    match.players[0].grid = koGrid;
    match.players[0].ceilingDrop = 1; // row (DANGER_ROW - 1) + 1 >= DANGER_ROW

    match = settleBubbleAt(match, 0, 0, 2, 'emerald', () => 0.2);
    expect(match.status).toBe('round_over');
    expect(match.winner).toBe(1);
    expect(match.wins).toEqual([0, 1]);

    // Clearing the last bubble in 2P mode immediately wins the round for that player.
    let clearMatch = createMatch('2p', () => 0.2, match.wins);
    const nearlyClear = createEmptyGrid();
    nearlyClear[0][1] = 'coral';
    nearlyClear[0][2] = 'coral';
    clearMatch.players[0].grid = nearlyClear;

    clearMatch = settleBubbleAt(clearMatch, 0, 0, 3, 'coral', () => 0.2);
    expect(clearMatch.status).toBe('round_over');
    expect(clearMatch.winner).toBe(0);
    expect(clearMatch.wins).toEqual([1, 1]);
  });

  it('fires and resolves a live shot for both players independently', () => {
    let match = createMatch('2p', () => 0.25);
    match = aimPlayer(match, 0, -15);
    match = aimPlayer(match, 1, 15);
    match = fireAndResolvePlayer(match, 0, () => 0.25);
    match = fireAndResolvePlayer(match, 1, () => 0.25);
    expect(match.players[0].shotsFired).toBe(1);
    expect(match.players[1]?.shotsFired).toBe(1);
  });
});
