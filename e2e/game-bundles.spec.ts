import { test, expect } from './fixtures';
import { startStubApp } from './stub-server';

/**
 * Modular lazy-loaded per-game bundles & hash-addressed local CacheStorage (#306, #352).
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
    await expect(card).toHaveAttribute('data-slide-id', 'starlight-burst');
    await expect(card).toHaveAttribute('data-game-version', '2.1.1');
    await expect.poll(async () => (await card.getAttribute('data-game-hash'))?.length ?? 0).toBe(64);
    await expect(card).toHaveAttribute('data-bundle-cached', 'false');

    // Zero `/games/*.js` chunks downloaded on the Home menu!
    expect(fetchedGameEntries).toEqual([]);

    // Launch Starlight Burst: downloads ONLY starlight-burst's bundle and caches it in CacheStorage.
    await card.click();
    await expect(page.getByRole('img', { name: 'Player 1 starlight board' })).toBeVisible();

    expect(fetchedGameEntries.some((p) => p.startsWith('/games/starlight-burst-'))).toBe(true);
    expect(fetchedGameEntries.some((p) => p.startsWith('/games/prism-stack-'))).toBe(false);

    const afterFirstLaunch = await page.evaluate(async () => {
      const snap = (
        window as unknown as {
          __yoloGameBundles?: () => {
            games: Record<string, { cached: boolean; hash: string | null; entry: string | null }>;
          };
        }
      ).__yoloGameBundles?.();
      const cache = await caches.open('yolo-arcade-games-v1');
      const sbEntry = snap?.games['starlight-burst']?.entry ?? '';
      const matched = sbEntry ? Boolean(await cache.match(sbEntry)) : false;
      if (navigator.serviceWorker) {
        await navigator.serviceWorker.ready;
      }
      return {
        sbCached: snap?.games['starlight-burst']?.cached ?? false,
        prismCached: snap?.games['prism-stack']?.cached ?? true,
        inCacheStorage: matched,
      };
    });
    expect(afterFirstLaunch).toEqual({
      sbCached: true,
      prismCached: false,
      inCacheStorage: true,
    });

    // Reload onto the Home menu so `/game-cache-sw.js` controls the client, confirm menu shows
    // `data-bundle-cached="true"`, block server `/games/starlight-burst-*.js`, and verify local cache launch!
    await page.goto(stub.base);
    await expect(card).toHaveAttribute('data-bundle-cached', 'true');

    await page.context().route('**/games/starlight-burst-*.js', (route) => route.abort('internetdisconnected'));
    await card.click();
    await expect(page.getByRole('img', { name: 'Player 1 starlight board' })).toBeVisible();

    expect(errors.filter((e) => !e.includes('play()') && !e.includes('Failed to load resource'))).toEqual([]);
  } finally {
    await new Promise<void>((resolve) => stub.server.close(() => resolve()));
  }
});
