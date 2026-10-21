import { useEffect, useRef } from 'react';
import type { SessionInfo } from '../api';
import type { IssueSummary } from '../api';
import type { NewRequestDraft, TextDraft } from '../drafts';
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
  onSelectIssueNumber,
  onNew,
  onCancelNew,
  onBack,
  newDraft,
  onNewDraftChange,
  clientBuild,
  createdIssues,
  onCreated,
  replyDraft,
  onReplyDraftChange,
  refreshToken,
  lastRefreshedAt,
  stale,
  onRefreshed,
  onStale,
  onDisconnect,
}: {
  session: SessionInfo;
  view: PanelView;
  filter: 'open' | 'closed' | 'all';
  onFilterChange: (next: 'open' | 'closed' | 'all') => void;
  onClose: () => void;
  onSelect: (issue: IssueSummary) => void;
  onSelectIssueNumber?: (issueNumber: number) => void;
  onNew: () => void;
  onCancelNew: () => void;
  onBack: () => void;
  newDraft: NewRequestDraft;
  onNewDraftChange: (next: NewRequestDraft) => void;
  clientBuild?: string;
  createdIssues: IssueSummary[];
  onCreated: (issue: IssueSummary) => void;
  replyDraft: TextDraft;
  onReplyDraftChange: (next: TextDraft) => void;
  refreshToken: number;
  lastRefreshedAt: number | null;
  stale: boolean;
  onRefreshed: (at: number) => void;
  onStale: (stale: boolean) => void;
  onDisconnect: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes the panel; focus moves inside on open. The composer owns its
  // first field focus (the title), so the close button only takes focus for the
  // list and detail views. This effect is mount-only: navigating between views
  // must not steal focus from the field the user is in.
  useEffect(() => {
    if (view.name !== 'new') closeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // The panel is modal. Background canvas shortcuts — notably Tetris's
      // arrows and hard-drop Space — must not see keys meant for a field. The
      // target still receives the event; this only stops it before it bubbles
      // to the window-level app controls.
      event.stopPropagation();
      if (event.key === 'Escape') {
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
              build={clientBuild}
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
              repo={session.repo}
              onSelectIssue={onSelectIssueNumber}
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
          {/* #131: the build identifier left this footer. It is diagnostic output
              and sat permanently beside Disconnect, competing with a
              session-ending control for the same row. It now appears only in the
              version-skew banner, where a mismatch is actually being diagnosed. */}
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </footer>
      </aside>
    </div>
  );
}