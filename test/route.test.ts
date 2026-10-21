import { describe, expect, it } from 'vitest';
import { readRoute, routeTarget, routeUrl } from '../src/client/route';

describe('readRoute', () => {
  it('reads the resting state from an absent parameter', () => {
    expect(readRoute('')).toEqual({ open: false, target: { name: 'list' }, app: null });
    expect(readRoute('?other=1')).toEqual({ open: false, target: { name: 'list' }, app: null });
  });

  it('reads the open list from a bare parameter', () => {
    expect(readRoute('?panel')).toEqual({ open: true, target: { name: 'list' }, app: null });
  });

  it('reads the composer', () => {
    expect(readRoute('?panel=new')).toEqual({ open: true, target: { name: 'new' }, app: null });
  });

  it('reads a request by number', () => {
    expect(readRoute('?panel=123')).toEqual({ open: true, target: { name: 'detail', number: 123 }, app: null });
  });

  it('reads a canvas app', () => {
    expect(readRoute('?app=tetris')).toEqual({ open: false, target: { name: 'list' }, app: 'tetris' });
  });

  it('composes an app with the Requests overlay', () => {
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

  it('rejects an app token that is not a URL token', () => {
    for (const search of ['?app=', '?app=Tetris', '?app=../tetris', '?app=1tetris', '?app=tetris/x']) {
      expect(readRoute(search).app, search).toBeNull();
    }
  });

  it('falls back to the open list rather than the resting state on a malformed value', () => {
    // A mangled link should still show the workflow, not silently discard where
    // the sender meant to send you.
    for (const search of ['?panel=', '?panel=abc', '?panel=0', '?panel=-1', '?panel=1.5', '?panel=007']) {
      expect(readRoute(search), search).toEqual({ open: true, target: { name: 'list' }, app: null });
    }
  });

  it('does not treat a non-issue-number as a detail route', () => {
    // `?panel=new` is the composer, never issue NaN.
    expect(readRoute('?panel=new').target).not.toEqual({ name: 'detail', number: NaN });
  });

  it('round-trips every location it can produce', () => {
    const targets = [{ name: 'list' } as const, { name: 'new' } as const, { name: 'detail', number: 7 } as const];
    for (const app of [null, 'tetris'] as const) {
      for (const target of targets) {
        const url = routeUrl(target, '/', app);
        const query = url.slice(url.indexOf('?'));
        expect(readRoute(query), url).toEqual({ open: true, target, app });
      }
      const resting = routeUrl(null, '/', app);
      if (resting.includes('?')) {
        expect(readRoute(resting.slice(resting.indexOf('?'))), resting).toEqual({
          open: false,
          target: { name: 'list' },
          app,
        });
      }
    }
  });
});

describe('routeUrl', () => {
  it('names the resting state as the bare pathname', () => {
    expect(routeUrl(null)).toBe('/');
    expect(routeUrl(null, '/app/')).toBe('/app/');
  });

  it('keeps the request link short', () => {
    expect(routeUrl({ name: 'detail', number: 42 })).toBe('/?panel=42');
  });

  it('distinguishes the composer from a request', () => {
    expect(routeUrl({ name: 'new' })).toBe('/?panel=new');
    expect(routeUrl({ name: 'list' })).toBe('/?panel');
  });

  it('puts the canvas app before the overlay', () => {
    expect(routeUrl(null, '/', 'tetris')).toBe('/?app=tetris');
    expect(routeUrl({ name: 'detail', number: 42 }, '/', 'tetris')).toBe('/?app=tetris&panel=42');
    expect(routeUrl({ name: 'list' }, '/', 'tetris')).toBe('/?app=tetris&panel');
  });

  it('drops an empty app token rather than producing a dead link', () => {
    expect(routeUrl(null, '/', '')).toBe('/');
    expect(routeUrl({ name: 'list' }, '/', '')).toBe('/?panel');
  });
});

describe('routeTarget', () => {
  it('is the resting state when the route is closed', () => {
    expect(routeTarget(readRoute(''))).toBeNull();
  });

  it('is the target when the route is open', () => {
    expect(routeTarget(readRoute('?panel=9'))).toEqual({ name: 'detail', number: 9 });
  });

  it('still names the target when an app is underneath', () => {
    expect(routeTarget(readRoute('?app=tetris'))).toBeNull();
    expect(routeTarget(readRoute('?app=tetris&panel=new'))).toEqual({ name: 'new' });
  });
});
