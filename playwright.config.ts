import { defineConfig } from '@playwright/test';

/**
 * Deterministic E2E: a stubbed GitHub client served by the real app, headless
 * system Chrome (system Chrome, not the bundled Chromium, so AAC/m4a media
 * codecs match what a user gets — see the #67 CSP fix).
 *
 * Review-capture scripts (`visual`, `motion`, `measure`, `determinism`) are
 * run explicitly via `npm run e2e:visual` and `npm run e2e:measure` so ordinary
 * `npm run e2e` stays fast and never dirties tracked files in `e2e/review/` (#201).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /(deterministic|visual|motion|measure|determinism|crossfade|panel-push|summary-hierarchy|list-treatment|theme|route|canvas-gallery|app-feedback|puzzle-bobble)\.spec\.ts/,
  testIgnore: process.env.YOLO_INCLUDE_REVIEW_CAPTURES ? undefined : /(visual|motion|measure|determinism)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
