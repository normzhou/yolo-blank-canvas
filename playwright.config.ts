import { defineConfig } from '@playwright/test';

/**
 * Deterministic E2E: a stubbed GitHub client served by the real app, headless
 * system Chrome (system Chrome, not the bundled Chromium, so AAC/m4a media
 * codecs match what a user gets — see the #67 CSP fix). The live, read-only
 * run is `playwright.live.config.ts`.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /(deterministic|visual|motion|measure|determinism|legibility|crossfade|on-art-text|link-colour|panel-push|narrow-toolbar|summary-hierarchy|list-treatment|scroll-affordance|disconnect-affordance)\.spec\.ts/,
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
