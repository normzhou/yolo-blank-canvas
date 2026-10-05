import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type IssueSummary, type SessionInfo } from './api';
import { Panel, type PanelView } from './components/Panel';
import { ErrorNotice } from './components/ErrorNotice';
import { useVisible } from './usePolling';
import {
  NEW_REQUEST_KEY,
  browserStore,
  clearDraft,
  loadDraft,
  replyKey,
  saveDraft,
  type DraftStore,
} from './drafts';

const CLIENT_BUILD: string = typeof __CLIENT_BUILD__ === 'string' ? __CLIENT_BUILD__ : '';

const EMPTY_DRAFT = { title: '', body: '' };

export function App() {
  const storeRef = useRef<DraftStore | null>(null);
  if (storeRef.current === null) storeRef.current = browserStore();
  const store = storeRef.current;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionError, setSessionError] = useState<ApiError | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState<PanelView>({ name: 'list' });
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [newDraft, setNewDraft] = useState(() => loadDraft(storeRef.current ?? undefined, NEW_REQUEST_KEY) ?? EMPTY_DRAFT);
  // Requests created in this session, kept until GitHub's list confirms them.
  const [createdIssues, setCreatedIssues] = useState<IssueSummary[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, { title: string; body: string }>>({});
  const [serverClientBuild, setServerClientBuild] = useState<string | null>(null);
  const [reloadPromptDismissed, setReloadPromptDismissed] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const refreshToken = useVisible(panelOpen);

  const connect = useCallback(async () => {
    setConnecting(true);
    setSessionError(null);
    try {
      // The launcher already verified GitHub CLI access, so an existing login
      // needs no extra step here. This also works as a retry after auth loss.
      const info = await api.connect();
      setSession(info);
      return info;
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : new ApiError(0, { kind: 'server_error', message: 'Unexpected error.' });
      setSessionError(error);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    void connect();
    void api
      .version()
      .then((info) => setServerClientBuild(info.clientBuild))
      .catch(() => setServerClientBuild(null));
  }, [connect]);

  // Drafts survive refreshes, panel open/close, and a user-initiated reload.
  useEffect(() => {
    if (store) saveDraft(store, NEW_REQUEST_KEY, newDraft);
  }, [newDraft, store]);

  const draftFor = useCallback(
    (issueNumber: number) => {
      if (replyDrafts[issueNumber]) return replyDrafts[issueNumber];
      const loaded = store ? loadDraft(store, replyKey(issueNumber)) : null;
      return loaded ?? EMPTY_DRAFT;
    },
    [replyDrafts, store],
  );

  const setReplyDraft = useCallback(
    (issueNumber: number, next: { title: string; body: string }) => {
      setReplyDrafts((previous) => ({ ...previous, [issueNumber]: next }));
      if (store) {
        if (next.body.trim() === '' && next.title.trim() === '') clearDraft(store, replyKey(issueNumber));
        else saveDraft(store, replyKey(issueNumber), next);
      }
    },
    [store],
  );

  const openPanel = useCallback(() => {
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setView((current) => (current.name === 'detail' ? { name: 'list' } : current));
    // Focus returns to the control that opened the panel.
    triggerRef.current?.focus();
  }, []);

  async function disconnect() {
    try {
      await api.disconnect();
    } catch {
      // The local session ends even if the request failed.
    }
    setSession(null);
    setPanelOpen(false);
  }

  const currentDraft = view.name === 'detail' ? draftFor(view.number) : EMPTY_DRAFT;
  const serverSuggestsReload =
    Boolean(CLIENT_BUILD) &&
    Boolean(serverClientBuild) &&
    serverClientBuild !== 'unknown' &&
    serverClientBuild !== CLIENT_BUILD;

  return (
    <div className="canvas">
      <header className="canvas-header">
        <h1 className="canvas-title">Blank canvas</h1>
        <button type="button" ref={triggerRef} onClick={openPanel}>
          Requests
        </button>
      </header>

      {serverSuggestsReload && !reloadPromptDismissed ? (
        <div className="banner warning" role="status">
          <span>App version changed — reload to use the version this server is running.</span>
          <span className="row">
            <button
              type="button"
              className="primary"
              onClick={() => {
                // Drafts are already stored, so reloading does not lose typed input.
                window.location.reload();
              }}
            >
              Reload
            </button>
            <button type="button" onClick={() => setReloadPromptDismissed(true)}>
              Not now
            </button>
          </span>
        </div>
      ) : null}

      {sessionError ? (
        <ErrorNotice error={sessionError} onRetry={() => void connect()} retryLabel="Retry connection" />
      ) : null}

      {session ? (
        <p className="canvas-identity">
          {session.repo} · signed in as {session.identity}
        </p>
      ) : (
        <p className="canvas-identity">
          {connecting ? 'Connecting to GitHub…' : 'Connect GitHub to see requests.'}{' '}
          {!connecting ? (
            <button type="button" onClick={() => void connect()} disabled={connecting}>
              Connect GitHub
            </button>
          ) : null}
        </p>
      )}

      <p className="canvas-prompt">What would you like to build or change?</p>

      {panelOpen && session ? (
        <Panel
          session={session}
          view={view}
          filter={filter}
          onFilterChange={setFilter}
          onClose={closePanel}
          onSelect={(issue: IssueSummary) => setView({ name: 'detail', issue, number: issue.number })}
          onCreated={(issue) =>
            setCreatedIssues((previous) => [...previous.filter((item) => item.number !== issue.number), issue])
          }
          onNew={() => setView({ name: 'new' })}
          onCancelNew={() => setView({ name: 'list' })}
          onBack={() => setView({ name: 'list' })}
          newDraft={newDraft}
          onNewDraftChange={setNewDraft}
          createdIssues={createdIssues}
          replyDraft={currentDraft}
          onReplyDraftChange={(next) => {
            if (view.name === 'detail') setReplyDraft(view.number, next);
          }}
          refreshToken={refreshToken}
          lastRefreshedAt={lastRefreshedAt}
          stale={stale}
          onRefreshed={setLastRefreshedAt}
          onStale={setStale}
          clientBuild={CLIENT_BUILD || 'unknown'}
          onDisconnect={() => void disconnect()}
        />
      ) : null}
    </div>
  );
}