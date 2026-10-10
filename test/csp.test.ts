import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INLINE_SCRIPT_SHA256 } from '../server/inline-script-hash.generated.js';

/**
 * The one inline script is authorised by hash, not by weakening the policy (#110).
 *
 * The page renders untrusted Markdown, so `script-src` stays `'self'` with no
 * `unsafe-inline`. The single exception is the theme applied before first paint,
 * which the build hashes and hands to the server.
 *
 * This guard exists because that arrangement fails silently and confusingly.
 * An earlier version of the build hashed the script *without* its leading
 * whitespace; the browser rejected it, the page flashed the default theme on
 * every load, and the build's own self-check agreed with itself because it
 * repeated the same mistake. So the check here is deliberately independent: it
 * re-derives the digest from the built HTML using the rule the browser applies,
 * and it fails if the policy ever gains `unsafe-inline`.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const builtHtmlPath = path.join(root, 'dist', 'client', 'index.html');
const hasBuilt = fs.existsSync(builtHtmlPath);

describe('the CSP inline-script hash matches the built page', () => {
  it.skipIf(!hasBuilt)('authorises exactly the script that is served', () => {
    const html = fs.readFileSync(builtHtmlPath, 'utf8');
    // The browser hashes the element's whole text content, so this must not
    // strip leading whitespace the way the build originally did.
    const match = /<script>([\s\S]*?)<\/script>/.exec(html);
    expect(match, 'no inline <script> found in the built page').not.toBeNull();
    const digest = crypto.createHash('sha256').update(match![1], 'utf8').digest('base64');
    expect(digest, 'the generated hash does not match the script actually served').toBe(INLINE_SCRIPT_SHA256);
  });

  it.skipIf(!hasBuilt)('hashes the theme script and not some other inline block', () => {
    const html = fs.readFileSync(builtHtmlPath, 'utf8');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(inline.length, 'expected exactly one inline script').toBe(1);
    expect(inline[0][1]).toContain("setAttribute('data-theme'");
    expect(inline[0][1]).toContain('yolo.theme');
  });
});

describe('the policy does not get weakened', () => {
  const securitySource = fs.readFileSync(path.join(root, 'server', 'security.js'), 'utf8');

  it('never allows unsafe-inline for scripts', () => {
    // `unsafe-inline` is present for styles, which is a deliberate and separate
    // allowance. It must never appear in the script-src directive.
    const scriptSrc = /script-src[^;']*/.exec(securitySource)?.[0] ?? '';
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('authorises the inline script by hash', () => {
    expect(securitySource).toContain("'sha256-${INLINE_SCRIPT_SHA256}'");
  });
});