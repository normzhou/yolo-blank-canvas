import { describe, expect, it } from 'vitest';
import {
  BACKGROUNDS,
  nextBackgroundIndex,
  pixelCells,
} from '../src/shared/tetrisBackgrounds';

describe('tetris backgrounds', () => {
  it('offers several distinct scenes', () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(3);
    const ids = new Set<string>();
    for (const art of BACKGROUNDS) {
      expect(art.id.length).toBeGreaterThan(0);
      expect(art.title.length).toBeGreaterThan(0);
      expect(ids.has(art.id)).toBe(false);
      ids.add(art.id);
    }
  });

  it('keeps every scene a non-empty rectangular grid with a complete palette', () => {
    for (const art of BACKGROUNDS) {
      expect(art.width).toBeGreaterThan(0);
      expect(art.height).toBeGreaterThan(0);
      expect(art.rows).toHaveLength(art.height);
      for (const row of art.rows) {
        expect(row).toHaveLength(art.width);
        for (const key of row) {
          if (key !== '.') expect(art.palette[key]).toBeTruthy();
        }
      }
    }
  });

  it('flattens a scene to one resolvable colour per cell', () => {
    for (const art of BACKGROUNDS) {
      const cells = pixelCells(art);
      expect(cells).toHaveLength(art.width * art.height);
      expect(cells.some((color) => color !== null)).toBe(true);
      for (const color of cells) {
        if (color !== null) expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('cycles scenes in order and wraps around', () => {
    expect(nextBackgroundIndex(0)).toBe(1);
    expect(nextBackgroundIndex(BACKGROUNDS.length - 1)).toBe(0);
  });
});
