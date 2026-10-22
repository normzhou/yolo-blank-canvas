import { describe, expect, it } from 'vitest';
import { readRoute, routeTarget, routeUrl } from '../src/client/route';

describe('route parsing and formatting', () => {
  it('parses resting, list, composer, detail, and composed canvas-app routes', () => {
    expect(readRoute('')).toEqual({ open: false, target: { name: 'list' }, app: null });
    expect(readRoute('?other=1')).toEqual({ open: false, target: { name: 'list' }, app: null });
    expect(readRoute('?panel')).toEqual({ open: true, target: { name: 'list' }, app: null });
    expect(readRoute('?panel=new')).toEqual({ open: true, target: { name: 'new' }, app: null });
    expect(readRoute('?panel=123')).toEqual({ open: true, target: { name: 'detail', number: 123 }, app: null });
    expect(readRoute('?app=tetris')).toEqual({ open: false, target: { name: 'list' }, app: 'tetris' });
    expect(readRoute('?app=tetris&panel=7')).toEqual({
      open: true,
      target: { name: 'detail', number: 7 },
      app: 'tetris',
    });
    expect(readRoute('?panel=new&app=tetris')).toEqual({
      open: true,
      target: { name: 'new' },
      app: 'tetris',
    });
  });

  it('rejects invalid app tokens and falls back to the open list on malformed panel values', () => {
    for (const search of ['?app=', '?app=Tetris', '?app=../tetris', '?app=1tetris', '?app=tetris/x']) {
      expect(readRoute(search).app, search).toBeNull();
    }
    for (const search of ['?panel=', '?panel=abc', '?panel=0', '?panel=-1', '?panel=1.5', '?panel=007']) {
      expect(readRoute(search), search).toEqual({ open: true, target: { name: 'list' }, app: null });
    }
    expect(readRoute('?panel=new').target).not.toEqual({ name: 'detail', number: NaN });
  });

  it('formats clean URLs and round-trips every location it produces', () => {
    expect(routeUrl(null)).toBe('/');
    expect(routeUrl(null, '/app/')).toBe('/app/');
    expect(routeUrl({ name: 'detail', number: 42 })).toBe('/?panel=42');
    expect(routeUrl({ name: 'new' })).toBe('/?panel=new');
    expect(routeUrl({ name: 'list' })).toBe('/?panel');
    expect(routeUrl(null, '/', 'tetris')).toBe('/?app=tetris');
    expect(routeUrl({ name: 'detail', number: 42 }, '/', 'tetris')).toBe('/?app=tetris&panel=42');
    expect(routeUrl({ name: 'list' }, '/', 'tetris')).toBe('/?app=tetris&panel');
    expect(routeUrl(null, '/', '')).toBe('/');
    expect(routeUrl({ name: 'list' }, '/', '')).toBe('/?panel');

    const targets = [{ name: 'list' } as const, { name: 'new' } as const, { name: 'detail', number: 7 } as const];
    for (const app of [null, 'tetris'] as const) {
      for (const target of targets) {
        const url = routeUrl(target, '/', app);
        const query = url.slice(url.indexOf('?'));
        expect(readRoute(query), url).toEqual({ open: true, target, app });
      }
    }
  });

  it('derives routeTarget across closed, open, and app-backed routes', () => {
    expect(routeTarget(readRoute(''))).toBeNull();
    expect(routeTarget(readRoute('?panel=9'))).toEqual({ name: 'detail', number: 9 });
    expect(routeTarget(readRoute('?app=tetris'))).toBeNull();
    expect(routeTarget(readRoute('?app=tetris&panel=new'))).toEqual({ name: 'new' });
  });
});
