import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Comment, type IssueSummary } from '../api';
import {
  deriveIssueStatus,
  findSummaryComment,
  summaryComments,
  reportedTiming,
  NO_SUMMARY_TEXT,
  NO_TIMING_TEXT,
} from '../../shared/status';
import { StatusDetail } from '../components/StatusBadge';
import { Markdown } from '../components/Markdown';
import { ErrorNotice } from '../components/ErrorNotice';
import { formatRelativeTime } from '../usePolling';

const PER_PAGE = 30;

export function DetailView({
  issueNumber,
  issueHint,
  draft,
  onDraftChange,
  onBack,
  refreshToken,
  onRefreshed,
  onStale,
}: {
  issueNumber: number;
  issueHint: IssueSummary | null;
  draft: { title: string; body: string };
  onDraftChange: (next: { title: string; body: string }) => void;
  onBack: () => void;
  refreshToken: number;
  onRefreshed: (at: number) => void;
  onStale: (stale: boolean) => void;
}) {
  const [issue, setIssue] = useState<IssueSummary | null>(issueHint);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentPages, setCommentPages] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [posting, setPosting] = useState(false);
  const postingRef = useRef(false);
  const loadedOnce = useRef(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const [issueResult, commentResult] = await Promise.all([api.getIssue(issueNumber), api.listComments(issueNumber, 1, PER_PAGE)]);
      setIssue(issueResult.issue);
      setComments(commentResult.items);
      setCommentPages(1);
      setHasMoreComments(commentResult.hasMore);
      setError(null);
      loadedOnce.current = true;
      onStale(false);
      onRefreshed(Date.now());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, { kind: 'server_error', message: 'Unexpected error.' }));
      if (loadedOnce.current) onStale(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [issueNumber, onRefreshed, onStale]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueNumber, refreshToken]);

  async function loadMoreComments() {
    const next = commentPages + 1;
    try {
      const result = await api.listComments(issueNumber, next, PER_PAGE);
      setComments((previous) => [...previous, ...result.items]);
      setCommentPages(next);
      setHasMoreComments(result.hasMore);
      setError(null);
      onRefreshed(Date.now());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, { kind: 'server_error', message: 'Unexpected error.' }));
    }
  }

  async function postReply(event: React.FormEvent) {
    event.preventDefault();
    if (postingRef.current || draft.body.trim().length === 0) return;
    postingRef.current = true;
    setPosting(true);
    setError(null);
    try {
      await api.createComment(issueNumber, draft.body);
      // Only now is the reply confirmed, so the draft can go.
      onDraftChange({ title: '', body: '' });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, { kind: 'server_error', message: 'Unexpected error.' }));
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  const status = issue ? deriveIssueStatus(issue) : null;
  const summary = findSummaryComment(comments);
  const otherSummaries = summaryComments(comments).filter((comment) => !summary || comment.id !== summary.id);
  const timing = reportedTiming(summary);

  return (
    <div>
      <div className="toolbar">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <div className="spacer" />
        {issue?.html_url ? (
          <a href={issue.html_url} target="_blank" rel="noreferrer noopener">
            Open in GitHub ↗
          </a>
        ) : null}
        <button type="button" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      <ErrorNotice error={error} onRetry={() => void load()} />

      {issue ? (
        <>
          <h2 style={{ fontSize: 17, margin: '4px 0 8px' }}>
            #{issue.number} {issue.title}
          </h2>
          <div className="row" style={{ gap: 8 }}>
            {status ? <StatusDetail status={status} /> : null}
            <span className="note">
              opened {formatRelativeTime(issue.created_at)} by {issue.user?.login ?? 'unknown'} · updated{' '}
              {formatRelativeTime(issue.updated_at)}
            </span>
          </div>
          {issue.body ? (
            <div style={{ margin: '12px 0 16px' }}>
              <Markdown>{issue.body}</Markdown>
            </div>
          ) : null}
        </>
      ) : (
        <p className="empty">Loading request…</p>
      )}

      <div className="summary-box">
        <h3>Reported summary</h3>
        {summary ? (
          <>
            <p className="note">
              by {summary.user?.login ?? 'unknown'} · updated {formatRelativeTime(summary.updated_at)}{' '}
              {summary.html_url ? (
                <>
                  ·{' '}
                  <a href={summary.html_url} target="_blank" rel="noreferrer noopener">
                    source
                  </a>
                </>
              ) : null}
            </p>
            <Markdown>{summary.body}</Markdown>
            <p className="note">Timing: {timing ?? NO_TIMING_TEXT}</p>
            {otherSummaries.length > 0 ? (
              <p className="note">
                {otherSummaries.length} earlier summary comment{otherSummaries.length === 1 ? '' : 's'} also appear in the
                discussion below.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="note">{NO_SUMMARY_TEXT}</p>
            <p className="note">Timing: {NO_TIMING_TEXT}</p>
          </>
        )}
      </div>

      <h3 style={{ fontSize: 14 }}>Discussion</h3>
      {comments.length === 0 && loadedOnce.current ? <p className="note">No comments yet.</p> : null}
      {comments.map((comment) => (
        <article key={comment.id} className="comment">
          <div className="comment-header">
            <strong>{comment.user?.login ?? 'unknown'}</strong>
            <span>{formatRelativeTime(comment.created_at)}</span>
            {comment.html_url ? (
              <a href={comment.html_url} target="_blank" rel="noreferrer noopener">
                source
              </a>
            ) : null}
          </div>
          <Markdown>{comment.body}</Markdown>
        </article>
      ))}
      {hasMoreComments ? (
        <button type="button" onClick={() => void loadMoreComments()}>
          Load more comments
        </button>
      ) : null}
      {comments.length > 0 && !hasMoreComments ? <p className="note">End of discussion ({comments.length} shown).</p> : null}

      <form onSubmit={postReply} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="reply-body">Reply</label>
          <textarea
            id="reply-body"
            value={draft.body}
            onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
          />
          <p className="hint">Replies are GitHub comments on this request{issue && issue.state === 'closed' ? ' (it is closed)' : ''}.</p>
        </div>
        <button type="submit" className="primary" disabled={posting || draft.body.trim().length === 0}>
          {posting ? 'Posting…' : 'Reply'}
        </button>
      </form>
    </div>
  );
}