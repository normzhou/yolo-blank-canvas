import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH, PRISM_SHAPES } from '../src/shared/prismStack';
import { CHARACTER_OPTIONS } from '../src/shared/starlightBurst';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['src', 'server', 'public', 'hosting', 'src-tauri'];
const SKIP_DIRS = new Set([
  'node_modules',
  '.wrangler',
  '.terraform',
  'target',
  'gen',
  'dist',
  'yolo-feedback',
]);
const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.icns', '.ico', '.m4a', '.mp3', '.ogg', '.wav', '.woff', '.woff2']);

const FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  { label: 'Tetris', regex: /tetris/i },
  { label: 'Tetromino / Tetrimino', regex: /tetr[io]mino/i },
  { label: 'Puzzle Bobble', regex: /puzzle[\s_-]*bobble/i },
  { label: 'Bust-A-Move', regex: /bust[\s_-]*a[\s_-]*move/i },
  { label: 'Bub / Bob character names', regex: /\b(?:bub|bob)\b/i },
  { label: 'Taito', regex: /\btaito\b/i },
  { label: 'Neo-Geo', regex: /neo[\s_-]*geo/i },
  { label: 'Korobeiniki', regex: /korobeiniki/i },
];

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

describe('IP, trademark, and trade-dress compliance (#351, #352)', () => {
  it('purges forbidden trademark strings from filenames and text contents across src/, server/, public/, hosting/, and src-tauri/', () => {
    const violations: string[] = [];

    for (const relRoot of SCAN_DIRS) {
      const absRoot = path.join(ROOT, relRoot);
      if (!fs.existsSync(absRoot)) continue;
      for (const file of collectFiles(absRoot)) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        for (const { label, regex } of FORBIDDEN_PATTERNS) {
          if (regex.test(rel)) {
            violations.push(`Path "${rel}" matched forbidden term (${label})`);
          }
        }
        const ext = path.extname(file).toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let idx = 0; idx < lines.length; idx += 1) {
          const line = lines[idx]!;
          for (const { label, regex } of FORBIDDEN_PATTERNS) {
            if (regex.test(line)) {
              violations.push(`${rel}:${idx + 1} matched ${label}: ${line.trim().slice(0, 120)}`);
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('enforces non-10x20 playfield geometry in Prism Stack and non-reptilian companions in Starlight Burst', () => {
    expect(`${BOARD_WIDTH}x${BOARD_HEIGHT}`).toBe('9x18');
    expect(`${BOARD_WIDTH}x${BOARD_HEIGHT}`).not.toBe('10x20');
    expect(PRISM_SHAPES).toEqual([
      'bar',
      'hookL',
      'hookR',
      'quad',
      'stepR',
      'crest',
      'stepL',
    ]);
    expect(CHARACTER_OPTIONS.map((c) => c.id)).toEqual(['fox', 'cat', 'dog', 'bunny']);
    expect(CHARACTER_OPTIONS.some((c) => c.id.includes('dragon'))).toBe(false);
  });
});
