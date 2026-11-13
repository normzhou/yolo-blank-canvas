import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const NL = String.fromCharCode(10);

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

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
      fs.writeFileSync(path.join(outDir, '.build-id'), id + NL);
      const generated = [
        '// Generated at build time by vite.config.ts. Do not edit.',
        `export const BUILD_ID = ${JSON.stringify(id)};`,
        '',
      ].join(NL);
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
      const scriptOpen = html.indexOf('<script>');
      const scriptClose = scriptOpen >= 0 ? html.indexOf('</script>', scriptOpen + 8) : -1;
      const body = scriptOpen >= 0 && scriptClose >= 0 ? html.slice(scriptOpen + 8, scriptClose) : '';
      const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
      const generated = [
        '// Generated at build time by vite.config.ts. Do not edit.',
        '// SHA-256 of the inline theme script in dist/client/index.html, for the CSP.',
        `export const INLINE_SCRIPT_SHA256 = ${JSON.stringify(digest)};`,
        '',
      ].join(NL);
      fs.writeFileSync(path.resolve(root, 'server/inline-script-hash.generated.js'), generated);
    },
  };
}

const GAME_PACKAGES = [
  { id: 'starlight-burst', dir: 'src/games/starlight-burst' },
  { id: 'prism-stack', dir: 'src/games/prism-stack' },
] as const;

/**
 * Emits `dist/client/games/manifest.json` mapping each game id to its package
 * version, full 64-char SHA-256 digest, immutable `/games/<id>-<hash>.js` entry
 * URL, ordered chunk list, and byte size (#306).
 */
function gameBundleManifest(): Plugin {
  let root = process.cwd();
  let outDir = 'dist/client';
  return {
    name: 'yolo-game-bundle-manifest',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle(_options, bundle) {
      const chunksByFileName = new Map<
        string,
        { fileName: string; code: string; imports: string[]; dynamicImports: string[]; name: string; isEntry: boolean }
      >();
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          chunksByFileName.set(item.fileName, {
            fileName: item.fileName,
            code: item.code,
            imports: item.imports,
            dynamicImports: item.dynamicImports,
            name: item.name,
            isEntry: item.isEntry,
          });
        }
      }

      const collectTransitiveChunks = (entryFile: string): string[] => {
        const visited = new Set<string>();
        const ordered: string[] = [];
        const visit = (fileName: string) => {
          if (visited.has(fileName)) return;
          visited.add(fileName);
          const chunk = chunksByFileName.get(fileName);
          if (!chunk) return;
          for (const dep of chunk.imports) {
            visit(dep);
          }
          ordered.push(`/${toPosix(fileName)}`);
        };
        visit(entryFile);
        return ordered;
      };

      const games: Record<
        string,
        {
          id: string;
          packageName: string;
          version: string;
          hash: string;
          entry: string;
          chunks: string[];
          sizeBytes: number;
        }
      > = {};

      for (const game of GAME_PACKAGES) {
        const pkgPath = path.resolve(root, game.dir, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name: string; version: string };
        const entryChunk = [...chunksByFileName.values()].find(
          (c) => c.isEntry && c.name === game.id && c.fileName.startsWith(`games/${game.id}-`),
        );
        if (!entryChunk) {
          throw new Error(`Expected emitted game entry chunk for "${game.id}" under games/${game.id}-*.js`);
        }
        const rawBytes = Buffer.from(entryChunk.code, 'utf8');
        const sha256 = crypto.createHash('sha256').update(rawBytes).digest('hex');
        const entryUrl = `/${toPosix(entryChunk.fileName)}`;
        const chunks = collectTransitiveChunks(entryChunk.fileName);
        games[game.id] = {
          id: game.id,
          packageName: pkg.name,
          version: pkg.version,
          hash: sha256,
          entry: entryUrl,
          chunks,
          sizeBytes: rawBytes.byteLength,
        };
      }

      const manifestDir = path.join(outDir, 'games');
      fs.mkdirSync(manifestDir, { recursive: true });
      fs.writeFileSync(
        path.join(manifestDir, 'manifest.json'),
        JSON.stringify({ schemaVersion: 1, games }, null, 2) + NL,
      );
    },
  };
}

const buildId = resolveBuildId(process.cwd());

export default defineConfig({
  plugins: [react(), buildIdentity(buildId), inlineScriptHash(), gameBundleManifest()],
  define: {
    __CLIENT_BUILD__: JSON.stringify(buildId),
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: {
        index: path.resolve(process.cwd(), 'index.html'),
        'starlight-burst': path.resolve(process.cwd(), 'src/games/starlight-burst/entry.tsx'),
        'prism-stack': path.resolve(process.cwd(), 'src/games/prism-stack/entry.tsx'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'starlight-burst' || chunkInfo.name === 'prism-stack') {
            return 'games/[name]-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          const normalized = toPosix(id);
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (
            normalized.includes('/node_modules/react-markdown/') ||
            normalized.includes('/node_modules/remark-') ||
            normalized.includes('/node_modules/unified/') ||
            normalized.includes('/node_modules/micromark') ||
            normalized.includes('/node_modules/mdast-') ||
            normalized.includes('/node_modules/hast-') ||
            normalized.includes('/node_modules/unist-') ||
            normalized.includes('/node_modules/vfile') ||
            normalized.includes('/node_modules/property-information/')
          ) {
            return 'vendor-markdown';
          }
          if (
            normalized.endsWith('/src/client/gamePause.ts') ||
            normalized.endsWith('/src/client/netplay.ts') ||
            normalized.endsWith('/src/client/hostedFeedback.ts') ||
            normalized.includes('/src/client/audio/') ||
            normalized.endsWith('/src/shared/arcadeMusic.ts') ||
            normalized.endsWith('/src/shared/countdownLanguages.ts')
          ) {
            return 'arcade-runtime';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
