import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/client/components/Markdown';

/**
 * Untrusted GitHub Markdown must render as text: no raw HTML execution, no
 * javascript: URLs, and links stay safe.
 */
describe('Markdown safety', () => {
  it('does not execute embedded HTML', () => {
    const html = renderToStaticMarkup(
      <Markdown>{'before\n\n<script>window.pwned = true</script>\n\n<img src=x onerror="window.pwned = true">\n\nafter'}</Markdown>,
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<img');
    // The text is preserved, not silently dropped.
    expect(html).toContain('before');
    expect(html).toContain('after');
  });

  it('renders links safely and keeps evidence links clickable', () => {
    const html = renderToStaticMarkup(<Markdown>{'See the [PR](https://github.com/o/r/pull/1) and ![shot](https://x/y.png)'}</Markdown>);
    expect(html).toContain('href="https://github.com/o/r/pull/1"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('target="_blank"');
  });

  it('does not link javascript: URLs', () => {
    const html = renderToStaticMarkup(<Markdown>{'[click](javascript:alert(1))'}</Markdown>);
    expect(html).not.toContain('href="javascript:');
  });

  it('renders the documented summary headings as Markdown', () => {
    const html = renderToStaticMarkup(
      <Markdown>{'## YOLO status\n\n### Outcome\n\nMerged in v0.2.0\n\n- Acceptance: list and reply work'}</Markdown>,
    );
    expect(html).toContain('<h2>YOLO status</h2>');
    expect(html).toContain('<h3>Outcome</h3>');
    expect(html).toContain('<li>Acceptance: list and reply work</li>');
  });

  it('renders GitHub-flavored markdown tables used in summaries', () => {
    const html = renderToStaticMarkup(
      <Markdown>{'| Stage | Result |\n| --- | --- |\n| Plan | done |'}</Markdown>,
    );
    expect(html).toContain('<table>');
  });
});