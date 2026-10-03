/**
 * Non-secret build identity.
 *
 * The build process writes an immutable commit/build ID (see
 * `scripts/write-build-id.mjs`). "unknown" is a valid, honest value.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(here, '..');
export const CLIENT_DIR = path.join(PACKAGE_ROOT, 'dist', 'client');

function serverBuildId() {
  try {
    const text = fs.readFileSync(path.join(here, 'build-id.generated.js'), 'utf8');
    const match = text.match(/BUILD_ID\s*=\s*["'`]([^"'`]*)["'`]/);
    return match && match[1] ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

function clientBuildId() {
  try {
    const text = fs.readFileSync(path.join(CLIENT_DIR, '.build-id'), 'utf8').trim();
    return text || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function buildInfo() {
  return {
    name: 'yolo-blank-canvas',
    serverBuild: serverBuildId(),
    clientBuild: clientBuildId(),
  };
}