/**
 * Hosted v1 & same-origin shared feedback dialog integration (#290).
 *
 * Follows `.agents/skills/yolo/references/hosted-feedback.md` and
 * `.agents/skills/yolo/references/client-feedback-library.md`:
 * - Loads `https://yolo-dev.ai/feedback/v1.mjs` (`HOSTED_FEEDBACK_API === 'yolo-feedback-ui-v1'`),
 *   preloads matching release styles via `prepareStyles()`, and mounts the panel-only
 *   `<yolo-feedback-v1>` dialog (`mountFeedback`) bound to the existing top-right YOLO
 *   Threefold symbol launcher.
 * - Falls back automatically to same-origin `/yolo/feedback/browser.js` (`mountFeedback`)
 *   if the remote CDN is unreachable.
 */

export const HOSTED_FEEDBACK_V1_URL = 'https://yolo-dev.ai/feedback/v1.mjs';
export const LOCAL_FEEDBACK_FALLBACK_URL = '/yolo/feedback/browser.js';

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

function defaultImporter(url: string): Promise<HostedFeedbackUiModule> {
  return import(/* @vite-ignore */ url) as Promise<HostedFeedbackUiModule>;
}

function getOrCreateMountRoot(): HTMLElement {
  if (activeRoot && activeRoot.isConnected) {
    return activeRoot;
  }
  const existing = document.getElementById('yolo-hosted-feedback-root');
  if (existing) {
    existing.replaceChildren();
    activeRoot = existing;
    return existing;
  }
  const root = document.createElement('div');
  root.id = 'yolo-hosted-feedback-root';
  root.dataset.testid = 'yolo-hosted-feedback-root';
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

    const mountOptions = {
      app: { id: 'demo', name: 'Blank Canvas' },
      apiBase: '/yolo/api/v1',
      getContext: () => ({ page: currentPageLabel.slice(0, 160) }),
      onOpenChange: (open: boolean) => {
        openChangeHandler?.(open);
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
  ctrl.open({ context: { page: currentPageLabel.slice(0, 160) } });
  return true;
}

export function closeHostedFeedback(): void {
  activeControl?.close();
}

export function resetHostedFeedbackForTests(): void {
  activeControl?.destroy();
  activeControl = null;
  loadingPromise = null;
  retryCount = 0;
  if (activeRoot) {
    activeRoot.remove();
    activeRoot = null;
  }
}
