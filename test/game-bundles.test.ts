import crypto from 'node:crypto';
import fs from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import {
  ensureGameBundleCached,
  GAME_BUNDLE_CACHE_NAME,
  isGameCachedInStorage,
  readBundleIndex,
  sha256Hex,
  validateGameManifest,
} from '../src/client/gameBundles';
import type { GameManifestEntry } from '../src/games/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_CLIENT = path.join(ROOT, 'dist', 'client');

function createMemoryCacheStorage() {
  const buckets = new Map<string, Map<string, Response>>();
  const cachesImpl = {
    async open(name: string) {
      let bucket = buckets.get(name);
      if (!bucket) {
        bucket = new Map();
        buckets.set(name, bucket);
      }
      return {
        async match(req: RequestInfo | URL) {
          const key = typeof req === 'string' ? req : req instanceof URL ? req.pathname : new URL(req.url).pathname;
          const stored = bucket!.get(key);
          return stored ? stored.clone() : undefined;
        },
        async put(req: RequestInfo | URL, res: Response) {
          const key = typeof req === 'string' ? req : req instanceof URL ? req.pathname : new URL(req.url).pathname;
          bucket!.set(key, res.clone());
        },
        async keys() {
          return [...bucket!.keys()].map((k) => new Request(`https://demo.yolo-dev.ai${k}`));
        },
        async delete(req: RequestInfo | URL) {
          const key = typeof req === 'string' ? req : req instanceof URL ? req.pathname : new URL(req.url).pathname;
          return bucket!.delete(key);
        },
      } as unknown as Cache;
    },
  } as unknown as CacheStorage;
  return { cachesImpl, getBucket: (name: string) => buckets.get(name) ?? new Map<string, Response>() };
}

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function makeSampleEntry(id: string, version: string, code: string, hashSuffix = 'a1b2'): GameManifestEntry {
  const bytes = Buffer.from(code, 'utf8');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const entry = `/games/${id}-${hashSuffix}.js`;
  return {
    id,
    packageName: `@yolo-arcade/game-${id}`,
    version,
    hash,
    entry,
    chunks: ['/assets/vendor-react-shared.js', entry],
    sizeBytes: bytes.byteLength,
  };
}

describe('per-game manifest validation and built bundle isolation (#306)', () => {
  it('validates canonical game manifests and rejects unsafe paths or invalid hashes', () => {
    const pb = makeSampleEntry('puzzle-bobble', '1.0.0', 'export default function PB() {}');
    const valid = validateGameManifest({
      schemaVersion: 1,
      games: { 'puzzle-bobble': pb },
    });
    expect(valid?.games['puzzle-bobble']?.hash).toBe(pb.hash);

    expect(
      validateGameManifest({
        schemaVersion: 1,
        games: {
          'puzzle-bobble': { ...pb, entry: 'https://evil.example/puzzle-bobble-a1b2.js' },
        },
      }),
    ).toBeNull();

    expect(
      validateGameManifest({
        schemaVersion: 1,
        games: {
          'puzzle-bobble': { ...pb, entry: '/games/tetris-a1b2.js', chunks: ['/games/tetris-a1b2.js'] },
        },
      }),
    ).toBeNull();

    expect(
      validateGameManifest({
        schemaVersion: 1,
        games: {
          'puzzle-bobble': { ...pb, hash: 'not-a-sha256' },
        },
      }),
    ).toBeNull();
  });

  it('emits dist/client/games/manifest.json matching real SHA-256 digests and keeps game bundles out of the Home shell', () => {
    const manifestPath = path.join(DIST_CLIENT, 'games', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const parsed = validateGameManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
    expect(parsed).not.toBeNull();

    for (const id of ['puzzle-bobble', 'tetris']) {
      const entry = parsed!.games[id];
      expect(entry, `missing ${id} in manifest`).toBeDefined();
      const entryDiskPath = path.join(DIST_CLIENT, entry!.entry.slice(1));
      expect(fs.existsSync(entryDiskPath)).toBe(true);
      const bytes = fs.readFileSync(entryDiskPath);
      const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
      expect(actualHash).toBe(entry!.hash);
      expect(bytes.byteLength).toBe(entry!.sizeBytes);
      for (const chunk of entry!.chunks) {
        expect(fs.existsSync(path.join(DIST_CLIENT, chunk.slice(1))), `missing chunk ${chunk}`).toBe(true);
      }
    }

    // Home index.html and shell index-*.js must NOT statically reference or modulepreload game bundles.
    const indexHtml = fs.readFileSync(path.join(DIST_CLIENT, 'index.html'), 'utf8');
    expect(indexHtml).not.toContain('/games/puzzle-bobble-');
    expect(indexHtml).not.toContain('/games/tetris-');

    const assetsDir = path.join(DIST_CLIENT, 'assets');
    const shellBundleName = fs
      .readdirSync(assetsDir)
      .find((name) => name.startsWith('index-') && name.endsWith('.js'));
    expect(shellBundleName).toBeDefined();
    const shellCode = fs.readFileSync(path.join(assetsDir, shellBundleName!), 'utf8');
    expect(shellCode).not.toContain(parsed!.games['puzzle-bobble']!.entry);
    expect(shellCode).not.toContain(parsed!.games['tetris']!.entry);
    expect(shellCode).not.toContain(path.basename(parsed!.games['puzzle-bobble']!.entry));
    expect(shellCode).not.toContain(path.basename(parsed!.games['tetris']!.entry));
  });
});

describe('hash-verified local CacheStorage bundle manager (#306)', () => {
  it('downloads and SHA-256-verifies on cold miss, hits local cache with zero fetches when hash matches, and evicts only the updated game on version bump', async () => {
    const { cachesImpl, getBucket } = createMemoryCacheStorage();
    const storageImpl = createMemoryStorage();

    const pbV1Code = 'export default function PuzzleBobbleV1() {}';
    const pbV2Code = 'export default function PuzzleBobbleV2Updated() {}';
    const tetrisCode = 'export default function TetrisV1() {}';

    const pbV1 = makeSampleEntry('puzzle-bobble', '1.0.0', pbV1Code, 'v1hash');
    const pbV2 = makeSampleEntry('puzzle-bobble', '1.1.0', pbV2Code, 'v2hash');
    const tetrisV1 = makeSampleEntry('tetris', '1.0.0', tetrisCode, 'thash1');

    const payloads: Record<string, string> = {
      '/assets/vendor-react-shared.js': 'export const React = {};',
      [pbV1.entry]: pbV1Code,
      [pbV2.entry]: pbV2Code,
      [tetrisV1.entry]: tetrisCode,
    };

    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!(url in payloads)) return new Response('Not found', { status: 404 });
      return new Response(payloads[url], { status: 200 });
    });

    // 1. Cold load of Puzzle Bobble v1 + Tetris v1 caches both.
    const resPb1 = await ensureGameBundleCached(pbV1, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resPb1.fromCache).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // vendor-react + pbV1

    const resTetris = await ensureGameBundleCached(tetrisV1, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resTetris.fromCache).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(3); // vendor-react already cached, fetches only tetrisV1!

    // 2. Subsequent entry into Puzzle Bobble v1 with matching hash makes ZERO network calls.
    fetchSpy.mockClear();
    const resPbHit = await ensureGameBundleCached(pbV1, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resPbHit.fromCache).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    // 3. Puzzle Bobble updates to v1.1.0 (pbV2): fetches ONLY pbV2, evicts pbV1, keeps Tetris v1 cached!
    expect(await isGameCachedInStorage(pbV2, cachesImpl, storageImpl)).toBe(false);
    const resPb2 = await ensureGameBundleCached(pbV2, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resPb2.fromCache).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(pbV2.entry, { credentials: 'same-origin' });

    const bucket = getBucket(GAME_BUNDLE_CACHE_NAME);
    expect(bucket.has(pbV1.entry)).toBe(false);
    expect(bucket.has(pbV2.entry)).toBe(true);
    expect(bucket.has(tetrisV1.entry)).toBe(true);
    expect(readBundleIndex(storageImpl)['puzzle-bobble']?.version).toBe('1.1.0');
    expect(readBundleIndex(storageImpl)['tetris']?.hash).toBe(tetrisV1.hash);
  });

  it('rejects tampered bundle payloads on SHA-256 mismatch without poisoning CacheStorage', async () => {
    const { cachesImpl, getBucket } = createMemoryCacheStorage();
    const storageImpl = createMemoryStorage();
    const pb = makeSampleEntry('puzzle-bobble', '1.0.0', 'export default function Genuine() {}', 'clean');

    const tamperedFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/assets/vendor-react-shared.js') return new Response('export const R = 1;', { status: 200 });
      return new Response('export default function TamperedPayload() {}', { status: 200 });
    });

    await expect(
      ensureGameBundleCached(pb, {
        fetchImpl: tamperedFetch as unknown as typeof fetch,
        cachesImpl,
        storageImpl,
      }),
    ).rejects.toThrow(/Integrity check failed/);

    expect(getBucket(GAME_BUNDLE_CACHE_NAME).has(pb.entry)).toBe(false);
    expect(readBundleIndex(storageImpl)['puzzle-bobble']).toBeUndefined();
    const checkHex = await sha256Hex(new TextEncoder().encode('abc').buffer);
    expect(checkHex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('serves /games/manifest.json with no-cache, /games/*.js as immutable, 404s missing /games/*, and sets worker-src self', async () => {
    const target = { owner: 'normzhou', name: 'yolo-blank-canvas', slug: 'normzhou/yolo-blank-canvas' };
    const app = createApp({
      target,
      requestStore: {
        identity: () => ({
          provider: 'github',
          displayName: 'GitHub',
          repository: target.slug,
          visibility: 'repository',
        }),
        capabilities: () => ({ comments: true, labels: true, externalLinks: true }),
        requestsUrl: () => 'https://github.com/normzhou/yolo-blank-canvas/issues',
        requestUrl: (n: number) => `https://github.com/normzhou/yolo-blank-canvas/issues/${n}`,
        listRequests: async () => ({ items: [], hasMore: false }),
        getRequest: async () => null,
        listComments: async () => [],
        createRequest: async () => ({}),
        createComment: async () => ({}),
      },
      identity: async () => ({ login: 'normzhou' }),
      repoAccess: async () => ({ fullName: target.slug, hasIssues: true }),
    });

    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const base = `http://127.0.0.1:${port}`;

    try {
      const manifestRes = await fetch(`${base}/games/manifest.json`);
      expect(manifestRes.status).toBe(200);
      expect(manifestRes.headers.get('cache-control')).toBe('no-cache');
      expect(manifestRes.headers.get('content-security-policy')).toContain("worker-src 'self'");
      const manifestJson = (await manifestRes.json()) as {
        games: Record<string, { entry: string }>;
      };

      const pbEntry = manifestJson.games['puzzle-bobble']!.entry;
      const chunkRes = await fetch(`${base}${pbEntry}`);
      expect(chunkRes.status).toBe(200);
      expect(chunkRes.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

      const missingRes = await fetch(`${base}/games/does-not-exist-1234.js`);
      expect(missingRes.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
