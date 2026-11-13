import { describe, expect, it } from 'vitest';
import { MASCOT_RIGS, mascotPalette, solveTwoBoneIK } from '../src/games/starlight-burst/companions';
import {
  AIM_STEP_DEG,
  ARENA_WIDTH,
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
  STAR_RADIUS,
  TOTAL_STAGES,
  aimAngleFromBoardPoint,
  aimGuidePoints,
  aimPlayer,
  aimVelocityDegPerSec,
  characterDisplayName,
  colsForRow,
  createEmptyGrid,
  createMatch,
  createRandomMascotPair,
  createStageGrid,
  decomposeGarbageOrbs,
  deriveMascotAdvice,
  deriveMascotMood,
  findFloatingStars,
  fireAndResolvePlayer,
  firePlayerStar,
  formatAimAngle,
  hexNeighbors,
  hurryCountdownSeconds,
  pickRandomOtherMascot,
  resolveMatchOutcome,
  scoreForBurst,
  scoreForDroppedStars,
  scoreForStageClearBonus,
  setPlayerAimAngle,
  settleStarAt,
  shotsPerCeilingDrop,
  stageTitle,
  starCenter,
  stepMatch,
  tickShotTimers,
  type MascotSelection,
} from '../src/shared/starlightBurst';

describe('Starlight Burst celestial star-core rules (#352)', () => {
  it('lays out an 8/7 staggered hexagonal grid with exact 6-way neighbors', () => {
    expect(colsForRow(0)).toBe(EVEN_COLS);
    expect(colsForRow(1)).toBe(ODD_COLS);
    expect(starCenter(0, 0)).toEqual({ x: STAR_RADIUS, y: STAR_RADIUS });
    expect(starCenter(1, 0).x).toBe(STAR_RADIUS + STAR_RADIUS);

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

  it('starts a 2-player match with identical opening constellations and star-core queues for fairness', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 48271) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const match = createMatch('2p', rng);
    expect(match.players).toHaveLength(2);
    expect(match.players[0].grid).toEqual(match.players[1]?.grid);
    expect(match.players[0].currentStar).toBe(match.players[1]?.currentStar);
    expect(match.players[0].nextStar).toBe(match.players[1]?.nextStar);
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

    expect(aimVelocityDegPerSec(50)).toBe(38);
    expect(aimVelocityDegPerSec(350)).toBeGreaterThan(38);
    expect(aimVelocityDegPerSec(600)).toBe(115);

    const straight = aimGuidePoints(0);
    expect(straight).toHaveLength(2);
    expect(straight[0].x).toBe(straight[1].x);

    const banked = aimGuidePoints(60);
    expect(banked.length).toBeGreaterThanOrEqual(3);
    expect(banked[1].x).toBe(ARENA_WIDTH - STAR_RADIUS);

    expect(aimAngleFromBoardPoint(112, 120)).toBe(0);
    expect(aimAngleFromBoardPoint(112 + 100, 268 - 100)).toBe(45);
    expect(aimAngleFromBoardPoint(112 - 100, 268 - 100)).toBe(-45);
    expect(aimAngleFromBoardPoint(500, 268)).toBe(MAX_AIM_ANGLE);
    expect(aimAngleFromBoardPoint(-200, 268)).toBe(MIN_AIM_ANGLE);

    match = setPlayerAimAngle(match, 0, -22.5);
    expect(match.players[0].aimAngle).toBe(-22.5);
  });

  it('implements exponential cascade scoring (20 * 2^(n-1) capped at 1,310,720) and speed bonus', () => {
    expect(scoreForBurst(2)).toBe(0);
    expect(scoreForBurst(3)).toBe(30);
    expect(scoreForBurst(5)).toBe(50);

    expect(scoreForDroppedStars(0)).toBe(0);
    expect(scoreForDroppedStars(1)).toBe(20);
    expect(scoreForDroppedStars(2)).toBe(40);
    expect(scoreForDroppedStars(3)).toBe(80);
    expect(scoreForDroppedStars(4)).toBe(160);
    expect(scoreForDroppedStars(10)).toBe(10_240);
    expect(scoreForDroppedStars(16)).toBe(655_360);
    expect(scoreForDroppedStars(17)).toBe(MAX_DROP_SCORE);
    expect(scoreForDroppedStars(22)).toBe(1_310_720);

    expect(scoreForStageClearBonus(3_000)).toBe(50_000);
    expect(scoreForStageClearBonus(6_000)).toBe(49_160);
    expect(scoreForStageClearBonus(64_000)).toBe(440);
    expect(scoreForStageClearBonus(65_000)).toBe(0);
  });

  it('bounces flying star-cores off the side walls and snaps them onto the hex grid', () => {
    let match = createMatch('1p', () => 0.1);
    match.players[0].grid = createEmptyGrid();
    match = aimPlayer(match, 0, 65);
    match = firePlayerStar(match, 0);
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

  it('transfers 4+ burst bonuses and cascade clusters into opponent incomingQueue and launches them upward on non-clearing shots', () => {
    let match = createMatch('2p', () => 0.3);

    const quadGrid = createEmptyGrid();
    quadGrid[0][0] = 'ruby';
    quadGrid[0][1] = 'ruby';
    quadGrid[0][2] = 'ruby';
    quadGrid[0][3] = 'ruby';
    quadGrid[0][6] = 'azure';
    match.players[0].grid = quadGrid;

    match = settleStarAt(match, 0, 0, 4, 'ruby', () => 0.3);
    expect(match.players[0].lastEvent?.popped).toHaveLength(5);
    expect(match.players[0].lastEvent?.sentGarbage).toBe(2);
    expect(match.players[1]?.incomingGarbage).toBe(2);
    expect(match.players[1]?.incomingQueue).toHaveLength(2);

    const dropGrid = createEmptyGrid();
    dropGrid[0][2] = 'azure';
    dropGrid[0][3] = 'azure';
    dropGrid[1][2] = 'emerald';
    dropGrid[2][2] = 'amber';
    dropGrid[0][7] = 'coral';
    match.players[0].grid = dropGrid;

    match = settleStarAt(match, 0, 1, 1, 'azure', () => 0.3);
    expect(match.players[0].lastEvent?.popped).toHaveLength(3);
    expect(match.players[0].lastEvent?.dropped).toHaveLength(2);
    expect(match.players[0].lastEvent?.dropScore).toBe(40);
    expect(match.players[0].lastEvent?.sentGarbage).toBe(2);
    expect(match.players[1]?.incomingGarbage).toBe(4);
    expect(match.players[1]?.incomingQueue).toHaveLength(4);

    const p2Grid = createEmptyGrid();
    p2Grid[0][0] = 'ruby';
    match.players[1]!.grid = p2Grid;
    const queuedColors = [...match.players[1]!.incomingQueue];

    match = settleStarAt(match, 1, 0, 4, 'emerald', () => 0.3);
    expect(match.players[1]?.incomingGarbage).toBe(0);
    expect(match.players[1]?.incomingQueue).toEqual([]);
    expect(match.players[1]?.lastEvent?.risenGarbage).toHaveLength(4);
    expect(match.players[1]?.lastEvent?.risenGarbage.map((c) => c.color)).toEqual(queuedColors);

    expect(decomposeGarbageOrbs(7)).toEqual(['red', 'yellow', 'yellow']);
  });

  it('scales sky descent frequency by remaining colors and warns 1 shot before dropping', () => {
    const oneColorGrid = createEmptyGrid();
    oneColorGrid[0][0] = 'ruby';
    expect(shotsPerCeilingDrop(oneColorGrid)).toBe(4);

    let match = createMatch('2p', () => 0.4);
    match.players[0].grid = oneColorGrid;
    match.players[0].incomingGarbage = 3;
    match.players[0].shotsFired = CEILING_DROP_SHOTS - 1;
    match.players[0].shotsSinceDrop = 2;

    match = settleStarAt(match, 0, 0, 4, 'azure', () => 0.4);
    expect(match.players[0].incomingGarbage).toBe(0);
    expect(match.players[0].ceilingDrop).toBe(1);
    const occupiedCount = match.players[0].grid.flat().filter((cell) => cell !== null).length;
    expect(occupiedCount).toBe(2 + 3);
  });

  it('counts down the 10-second shot timer, surfaces HURRY UP! at <= 5s, and auto-launches at 0s', () => {
    let match = createMatch('2p', () => 0.25);
    expect(match.players[0].shotTimerMs).toBe(SHOT_TIME_LIMIT_MS);
    expect(hurryCountdownSeconds(match.players[0])).toBeNull();

    match = tickShotTimers(match, 6_000, () => 0.25);
    expect(hurryCountdownSeconds(match.players[0])).toBe(4);

    match = tickShotTimers(match, 4_100, () => 0.25);
    expect(match.players[0].flying).not.toBeNull();
    expect(match.players[1]?.flying).not.toBeNull();
  });

  it('awards the round to the opponent on danger-line KO, to the clearer on sky clear, and supports 15 constellations', () => {
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
      expect(occupied.length).toBeGreaterThanOrEqual(8);
      expect(findFloatingStars(grid)).toEqual([]);
    }
    expect(titles.size).toBe(15);

    let match = createMatch('2p', () => 0.2);
    const koGrid = createEmptyGrid();
    koGrid[0][0] = 'ruby';
    koGrid[DANGER_ROW - 1][0] = 'amber';
    match.players[0].grid = koGrid;
    match.players[0].ceilingDrop = 1;

    match = settleStarAt(match, 0, 0, 2, 'emerald', () => 0.2);
    expect(match.status).toBe('round_over');
    expect(match.winner).toBe(1);
    expect(match.wins).toEqual([0, 1]);

    let clearMatch = createMatch('2p', () => 0.2, match.wins);
    const nearlyClear = createEmptyGrid();
    nearlyClear[0][1] = 'coral';
    nearlyClear[0][2] = 'coral';
    clearMatch.players[0].grid = nearlyClear;

    clearMatch = settleStarAt(clearMatch, 0, 0, 3, 'coral', () => 0.2);
    expect(clearMatch.status).toBe('round_over');
    expect(clearMatch.winner).toBe(0);
    expect(clearMatch.wins).toEqual([1, 1]);
  });

  it('provides non-reptilian boy & girl companions (Fox Ren/Kiko, Cat Yuzu/Mochi, Dog Koro/Hana, Bunny Poko/Momo) and derives moods (#347, #352)', () => {
    expect(CHARACTER_OPTIONS.map((c) => c.id)).toEqual(['fox', 'cat', 'dog', 'bunny']);
    expect(characterDisplayName('fox', 'boy')).toBe('Ren');
    expect(characterDisplayName('fox', 'girl')).toBe('Kiko');
    expect(characterDisplayName('cat', 'boy')).toBe('Yuzu');
    expect(characterDisplayName('cat', 'girl')).toBe('Mochi');
    expect(characterDisplayName('dog', 'boy')).toBe('Koro');
    expect(characterDisplayName('dog', 'girl')).toBe('Hana');
    expect(characterDisplayName('bunny', 'boy')).toBe('Poko');
    expect(characterDisplayName('bunny', 'girl')).toBe('Momo');

    let match = createMatch('2p', () => 0.2);
    expect(deriveMascotMood(match.players[0])).toBe('normal');

    const hurryMatch = tickShotTimers(match, 6_000, () => 0.2);
    expect(deriveMascotMood(hurryMatch.players[0])).toBe('hurry');

    const popGrid = createEmptyGrid();
    popGrid[0][0] = 'ruby';
    popGrid[0][1] = 'ruby';
    popGrid[0][6] = 'azure';
    match.players[0].grid = popGrid;
    match = settleStarAt(match, 0, 0, 2, 'ruby', () => 0.2);
    expect(deriveMascotMood(match.players[0])).toBe('cheer');

    const p1Win = resolveMatchOutcome(match, 0);
    expect(deriveMascotMood(p1Win.players[0])).toBe('celebrate');
    expect(deriveMascotMood(p1Win.players[1]!)).toBe('cry');
  });

  it('derives real-time companion tactical dialogue across Fox, Cat, Dog, and Bunny (#299, #352)', () => {
    let match = createMatch('2p', () => 0.2);
    const grid = createEmptyGrid();
    grid[0][1] = 'azure';
    grid[1][1] = 'azure';
    grid[2][1] = 'ruby';
    grid[2][2] = 'ruby';
    match.players[0] = {
      ...match.players[0],
      grid,
      currentStar: 'ruby',
      nextStar: 'emerald',
      aimAngle: 20,
    };

    const tiltLeft = deriveMascotAdvice(match.players[0], 'fox');
    expect(tiltLeft.kind).toBe('tip');
    expect(tiltLeft.bubbleText).toContain('YIP! TILT LEFT FOR RUBY');
    expect(deriveMascotAdvice(match.players[0], 'cat').bubbleText).toContain('MEOW! PAW LEFT FOR RUBY');
    expect(deriveMascotAdvice(match.players[0], 'dog').bubbleText).toContain('WOOF! FETCH RUBY LEFT');
    expect(deriveMascotAdvice(match.players[0], 'bunny').bubbleText).toContain('HOP LEFT FOR RUBY, BUN');

    const center = starCenter(2, 1, 0);
    const lockedAngle = aimAngleFromBoardPoint(center.x, center.y);
    match = setPlayerAimAngle(match, 0, lockedAngle);
    const locked = deriveMascotAdvice(match.players[0], 'fox');
    expect(locked.kind).toBe('match');
    expect(locked.bubbleText).toContain('FOXY! LOCKED ON RUBY! LAUNCH!');
  });

  it('defines boy/girl companion rigs, initializes a random 1-girl + 1-boy duo, excludes both sides when switching, and solves 2-bone arm IK (#347, #349, #352)', () => {
    for (const id of ['fox', 'cat', 'dog', 'bunny'] as const) {
      expect(MASCOT_RIGS[id].id).toBe(id);
      const boy = mascotPalette(id, 'boy');
      const girl = mascotPalette(id, 'girl');
      expect(boy.body).toMatch(/^var\(--/);
      expect(girl.body).toMatch(/^var\(--/);
      expect(boy.badgeBg).toMatch(/^var\(--/);
      expect(girl.badgeBg).toMatch(/^var\(--/);
      expect(boy.body).not.toBe(girl.body);
    }

    let s = 17;
    const nextRng = () => {
      s = (s * 48271) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < 40; i++) {
      const [m1, m2] = createRandomMascotPair(nextRng);
      expect(m1.character).not.toBe(m2.character);
      expect([m1.gender, m2.gender].sort()).toEqual(['boy', 'girl']);
    }

    let p1: MascotSelection = { character: 'fox', gender: 'boy' };
    let p2: MascotSelection = { character: 'cat', gender: 'girl' };
    for (let i = 0; i < 40; i++) {
      const nextP1 = pickRandomOtherMascot(p1, p2.character, nextRng);
      expect(nextP1.character).not.toBe(p1.character);
      expect(nextP1.character).not.toBe(p2.character);
      p1 = nextP1;
    }

    for (let deg = -75; deg <= 75; deg += 5) {
      const rad = (-deg * 18 * Math.PI) / 180;
      const pinX = -17 + Math.cos(rad) * 5.2;
      const pinY = Math.sin(rad) * 5.2;
      const ik = solveTwoBoneIK(-4.2, -1.2, pinX, pinY, 9.6, 9.8, -1);
      expect(Number.isFinite(ik.elbowX)).toBe(true);
      expect(Number.isFinite(ik.elbowY)).toBe(true);
      expect(ik.handX).toBeCloseTo(pinX, 1);
      expect(ik.handY).toBeCloseTo(pinY, 1);
    }

    let live = createMatch('2p', () => 0.25);
    live = fireAndResolvePlayer(live, 0, () => 0.25);
    expect(live.players[0].shotsFired).toBe(1);
  });
});
