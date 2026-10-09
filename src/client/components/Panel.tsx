import { useEffect, useRef } from 'react';
import type { SessionInfo } from '../api';
import type { IssueSummary } from '../api';
import { ListView } from '../views/ListView';
import { NewRequestView } from '../views/NewRequestView';
import { DetailView } from '../views/DetailView';
import { formatClockTime } from '../usePolling';

export type PanelView = { name: 'list' } | { name: 'new' } | { name: 'detail'; issue: IssueSummary | null; number: number };

export function Panel({
  session,
  view,
  filter,
  onFilterChange,
  onClose,
  onSelect,
  onNew,
  onCancelNew,
  onBack,
  newDraft,
  onNewDraftChange,
  createdIssues,
  onCreated,
  replyDraft,
  onReplyDraftChange,
  refreshToken,
  lastRefreshedAt,
  stale,
  onRefreshed,
  onStale,
  clientBuild,
  onDisconnect,
}: {
  session: SessionInfo;
  view: PanelView;
  filter: 'open' | 'closed' | 'all';
  onFilterChange: (next: 'open' | 'closed' | 'all') => void;
  onClose: () => void;
  onSelect: (issue: IssueSummary) => void;
  onNew: () => void;
  onCancelNew: () => void;
  onBack: () => void;
  newDraft: { title: string; body: string };
  onNewDraftChange: (next: { title: string; body: string }) => void;
  createdIssues: IssueSummary[];
  onCreated: (issue: IssueSummary) => void;
  replyDraft: { title: string; body: string };
  onReplyDraftChange: (next: { title: string; body: string }) => void;
  refreshToken: number;
  lastRefreshedAt: number | null;
  stale: boolean;
  onRefreshed: (at: number) => void;
  onStale: (stale: boolean) => void;
  clientBuild: string;
  onDisconnect: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes the panel; focus moves inside on open.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const container = bodyRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="panel" role="dialog" aria-modal="true" aria-label="Requests">
        <header className="panel-header">
          <div>
            <div className="panel-repo">{session.repo ?? 'repository'}</div>
            <div className="panel-identity">
              signed in as {session.identity ?? 'unknown'}
            </div>
          </div>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="Close Requests panel">
            Close
          </button>
        </header>
        <div className="panel-body" ref={bodyRef}>
          {view.name === 'list' ? (
            <ListView
              filter={filter}
              onFilterChange={onFilterChange}
              onSelect={onSelect}
              onNew={onNew}
              refreshToken={refreshToken}
              onRefreshed={onRefreshed}
              onStale={onStale}
              createdIssues={createdIssues}
            />
          ) : null}
          {view.name === 'new' ? (
            <NewRequestView
              draft={newDraft}
              onDraftChange={onNewDraftChange}
              onCancel={onCancelNew}
              onCreated={(issue) => {
                // Record the confirmed create result before opening the detail
                // view, so the list can reconcile if GitHub has not caught up.
                onCreated(issue);
                onSelect(issue);
              }}
            />
          ) : null}
          {view.name === 'detail' ? (
            <DetailView
              issueNumber={view.number}
              issueHint={view.issue}
              draft={replyDraft}
              onDraftChange={onReplyDraftChange}
              onBack={onBack}
              refreshToken={refreshToken}
              onRefreshed={onRefreshed}
              onStale={onStale}
            />
          ) : null}
        </div>
        <footer className="panel-footer">
          <span>
            Last refresh: {formatClockTime(lastRefreshedAt)}
            {stale ? <span className="stale"> · stale</span> : null}
          </span>
          <span>UI build: {clientBuild === 'unknown' || !clientBuild ? 'Unknown' : clientBuild.slice(0, 7)}</span>
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </footer>
      </aside>
    </div>
  );
}