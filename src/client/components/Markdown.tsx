import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Recognises a canonical GitHub issue URL for the currently connected
 * repository (`https://github.com/<owner>/<repo>/issues/<n>`), excluding
 * comment/fragment links (`#issuecomment-...`), pull requests, and other
 * repositories so only same-repo request/outcome links open inside the panel.
 */
export function parseSameRepoIssueUrl(href: string | undefined, repo: string | undefined | null): number | null {
  if (!href || !repo) return null;
  const cleanRepo = repo.trim().toLowerCase();
  if (!cleanRepo) return null;
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/([1-9]\d*)\/?$/.exec(href.trim());
  if (!match) return null;
  if (match[1].toLowerCase() !== cleanRepo) return null;
  const number = Number.parseInt(match[2], 10);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Markdown rendering for untrusted GitHub content.
 *
 * react-markdown does not evaluate raw HTML unless a raw-HTML plugin is added,
 * so embedded `<script>`/`<img onerror>` text is shown, not executed. Links are
 * forced to open safely with `rel="noreferrer noopener"`. When `repo` and
 * `onSelectIssue` are provided (#177), unmodified left-clicks on same-repo
 * issue links navigate inside the panel while keeping the `href` for new-tab
 * and modifier clicks.
 */
export function Markdown({
  children,
  repo,
  onSelectIssue,
}: {
  children?: string | null;
  repo?: string | null;
  onSelectIssue?: (issueNumber: number) => void;
}) {
  if (!children) return null;
  return (
    <div className="comment-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children: linkChildren }) => {
            const targetIssue = onSelectIssue ? parseSameRepoIssueUrl(href, repo) : null;
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                onClick={
                  targetIssue !== null
                    ? (event) => {
                        if (
                          event.button === 0 &&
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.shiftKey &&
                          !event.altKey
                        ) {
                          event.preventDefault();
                          onSelectIssue!(targetIssue);
                        }
                      }
                    : undefined
                }
              >
                {linkChildren as ReactNode}
              </a>
            );
          },
          img: ({ src, alt }) => <img src={src} alt={alt ?? ''} loading="lazy" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
