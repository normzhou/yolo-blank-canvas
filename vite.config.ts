import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Immutable revision for this build; "unknown" is an honest value. */
function resolveBuildId(root: string): string {
  const fromEnv = process.env.YOLO_BUILD_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * The build writes its immutable revision next to the assets so the running app
 * reports client/server build identity without needing git metadata at runtime
 * (an `npx` install has no `.git`).
 */
function buildIdentity(id: string): Plugin {
  let root = process.cwd();
  let outDir = 'dist/client';
  return {
    name: 'yolo-build-identity',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      fs.writeFileSync(path.join(outDir, '.build-id'), `${id}\n`);
      const generated = `// Generated at build time by vite.config.ts. Do not edit.\nexport const BUILD_ID = ${JSON.stringify(id)};\n`;
      fs.writeFileSync(path.resolve(root, 'server/build-id.generated.js'), generated);
    },
  };
}

/**
 * The Content-Security-Policy forbids inline scripts (`script-src 'self'`), which
 * is what stops an injected script running — a real risk on a page that renders
 * untrusted Markdown. The one inline script this app needs is the theme applied
 * before first paint: without it a stored dark theme paints light and then
 * corrects itself, which is a visible flash on every load.
 *
 * Rather than weaken the policy with `unsafe-inline`, this hashes that exact
 * script at build time and hands the hash to the server. The policy then
 * authorises one known, reviewable inline script and nothing else — if the
 * snippet ever changes, its hash changes with it and the old one stops working.
 * `test/csp.test.ts` checks the header against the bytes actually served.
 */
function inlineScriptHash(): Plugin {
  let root = process.cwd();
  return {
    name: 'yolo-inline-script-hash',
    configResolved(config) {
      root = config.root;
    },
    closeBundle() {
      const html = fs.readFileSync(path.join(root, 'dist', 'client', 'index.html'), 'utf8');
      // CSP hashes the text content of the <script> element, not the tags.
      // No `\s*` here: the browser hashes the element's entire text content,
      // leading newline and indentation included. Stripping it produced a hash
      // the browser rejected, while my own check agreed with itself and missed it.
      const match = /<script>([\s\S]*?)<\/script>/.exec(html);
      const body = match?.[1] ?? '';
      const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
      const generated =
        '// Generated at build time by vite.config.ts. Do not edit.\n' +
        '// SHA-256 of the inline theme script in dist/client/index.html, for the CSP.\n' +
        `export const INLINE_SCRIPT_SHA256 = ${JSON.stringify(digest)};\n`;
      fs.writeFileSync(path.resolve(root, 'server/inline-script-hash.generated.js'), generated);
    },
  };
}

const buildId = resolveBuildId(process.cwd());

export default defineConfig({
  plugins: [react(), buildIdentity(buildId), inlineScriptHash()],
  define: {
    __CLIENT_BUILD__: JSON.stringify(buildId),
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});