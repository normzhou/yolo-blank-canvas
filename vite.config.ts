import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
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

const buildId = resolveBuildId(process.cwd());

export default defineConfig({
  plugins: [react(), buildIdentity(buildId)],
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