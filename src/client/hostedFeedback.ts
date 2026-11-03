/**
 * Hosted v1 & same-origin shared feedback dialog integration (#290, #294, #296).
 *
 * Follows `.agents/skills/yolo/references/hosted-feedback.md` and
 * `.agents/skills/yolo/references/client-feedback-library.md`:
 * - Loads `https://yolo-dev.ai/feedback/v1.mjs` (`HOSTED_FEEDBACK_API === 'yolo-feedback-ui-v1'`),
 *   preloads matching release styles via `prepareStyles()`, and mounts the panel-only
 *   `<yolo-feedback-v1>` dialog (`mountFeedback`) bound to the existing top-right YOLO
 *   Threefold symbol launcher.
 * - Falls back automatically to same-origin `/yolo/feedback/browser.js` (`mountFeedback`)
 *   if the remote CDN is unreachable.
 * - Persists a short-lived return marker across OAuth sign-in (`/auth/yolo/login` ->
 *   `/auth/yolo/callback`) so the user returns directly to the open, logged-in YOLO menu.
 * - Pauses any active game and isolates keyboard events (`keydown`, `keyup`, `keypress`)
 *   to the `<yolo-feedback-v1>` dialog while it is open.
 */

import { setSharedOverlayOpen } from './gamePause';

export const HOSTED_FEEDBACK_V1_URL = 'https://yolo-dev.ai/feedback/v1.mjs';
export const LOCAL_FEEDBACK_FALLBACK_URL = '/yolo/feedback/browser.js';
export const PENDING_LOGIN_RETURN_KEY = 'yolo:hosted-feedback-login-return:v1';
export const PENDING_LOGIN_RETURN_TTL_MS = 10 * 60 * 1000;

export interface PendingFeedbackLoginReturn {
  search: string;
  page: string;
  ts: number;
}

export interface FeedbackMountControl {
  open: (options?: { context?: { page?: string } }) => void;
  close: () => void;
  destroy: () => void;
}

export interface HostedFeedbackUiModule {
  HOSTED_FEEDBACK_API?: string;
  LIBRARY_VERSION?: string;
  prepareStyles?: (signal?: AbortSignal, retry?: number) => Promise<void>;
  mountFeedback: (
    root: HTMLElement,
    options: {
      app: { id: string; name: string };
      apiBase?: string;
      getContext?: () => { page?: string } | undefined;
      onOpenChange?: (open: boolean) => void;
      onLogin?: () => void;
      onLogout?: () => void | Promise<void>;
    },
  ) => FeedbackMountControl;
}

export interface OpenHostedFeedbackOptions {
  page?: string;
  onOpenChange?: (open: boolean) => void;
  importer?: (url: string) => Promise<HostedFeedbackUiModule>;
}

let activeControl: FeedbackMountControl | null = null;
let activeRoot: HTMLElement | null = null;
let currentPageLabel = 'Home';
let openChangeHandler: ((open: boolean) => void) | undefined;
let loadingPromise: Promise<FeedbackMountControl | null> | null = null;
let retryCount = 0;
let hostedFeedbackOpen = false;
let removeDocKeyIsolation: (() => void) | null = null;

function defaultImporter(url: string): Promise<HostedFeedbackUiModule> {
  return import(/* @vite-ignore */ url) as Promise<HostedFeedbackUiModule>;
}

function stopGameKeyBubble(event: Event): void {
  if (!hostedFeedbackOpen) return;
  event.stopPropagation();
}

function syncHostedFeedbackOpen(next: boolean): void {
  hostedFeedbackOpen = next;
  setSharedOverlayOpen(next);
  if (next) {
    if (!removeDocKeyIsolation && typeof document?.addEventListener === 'function') {
      document.addEventListener('keydown', stopGameKeyBubble, false);
      document.addEventListener('keyup', stopGameKeyBubble, false);
      document.addEventListener('keypress', stopGameKeyBubble, false);
      removeDocKeyIsolation = () => {
        if (typeof document?.removeEventListener === 'function') {
          document.removeEventListener('keydown', stopGameKeyBubble, false);
          document.removeEventListener('keyup', stopGameKeyBubble, false);
          document.removeEventListener('keypress', stopGameKeyBubble, false);
        }
        removeDocKeyIsolation = null;
      };
    }
  } else if (removeDocKeyIsolation) {
    removeDocKeyIsolation();
  }
  openChangeHandler?.(next);
}

export function isHostedFeedbackOpen(): boolean {
  return hostedFeedbackOpen;
}

export function savePendingFeedbackLoginReturn(state: {
  search?: string;
  page?: string;
  ts?: number;
}): void {
  const payload: PendingFeedbackLoginReturn = {
    search: typeof state.search === 'string' ? state.search : '',
    page: (state.page || currentPageLabel || 'Home').slice(0, 160),
    ts: typeof state.ts === 'number' ? state.ts : Date.now(),
  };
  const serialized = JSON.stringify(payload);
  try {
    window.sessionStorage?.setItem(PENDING_LOGIN_RETURN_KEY, serialized);
  } catch {
    // Ignore storage write errors
  }
  try {
    window.localStorage?.setItem(PENDING_LOGIN_RETURN_KEY, serialized);
  } catch {
    // Ignore storage write errors
  }
}

export function consumePendingFeedbackLoginReturn(
  now = Date.now(),
): { search: string; page: string } | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage?.getItem(PENDING_LOGIN_RETURN_KEY) ?? null;
    window.sessionStorage?.removeItem(PENDING_LOGIN_RETURN_KEY);
  } catch {
    // Ignore storage read errors
  }
  try {
    if (!raw) {
      raw = window.localStorage?.getItem(PENDING_LOGIN_RETURN_KEY) ?? null;
    }
    window.localStorage?.removeItem(PENDING_LOGIN_RETURN_KEY);
  } catch {
    // Ignore storage read errors
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingFeedbackLoginReturn>;
    if (
      typeof parsed?.ts !== 'number' ||
      !Number.isFinite(parsed.ts) ||
      now - parsed.ts > PENDING_LOGIN_RETURN_TTL_MS ||
      now < parsed.ts - 60_000
    ) {
      return null;
    }
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      page: typeof parsed.page === 'string' && parsed.page ? parsed.page.slice(0, 160) : 'Home',
    };
  } catch {
    return null;
  }
}

function attachRootKeyIsolation(root: HTMLElement): void {
  const r = root as HTMLElement & { _yoloKeyIsolationAttached?: boolean };
  if (r._yoloKeyIsolationAttached || typeof root.addEventListener !== 'function') return;
  r._yoloKeyIsolationAttached = true;
  root.addEventListener('keydown', stopGameKeyBubble, false);
  root.addEventListener('keyup', stopGameKeyBubble, false);
  root.addEventListener('keypress', stopGameKeyBubble, false);
}

function getOrCreateMountRoot(): HTMLElement {
  if (activeRoot && activeRoot.isConnected) {
    attachRootKeyIsolation(activeRoot);
    return activeRoot;
  }
  const existing = document.getElementById('yolo-hosted-feedback-root');
  if (existing) {
    existing.replaceChildren();
    attachRootKeyIsolation(existing);
    activeRoot = existing;
    return existing;
  }
  const root = document.createElement('div');
  root.id = 'yolo-hosted-feedback-root';
  root.dataset.testid = 'yolo-hosted-feedback-root';
  attachRootKeyIsolation(root);
  document.body.append(root);
  activeRoot = root;
  return root;
}

async function ensureFeedbackControl(
  importer: (url: string) => Promise<HostedFeedbackUiModule> = defaultImporter,
): Promise<FeedbackMountControl | null> {
  if (activeControl) return activeControl;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const root = getOrCreateMountRoot();
    root.replaceChildren();
    retryCount += 1;

    let loginForm: HTMLFormElement | undefined;
    const mountOptions = {
      app: { id: 'demo', name: 'Blank Canvas' },
      apiBase: '/yolo/api/v1',
      getContext: () => ({ page: currentPageLabel.slice(0, 160) }),
      onOpenChange: (open: boolean) => {
        syncHostedFeedbackOpen(open);
      },
      onLogin: () => {
        savePendingFeedbackLoginReturn({
          search: window.location?.search ?? '',
          page: currentPageLabel,
        });
        if (!loginForm || !loginForm.isConnected) {
          loginForm = document.createElement('form');
          loginForm.method = 'post';
          loginForm.action = new URL('/auth/yolo/login', window.location.origin).href;
          loginForm.target = '_self';
          loginForm.hidden = true;
          root.append(loginForm);
        }
        loginForm.submit();
      },
      onLogout: async () => {
        const response = await fetch(new URL('/auth/yolo/logout', window.location.origin), {
          method: 'POST',
          credentials: 'same-origin',
          redirect: 'error',
          headers: { Origin: window.location.origin },
          signal: AbortSignal.timeout(15000),
        });
        if (response.status !== 204) {
          throw new Error('Sign-out could not be confirmed.');
        }
        window.location.reload();
      },
    };

    try {
      const url = new URL(HOSTED_FEEDBACK_V1_URL);
      if (retryCount > 1) {
        url.searchParams.set('retry', String(retryCount));
      }
      const ui = await importer(url.href);
      if (
        ui.HOSTED_FEEDBACK_API !== 'yolo-feedback-ui-v1' ||
        typeof ui.mountFeedback !== 'function' ||
        typeof ui.prepareStyles !== 'function'
      ) {
        throw new Error('Incompatible hosted feedback UI.');
      }
      await ui.prepareStyles(undefined, retryCount);
      const ctrl = ui.mountFeedback(root, mountOptions);
      activeControl = ctrl;
      root.dataset.yoloFeedbackSource = 'hosted-v1';
      if (typeof ui.LIBRARY_VERSION === 'string') {
        root.dataset.yoloFeedbackVersion = ui.LIBRARY_VERSION;
      }
      return ctrl;
    } catch {
      try {
        root.replaceChildren();
        const fallbackUrl = new URL(LOCAL_FEEDBACK_FALLBACK_URL, window.location.origin).href;
        const localUi = await importer(fallbackUrl);
        if (typeof localUi?.mountFeedback !== 'function') {
          throw new Error('Incompatible local feedback fallback.');
        }
        const ctrl = localUi.mountFeedback(root, mountOptions);
        activeControl = ctrl;
        root.dataset.yoloFeedbackSource = 'local-fallback';
        if (typeof localUi.LIBRARY_VERSION === 'string') {
          root.dataset.yoloFeedbackVersion = localUi.LIBRARY_VERSION;
        }
        return ctrl;
      } catch {
        return null;
      }
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export async function openHostedFeedback({
  page = 'Home',
  onOpenChange,
  importer,
}: OpenHostedFeedbackOptions = {}): Promise<boolean> {
  currentPageLabel = page || 'Home';
  if (onOpenChange) {
    openChangeHandler = onOpenChange;
  }
  const ctrl = await ensureFeedbackControl(importer);
  if (!ctrl) return false;
  syncHostedFeedbackOpen(true);
  ctrl.open({ context: { page: currentPageLabel.slice(0, 160) } });
  return true;
}

export function closeHostedFeedback(): void {
  activeControl?.close();
  syncHostedFeedbackOpen(false);
}

export function resetHostedFeedbackForTests(): void {
  activeControl?.destroy();
  activeControl = null;
  loadingPromise = null;
  retryCount = 0;
  openChangeHandler = undefined;
  syncHostedFeedbackOpen(false);
  if (activeRoot) {
    activeRoot.remove();
    activeRoot = null;
  }
}
