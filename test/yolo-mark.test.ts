import { describe, expect, it, vi } from 'vitest';
import {
  HOSTED_YOLO_MARK_URL,
  animateYoloMark,
  motion,
  mountHostedYoloMark,
  randomTurn,
  renderMark,
} from '../src/client/brand/yoloMark';

function createFakeMarkDom() {
  const listeners = new Map<string, Set<EventListener>>();
  const docListeners = new Map<string, Set<EventListener>>();
  const winListeners = new Map<string, Set<EventListener>>();
  const appended: Array<{
    tag: string;
    attrs: Record<string, string>;
    children: unknown[];
    style: { opacity: string; filter: string };
  }> = [];
  let rafCallback: ((now: number) => void) | undefined;
  let nowMs = 1000;

  const add = (map: Map<string, Set<EventListener>>, type: string, fn: EventListener) => {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type)!.add(fn);
  };
  const remove = (map: Map<string, Set<EventListener>>, type: string, fn: EventListener) => {
    map.get(type)?.delete(fn);
  };
  const emit = (map: Map<string, Set<EventListener>>, type: string, event: Record<string, unknown>) => {
    for (const fn of map.get(type) ?? []) {
      fn(event as unknown as Event);
    }
  };

  const inner = {
    style: { animation: '', opacity: '', filter: '' },
  };

  function makeSvgNode(tag: string) {
    const attrs: Record<string, string> = {};
    const children: unknown[] = [];
    const node = {
      tag,
      attrs,
      children,
      style: { opacity: '', filter: '' },
      setAttribute(k: string, v: string) {
        attrs[k] = v;
      },
      append(...items: unknown[]) {
        children.push(...items);
      },
      remove() {
        const idx = appended.indexOf(node);
        if (idx >= 0) appended.splice(idx, 1);
      },
    };
    return node;
  }

  let animationsCount = 0;

  const doc = {
    hidden: false,
    defaultView: null as unknown,
    createElementNS(_ns: string, tag: string) {
      return makeSvgNode(tag);
    },
    addEventListener: (type: string, fn: EventListener) => add(docListeners, type, fn),
    removeEventListener: (type: string, fn: EventListener) => remove(docListeners, type, fn),
  };

  const view = {
    matchMedia: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
    getComputedStyle: () => ({ transform: 'none' }),
    requestAnimationFrame: (cb: (now: number) => void) => {
      rafCallback = cb;
      return 1;
    },
    cancelAnimationFrame: () => {
      rafCallback = undefined;
    },
    performance: {
      now: () => nowMs,
    },
    crypto: {
      randomUUID: () => 'test-uuid-53',
    },
    addEventListener: (type: string, fn: EventListener) => add(winListeners, type, fn),
    removeEventListener: (type: string, fn: EventListener) => remove(winListeners, type, fn),
  };
  doc.defaultView = view;

  const mark = {
    ownerDocument: doc,
    clientWidth: 34,
    clientHeight: 34,
    dataset: {} as Record<string, string>,
    style: { transformOrigin: '', transform: '' },
    querySelector: (sel: string) => (sel === '.yolo-mark__motion' ? inner : null),
    getClientRects: () => [{ width: 34, height: 34 }],
    getBoundingClientRect: () => ({ left: 100, top: 20, width: 34, height: 34 }),
    animate: () => {
      animationsCount += 1;
      return {
        cancel: () => undefined,
        finished: Promise.resolve(),
      };
    },
    append: (node: ReturnType<typeof makeSvgNode>) => {
      appended.push(node);
    },
    addEventListener: (type: string, fn: EventListener) => add(listeners, type, fn),
    removeEventListener: (type: string, fn: EventListener) => remove(listeners, type, fn),
    getAttribute: () => null,
  };

  return {
    mark: mark as unknown as SVGElement,
    inner,
    appended,
    getAnimationsCount: () => animationsCount,
    emitTrigger: (type: string, ev: Record<string, unknown> = {}) => emit(listeners, type, ev),
    emitDoc: (type: string, ev: Record<string, unknown> = {}) => emit(docListeners, type, ev),
    stepFrame: (deltaMs: number) => {
      nowMs += deltaMs;
      const cb = rafCallback;
      rafCallback = undefined;
      cb?.(nowMs);
    },
  };
}

describe('YOLO mark v0.1.0-alpha.53 motion and hosted v1 channel (#282)', () => {
  it('renders the Threefold symbol SVG and builds spin/wiggle motion plans', () => {
    const svg = renderMark({ decorative: true });
    expect(svg).toContain('viewBox="0 0 96 96"');
    expect(svg).toContain('aria-hidden="true"');
    expect(randomTurn(1, () => 0.1)).toBe(0);
    expect(randomTurn(1, () => 0.8)).toBeGreaterThanOrEqual(120);
    const spinPlan = motion(120, 0, () => 0.25, 1);
    expect(spinPlan.spin).toBe(true);
    expect(spinPlan.turn).toBe(120);
  });

  it('plays on mouse hover, accelerates into the radial density disk on hold, activates on release inside, and cancels on release outside', () => {
    const env = createFakeMarkDom();
    const onActivate = vi.fn();
    const ctrl = animateYoloMark(env.mark, { onActivate });

    // 1. Mouse hover triggers play()
    const beforeHover = env.getAnimationsCount();
    env.emitTrigger('pointerenter', { pointerType: 'mouse' });
    expect(env.getAnimationsCount()).toBe(beforeHover + 1);

    // 2. Press-and-hold creates the radial density-gradient trail and accelerates spin
    env.emitTrigger('pointerdown', { button: 0, isPrimary: true, pointerId: 7 });
    expect(env.appended.length).toBe(1);
    expect(env.appended[0].attrs.class).toBe('yolo-mark__trail');

    for (let i = 0; i < 30; i += 1) {
      env.stepFrame(50);
    }
    expect(Number(env.appended[0].style.opacity)).toBeGreaterThan(0);
    expect(Number(env.inner.style.opacity)).toBeLessThan(1);

    // 3. Releasing outside the mark cancels activation (does not call onActivate)
    env.emitDoc('pointerup', { pointerId: 7, clientX: 10, clientY: 10 });
    expect(onActivate).not.toHaveBeenCalled();

    // 4. Pressing and releasing inside the mark calls onActivate once
    env.emitTrigger('pointerdown', { button: 0, isPrimary: true, pointerId: 8 });
    env.emitDoc('pointerup', { pointerId: 8, clientX: 117, clientY: 37 });
    expect(onActivate).toHaveBeenCalledTimes(1);

    // 5. Keyboard click (detail === 0, no pointerType) calls onActivate once
    env.emitTrigger('click', { detail: 0 });
    expect(onActivate).toHaveBeenCalledTimes(2);

    ctrl.destroy();
  });

  it('mounts the local fallback immediately and upgrades in-place when https://yolo-dev.ai/feedback/v1.mjs resolves', async () => {
    const env = createFakeMarkDom();
    const localDestroySpy = vi.fn();
    const remoteDestroy = vi.fn();
    const remotePlay = vi.fn();

    const ctrl = mountHostedYoloMark(env.mark, {
      importer: async (url) => {
        expect(url).toBe(HOSTED_YOLO_MARK_URL);
        return {
          LIBRARY_VERSION: '0.1.0-alpha.53',
          animateYoloMark: () => {
            localDestroySpy();
            return {
              play: remotePlay,
              destroy: remoteDestroy,
            };
          },
        };
      },
    });

    expect(env.mark.dataset.yoloMarkSource).toBe('local');
    await Promise.resolve();
    await Promise.resolve();

    expect(env.mark.dataset.yoloMarkSource).toBe('hosted-v1');
    expect(env.mark.dataset.yoloMarkVersion).toBe('0.1.0-alpha.53');
    ctrl.play();
    expect(remotePlay).toHaveBeenCalledTimes(1);

    ctrl.destroy();
    expect(remoteDestroy).toHaveBeenCalledTimes(1);
  });

  it('retains the local v0.1.0-alpha.53 controller cleanly if the remote import fails', async () => {
    const env = createFakeMarkDom();
    const ctrl = mountHostedYoloMark(env.mark, {
      importer: async () => {
        throw new Error('offline');
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(env.mark.dataset.yoloMarkSource).toBe('local');
    ctrl.destroy();
  });
});
