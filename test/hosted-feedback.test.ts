import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOSTED_FEEDBACK_V1_URL,
  LOCAL_FEEDBACK_FALLBACK_URL,
  openHostedFeedback,
  resetHostedFeedbackForTests,
} from '../src/client/hostedFeedback';

describe('Hosted v1 shared feedback integration (#290, #294)', () => {
  const origDocument = globalThis.document;
  const origWindow = globalThis.window;
  const origFetch = globalThis.fetch;

  afterEach(() => {
    resetHostedFeedbackForTests();
    (globalThis as unknown as { document: unknown }).document = origDocument;
    (globalThis as unknown as { window: unknown }).window = origWindow;
    (globalThis as unknown as { fetch: unknown }).fetch = origFetch;
  });

  function setupMockDom() {
    const roots = new Map<string, HTMLElement>();
    const submittedForms: Array<{ method: string; action: string; target: string; hidden: boolean }> = [];
    const reloadSpy = vi.fn();

    const makeElement = (tag: string) => {
      if (tag === 'form') {
        const form = {
          tagName: 'FORM',
          method: '',
          action: '',
          target: '',
          hidden: false,
          isConnected: true,
          submit: () => {
            submittedForms.push({
              method: form.method,
              action: form.action,
              target: form.target,
              hidden: form.hidden,
            });
          },
        };
        return form as unknown as HTMLElement;
      }
      const children: unknown[] = [];
      const node = {
        id: '',
        isConnected: true,
        dataset: {} as Record<string, string>,
        append: (...items: unknown[]) => children.push(...items),
        replaceChildren: () => {
          children.length = 0;
        },
        remove: () => {
          if (node.id) roots.delete(node.id);
        },
      };
      return node as unknown as HTMLElement;
    };

    (globalThis as unknown as { window: unknown }).window = {
      location: { origin: 'https://demo.yolo-dev.ai', reload: reloadSpy },
    };
    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => roots.get(id) ?? null,
      createElement: (tag: string) => makeElement(tag),
      body: {
        append: (node: HTMLElement) => {
          if (node.id) roots.set(node.id, node);
        },
      },
    };
    return { roots, submittedForms, reloadSpy };
  }

  it('loads https://yolo-dev.ai/feedback/v1.mjs, prepares styles, mounts with app id "demo", and supplies onLogin/onLogout callbacks (#294)', async () => {
    const { roots, submittedForms, reloadSpy } = setupMockDom();
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    const prepareStyles = vi.fn().mockResolvedValue(undefined);
    const openSpy = vi.fn();
    let capturedGetContext: (() => { page?: string } | undefined) | undefined;
    let capturedOnLogin: (() => void) | undefined;
    let capturedOnLogout: (() => void | Promise<void>) | undefined;

    const ok = await openHostedFeedback({
      page: 'Puzzle Bobble',
      importer: async (url) => {
        expect(url).toBe(HOSTED_FEEDBACK_V1_URL);
        return {
          HOSTED_FEEDBACK_API: 'yolo-feedback-ui-v1',
          LIBRARY_VERSION: '0.1.0-alpha.57',
          prepareStyles,
          mountFeedback: (_root, opts) => {
            expect(opts.app).toEqual({ id: 'demo', name: 'Blank Canvas' });
            expect(opts.apiBase).toBe('/yolo/api/v1');
            expect(typeof opts.onLogin).toBe('function');
            expect(typeof opts.onLogout).toBe('function');
            capturedGetContext = opts.getContext;
            capturedOnLogin = opts.onLogin;
            capturedOnLogout = opts.onLogout;
            return {
              open: openSpy,
              close: () => undefined,
              destroy: () => undefined,
            };
          },
        };
      },
    });

    expect(ok).toBe(true);
    expect(prepareStyles).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith({ context: { page: 'Puzzle Bobble' } });
    expect(capturedGetContext?.()).toEqual({ page: 'Puzzle Bobble' });
    const root = roots.get('yolo-hosted-feedback-root');
    expect(root?.dataset.yoloFeedbackSource).toBe('hosted-v1');
    expect(root?.dataset.yoloFeedbackVersion).toBe('0.1.0-alpha.57');

    // Verify onLogin submits a same-origin native POST form to /auth/yolo/login
    const runLogin = capturedOnLogin as (() => void) | undefined;
    runLogin?.();
    expect(submittedForms).toEqual([
      {
        method: 'post',
        action: 'https://demo.yolo-dev.ai/auth/yolo/login',
        target: '_self',
        hidden: true,
      },
    ]);

    // Verify onLogout posts to /auth/yolo/logout with Origin and reloads on 204
    const runLogout = capturedOnLogout as (() => void | Promise<void>) | undefined;
    await runLogout?.();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [logoutUrl, logoutInit] = fetchMock.mock.calls[0];
    expect(String(logoutUrl)).toBe('https://demo.yolo-dev.ai/auth/yolo/logout');
    expect(logoutInit).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      headers: { Origin: 'https://demo.yolo-dev.ai' },
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to same-origin /yolo/feedback/browser.js with onLogin and onLogout if the remote v1.mjs import fails', async () => {
    const { roots } = setupMockDom();
    const openSpy = vi.fn();
    let hasCallbacks = false;

    const ok = await openHostedFeedback({
      page: 'Tetris',
      importer: async (url) => {
        if (url.startsWith(HOSTED_FEEDBACK_V1_URL)) {
          throw new Error('CDN unreachable');
        }
        expect(url).toBe(`https://demo.yolo-dev.ai${LOCAL_FEEDBACK_FALLBACK_URL}`);
        return {
          LIBRARY_VERSION: '0.1.0-alpha.57',
          mountFeedback: (_root, opts) => {
            hasCallbacks = typeof opts.onLogin === 'function' && typeof opts.onLogout === 'function';
            return {
              open: openSpy,
              close: () => undefined,
              destroy: () => undefined,
            };
          },
        };
      },
    });

    expect(ok).toBe(true);
    expect(hasCallbacks).toBe(true);
    expect(openSpy).toHaveBeenCalledWith({ context: { page: 'Tetris' } });
    const root = roots.get('yolo-hosted-feedback-root');
    expect(root?.dataset.yoloFeedbackSource).toBe('local-fallback');
  });
});
