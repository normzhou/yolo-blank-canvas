import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown rendering for untrusted GitHub content.
 *
 * react-markdown does not evaluate raw HTML unless a raw-HTML plugin is added,
 * so embedded `<script>`/`<img onerror>` text is shown, not executed. Links are
 * forced to open safely with `rel="noreferrer noopener"`.
 */
export function Markdown({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <div className="comment-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {linkChildren as ReactNode}
            </a>
          ),
          img: ({ src, alt }) => <img src={src} alt={alt ?? ''} loading="lazy" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}