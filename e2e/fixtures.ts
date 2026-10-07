import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Per-test console/page-error collection: a console error or uncaught
 * exception (including a CSP violation) fails the test unless the test opts
 * out. Full-page screenshots go to `e2e/artifacts/` for agent review; a
 * representative set is copied to `e2e/screenshots/`.
 */
export const ARTIFACTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artifacts');

export const test = base.extend<{ errors: string[]; snap: (name: string) => Promise<string> }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    await use(errors);
  },
  snap: async ({ page }, use) => {
    await use(async (name: string) => {
      fs.mkdirSync(ARTIFACTS, { recursive: true });
      const file = path.join(ARTIFACTS, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      return file;
    });
  },
});

export { expect };

/** Assert no console errors/page errors were seen on this page. */
export function expectClean(errors: string[]) {
  // Audio autoplay rejections are policy, not a defect; CSP media violations are errors we keep.
  const relevant = errors.filter((entry) => !entry.includes('play()') && !entry.includes('Failed to load resource'));
  expect(relevant, `console/page errors:\n${relevant.join('\n')}`).toEqual([]);
}
