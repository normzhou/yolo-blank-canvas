import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANVAS_APPS, canvasAppById } from '../src/client/apps/registry';

const APP_ID = /^[a-z][a-z0-9-]*$/;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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

  it('keeps the static Cloudflare Worker config and local shared-identity preview aligned (#199)', () => {
    const wrangler = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'hosting', 'cloudflare', 'wrangler.json'), 'utf8'),
    );
    expect(wrangler.name).toBe('yolo-demo-app');
    expect(wrangler.assets?.directory).toBe('../../dist/client');
    expect(wrangler.assets?.run_worker_first).toBe(true);
    expect(wrangler.vars?.PUBLIC_ORIGIN).toBe('https://demo.yolo-dev.ai');
    expect(wrangler.vars?.BACKEND_ORIGIN).toBe('');
    expect(wrangler.vars?.APP_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(wrangler.vars?.APP_VERSION).not.toBe('development');

    const identityWrangler = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'hosting', 'yolo-identity', 'wrangler.json'), 'utf8'),
    );
    expect(identityWrangler.vars?.CLIENT_IDENTITY_ENABLED).toBe('false');
  });
});
