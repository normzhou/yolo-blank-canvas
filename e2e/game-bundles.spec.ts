import { test, expect } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Modular lazy-loaded per-game bundles & hash-addressed local CacheStorage (#306).
 *
 * Verifies:
 * 1. Visiting the Home menu loads `/games/manifest.json` (tracking each game's
 *    version and SHA-256 content hash) while downloading ZERO `/games/*.js` bundles.
 * 2. Entering Puzzle Bobble lazily downloads and SHA-256-caches ONLY Puzzle Bobble's
 *    bundle in `yolo-arcade-games-v1`, leaving Tetris un-downloaded until entered.
 * 3. Once cached and controlled by `/game-cache-sw.js`, Puzzle Bobble launches
 *    directly from local `CacheStorage` even when upstream `/games/*.js` network
 *    requests are offline/aborted.
 */
test('Home menu tracks game version/hash without downloading game bundles until entered, then serves cached games locally (#306)', async ({
  page,
  errors,
}) => {
  const stub = await startStubApp();
  const fetchedGameEntries: string[] = [];

  page.on('request', (req) => {
    const pathname = new URL(req.url()).pathname;
    if (pathname.startsWith('/games/') && pathname.endsWith('.js')) {
      fetchedGameEntries.push(pathname);
    }
  });

  try {
    await page.goto(stub.base);

    const card = page.getByTestId('deck-slide-card');
    await expect(card).toHaveAttribute('data-slide-id', 'puzzle-bobble');
    await expect(card).toHaveAttribute('data-game-version', '1.2.0');
    await expect.poll(async () => (await card.getAttribute('data-game-hash'))?.length ?? 0).toBe(64);
    await expect(card).toHaveAttribute('data-bundle-cached', 'false');

    // Zero `/games/*.js` chunks downloaded on the Home menu!
    expect(fetchedGameEntries).toEqual([]);

    // Launch Puzzle Bobble: downloads ONLY puzzle-bobble's bundle and caches it in CacheStorage.
    await card.click();
    await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();

    expect(fetchedGameEntries.some((p) => p.startsWith('/games/puzzle-bobble-'))).toBe(true);
    expect(fetchedGameEntries.some((p) => p.startsWith('/games/tetris-'))).toBe(false);

    const afterFirstLaunch = await page.evaluate(async () => {
      const snap = (
        window as unknown as {
          __yoloGameBundles?: () => {
            games: Record<string, { cached: boolean; hash: string | null; entry: string | null }>;
          };
        }
      ).__yoloGameBundles?.();
      const cache = await caches.open('yolo-arcade-games-v1');
      const pbEntry = snap?.games['puzzle-bobble']?.entry ?? '';
      const matched = pbEntry ? Boolean(await cache.match(pbEntry)) : false;
      if (navigator.serviceWorker) {
        await navigator.serviceWorker.ready;
      }
      return {
        pbCached: snap?.games['puzzle-bobble']?.cached ?? false,
        tetrisCached: snap?.games['tetris']?.cached ?? true,
        inCacheStorage: matched,
      };
    });
    expect(afterFirstLaunch).toEqual({
      pbCached: true,
      tetrisCached: false,
      inCacheStorage: true,
    });

    // Reload onto the Home menu so `/game-cache-sw.js` controls the client, confirm menu shows
    // `data-bundle-cached="true"`, block server `/games/puzzle-bobble-*.js`, and verify local cache launch!
    await page.goto(stub.base);
    await expect(card).toHaveAttribute('data-bundle-cached', 'true');

    await page.context().route('**/games/puzzle-bobble-*.js', (route) => route.abort('internetdisconnected'));
    await card.click();
    await expect(page.getByRole('img', { name: 'Player 1 bubble board' })).toBeVisible();

    expect(errors.filter((e) => !e.includes('play()') && !e.includes('Failed to load resource'))).toEqual([]);
  } finally {
    await new Promise<void>((resolve) => stub.server.close(() => resolve()));
  }
});
