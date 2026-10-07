import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BACKGROUNDS,
  nextBackgroundIndex,
} from '../src/shared/tetrisBackgrounds';

describe('tetris backgrounds', () => {
  it('offers several distinct scenes', () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(3);
    const ids = new Set<string>();
    for (const art of BACKGROUNDS) {
      expect(art.id.length).toBeGreaterThan(0);
      expect(art.title.length).toBeGreaterThan(0);
      expect(art.src).toMatch(/^tetris\/.+\.(png|jpg|gif|svg)$/);
      expect(ids.has(art.id)).toBe(false);
      ids.add(art.id);
    }
  });

  it('points at bundled image files that actually exist', () => {
    for (const art of BACKGROUNDS) {
      const file = path.resolve(__dirname, '../public', art.src);
      expect(fs.existsSync(file), `${art.src} should exist under public/`).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(1000);
    }
  });

  it('cycles scenes in order and wraps around', () => {
    expect(nextBackgroundIndex(0)).toBe(1);
    expect(nextBackgroundIndex(BACKGROUNDS.length - 1)).toBe(0);
  });
});
