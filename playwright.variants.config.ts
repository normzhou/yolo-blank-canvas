import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Stage 3 of the UI review (#75): renders the variant options for each open
 * visual question into `e2e/review/variants/`. Kept out of the default
 * `npm run e2e` run because it is a decision aid, not a regression gate.
 */
export default defineConfig({ ...base, testMatch: /variants\.spec\.ts/ });
