/**
 * Pixel-art backdrops for the Tetris view.
 *
 * The art is generated locally from in-repo pixel data — no network fetch and no
 * third-party images — so the app stays offline and dependency-free. Each scene
 * is a fixed grid of palette keys (`.` is transparent), kept in `src/shared` so
 * the scenes can be validated without a browser. The backdrop is decoration:
 * it carries no game state and is never written to GitHub.
 */

export interface PixelArt {
  /** Stable identifier. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Grid width in pixels. */
  width: number;
  /** Grid height in pixels. */
  height: number;
  /** Palette key (single character) to CSS colour. */
  palette: Readonly<Record<string, string>>;
  /** One string per row, each `width` characters; `.` is transparent. */
  rows: ReadonlyArray<string>;
}

export const ART_WIDTH = 24;
export const ART_HEIGHT = 14;

/** A calm night sky with stars over a dark horizon. */
const NIGHT_SKY: PixelArt = {
  id: 'night-sky',
  title: 'Night sky',
  width: ART_WIDTH,
  height: ART_HEIGHT,
  palette: {
    '1': '#070b1e',
    '2': '#f6f8ff',
    '3': '#1b3a6b',
    '4': '#16324a',
    '5': '#1f4a38',
  },
  rows: [
    '111111111111111111111111',
    '111211111111111111111211',
    '111111111111131111111111',
    '111111111211111111111111',
    '111111111111111113111111',
    '111311111111111111111111',
    '111111111111112111111111',
    '111111111111111111111111',
    '333333333333333333333333',
    '444444444444444444444444',
    '444444444444444444444444',
    '555555555555555555555555',
    '555555555555555555555555',
    '555555555555555555555555',
  ],
};

/** A blocky city at night with a lit-window pattern. */
const CITY: PixelArt = {
  id: 'city',
  title: 'City',
  width: ART_WIDTH,
  height: ART_HEIGHT,
  palette: {
    '1': '#0a0a1e',
    '2': '#1c2b4a',
    '3': '#f2d24b',
    '4': '#2a2a3e',
    '5': '#3f4257',
  },
  rows: [
    '111111111111111111111111',
    '111111111111111111111111',
    '222211111122221111112222',
    '222212222122221222212222',
    '232212232132221223212322',
    '222212222122221222212222',
    '322212322122321232213222',
    '222212222122221222212222',
    '222212222122221222212222',
    '444444444444444444444444',
    '444444444444444444444444',
    '444444444444444444444444',
    '555555555555555555555555',
    '444444444444444444444444',
  ],
};

/** A moonlit snowy peak over dark ground. */
const MOUNTAIN: PixelArt = {
  id: 'mountain',
  title: 'Mountain',
  width: ART_WIDTH,
  height: ART_HEIGHT,
  palette: {
    '1': '#1b2a4a',
    '2': '#4a5f8a',
    '3': '#e8eef7',
    '4': '#24402e',
    '5': '#f6e7a8',
  },
  rows: [
    '111111111111111111111111',
    '111111111111111111151111',
    '111111111111111111111111',
    '111111111113311111111111',
    '111111111132231111111111',
    '111111111322223111111111',
    '111111113222222311111111',
    '111111132222222231111111',
    '111111322222222223111111',
    '111113222222222222311111',
    '112222222222222222222211',
    '222222222222222222222222',
    '444444444444444444444444',
    '444444444444444444444444',
  ],
};

/** A woven wall of the seven tetromino colours. */
const BLOCKS: PixelArt = {
  id: 'blocks',
  title: 'Blocks',
  width: ART_WIDTH,
  height: ART_HEIGHT,
  palette: {
    '1': '#0b1020',
    '2': '#4dd0e1',
    '3': '#5b8def',
    '4': '#f2a03d',
    '5': '#f6d743',
    '6': '#5fc27e',
    '7': '#b06bd8',
    '8': '#e0605f',
  },
  rows: [
    '111111111111111111111111',
    '111111111111111111111111',
    '223344556677223344556677',
    '776655443322776655443322',
    '223344556677223344556677',
    '776655443322776655443322',
    '223344556677223344556677',
    '776655443322776655443322',
    '223344556677223344556677',
    '776655443322776655443322',
    '223344556677223344556677',
    '776655443322776655443322',
    '111111111111111111111111',
    '111111111111111111111111',
  ],
};

/** The scenes, cycled in order each time the player clears four lines. */
export const BACKGROUNDS: ReadonlyArray<PixelArt> = [NIGHT_SKY, CITY, MOUNTAIN, BLOCKS];

/**
 * Flat, row-major list of CSS colours for one scene; `null` is transparent.
 * Pure, so the scenes can be checked without rendering.
 */
export function pixelCells(art: PixelArt): Array<string | null> {
  const cells: Array<string | null> = [];
  for (const row of art.rows) {
    for (const key of row) {
      cells.push(key === '.' ? null : art.palette[key] ?? null);
    }
  }
  return cells;
}

/** Index of the next scene, wrapping around the set. */
export function nextBackgroundIndex(index: number): number {
  return (index + 1) % BACKGROUNDS.length;
}
