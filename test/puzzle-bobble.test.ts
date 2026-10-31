import { describe, expect, it } from 'vitest';
import {
  AIM_STEP_DEG,
  ARENA_WIDTH,
  BUBBLE_RADIUS,
  CEILING_DROP_SHOTS,
  CHARACTER_OPTIONS,
  DANGER_ROW,
  EVEN_COLS,
  MAX_AIM_ANGLE,
  MAX_DROP_SCORE,
  MIN_AIM_ANGLE,
  ODD_COLS,
  SHOT_TIME_LIMIT_MS,
  STAGE_CATALOG,
  TOTAL_STAGES,
  aimAngleFromBoardPoint,
  aimGuidePoints,
  aimPlayer,
  aimVelocityDegPerSec,
  bubbleCenter,
  characterDisplayName,
  colsForRow,
  createEmptyGrid,
  createMatch,
  createStageGrid,
  decomposeGarbageOrbs,
  deriveMascotMood,
  findConnectedColorCluster,
  findFloatingBubbles,
  fireAndResolvePlayer,
  firePlayerBubble,
  formatAimAngle,
  hexNeighbors,
  hurryCountdownSeconds,
  resolveMatchOutcome,
  scoreForDroppedBubbles,
  scoreForPop,
  scoreForStageClearBonus,
  setPlayerAimAngle,
  settleBubbleAt,
  shotsPerCeilingDrop,
  stageTitle,
  stepMatch,
  tickShotTimers,
} from '../src/shared/puzzleBobble';

describe('Puzzle Bobble (Bust-A-Move) arcade rules', () => {
  it('lays out an 8/7 staggered hexagonal grid with exact 6-way neighbors', () => {
    expect(colsForRow(0)).toBe(EVEN_COLS);
    expect(colsForRow(1)).toBe(ODD_COLS);
    expect(bubbleCenter(0, 0)).toEqual({ x: BUBBLE_RADIUS, y: BUBBLE_RADIUS });
    expect(bubbleCenter(1, 0).x).toBe(BUBBLE_RADIUS + BUBBLE_RADIUS);

    expect(hexNeighbors(0, 1)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);

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

  it('supports fine 0.5-degree micro-tap aiming, smooth hold velocity, and multi-bounce guide rays', () => {
    expect(AIM_STEP_DEG).toBe(0.5);
    let match = createMatch('2p', () => 0.2);

    match = aimPlayer(match, 0, AIM_STEP_DEG);
    expect(match.players[0].aimAngle).toBe(0.5);
    expect(formatAimAngle(match.players[0].aimAngle)).toBe('+0.5°');

    match = aimPlayer(match, 0, AIM_STEP_DEG);
    expect(match.players[0].aimAngle).toBe(1);
    expect(formatAimAngle(match.players[0].aimAngle)).toBe('+1°');

    match = aimPlayer(match, 0, -200);
    expect(match.players[0].aimAngle).toBe(MIN_AIM_ANGLE);
    expect(match.players[1]?.aimAngle).toBe(0);

    match = aimPlayer(match, 1, 200);
    expect(match.players[1]?.aimAngle).toBe(MAX_AIM_ANGLE);

    // Smooth hold acceleration starts gentle (38 deg/s) and ramps up to 115 deg/s.
    expect(aimVelocityDegPerSec(50)).toBe(38);
    expect(aimVelocityDegPerSec(350)).toBeGreaterThan(38);
    expect(aimVelocityDegPerSec(600)).toBe(115);

    const straight = aimGuidePoints(0);
    expect(straight).toHaveLength(2);
    expect(straight[0].x).toBe(straight[1].x);

    const banked = aimGuidePoints(60);
    expect(banked.length).toBeGreaterThanOrEqual(3);
    expect(banked[1].x).toBe(ARENA_WIDTH - BUBBLE_RADIUS);

    // Direct touch/pointer drag-to-aim math (#212).
    expect(aimAngleFromBoardPoint(112, 120)).toBe(0);
    expect(aimAngleFromBoardPoint(112 + 100, 268 - 100)).toBe(45);
    expect(aimAngleFromBoardPoint(112 - 100, 268 - 100)).toBe(-45);
    expect(aimAngleFromBoardPoint(500, 268)).toBe(MAX_AIM_ANGLE);
    expect(aimAngleFromBoardPoint(-200, 268)).toBe(MIN_AIM_ANGLE);

    match = setPlayerAimAngle(match, 0, -22.5);
    expect(match.players[0].aimAngle).toBe(-22.5);
  });

  it('implements the Neo-Geo exponential drop scoring (20 * 2^(n-1) capped at 1,310,720) and speed bonus', () => {
    expect(scoreForPop(2)).toBe(0);
    expect(scoreForPop(3)).toBe(30);
    expect(scoreForPop(5)).toBe(50);

    expect(scoreForDroppedBubbles(0)).toBe(0);
    expect(scoreForDroppedBubbles(1)).toBe(20);
    expect(scoreForDroppedBubbles(2)).toBe(40);
    expect(scoreForDroppedBubbles(3)).toBe(80);
    expect(scoreForDroppedBubbles(4)).toBe(160);
    expect(scoreForDroppedBubbles(10)).toBe(10_240);
    expect(scoreForDroppedBubbles(16)).toBe(655_360);
    expect(scoreForDroppedBubbles(17)).toBe(MAX_DROP_SCORE);
    expect(scoreForDroppedBubbles(22)).toBe(1_310_720);

    expect(scoreForStageClearBonus(3_000)).toBe(50_000);
    expect(scoreForStageClearBonus(6_000)).toBe(49_160);
    expect(scoreForStageClearBonus(64_000)).toBe(440);
    expect(scoreForStageClearBonus(65_000)).toBe(0);
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
    expect(match.players[0].grid[0].some((cell) => cell !== null)).toBe(true);
  });

  it('immediately transfers 4+ pop bonuses and dropped hanging clusters into the opponent incomingQueue and launches them upward on the next non-clearing shot', () => {
    let match = createMatch('2p', () => 0.3);

    // Step 1: Pop a row of 5 ruby bubbles -> immediately sends 2 attack bubbles to Player 2's incomingQueue!
    const quadGrid = createEmptyGrid();
    quadGrid[0][0] = 'ruby';
    quadGrid[0][1] = 'ruby';
    quadGrid[0][2] = 'ruby';
    quadGrid[0][3] = 'ruby';
    quadGrid[0][6] = 'azure';
    match.players[0].grid = quadGrid;

    match = settleBubbleAt(match, 0, 0, 4, 'ruby', () => 0.3);
    expect(match.players[0].lastEvent?.popped).toHaveLength(5);
    expect(match.players[0].lastEvent?.sentGarbage).toBe(2);
    expect(match.players[1]?.incomingGarbage).toBe(2);
    expect(match.players[1]?.incomingQueue).toHaveLength(2);

    // Step 2: Pop 3 azure bubbles holding up 2 hanging bubbles -> sends 2 more to Player 2 (total 4 queued)!
    const dropGrid = createEmptyGrid();
    dropGrid[0][2] = 'azure';
    dropGrid[0][3] = 'azure';
    dropGrid[1][2] = 'emerald';
    dropGrid[2][2] = 'amber';
    dropGrid[0][7] = 'coral';
    match.players[0].grid = dropGrid;

    match = settleBubbleAt(match, 0, 1, 1, 'azure', () => 0.3);
    expect(match.players[0].lastEvent?.popped).toHaveLength(3);
    expect(match.players[0].lastEvent?.dropped).toHaveLength(2);
    expect(match.players[0].lastEvent?.dropScore).toBe(40);
    expect(match.players[0].lastEvent?.sentGarbage).toBe(2);
    expect(match.players[1]?.incomingGarbage).toBe(4);
    expect(match.players[1]?.incomingQueue).toHaveLength(4);

    // Step 3: Player 2 takes a non-popping shot -> all 4 queued bubbles rise from the bottom
    // and are recorded in `lastEvent.risenGarbage`!
    const p2Grid = createEmptyGrid();
    p2Grid[0][0] = 'ruby';
    match.players[1]!.grid = p2Grid;
    const queuedColors = [...match.players[1]!.incomingQueue];

    match = settleBubbleAt(match, 1, 0, 4, 'emerald', () => 0.3);
    expect(match.players[1]?.incomingGarbage).toBe(0);
    expect(match.players[1]?.incomingQueue).toEqual([]);
    expect(match.players[1]?.lastEvent?.risenGarbage).toHaveLength(4);
    expect(match.players[1]?.lastEvent?.risenGarbage.map((c) => c.color)).toEqual(queuedColors);

    // Verify red (5) and yellow (1) garbage orb decomposition.
    expect(decomposeGarbageOrbs(7)).toEqual(['red', 'yellow', 'yellow']);
  });

  it('scales ceiling drop frequency by remaining colors and warns 1 shot before dropping', () => {
    const oneColorGrid = createEmptyGrid();
    oneColorGrid[0][0] = 'ruby';
    // 1 active color -> interval is max(4, 3 + 1) = 4 shots.
    expect(shotsPerCeilingDrop(oneColorGrid)).toBe(4);

    let match = createMatch('2p', () => 0.4);
    match.players[0].grid = oneColorGrid;
    match.players[0].incomingGarbage = 3;
    match.players[0].shotsFired = CEILING_DROP_SHOTS - 1;
    match.players[0].shotsSinceDrop = 2;

    match = settleBubbleAt(match, 0, 0, 4, 'azure', () => 0.4);
    expect(match.players[0].incomingGarbage).toBe(0);
    expect(match.players[0].ceilingDrop).toBe(1);
    const occupiedCount = match.players[0].grid.flat().filter((cell) => cell !== null).length;
    expect(occupiedCount).toBe(2 + 3);
  });

  it('counts down the 10-second shot timer, surfaces HURRY UP! at <= 5s, and auto-fires at 0s', () => {
    let match = createMatch('2p', () => 0.25);
    expect(match.players[0].shotTimerMs).toBe(SHOT_TIME_LIMIT_MS);
    expect(hurryCountdownSeconds(match.players[0])).toBeNull();

    // Advance 6 seconds -> 4,000ms left -> HURRY UP! 4
    match = tickShotTimers(match, 6_000, () => 0.25);
    expect(hurryCountdownSeconds(match.players[0])).toBe(4);

    // Advance remaining 4.1 seconds -> auto-fires!
    match = tickShotTimers(match, 4_100, () => 0.25);
    expect(match.players[0].flying).not.toBeNull();
    expect(match.players[1]?.flying).not.toBeNull();
  });

  it('awards the round to the opponent on danger-line KO, to the clearer on board clear, and supports 15 anchored classic stages', () => {
    expect(TOTAL_STAGES).toBe(15);
    expect(STAGE_CATALOG).toHaveLength(15);
    expect(stageTitle(0)).toBe('Random Wave');
    expect(stageTitle(1)).toBe('Paired Blocks');
    expect(stageTitle(15)).toBe("Emperor's Citadel");

    const titles = new Set<string>();
    for (let s = 1; s <= TOTAL_STAGES; s += 1) {
      titles.add(stageTitle(s));
      const grid = createStageGrid(s, () => 0);
      const occupied = grid.flat().filter((c) => c !== null);
      expect(occupied.length, `Stage ${s} (${stageTitle(s)}) should have bubbles`).toBeGreaterThanOrEqual(8);
      expect(
        findFloatingBubbles(grid),
        `Stage ${s} (${stageTitle(s)}) must have zero unanchored bubbles at spawn`,
      ).toEqual([]);
    }
    expect(titles.size).toBe(15);

    let match = createMatch('2p', () => 0.2);
    const koGrid = createEmptyGrid();
    koGrid[0][0] = 'ruby';
    koGrid[DANGER_ROW - 1][0] = 'amber';
    match.players[0].grid = koGrid;
    match.players[0].ceilingDrop = 1;

    match = settleBubbleAt(match, 0, 0, 2, 'emerald', () => 0.2);
    expect(match.status).toBe('round_over');
    expect(match.winner).toBe(1);
    expect(match.wins).toEqual([0, 1]);

    let clearMatch = createMatch('2p', () => 0.2, match.wins);
    const nearlyClear = createEmptyGrid();
    nearlyClear[0][1] = 'coral';
    nearlyClear[0][2] = 'coral';
    clearMatch.players[0].grid = nearlyClear;

    clearMatch = settleBubbleAt(clearMatch, 0, 0, 3, 'coral', () => 0.2);
    expect(clearMatch.status).toBe('round_over');
    expect(clearMatch.winner).toBe(0);
    expect(clearMatch.wins).toEqual([1, 1]);

    // 1P solo mode also ends on the Win screen (status: 'round_over', winner: 0) rather than jumping straight to the next stage (#270).
    let soloClearMatch = createMatch('1p', () => 0.2);
    const soloNearlyClear = createEmptyGrid();
    soloNearlyClear[0][1] = 'ruby';
    soloNearlyClear[0][2] = 'ruby';
    soloClearMatch.players[0].grid = soloNearlyClear;
    soloClearMatch = settleBubbleAt(soloClearMatch, 0, 0, 3, 'ruby', () => 0.2);
    expect(soloClearMatch.status).toBe('round_over');
    expect(soloClearMatch.winner).toBe(0);
    expect(soloClearMatch.players[0].status).toBe('won');
    expect(soloClearMatch.wins).toEqual([1, 0]);
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

  it('provides cute character options (dragon, cat, dog, bunny) and derives normal, cheer, hurry, celebrate, and cry mascot moods', () => {
    expect(CHARACTER_OPTIONS.map((c) => c.id)).toEqual(['dragon', 'cat', 'dog', 'bunny']);
    expect(characterDisplayName('dragon', 1)).toBe('Bub');
    expect(characterDisplayName('dragon', 2)).toBe('Bob');
    expect(characterDisplayName('cat', 1)).toBe('Mochi');
    expect(characterDisplayName('dog', 2)).toBe('Koro');
    expect(characterDisplayName('bunny', 1)).toBe('Usagi');

    let match = createMatch('2p', () => 0.2);
    expect(deriveMascotMood(match.players[0])).toBe('normal');

    // Hurry countdown -> 'hurry'
    const hurryMatch = tickShotTimers(match, 6_000, () => 0.2);
    expect(deriveMascotMood(hurryMatch.players[0])).toBe('hurry');

    // Popping 3+ bubbles -> 'cheer'
    const popGrid = createEmptyGrid();
    popGrid[0][0] = 'ruby';
    popGrid[0][1] = 'ruby';
    popGrid[0][6] = 'azure';
    match.players[0].grid = popGrid;
    match = settleBubbleAt(match, 0, 0, 2, 'ruby', () => 0.2);
    expect(deriveMascotMood(match.players[0])).toBe('cheer');

    // Round outcome -> winner celebrates ('celebrate') and loser cries ('cry'), overriding prior cheer
    const p1Win = resolveMatchOutcome(match, 0);
    expect(p1Win.status).toBe('round_over');
    expect(p1Win.winner).toBe(0);
    expect(deriveMascotMood(p1Win.players[0])).toBe('celebrate');
    expect(deriveMascotMood(p1Win.players[1]!)).toBe('cry');

    const p2Win = resolveMatchOutcome(match, 1);
    expect(p2Win.winner).toBe(1);
    expect(deriveMascotMood(p2Win.players[0])).toBe('cry');
    expect(deriveMascotMood(p2Win.players[1]!)).toBe('celebrate');
  });
});
