/**
 * Official YOLO Dev Threefold symbol geometry, hover/hold-to-spin radial density
 * disk motion, and optional hosted v1 channel (`yolo-mark.mjs` from `v0.1.0-alpha.53`
 * `.agents/skills/yolo/assets/brand/yolo-mark.mjs` and `https://yolo-dev.ai/feedback/v1.mjs`).
 *
 * - Mouse entry (`pointerenter` with `pointerType === 'mouse'`) triggers a random
 *   wiggle or 120°-step spin (`alpha.44`).
 * - Press-and-hold (`pointerdown`) accelerates rotation up to 7200 deg/s and blends
 *   into a filled translucent radial density-gradient disk (`yolo-mark-density-*`)
 *   whose stop opacities match the angular coverage `3 * asin(4 / r) / π` of the
 *   three 8-unit square-capped arms (`alpha.47`, `alpha.49`, `alpha.50`).
 * - Releasing inside the symbol invokes `onActivate` and coasts to the nearest 120°
 *   pose with a directional settle wiggle; releasing outside cancels activation and
 *   coasts to rest (`alpha.47`, `alpha.49`).
 * - `mountHostedYoloMark` mounts the local `v0.1.0-alpha.53` controller immediately
 *   and upgrades in place from `https://yolo-dev.ai/feedback/v1.mjs` when reachable
 *   in the browser (`alpha.52`, `references/hosted-feedback.md`).
 */

export const HOSTED_YOLO_MARK_URL = 'https://yolo-dev.ai/feedback/v1.mjs';

export function renderMark({ decorative = false }: { decorative?: boolean } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" color="#d84b27" class="yolo-mark" ${
    decorative ? 'aria-hidden="true"' : 'role="img" aria-label="Threefold symbol"'
  }><g class="yolo-mark__motion" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square"><path d="M48 48v30"/><path d="M48 48v30" transform="rotate(120 48 48)"/><path d="M48 48v30" transform="rotate(240 48 48)"/></g></svg>`;
}

const between = (min: number, max: number, random: () => number = Math.random): number =>
  min + random() * (max - min);

export function randomTurn(wiggleSteps: number, random: () => number = Math.random): number {
  // Each successive step receives a third of the remaining probability.
  const step = Math.floor(Math.log1p(-random()) / Math.log(2 / 3));
  return Math.max(0, step - wiggleSteps + 1) * 120;
}

export interface YoloMarkMotionPlan {
  frames: Keyframe[];
  duration: number;
  easing: string;
  spin: boolean;
  turn: number;
}

export function motion(
  turnSize: number,
  start = 0,
  random: () => number = Math.random,
  settledDirection?: 1 | -1,
): YoloMarkMotionPlan {
  const spin = turnSize !== 0;
  const direction = settledDirection ?? (random() < 0.5 ? -1 : 1);
  const angle = between(5, 9, random) * direction;
  const turn = turnSize * direction;
  // sqrt(angle) keeps acceleration consistent as larger turns get more time.
  const rotationDuration = spin ? 500 * Math.sqrt(Math.abs(turn - start) / 120) : 0;
  const settleDuration = spin ? between(120, 160, random) : between(500, 950, random);
  const duration = rotationDuration + settleDuration;
  const arrival = rotationDuration / duration;
  const frames: Keyframe[] = spin
    ? [
        // These segment curves are t² and 1 - (1 - t)²: accelerate, then decelerate.
        {
          transform: `rotate(${start}deg)`,
          offset: 0,
          easing: 'cubic-bezier(0.3333333333333333, 0, 0.6666666666666666, 0.3333333333333333)',
        },
        {
          transform: `rotate(${(start + turn) / 2}deg)`,
          offset: arrival / 2,
          easing: 'cubic-bezier(0.3333333333333333, 0.6666666666666666, 0.6666666666666666, 1)',
        },
        { transform: `rotate(${turn}deg)`, offset: arrival, easing: 'ease-in-out' },
        {
          transform: `rotate(${turn + angle}deg)`,
          offset: arrival + (1 - arrival) * 0.3,
          easing: 'ease-in-out',
        },
        {
          transform: `rotate(${turn - angle * 0.65}deg)`,
          offset: arrival + (1 - arrival) * 0.65,
          easing: 'ease-in-out',
        },
        {
          transform: `rotate(${turn + angle * 0.15}deg)`,
          offset: arrival + (1 - arrival) * 0.86,
          easing: 'ease-in-out',
        },
        { transform: `rotate(${turn}deg)`, offset: 1 },
      ]
    : [
        { transform: `rotate(${start}deg)`, offset: 0 },
        { transform: `rotate(${angle}deg)`, offset: between(0.25, 0.35, random) },
        { transform: `rotate(${-angle * 0.65}deg)`, offset: between(0.6, 0.75, random) },
        { transform: `rotate(${angle * 0.15}deg)`, offset: 0.88 },
        { transform: 'rotate(0deg)', offset: 1 },
      ];
  return { frames, duration, easing: spin ? 'linear' : 'ease-in-out', spin, turn };
}

export interface YoloMarkOptions {
  trigger?: HTMLElement | SVGElement;
  onActivate?: () => void;
}

export interface YoloMarkController {
  play: () => void;
  press: () => void;
  release: () => void;
  destroy: () => void;
}

interface CoastState {
  start: number;
  speed: number;
  target: number;
  brake: number;
  duration: number;
  time: number;
}

let densityCounter = 0;

export function animateYoloMark(
  mark: SVGElement | HTMLElement,
  { trigger = mark, onActivate }: YoloMarkOptions = {},
): YoloMarkController {
  const doc = mark.ownerDocument;
  const view = doc.defaultView;
  if (!view || typeof view.matchMedia !== 'function') {
    return {
      play: () => undefined,
      press: () => undefined,
      release: () => undefined,
      destroy: () => undefined,
    };
  }

  const touchAction = trigger.style.touchAction;
  const userSelect = trigger.style.userSelect;
  trigger.style.touchAction = 'none';
  trigger.style.userSelect = 'none';

  let pointer: number | undefined;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Animation | undefined;
  let frame: number | undefined;
  let spinning = false;
  let destroyed = false;
  let phase: 'holding' | 'coasting' | undefined;
  let angle = 0;
  let speed = 0;
  let direction: 1 | -1 = 1;
  let last = 0;
  let coast: CoastState | undefined;
  let trail: SVGGElement | undefined;

  mark.style.transformOrigin = 'center';
  const inner = mark.querySelector<HTMLElement | SVGElement>('.yolo-mark__motion');
  if (inner) inner.style.animation = 'none';

  function currentRotationDeg(): number {
    if (!view) return 0;
    try {
      const transform = view.getComputedStyle(mark).transform;
      if (transform && transform !== 'none' && typeof view.DOMMatrixReadOnly === 'function') {
        const matrix = new view.DOMMatrixReadOnly(transform);
        return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
      }
    } catch {
      // Fallback to 0 when transform parsing is unavailable.
    }
    return 0;
  }

  function schedule() {
    clearTimeout(timer);
    if (!destroyed && !reduced.matches && !doc.hidden) {
      timer = setTimeout(() => play(randomTurn(3)), between(3200, 7600));
    }
  }

  function play(turnSize = randomTurn(1), from?: number, settledDirection?: 1 | -1) {
    if (destroyed || spinning || phase || !view) return;
    clearTimeout(timer);
    if (reduced.matches || doc.hidden) return;
    if (typeof mark.getClientRects === 'function' && mark.getClientRects().length === 0) {
      schedule();
      return;
    }
    const start = from ?? currentRotationDeg();
    running?.cancel();
    mark.style.transform = 'rotate(0deg)';
    if (typeof mark.animate !== 'function') {
      schedule();
      return;
    }
    const plan = motion(turnSize, start, Math.random, settledDirection);
    const animation = mark.animate(plan.frames, { duration: plan.duration, easing: plan.easing });
    running = animation;
    spinning = plan.spin;
    animation.finished.then(
      () => {
        if (running !== animation) return;
        running = undefined;
        spinning = false;
        schedule();
      },
      () => undefined,
    );
  }

  // Holding is local animation only: never polls or invokes an app callback.
  function paint() {
    mark.style.transform = `rotate(${angle}deg)`;
    const blur = Math.max(0, Math.min(1, (speed - 1600) / 2800));
    if (trail) trail.style.opacity = String(blur);
    if (inner) {
      inner.style.opacity = String(1 - blur);
      inner.style.filter = `blur(${blur * 0.8}px)`;
    }
  }

  function settle() {
    phase = undefined;
    speed = 0;
    if (trail) trail.style.opacity = '0';
    if (inner) {
      inner.style.opacity = '1';
      inner.style.filter = '';
    }
    // Whole 120° turns are identical; settle from the equivalent nearby pose.
    const from = ((((angle + 60) % 120) + 120) % 120) - 60;
    play(0, from, direction);
  }

  function advance(now: number) {
    frame = undefined;
    if (!phase || destroyed || reduced.matches || doc.hidden || !view) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (phase === 'holding') {
      const next = Math.min(7200, speed + 2400 * dt);
      angle += direction * (speed + next) * 0.5 * dt;
      speed = next;
    } else if (coast) {
      const t = Math.min(coast.duration, (now - coast.time) / 1000);
      angle = coast.start + direction * (coast.speed * t - 0.5 * coast.brake * t * t);
      speed = Math.max(0, coast.speed - coast.brake * t);
      if (t >= coast.duration) {
        angle = coast.target;
        settle();
        return;
      }
    }
    paint();
    frame = view.requestAnimationFrame(advance);
  }

  function press() {
    if (destroyed || phase === 'holding' || reduced.matches || doc.hidden || !view) return;
    clearTimeout(timer);
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    const resume = phase === 'coasting';
    if (!resume) {
      angle = currentRotationDeg();
      direction = Math.random() < 0.5 ? -1 : 1;
      speed = 0;
    }
    running?.cancel();
    running = undefined;
    spinning = false;
    phase = 'holding';
    if (!trail) {
      const svg = <K extends keyof SVGElementTagNameMap>(
        tag: K,
        attributes: Record<string, string | number> = {},
      ): SVGElementTagNameMap[K] => {
        const element = doc.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attributes)) {
          element.setAttribute(key, String(value));
        }
        return element;
      };
      const uuid =
        typeof view.crypto?.randomUUID === 'function'
          ? view.crypto.randomUUID()
          : `local-${++densityCounter}`;
      const id = `yolo-mark-density-${uuid}`;
      const radius = Math.hypot(34, 4); // 30-unit arm + 4-unit square cap/half-width.
      const gradient = svg('radialGradient', {
        id,
        gradientUnits: 'userSpaceOnUse',
        cx: 48,
        cy: 48,
        r: radius,
      });
      // Angular coverage of three rotating rectangles, not a luminous rim:
      // full coverage at the hub, then 3*asin(halfWidth/r)/pi until the tip.
      for (const r of [0, 4 / Math.sin(Math.PI / 3), 6, 8, 10, 12, 16, 20, 24, 28, 30, 32, 34, radius]) {
        const coverage =
          r === 0
            ? 1
            : Math.min(
                1,
                (3 / Math.PI) *
                  Math.max(0, Math.asin(Math.min(1, 4 / r)) - (r > 34 ? Math.acos(34 / r) : 0)),
              );
        gradient.append(
          svg('stop', {
            offset: r / radius,
            'stop-color': 'currentColor',
            'stop-opacity': coverage,
          }),
        );
      }
      const defs = svg('defs');
      defs.append(gradient);
      trail = svg('g', { class: 'yolo-mark__trail', 'pointer-events': 'none', opacity: 0 });
      trail.append(defs, svg('circle', { cx: 48, cy: 48, r: radius, fill: `url(#${id})` }));
      trail.style.filter = 'blur(.65px)';
      mark.append(trail);
    }
    last = view.performance.now();
    paint();
    frame = view.requestAnimationFrame(advance);
  }

  function release() {
    if (phase !== 'holding' || !view) return;
    if (speed < 300) {
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      frame = undefined;
      settle();
      return;
    }
    const distance = (speed * speed) / (2 * 3200);
    const target = Math.ceil((direction * angle + distance) / 120) * 120;
    const travel = target - direction * angle;
    coast = {
      start: angle,
      speed,
      target: direction * target,
      brake: (speed * speed) / (2 * travel),
      duration: (2 * travel) / speed,
      time: view.performance.now(),
    };
    phase = 'coasting';
  }

  function disabled(): boolean {
    return (
      (trigger as HTMLButtonElement).disabled === true ||
      trigger.getAttribute('aria-disabled') === 'true'
    );
  }

  function cancelPress(event?: PointerEvent | Event) {
    if (
      event &&
      'pointerId' in event &&
      typeof event.pointerId === 'number' &&
      event.pointerId !== pointer
    ) {
      return;
    }
    const id = pointer;
    pointer = undefined;
    if (id === undefined) return;
    release();
    try {
      if (typeof trigger.hasPointerCapture === 'function' && trigger.hasPointerCapture(id)) {
        trigger.releasePointerCapture(id);
      }
    } catch {
      // Ignore pointer capture release errors on detached/synthetic targets.
    }
  }

  function sync() {
    cancelPress();
    clearTimeout(timer);
    running?.cancel();
    running = undefined;
    spinning = false;
    if (frame !== undefined && view) view.cancelAnimationFrame(frame);
    frame = undefined;
    phase = undefined;
    speed = 0;
    mark.style.transform = '';
    if (trail) trail.style.opacity = '0';
    if (inner) {
      inner.style.opacity = '1';
      inner.style.filter = '';
    }
    schedule();
  }

  const hover = (event: Event) => {
    if ((event as PointerEvent).pointerType === 'mouse') play();
  };

  function pressGesture(event: Event) {
    const pe = event as PointerEvent;
    if (destroyed || disabled() || pe.button !== 0 || !pe.isPrimary || pointer !== undefined) {
      return;
    }
    pointer = pe.pointerId;
    try {
      trigger.setPointerCapture?.(pe.pointerId);
    } catch {
      // Document release fallback.
    }
    press();
  }

  function releaseGesture(event: Event) {
    const pe = event as PointerEvent;
    if (pe.pointerId !== pointer) return;
    const bounds = trigger.getBoundingClientRect();
    const markBounds = mark.getBoundingClientRect();
    const halfW = (mark.clientWidth || markBounds.width || bounds.width) / 2;
    const halfH = (mark.clientHeight || markBounds.height || bounds.height) / 2;
    const inside =
      Math.abs(pe.clientX - bounds.left - bounds.width / 2) <= halfW &&
      Math.abs(pe.clientY - bounds.top - bounds.height / 2) <= halfH;
    cancelPress();
    if (inside && !doc.hidden && !destroyed && !disabled()) {
      onActivate?.();
    }
  }

  function activate(event: Event) {
    const me = event as MouseEvent & { pointerType?: string };
    // Pointer-up owns pointer activation; native keyboard/assistive clicks have
    // no pointer sequence. Neither path can double-fire the location's action.
    if (me.detail === 0 && !me.pointerType && pointer === undefined && !destroyed && !disabled()) {
      play();
      onActivate?.();
    }
  }

  const preventMenu = (event: Event) => event.preventDefault();

  trigger.addEventListener('pointerenter', hover);
  trigger.addEventListener('pointerdown', pressGesture);
  trigger.addEventListener('lostpointercapture', cancelPress);
  trigger.addEventListener('contextmenu', preventMenu);
  trigger.addEventListener('click', activate);
  doc.addEventListener('pointerup', releaseGesture, true);
  doc.addEventListener('pointercancel', cancelPress, true);
  view.addEventListener('blur', cancelPress);
  reduced.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', sync);
  sync();

  return {
    play: () => play(),
    press,
    release,
    destroy() {
      destroyed = true;
      cancelPress();
      clearTimeout(timer);
      running?.cancel();
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      phase = undefined;
      trail?.remove();
      mark.style.transform = '';
      if (inner) {
        inner.style.opacity = '';
        inner.style.filter = '';
      }
      trigger.removeEventListener('pointerenter', hover);
      trigger.removeEventListener('click', activate);
      trigger.removeEventListener('pointerdown', pressGesture);
      trigger.removeEventListener('lostpointercapture', cancelPress);
      trigger.removeEventListener('contextmenu', preventMenu);
      doc.removeEventListener('pointerup', releaseGesture, true);
      doc.removeEventListener('pointercancel', cancelPress, true);
      view.removeEventListener('blur', cancelPress);
      trigger.style.touchAction = touchAction;
      trigger.style.userSelect = userSelect;
      reduced.removeEventListener('change', sync);
      doc.removeEventListener('visibilitychange', sync);
    },
  };
}

export interface HostedYoloMarkModule {
  animateYoloMark?: (
    mark: SVGElement | HTMLElement,
    options?: YoloMarkOptions,
  ) => { play?: () => void; press?: () => void; release?: () => void; destroy: () => void };
  LIBRARY_VERSION?: string;
}

export interface MountHostedYoloMarkOptions extends YoloMarkOptions {
  /** Remote module URL (defaults to `https://yolo-dev.ai/feedback/v1.mjs`; pass `null` to stay local-only). */
  remoteUrl?: string | null;
  /** Optional custom importer for deterministic unit testing. */
  importer?: (url: string) => Promise<HostedYoloMarkModule>;
}

let cachedHostedMarkPromise: Promise<HostedYoloMarkModule> | null = null;
let cachedHostedMarkUrl: string | null = null;

function loadHostedMarkModule(
  url: string,
  importer?: (url: string) => Promise<HostedYoloMarkModule>,
): Promise<HostedYoloMarkModule> {
  if (importer) return importer(url);
  if (cachedHostedMarkPromise && cachedHostedMarkUrl === url) {
    return cachedHostedMarkPromise;
  }
  cachedHostedMarkUrl = url;
  cachedHostedMarkPromise = import(/* @vite-ignore */ url) as Promise<HostedYoloMarkModule>;
  return cachedHostedMarkPromise;
}

/**
 * Mounts the local `v0.1.0-alpha.53` `animateYoloMark` immediately so the Y mark is
 * interactive with zero latency and in offline/deterministic environments, then
 * upgrades in-place from `https://yolo-dev.ai/feedback/v1.mjs` (`references/hosted-feedback.md`)
 * when reachable so compatible YOLO mark motion updates on `yolo-dev.ai` take effect
 * automatically without waiting for a skill upgrade.
 */
export function mountHostedYoloMark(
  mark: SVGElement | HTMLElement,
  {
    trigger = mark,
    onActivate,
    remoteUrl = HOSTED_YOLO_MARK_URL,
    importer,
  }: MountHostedYoloMarkOptions = {},
): YoloMarkController {
  let destroyed = false;
  let active: {
    play?: () => void;
    press?: () => void;
    release?: () => void;
    destroy: () => void;
  } = animateYoloMark(mark, { trigger, onActivate });
  mark.dataset.yoloMarkSource = 'local';

  if (remoteUrl) {
    void loadHostedMarkModule(remoteUrl, importer)
      .then((mod) => {
        if (destroyed || typeof mod?.animateYoloMark !== 'function') return;
        const next = mod.animateYoloMark(mark, { trigger, onActivate });
        if (!next || typeof next.destroy !== 'function') return;
        active.destroy();
        active = next;
        mark.dataset.yoloMarkSource = 'hosted-v1';
        if (typeof mod.LIBRARY_VERSION === 'string') {
          mark.dataset.yoloMarkVersion = mod.LIBRARY_VERSION;
        }
      })
      .catch(() => {
        // Keep the local v0.1.0-alpha.53 mark controller active when offline or blocked.
      });
  }

  return {
    play: () => active.play?.(),
    press: () => active.press?.(),
    release: () => active.release?.(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active.destroy();
      delete mark.dataset.yoloMarkSource;
      delete mark.dataset.yoloMarkVersion;
    },
  };
}
