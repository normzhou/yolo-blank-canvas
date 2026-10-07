import { defineConfig } from '@playwright/test';

/**
 * Live E2E: read-only smoke against the real dev app (`server/cli.js --no-open`,
 * random port, real `gh` credentials, no GitHub writes). This spec spawns and
 * stops the app itself.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /live\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
