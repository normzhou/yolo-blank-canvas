import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOSTED_FEEDBACK_V1_URL,
  LOCAL_FEEDBACK_FALLBACK_URL,
  openHostedFeedback,
  resetHostedFeedbackForTests,
} from '../src/client/hostedFeedback';

describe('Hosted v1 shared feedback integration (#290)', () => {
  const origDocument = globalThis.document;
  const origWindow = globalThis.window;

  afterEach(() => {
    resetHostedFeedbackForTests();
    (globalThis as unknown as { document: unknown }).document = origDocument;
    (globalThis as unknown as { window: unknown }).window = origWindow;
  });

  function setupMockDom() {
    const roots = new Map<string, HTMLElement>();
    const makeRoot = () => {
      const node = {
        id: '',
        isConnected: true,
        dataset: {} as Record<string, string>,
        replaceChildren: () => undefined,
        remove: () => {
          if (node.id) roots.delete(node.id);
        },
      };
      return node as unknown as HTMLElement;
    };
    (globalThis as unknown as { window: unknown }).window = {
      location: { origin: 'https://demo.yolo-dev.ai' },
    };
    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => roots.get(id) ?? null,
      createElement: () => makeRoot(),
      body: {
        append: (node: HTMLElement) => {
          if (node.id) roots.set(node.id, node);
        },
      },
    };
    return roots;
  }

  it('loads https://yolo-dev.ai/feedback/v1.mjs, prepares styles, mounts with app id "demo", and passes current page context', async () => {
    const roots = setupMockDom();
    const prepareStyles = vi.fn().mockResolvedValue(undefined);
    const openSpy = vi.fn();
    let capturedGetContext: (() => { page?: string } | undefined) | undefined;

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
            capturedGetContext = opts.getContext;
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
  });

  it('falls back to same-origin /yolo/feedback/browser.js if the remote v1.mjs import fails', async () => {
    const roots = setupMockDom();
    const openSpy = vi.fn();

    const ok = await openHostedFeedback({
      page: 'Tetris',
      importer: async (url) => {
        if (url.startsWith(HOSTED_FEEDBACK_V1_URL)) {
          throw new Error('CDN unreachable');
        }
        expect(url).toBe(`https://demo.yolo-dev.ai${LOCAL_FEEDBACK_FALLBACK_URL}`);
        return {
          LIBRARY_VERSION: '0.1.0-alpha.57',
          mountFeedback: () => ({
            open: openSpy,
            close: () => undefined,
            destroy: () => undefined,
          }),
        };
      },
    });

    expect(ok).toBe(true);
    expect(openSpy).toHaveBeenCalledWith({ context: { page: 'Tetris' } });
    const root = roots.get('yolo-hosted-feedback-root');
    expect(root?.dataset.yoloFeedbackSource).toBe('local-fallback');
  });
});
