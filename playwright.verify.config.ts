import { defineConfig } from '@playwright/test';

/**
 * Verification of a released artifact. Point `YOLO_VERIFY_URL` at a running
 * release (for example one installed from its tag) and run this config; it
 * asserts the legibility and motion fixes are present in what users actually
 * receive. Read-only: no GitHub writes.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /verify-release\.spec\.ts/,
  workers: 1,
  timeout: 30_000,
  reporter: [['list']],
  use: { channel: 'chrome', headless: true },
});
