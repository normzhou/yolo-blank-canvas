import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type IssueSummary } from '../api';
import { deriveIssueStatus } from '../../shared/status';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorNotice } from '../components/ErrorNotice';
import { formatRelativeTime } from '../usePolling';

const PER_PAGE = 30;

export function ListView({
  filter,
  onFilterChange,
  onSelect,
  onNew,
  refreshToken,
  onRefreshed,
  onStale,
}: {
  filter: 'open' | 'closed' | 'all';
  onFilterChange: (next: 'open' | 'closed' | 'all') => void;
  onSelect: (issue: IssueSummary) => void;
  onNew: () => void;
  refreshToken: number;
  onRefreshed: (at: number) => void;
  onStale: (stale: boolean) => void;
}) {
  const [items, setItems] = useState<IssueSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(
    async (targetPage: number, mode: 'replace' | 'append') => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      try {
        const result = await api.listIssues(filter, targetPage, PER_PAGE);
        setItems((previous) => (mode === 'replace' ? result.items : [...previous, ...result.items]));
        setHasMore(result.hasMore);
        setPage(result.page);
        setError(null);
        setLoadedOnce(true);
        onStale(false);
        onRefreshed(Date.now());
      } catch (caught) {
        // Content already on screen is preserved but marked stale.
        setError(caught instanceof ApiError ? caught : new ApiError(0, { kind: 'server_error', message: 'Unexpected error.' }));
        if (loadedOnce) onStale(true);
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [filter, loadedOnce, onRefreshed, onStale],
  );

  useEffect(() => {
    setItems([]);
    setLoadedOnce(false);
    void load(1, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, refreshToken]);

  return (
    <div>
      <div className="toolbar">
        <div className="filter-group" role="group" aria-label="Filter requests by state">
          {(['open', 'closed', 'all'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => onFilterChange(value)}>
              {value === 'open' ? 'Open' : value === 'closed' ? 'Closed' : 'All'}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button type="button" className="primary" onClick={onNew}>
          New request
        </button>
        <button type="button" onClick={() => void load(1, 'replace')} disabled={loading}>
          Refresh
        </button>
      </div>

      <ErrorNotice error={error} onRetry={() => void load(1, 'replace')} />

      {items.length === 0 && loadedOnce && !error ? (
        <div className="empty">
          <p>No requests here yet.</p>
          <button type="button" className="primary" onClick={onNew}>
            New request
          </button>
        </div>
      ) : null}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((issue) => {
          const status = deriveIssueStatus(issue);
          return (
            <li key={issue.number} className="issue-row">
              <button type="button" className="issue-title" onClick={() => onSelect(issue)}>
                #{issue.number} {issue.title}
              </button>
              <div className="meta">
                <StatusBadge status={status} />
                <span>updated {formatRelativeTime(issue.updated_at)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <button type="button" onClick={() => void load(page + 1, 'append')} disabled={loading}>
          Load more
        </button>
      ) : null}
      {items.length > 0 && !hasMore ? <p className="note">End of list ({items.length} shown).</p> : null}
    </div>
  );
}