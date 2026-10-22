/**
 * Puzzle Bobble (Bust-A-Move) arcade rules as pure functions (#181).
 *
 * Supports both 2-Player Versus (Player 1 on ASDF vs Player 2 on Arrow keys)
 * and 1-Player Solo. Like Tetris, all game state is local to the canvas view
 * and is never written to GitHub.
 */

export type BubbleColor = 'ruby' | 'amber' | 'emerald' | 'azure' | 'amethyst' | 'coral';
export type BubbleCell = BubbleColor | null;
export type BubbleGrid = BubbleCell[][];

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
export const AIM_STEP_DEG = 3;
export const BUBBLE_SPEED = 14;
export const CEILING_DROP_SHOTS = 8;

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

export interface ShotEvent {
  popped: GridCoord[];
  dropped: GridCoord[];
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
  ceilingDrop: number;
  incomingGarbage: number;
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
 * Generates an initial arcade puzzle wave in the top `INITIAL_ROWS` rows.
 * Pairs are occasionally grouped along a row while avoiding giant monochrome
 * blobs so the opening board is varied and requires real shots to clear.
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
    ceilingDrop: 0,
    incomingGarbage: 0,
    stage: 1,
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
  const first = createPlayerBoard(rng, sharedGrid);
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
  return Math.max(MIN_AIM_ANGLE, Math.min(MAX_AIM_ANGLE, Math.round(angle * 100) / 100));
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
 * Computes a 2-segment aiming sight line from the launcher, including up to one
 * wall bounce, so players can line up bank shots accurately.
 */
export function aimGuidePoints(
  aimAngle: number,
  ceilingDrop = 0,
): Array<{ x: number; y: number }> {
  const rad = (clampAimAngle(aimAngle) * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const topY = BUBBLE_RADIUS + ceilingDrop * ROW_STEP;
  const start = { x: LAUNCHER_X, y: LAUNCHER_Y };

  if (Math.abs(dx) < 1e-4) {
    return [start, { x: LAUNCHER_X, y: topY }];
  }

  const wallX = dx > 0 ? ARENA_WIDTH - BUBBLE_RADIUS : BUBBLE_RADIUS;
  const tWall = (wallX - start.x) / dx;
  const tTop = (topY - start.y) / dy;

  if (tTop <= tWall) {
    return [start, { x: start.x + dx * tTop, y: topY }];
  }

  const bouncePoint = { x: wallX, y: start.y + dy * tWall };
  const remainingY = Math.max(topY, bouncePoint.y - 90);
  const tAfter = (remainingY - bouncePoint.y) / dy;
  const endX = Math.max(
    BUBBLE_RADIUS,
    Math.min(ARENA_WIDTH - BUBBLE_RADIUS, bouncePoint.x - dx * tAfter),
  );
  return [start, bouncePoint, { x: endX, y: remainingY }];
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
  return replacePlayer(match, playerIndex, { ...player, flying });
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
 * Drops `count` incoming attack bubbles onto open frontier cells of `grid`.
 */
export function applyIncomingGarbage(
  grid: BubbleGrid,
  count: number,
  rng: () => number = Math.random,
): BubbleGrid {
  if (count <= 0) return grid;
  const next = cloneGrid(grid);
  const toPlace = Math.min(count, 6);

  for (let i = 0; i < toPlace; i += 1) {
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
    const color = BUBBLE_COLORS[Math.min(BUBBLE_COLORS.length - 1, Math.floor(rng() * BUBBLE_COLORS.length))];
    next[chosen.row][chosen.col] = color;
  }

  return next;
}

/**
 * Places a bubble at `(row, col)` and resolves matches, floating drops,
 * incoming garbage, ceiling drops, and win/KO state.
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
  let popped: GridCoord[] = [];
  let dropped: GridCoord[] = [];

  if (matched.length >= 3) {
    popped = matched;
    for (const cell of popped) {
      grid[cell.row][cell.col] = null;
    }
    dropped = findFloatingBubbles(grid);
    for (const cell of dropped) {
      grid[cell.row][cell.col] = null;
    }
  }

  const popScore = popped.length * 10;
  const dropScore = dropped.length > 0 ? dropped.length * 30 + Math.min(dropped.length, 8) * 20 : 0;
  const sentGarbage =
    match.mode === '2p' && (popped.length >= 4 || dropped.length > 0)
      ? Math.min(6, Math.max(0, popped.length - 3) + dropped.length)
      : 0;

  let incomingGarbage = player.incomingGarbage;
  if (popped.length === 0 && incomingGarbage > 0 && !isBoardEmpty(grid)) {
    grid = applyIncomingGarbage(grid, incomingGarbage, rng);
    incomingGarbage = 0;
  }

  const shotsFired = player.shotsFired + 1;
  let ceilingDrop =
    shotsFired % CEILING_DROP_SHOTS === 0 ? player.ceilingDrop + 1 : player.ceilingDrop;
  let score = player.score + popScore + dropScore;
  let stage = player.stage;
  let playerStatus: PlayerBoardState['status'] = 'playing';

  if (isBoardEmpty(grid)) {
    score += 500;
    if (match.mode === '2p') {
      playerStatus = 'won';
    } else {
      // 1-Player solo mode advances to a fresh stage on clear.
      stage += 1;
      ceilingDrop = 0;
      grid = createInitialGrid(rng);
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
    ceilingDrop,
    incomingGarbage,
    stage,
    status: playerStatus,
    lastEvent: { popped, dropped, sentGarbage },
  };

  let nextMatch = replacePlayer(match, playerIndex, updatedPlayer);

  // Deliver attack garbage to the opponent in 2P mode.
  if (match.mode === '2p' && sentGarbage > 0) {
    const opponentIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const opponent = nextMatch.players[opponentIndex];
    if (opponent && opponent.status === 'playing') {
      nextMatch = replacePlayer(nextMatch, opponentIndex, {
        ...opponent,
        incomingGarbage: Math.min(12, opponent.incomingGarbage + sentGarbage),
      });
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

  const hitThresholdSq = (BUBBLE_DIAMETER * 0.9) ** 2;
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
