import { describe, expect, it } from 'vitest';
import { CANVAS_APPS, canvasAppById } from '../src/client/apps/registry';

const APP_ID = /^[a-z][a-z0-9-]*$/;

describe('canvas app registry', () => {
  it('has unique, route-safe ids and non-empty labels', () => {
    const ids = new Set<string>();
    for (const app of CANVAS_APPS) {
      expect(app.id).toMatch(APP_ID);
      expect(ids.has(app.id), app.id).toBe(false);
      ids.add(app.id);
      expect(app.title.trim()).not.toBe('');
      expect(app.summary.trim()).not.toBe('');
      expect(typeof app.element).toBe('function');
    }
  });

  it('resolves a known app and refuses everything else', () => {
    expect(canvasAppById('tetris')?.title).toBe('Tetris');
    expect(canvasAppById('puzzle-bobble')?.title).toBe('Puzzle Bobble');
    expect(canvasAppById('unknown')).toBeNull();
    expect(canvasAppById(null)).toBeNull();
    expect(canvasAppById(undefined)).toBeNull();
    expect(canvasAppById('')).toBeNull();
  });

  it('starts with Tetris as the first canvas app and includes Puzzle Bobble', () => {
    expect(CANVAS_APPS[0]?.id).toBe('tetris');
    expect(CANVAS_APPS.map((app) => app.id)).toEqual(['tetris', 'puzzle-bobble']);
  });
});
