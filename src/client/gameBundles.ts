import { createElement, useEffect, useState, type ComponentType } from 'react';
import type {
  CanvasAppProps,
  GameBundleManifest,
  GameEntryModule,
  GameManifestEntry,
  GamePackageDescriptor,
} from '../games/types';

export const GAME_BUNDLE_CACHE_NAME = 'yolo-arcade-games-v1';
export const GAME_BUNDLE_INDEX_KEY = 'yolo:game-bundle-index:v1';

const SAFE_ENTRY_PATH_RE = /^\/games\/[a-z][a-z0-9-]*-[A-Za-z0-9_-]+\.js$/;
const SAFE_CHUNK_PATH_RE = /^\/(?:games|assets)\/[A-Za-z0-9._-]+\.js$/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

export interface CachedGameRecord {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
  readonly entry: string;
  readonly chunks: readonly string[];
  readonly cachedAt: number;
}

export interface GameBundleGameStatus {
  readonly id: string;
  readonly version: string;
  readonly hash: string | null;
  readonly entry: string | null;
  readonly sizeBytes: number | null;
  readonly cached: boolean;
}

export interface GameBundleSnapshot {
  readonly manifestLoaded: boolean;
  readonly games: Readonly<Record<string, GameBundleGameStatus>>;
}

export interface BundleManagerDeps {
  fetchImpl?: typeof fetch;
  cachesImpl?: CacheStorage | null;
  storageImpl?: Pick<Storage, 'getItem' | 'setItem'> | null;
  importModule?: (entryPath: string) => Promise<GameEntryModule>;
}

export function isSafeGameEntryPath(entryPath: string, gameId: string): boolean {
  return SAFE_ENTRY_PATH_RE.test(entryPath) && entryPath.startsWith(`/games/${gameId}-`);
}

export function isSafeChunkPath(chunkPath: string): boolean {
  return SAFE_CHUNK_PATH_RE.test(chunkPath);
}

export function validateGameManifest(raw: unknown): GameBundleManifest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as { schemaVersion?: unknown; games?: unknown };
  if (candidate.schemaVersion !== 1 || !candidate.games || typeof candidate.games !== 'object') {
    return null;
  }
  const validatedGames: Record<string, GameManifestEntry> = {};
  for (const [id, item] of Object.entries(candidate.games as Record<string, unknown>)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    if (
      entry.id !== id ||
      typeof entry.packageName !== 'string' ||
      typeof entry.version !== 'string' ||
      typeof entry.hash !== 'string' ||
      !SHA256_HEX_RE.test(entry.hash) ||
      typeof entry.entry !== 'string' ||
      !isSafeGameEntryPath(entry.entry, id) ||
      !Array.isArray(entry.chunks) ||
      entry.chunks.length === 0 ||
      !entry.chunks.every((c) => typeof c === 'string' && isSafeChunkPath(c)) ||
      !entry.chunks.includes(entry.entry) ||
      typeof entry.sizeBytes !== 'number' ||
      !Number.isFinite(entry.sizeBytes) ||
      entry.sizeBytes < 0
    ) {
      return null;
    }
    validatedGames[id] = {
      id,
      packageName: entry.packageName,
      version: entry.version,
      hash: entry.hash.toLowerCase(),
      entry: entry.entry,
      chunks: [...(entry.chunks as string[])],
      sizeBytes: entry.sizeBytes,
    };
  }
  return { schemaVersion: 1, games: validatedGames };
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SHA-256 is required to verify game bundle integrity.');
  }
  const digest = await subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function readBundleIndex(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): Record<string, CachedGameRecord> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(GAME_BUNDLE_INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, CachedGameRecord> = {};
    for (const [id, rec] of Object.entries(parsed as Record<string, unknown>)) {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
      const r = rec as Record<string, unknown>;
      if (
        r.id === id &&
        typeof r.version === 'string' &&
        typeof r.hash === 'string' &&
        SHA256_HEX_RE.test(r.hash) &&
        typeof r.entry === 'string' &&
        isSafeGameEntryPath(r.entry, id) &&
        Array.isArray(r.chunks) &&
        r.chunks.every((c) => typeof c === 'string' && isSafeChunkPath(c))
      ) {
        out[id] = {
          id,
          version: r.version,
          hash: r.hash.toLowerCase(),
          entry: r.entry,
          chunks: [...(r.chunks as string[])],
          cachedAt: typeof r.cachedAt === 'number' ? r.cachedAt : 0,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeBundleIndex(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  index: Record<string, CachedGameRecord>,
): void {
  if (!storage) return;
  try {
    storage.setItem(GAME_BUNDLE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignore private-browsing quota limits; CacheStorage still serves verified chunks.
  }
}

export async function isGameCachedInStorage(
  entry: GameManifestEntry,
  cachesApi: CacheStorage | null | undefined,
  storage: Pick<Storage, 'getItem'> | null | undefined,
): Promise<boolean> {
  if (!cachesApi) return false;
  try {
    const recorded = readBundleIndex(storage)[entry.id];
    if (recorded && recorded.hash !== entry.hash) return false;
    const cache = await cachesApi.open(GAME_BUNDLE_CACHE_NAME);
    for (const chunkPath of entry.chunks) {
      const hit = await cache.match(chunkPath);
      if (!hit) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures every chunk needed by `entry` is present in `CacheStorage` with its
 * entry bundle verified against `entry.hash` (SHA-256), evicting only stale
 * prior `/games/<id>-*.js` bundles for this game so other cached games stay intact.
 */
export async function ensureGameBundleCached(
  entry: GameManifestEntry,
  deps: BundleManagerDeps = {},
): Promise<{ fromCache: boolean }> {
  const fetchFn = deps.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const cachesApi = deps.cachesImpl === undefined ? globalThis.caches ?? null : deps.cachesImpl;
  const storage =
    deps.storageImpl === undefined
      ? typeof window !== 'undefined'
        ? window.localStorage
        : null
      : deps.storageImpl;

  if (!cachesApi) {
    return { fromCache: false };
  }

  const alreadyCached = await isGameCachedInStorage(entry, cachesApi, storage);
  if (alreadyCached) {
    return { fromCache: true };
  }

  if (!fetchFn) {
    throw new Error(`Cannot download ${entry.id} bundle: fetch is unavailable.`);
  }

  const cache = await cachesApi.open(GAME_BUNDLE_CACHE_NAME);

  for (const chunkPath of entry.chunks) {
    if (!isSafeChunkPath(chunkPath)) {
      throw new Error(`Refusing unsafe game chunk path: ${chunkPath}`);
    }
    if (chunkPath !== entry.entry) {
      const existingChunk = await cache.match(chunkPath);
      if (existingChunk) continue;
    }

    const res = await fetchFn(chunkPath, { credentials: 'same-origin' });
    if (!res.ok) {
      throw new Error(`Failed to download game chunk ${chunkPath} (HTTP ${res.status})`);
    }
    const bytes = await res.arrayBuffer();
    if (chunkPath === entry.entry) {
      const actualHash = await sha256Hex(bytes);
      if (actualHash !== entry.hash) {
        throw new Error(
          `Integrity check failed for ${entry.id} (${entry.version}): expected SHA-256 ${entry.hash.slice(0, 12)}, got ${actualHash.slice(0, 12)}`,
        );
      }
    }
    await cache.put(
      chunkPath,
      new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'X-Yolo-Game-Version': entry.version,
          'X-Yolo-Game-Hash': entry.hash,
        },
      }),
    );
  }

  // Selective eviction: remove only outdated `/games/<id>-*.js` entries for THIS game.
  const keepSet = new Set(entry.chunks);
  const prefix = `/games/${entry.id}-`;
  const existingRequests = await cache.keys();
  for (const req of existingRequests) {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'https://local.invalid').pathname;
    } catch {
      pathname = req.url;
    }
    if (pathname.startsWith(prefix) && !keepSet.has(pathname)) {
      await cache.delete(req);
    }
  }

  const index = readBundleIndex(storage);
  index[entry.id] = {
    id: entry.id,
    version: entry.version,
    hash: entry.hash,
    entry: entry.entry,
    chunks: [...entry.chunks],
    cachedAt: Date.now(),
  };
  writeBundleIndex(storage, index);

  return { fromCache: false };
}

// --- Singleton client-side manifest & bundle state ---

let currentManifest: GameBundleManifest | null = null;
let manifestPromise: Promise<GameBundleManifest | null> | null = null;
let swRegistered = false;
const cachedFlags: Record<string, boolean> = {};
const loadedComponents = new Map<string, ComponentType<CanvasAppProps>>();
const inFlightLoads = new Map<string, Promise<ComponentType<CanvasAppProps>>>();
const listeners = new Set<() => void>();
const registeredDescriptors = new Map<string, GamePackageDescriptor>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

export function registerGameDescriptor(descriptor: GamePackageDescriptor): void {
  registeredDescriptors.set(descriptor.id, descriptor);
}

export function getGameBundleSnapshot(): GameBundleSnapshot {
  const storage = typeof window !== 'undefined' ? window.localStorage : null;
  const index = readBundleIndex(storage);
  const games: Record<string, GameBundleGameStatus> = {};
  for (const [id, desc] of registeredDescriptors) {
    const manifestEntry = currentManifest?.games[id];
    const indexEntry = index[id];
    const hash = manifestEntry?.hash ?? indexEntry?.hash ?? null;
    const isCached = Boolean(
      cachedFlags[id] || (hash && indexEntry && indexEntry.hash === hash && cachedFlags[id] !== false),
    );
    games[id] = {
      id,
      version: manifestEntry?.version ?? desc.version,
      hash,
      entry: manifestEntry?.entry ?? null,
      sizeBytes: manifestEntry?.sizeBytes ?? null,
      cached: isCached,
    };
  }
  return {
    manifestLoaded: currentManifest !== null,
    games,
  };
}

function exposeDebugHandle(): void {
  if (typeof window === 'undefined') return;
  (
    window as unknown as {
      __yoloGameBundles?: () => GameBundleSnapshot;
      __yoloRefreshGameManifest?: () => Promise<GameBundleManifest | null>;
    }
  ).__yoloGameBundles = getGameBundleSnapshot;
  (
    window as unknown as {
      __yoloRefreshGameManifest?: () => Promise<GameBundleManifest | null>;
    }
  ).__yoloRefreshGameManifest = () => refreshGameManifest();
}

function registerBundleServiceWorker(): void {
  if (swRegistered || typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Skip Vite HMR dev server where `/src/games/<id>/entry.tsx` modules are served unbundled.
  if (import.meta.env?.DEV) return;
  swRegistered = true;
  void navigator.serviceWorker.register('/game-cache-sw.js', { scope: '/' }).catch(() => {
    // Non-fatal: HTTP immutable cache + CacheStorage verification still function.
  });
}

export async function refreshGameManifest(
  deps: BundleManagerDeps = {},
): Promise<GameBundleManifest | null> {
  const fetchFn = deps.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const cachesApi = deps.cachesImpl === undefined ? globalThis.caches ?? null : deps.cachesImpl;
  const storage =
    deps.storageImpl === undefined
      ? typeof window !== 'undefined'
        ? window.localStorage
        : null
      : deps.storageImpl;

  if (!fetchFn) return currentManifest;

  let manifest: GameBundleManifest | null = null;
  try {
    const res = await fetchFn('/games/manifest.json', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (res.ok) {
      manifest = validateGameManifest(await res.json());
      if (manifest && cachesApi) {
        try {
          const cache = await cachesApi.open(GAME_BUNDLE_CACHE_NAME);
          await cache.put(
            '/games/manifest.json',
            new Response(JSON.stringify(manifest), {
              status: 200,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            }),
          );
        } catch {
          // Ignore cache write errors
        }
      }
    }
  } catch {
    if (cachesApi) {
      try {
        const cache = await cachesApi.open(GAME_BUNDLE_CACHE_NAME);
        const fallback = await cache.match('/games/manifest.json');
        if (fallback) {
          manifest = validateGameManifest(await fallback.json());
        }
      } catch {
        // Offline with no cached manifest
      }
    }
  }

  if (manifest) {
    currentManifest = manifest;
    await Promise.all(
      Object.values(manifest.games).map(async (entry) => {
        cachedFlags[entry.id] = await isGameCachedInStorage(entry, cachesApi, storage);
      }),
    );
    exposeDebugHandle();
    notifyListeners();
  }
  return currentManifest;
}

export function ensureGameManifestLoaded(): Promise<GameBundleManifest | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  registerBundleServiceWorker();
  exposeDebugHandle();
  if (!manifestPromise) {
    manifestPromise = refreshGameManifest().finally(() => {
      manifestPromise = null;
    });
  }
  return manifestPromise;
}

export function useGameBundleSnapshot(): GameBundleSnapshot {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setTick((t) => t + 1);
    listeners.add(onUpdate);
    void ensureGameManifestLoaded();
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);
  return getGameBundleSnapshot();
}

export async function loadGameComponent(
  descriptor: GamePackageDescriptor,
  devLoader: () => Promise<GameEntryModule>,
  deps: BundleManagerDeps = {},
): Promise<ComponentType<CanvasAppProps>> {
  const manifest = currentManifest ?? (await ensureGameManifestLoaded());
  const manifestEntry = manifest?.games[descriptor.id] ?? null;

  if (!manifestEntry || import.meta.env?.DEV) {
    const devKey = `${descriptor.id}@dev`;
    const cachedDev = loadedComponents.get(devKey);
    if (cachedDev) return cachedDev;
    const mod = await devLoader();
    loadedComponents.set(devKey, mod.default);
    return mod.default;
  }

  const cacheKey = `${descriptor.id}@${manifestEntry.hash}`;
  const inMemory = loadedComponents.get(cacheKey);
  if (inMemory) return inMemory;

  const existingLoad = inFlightLoads.get(cacheKey);
  if (existingLoad) return existingLoad;

  const loadTask = (async () => {
    await ensureGameBundleCached(manifestEntry, deps);
    cachedFlags[descriptor.id] = true;
    exposeDebugHandle();
    notifyListeners();

    const importer =
      deps.importModule ??
      ((entryPath: string) => import(/* @vite-ignore */ entryPath) as Promise<GameEntryModule>);
    const mod = await importer(manifestEntry.entry);
    if (!mod || typeof mod.default !== 'function') {
      throw new Error(`Invalid game bundle export for ${descriptor.id}`);
    }
    loadedComponents.set(cacheKey, mod.default);
    return mod.default;
  })().finally(() => {
    inFlightLoads.delete(cacheKey);
  });

  inFlightLoads.set(cacheKey, loadTask);
  return loadTask;
}

function getSynchronousLoadedComponent(descriptor: GamePackageDescriptor): ComponentType<CanvasAppProps> | null {
  const manifestEntry = currentManifest?.games[descriptor.id];
  if (manifestEntry && !import.meta.env?.DEV) {
    return loadedComponents.get(`${descriptor.id}@${manifestEntry.hash}`) ?? null;
  }
  return loadedComponents.get(`${descriptor.id}@dev`) ?? null;
}

export function createLazyGameElement(
  descriptor: GamePackageDescriptor,
  devLoader: () => Promise<GameEntryModule>,
): ComponentType<CanvasAppProps> {
  registerGameDescriptor(descriptor);

  function LazyGameHost(props: CanvasAppProps) {
    const [Component, setComponent] = useState<ComponentType<CanvasAppProps> | null>(() =>
      getSynchronousLoadedComponent(descriptor),
    );
    const [error, setError] = useState<string | null>(null);
    const [showLoading, setShowLoading] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
      const syncComp = getSynchronousLoadedComponent(descriptor);
      if (syncComp) {
        setComponent(() => syncComp);
        setError(null);
        return;
      }
      let cancelled = false;
      setError(null);
      const timer = window.setTimeout(() => {
        if (!cancelled) setShowLoading(true);
      }, 120);

      void loadGameComponent(descriptor, devLoader)
        .then((loaded) => {
          if (cancelled) return;
          window.clearTimeout(timer);
          setShowLoading(false);
          setComponent(() => loaded);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          window.clearTimeout(timer);
          setShowLoading(false);
          setError(err instanceof Error ? err.message : `Unable to load ${descriptor.title}.`);
        });

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }, [attempt]);

    if (Component) {
      return createElement(Component, props);
    }

    if (error) {
      return createElement(
        'div',
        { className: 'game-bundle-status', 'data-testid': 'game-bundle-error', role: 'alert' },
        createElement('div', { className: 'game-bundle-title' }, `${descriptor.title} unavailable`),
        createElement('p', { className: 'game-bundle-copy' }, error),
        createElement(
          'div',
          { className: 'row' },
          createElement(
            'button',
            {
              type: 'button',
              className: 'primary',
              onClick: () => setAttempt((a) => a + 1),
            },
            'Retry download',
          ),
          createElement(
            'button',
            {
              type: 'button',
              onClick: props.onExit,
            },
            `Close ${descriptor.title}`,
          ),
        ),
      );
    }

    if (!showLoading) {
      return null;
    }

    return createElement(
      'div',
      {
        className: 'game-bundle-status',
        'data-testid': 'game-bundle-loading',
        role: 'status',
        'aria-live': 'polite',
      },
      createElement('div', { className: 'game-bundle-title' }, `Loading ${descriptor.title}…`),
      createElement(
        'p',
        { className: 'game-bundle-copy' },
        `Preparing v${descriptor.version} game bundle`,
      ),
    );
  }

  LazyGameHost.displayName = `LazyGameHost(${descriptor.id})`;
  return LazyGameHost;
}
