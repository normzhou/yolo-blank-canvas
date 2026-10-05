import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type IssueSummary } from '../api';
import { deriveIssueStatus } from '../../shared/status';
import {
  buildListRows,
  MAX_RECONCILE_ATTEMPTS,
  retryDelayMs,
  shouldRetryFor,
  UNCONFIRMED_LABEL,
  UNCONFIRMED_NOTE,
} from '../../shared/listReconciliation';
import { planListRead } from '../../shared/listRefresh';
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
  createdIssues,
}: {
  filter: 'open' | 'closed' | 'all';
  onFilterChange: (next: 'open' | 'closed' | 'all') => void;
  onSelect: (issue: IssueSummary) => void;
  onNew: () => void;
  refreshToken: number;
  onRefreshed: (at: number) => void;
  onStale: (stale: boolean) => void;
  createdIssues: IssueSummary[];
}) {
  const [items, setItems] = useState<IssueSummary[]>([]);
  const [page, setPage] = useState(1);
  const lastFilterRef = useRef(filter);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const inFlight = useRef(false);
  const pageRef = useRef(1);

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
        pageRef.current = result.page;
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

  // A re-read of the same query (timer, manual refresh, reconciliation) must not
  // blank the rows already on screen: they stay until the response replaces them,
  // which also keeps the reader's scroll position. Only a new filter — a different
  // query — clears immediately.
  useEffect(() => {
    const trigger = lastFilterRef.current === filter ? 'refresh' : 'filter';
    lastFilterRef.current = filter;
    const plan = planListRead(trigger, pageRef.current);
    if (!plan.keepPreviousRows) {
      setItems([]);
      setLoadedOnce(false);
    }
    if (plan.resetPagination) {
      setHasMore(false);
      setPage(1);
    }
    void load(plan.page, plan.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, refreshToken]);

  const rows = useMemo(() => buildListRows(items, createdIssues), [items, createdIssues]);

  // A request the user just made must not vanish because GitHub's list endpoint
  // is still catching up. Re-read the list on a bounded backoff while any
  // created request is unconfirmed, instead of making the user press Refresh.
  const reconcileAttempt = useRef(0);
  useEffect(() => {
    if (!loadedOnce || items.length === 0) {
      if (loadedOnce && !shouldRetryFor(createdIssues, items)) reconcileAttempt.current = 0;
      return undefined;
    }
    if (!shouldRetryFor(createdIssues, items)) {
      reconcileAttempt.current = 0;
      return undefined;
    }
    if (reconcileAttempt.current >= MAX_RECONCILE_ATTEMPTS) return undefined;
    const timer = setTimeout(() => {
      reconcileAttempt.current += 1;
      void load(planListRead('retry', pageRef.current).page, 'replace');
    }, retryDelayMs(reconcileAttempt.current));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loadedOnce, createdIssues]);

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
        <button
          type="button"
          onClick={() => {
            const plan = planListRead('manual', pageRef.current);
            void load(plan.page, plan.mode);
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <ErrorNotice error={error} onRetry={() => void load(1, 'replace')} />

      {rows.length === 0 && loadedOnce && !error ? (
        <div className="empty">
          <p>No requests here yet.</p>
          <button type="button" className="primary" onClick={onNew}>
            New request
          </button>
        </div>
      ) : null}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row) => {
          const status = deriveIssueStatus(row.issue);
          return (
            <li key={row.issue.number} className="issue-row">
              <button type="button" className="issue-title" onClick={() => onSelect(row.issue)}>
                #{row.issue.number} {row.issue.title}
              </button>
              <div className="meta">
                <StatusBadge status={status} />
                {row.kind === 'unconfirmed' ? (
                  <span className="stale">{UNCONFIRMED_LABEL}</span>
                ) : null}
                <span>updated {formatRelativeTime(row.issue.updated_at)}</span>
              </div>
              {row.kind === 'unconfirmed' ? <p className="note">{UNCONFIRMED_NOTE}</p> : null}
            </li>
          );
        })}
      </ul>

      {rows.some((row) => row.kind === 'unconfirmed') ? (
        <p className="note">
          The list re-reads itself for a short while. If {UNCONFIRMED_LABEL.toLowerCase()} stays, press Refresh.
        </p>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={() => {
            const plan = planListRead('more', pageRef.current);
            void load(plan.page, plan.mode);
          }}
          disabled={loading}
        >
          Load more
        </button>
      ) : null}
      {items.length > 0 && !hasMore ? <p className="note">End of list ({items.length} shown).</p> : null}
      {/* Unconfirmed rows are appended to the server's list, so the count stays the server's. */}
    </div>
  );
}