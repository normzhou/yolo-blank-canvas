import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type IssueSummary, type SessionInfo } from './api';
import { Panel, type PanelView } from './components/Panel';
import { ErrorNotice } from './components/ErrorNotice';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { CanvasPalette } from './components/CanvasPalette';
import { CANVAS_APPS, canvasAppById } from './apps/registry';
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
import { readRoute, routeTarget, routeUrl, type RouteTarget } from './route';

const CLIENT_BUILD: string = typeof __CLIENT_BUILD__ === 'string' ? __CLIENT_BUILD__ : '';

const EMPTY_DRAFT = { title: '', body: '' };

/** A cold deep link names a location but has no list row behind it. */
function toPanelView(target: RouteTarget, issue: IssueSummary | null = null): PanelView {
  if (target.name === 'detail') return { name: 'detail', issue, number: target.number };
  return { name: target.name };
}

export function App() {
  const storeRef = useRef<DraftStore | null>(null);
  if (storeRef.current === null) storeRef.current = browserStore();
  const store = storeRef.current;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionError, setSessionError] = useState<ApiError | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => readRoute(window.location.search).open);
  const [appId, setAppId] = useState<string | null>(() => readRoute(window.location.search).app);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [view, setView] = useState<PanelView>(() => toPanelView(readRoute(window.location.search).target));
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
  const requestsTriggerRef = useRef<HTMLButtonElement>(null);
  const canvasTriggerRef = useRef<HTMLButtonElement>(null);
  const appRegionRef = useRef<HTMLElement>(null);

  const activeApp = canvasAppById(appId);

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

  // #132: the location is the state. Every view change pushes an entry, so browser
  // back means back, a reload lands where you were, and `?panel=123` is a link.
  // #165: the app is part of the same location, so Requests composes over it.
  // A cold deep link carries no list row, so `issue` is null and the detail view
  // resolves it from the server.
  const navigate = useCallback(
    (target: RouteTarget | null, issue: IssueSummary | null = null) => {
      window.history.pushState(null, '', routeUrl(target, window.location.pathname, appId));
      if (target === null) {
        setPanelOpen(false);
        setView({ name: 'list' });
        return;
      }
      setPanelOpen(true);
      setView(toPanelView(target, issue));
    },
    [appId],
  );

  // Opening a canvas app is a location change too. Closing the panel here keeps
  // the shell to one surface at a time; the panel's draft state is already stored.
  const openApp = useCallback((id: string | null) => {
    window.history.pushState(null, '', routeUrl(null, window.location.pathname, id));
    setPanelOpen(false);
    setView({ name: 'list' });
    setAppId(id);
  }, []);

  const exitApp = useCallback(() => openApp(null), [openApp]);

  // Back and forward replay history rather than push onto it, so this must only
  // apply state — never call navigate, which would grow the stack as you undo it.
  useEffect(() => {
    const onPopState = () => {
      const route = readRoute(window.location.search);
      setAppId(route.app);
      setPaletteOpen(false);
      if (!route.open) {
        setPanelOpen(false);
        setView({ name: 'list' });
        return;
      }
      setPanelOpen(true);
      setView(toPanelView(route.target));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // The panel cannot render without a session, so entering it while signed out
  // used to be a dead control: the click set state that nothing read. Connecting
  // first makes every entry point work in every state (#130). On a deep link the
  // connection is already in flight from mount, so this is a no-op re-check.
  const enterRequests = useCallback(
    async (destination: RouteTarget, issue: IssueSummary | null = null) => {
      if (!session) {
        const info = await connect();
        if (!info) return;
      }
      navigate(destination, issue);
    },
    [connect, navigate, session],
  );

  const openPanel = useCallback(() => {
    void enterRequests({ name: 'list' });
  }, [enterRequests]);

  const closePanel = useCallback(() => {
    navigate(null);
    // Focus returns to the canvas control that opened it: the primary action on
    // the home canvas, or the Requests trigger in the app header.
    window.requestAnimationFrame(() => {
      (triggerRef.current ?? requestsTriggerRef.current)?.focus();
    });
  }, [navigate]);

  // The palette is transient UI, not a location. Opening it over Requests closes
  // the panel first so two shell overlays never compete for focus or Escape.
  const openPalette = useCallback(() => {
    if (panelOpen) {
      window.history.pushState(null, '', routeUrl(null, window.location.pathname, appId));
      setPanelOpen(false);
      setView({ name: 'list' });
    }
    setPaletteOpen(true);
  }, [appId, panelOpen]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    canvasTriggerRef.current?.focus();
  }, []);

  const selectApp = useCallback(
    (id: string | null) => {
      setPaletteOpen(false);
      if (id !== appId) openApp(id);
      // The dialog unmounts; move focus to the view that replaced it rather than
      // dropping it on the body.
      window.requestAnimationFrame(() => {
        (id ? appRegionRef.current : triggerRef.current)?.focus();
      });
    },
    [appId, openApp],
  );

  // Cmd/Ctrl+K is the portable shortcut; `~` is the game-flavoured alias. The
  // tilde is ignored while typing, so it cannot steal a character from a draft.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable),
      );
      const modified = event.metaKey || event.ctrlKey;
      const paletteShortcut = modified && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
      const tildeShortcut = !modified && !event.altKey && event.key === '~' && !editing;
      if (!paletteShortcut && !tildeShortcut) return;
      event.preventDefault();
      if (paletteOpen) closePalette();
      else openPalette();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [closePalette, openPalette, paletteOpen]);

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
    <div className={panelOpen && session ? 'canvas panel-open' : 'canvas'}>
      <header className="canvas-header">
        <h1 className="canvas-title">Blank canvas</h1>
        {/* Navigation lives here; the Requests workflow joins it only while an
           app is open, because that is when the canvas's own controls are
           replaced. Preferences stay separate. The header used to hold three
           peer actions — theme, Tetris and Requests — which put the app's one
           real action on equal footing with a game (#130). Canvas is navigation
           chrome, and Requests is the workflow, not a game. */}
        <span className="canvas-actions">
          <button
            type="button"
            className="canvas-switcher"
            ref={canvasTriggerRef}
            aria-haspopup="dialog"
            aria-expanded={paletteOpen}
            aria-keyshortcuts="Meta+K Control+K"
            title="Switch canvas app (Ctrl/⌘K or ~)"
            onClick={() => (paletteOpen ? closePalette() : openPalette())}
          >
            Canvas
          </button>
          {activeApp && !panelOpen ? (
            <button
              type="button"
              ref={requestsTriggerRef}
              onClick={() => void enterRequests({ name: 'list' })}
            >
              Requests
            </button>
          ) : null}
        </span>
        <ThemeSwitcher />
      </header>

      {serverSuggestsReload && !reloadPromptDismissed ? (
        <div className="banner warning" role="status">
          <span>App version changed — reload to use the version this server is running.
              {/* The build identifiers belong where a mismatch is actually being
                  diagnosed, not permanently in the product footer (#131). */}
              {serverClientBuild ? <span className="build-id">server {serverClientBuild.slice(0, 7)} · page {CLIENT_BUILD.slice(0, 7)}</span> : null}
            </span>
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

      {/* A status line only, and only when the canvas is visible. The panel header
          shows the same identity when it is open; rendering both left the facts
          duplicated on screen at the same time (#131). The connect action moved
          to the primary control in #130. */}
      {!panelOpen ? (
        <p className="canvas-identity">
          {session
            ? `${session.repo} · signed in as ${session.identity}`
            : connecting
              ? 'Connecting to GitHub…'
              : 'Not connected to GitHub.'}
        </p>
      ) : null}

      {activeApp ? (
        <section className="canvas-app" aria-label={activeApp.title} tabIndex={-1} ref={appRegionRef}>
          <activeApp.element onExit={exitApp} />
        </section>
      ) : (
        <div className="canvas-prompt-block">
          <p className="canvas-prompt">What would you like to build or change?</p>
          {/* The prompt is a question and this is its answer, so they are one
              group. It opens the composer directly rather than the list, because
              the Charter's bar is that asking costs almost nothing (#130). */}
          <button
            type="button"
            className="primary canvas-primary-action"
            ref={triggerRef}
            onClick={() => void enterRequests({ name: 'new' })}
            disabled={connecting}
          >
            {session ? 'Start a request' : 'Connect GitHub'}
          </button>
          <div className="canvas-secondary-actions">
            <button type="button" onClick={openPanel}>
              Open requests
            </button>
          </div>
          {/* The gallery is the home's quiet second row, not a dashboard. It is
              how an app is discovered without opening the keyboard palette. */}
          <nav className="canvas-gallery" aria-label="Canvas gallery">
            <span className="canvas-gallery-label">Canvas</span>
            {CANVAS_APPS.map((app) => (
              <button key={app.id} type="button" onClick={() => openApp(app.id)} title={app.summary}>
                {app.title}
              </button>
            ))}
          </nav>
        </div>
      )}

      {paletteOpen ? (
        <CanvasPalette
          apps={CANVAS_APPS}
          activeAppId={activeApp?.id ?? null}
          onSelect={selectApp}
          onClose={closePalette}
        />
      ) : null}

      {panelOpen && session ? (
        <Panel
          session={session}
          view={view}
          filter={filter}
          onFilterChange={setFilter}
          onClose={closePanel}
          onSelect={(issue: IssueSummary) => navigate({ name: 'detail', number: issue.number }, issue)}
          onCreated={(issue) =>
            setCreatedIssues((previous) => [...previous.filter((item) => item.number !== issue.number), issue])
          }
          onNew={() => navigate({ name: 'new' })}
          onCancelNew={() => navigate({ name: 'list' })}
          onBack={() => navigate({ name: 'list' })}
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
          onDisconnect={() => void disconnect()}
        />
      ) : null}
    </div>
  );
}
