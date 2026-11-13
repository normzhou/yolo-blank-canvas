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
    const sb = makeSampleEntry('starlight-burst', '2.0.0', 'export default function SB() {}');
    const valid = validateGameManifest({
      schemaVersion: 1,
      games: { 'starlight-burst': sb },
    });
    expect(valid?.games['starlight-burst']?.hash).toBe(sb.hash);

    expect(
      validateGameManifest({
        schemaVersion: 1,
        games: {
          'starlight-burst': { ...sb, entry: 'https://evil.example/starlight-burst-a1b2.js' },
        },
      }),
    ).toBeNull();

    expect(
      validateGameManifest({
        schemaVersion: 1,
        games: {
          'starlight-burst': { ...sb, entry: '/games/prism-stack-a1b2.js', chunks: ['/games/prism-stack-a1b2.js'] },
        },
      }),
    ).toBeNull();

    expect(
      validateGameManifest({
        schemaVersion: 1,
        games: {
          'starlight-burst': { ...sb, hash: 'not-a-sha256' },
        },
      }),
    ).toBeNull();
  });

  it('emits dist/client/games/manifest.json matching real SHA-256 digests and keeps game bundles out of the Home shell', () => {
    const manifestPath = path.join(DIST_CLIENT, 'games', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const parsed = validateGameManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
    expect(parsed).not.toBeNull();

    for (const id of ['starlight-burst', 'prism-stack']) {
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
    expect(indexHtml).not.toContain('/games/starlight-burst-');
    expect(indexHtml).not.toContain('/games/prism-stack-');

    const assetsDir = path.join(DIST_CLIENT, 'assets');
    const shellBundleName = fs
      .readdirSync(assetsDir)
      .find((name) => name.startsWith('index-') && name.endsWith('.js'));
    expect(shellBundleName).toBeDefined();
    const shellCode = fs.readFileSync(path.join(assetsDir, shellBundleName!), 'utf8');
    expect(shellCode).not.toContain(parsed!.games['starlight-burst']!.entry);
    expect(shellCode).not.toContain(parsed!.games['prism-stack']!.entry);
    expect(shellCode).not.toContain(path.basename(parsed!.games['starlight-burst']!.entry));
    expect(shellCode).not.toContain(path.basename(parsed!.games['prism-stack']!.entry));
  });
});

describe('hash-verified local CacheStorage bundle manager (#306)', () => {
  it('downloads and SHA-256-verifies on cold miss, hits local cache with zero fetches when hash matches, and evicts only the updated game on version bump', async () => {
    const { cachesImpl, getBucket } = createMemoryCacheStorage();
    const storageImpl = createMemoryStorage();

    const sbV1Code = 'export default function StarlightBurstV1() {}';
    const sbV2Code = 'export default function StarlightBurstV2Updated() {}';
    const prismCode = 'export default function PrismStackV1() {}';

    const sbV1 = makeSampleEntry('starlight-burst', '2.0.0', sbV1Code, 'v1hash');
    const sbV2 = makeSampleEntry('starlight-burst', '2.1.0', sbV2Code, 'v2hash');
    const prismV1 = makeSampleEntry('prism-stack', '2.0.0', prismCode, 'phash1');

    const payloads: Record<string, string> = {
      '/assets/vendor-react-shared.js': 'export const React = {};',
      [sbV1.entry]: sbV1Code,
      [sbV2.entry]: sbV2Code,
      [prismV1.entry]: prismCode,
    };

    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!(url in payloads)) return new Response('Not found', { status: 404 });
      return new Response(payloads[url], { status: 200 });
    });

    const resSb1 = await ensureGameBundleCached(sbV1, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resSb1.fromCache).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const resPrism = await ensureGameBundleCached(prismV1, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resPrism.fromCache).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    fetchSpy.mockClear();
    const resSbHit = await ensureGameBundleCached(sbV1, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resSbHit.fromCache).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    expect(await isGameCachedInStorage(sbV2, cachesImpl, storageImpl)).toBe(false);
    const resSb2 = await ensureGameBundleCached(sbV2, {
      fetchImpl: fetchSpy as unknown as typeof fetch,
      cachesImpl,
      storageImpl,
    });
    expect(resSb2.fromCache).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(sbV2.entry, { credentials: 'same-origin' });

    const bucket = getBucket(GAME_BUNDLE_CACHE_NAME);
    expect(bucket.has(sbV1.entry)).toBe(false);
    expect(bucket.has(sbV2.entry)).toBe(true);
    expect(bucket.has(prismV1.entry)).toBe(true);
    expect(readBundleIndex(storageImpl)['starlight-burst']?.version).toBe('2.1.0');
    expect(readBundleIndex(storageImpl)['prism-stack']?.hash).toBe(prismV1.hash);
  });

  it('rejects tampered bundle payloads on SHA-256 mismatch without poisoning CacheStorage', async () => {
    const { cachesImpl, getBucket } = createMemoryCacheStorage();
    const storageImpl = createMemoryStorage();
    const sb = makeSampleEntry('starlight-burst', '2.0.0', 'export default function Genuine() {}', 'clean');

    const tamperedFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/assets/vendor-react-shared.js') return new Response('export const R = 1;', { status: 200 });
      return new Response('export default function TamperedPayload() {}', { status: 200 });
    });

    await expect(
      ensureGameBundleCached(sb, {
        fetchImpl: tamperedFetch as unknown as typeof fetch,
        cachesImpl,
        storageImpl,
      }),
    ).rejects.toThrow(/Integrity check failed/);

    expect(getBucket(GAME_BUNDLE_CACHE_NAME).has(sb.entry)).toBe(false);
    expect(readBundleIndex(storageImpl)['starlight-burst']).toBeUndefined();
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

      const sbEntry = manifestJson.games['starlight-burst']!.entry;
      const chunkRes = await fetch(`${base}${sbEntry}`);
      expect(chunkRes.status).toBe(200);
      expect(chunkRes.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

      const missingRes = await fetch(`${base}/games/does-not-exist-1234.js`);
      expect(missingRes.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
