// Shared, dependency-free brand geometry and motion. No browser globals at import.
export function renderMark({ decorative = false } = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" color="#d84b27" class="yolo-mark" ${decorative ? 'aria-hidden="true"' : 'role="img" aria-label="Threefold symbol"'}><g class="yolo-mark__motion" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square"><path d="M48 48v30"/><path d="M48 48v30" transform="rotate(120 48 48)"/><path d="M48 48v30" transform="rotate(240 48 48)"/></g></svg>`;
}
const between = (min, max, random = Math.random) => min + random() * (max - min);
function randomTurn(wiggleSteps, random = Math.random) {
    // Each successive step receives a third of the remaining probability.
    const step = Math.floor(Math.log1p(-random()) / Math.log(2 / 3));
    return Math.max(0, step - wiggleSteps + 1) * 120;
}
function motion(turnSize, start = 0, random = Math.random, settledDirection) {
    const spin = turnSize !== 0;
    const direction = settledDirection ?? (random() < 0.5 ? -1 : 1);
    const angle = between(5, 9, random) * direction;
    const turn = turnSize * direction;
    // sqrt(angle) keeps acceleration consistent as larger turns get more time.
    const rotationDuration = spin ? 500 * Math.sqrt(Math.abs(turn - start) / 120) : 0;
    const settleDuration = spin ? between(120, 160, random) : between(500, 950, random);
    const duration = rotationDuration + settleDuration;
    const arrival = rotationDuration / duration;
    const frames = spin ? [
        // These segment curves are t² and 1 - (1 - t)²: accelerate, then decelerate.
        { transform: `rotate(${start}deg)`, offset: 0, easing: "cubic-bezier(0.3333333333333333, 0, 0.6666666666666666, 0.3333333333333333)" },
        { transform: `rotate(${(start + turn) / 2}deg)`, offset: arrival / 2, easing: "cubic-bezier(0.3333333333333333, 0.6666666666666666, 0.6666666666666666, 1)" },
        { transform: `rotate(${turn}deg)`, offset: arrival, easing: "ease-in-out" },
        { transform: `rotate(${turn + angle}deg)`, offset: arrival + (1 - arrival) * 0.3, easing: "ease-in-out" },
        { transform: `rotate(${turn - angle * 0.65}deg)`, offset: arrival + (1 - arrival) * 0.65, easing: "ease-in-out" },
        { transform: `rotate(${turn + angle * 0.15}deg)`, offset: arrival + (1 - arrival) * 0.86, easing: "ease-in-out" },
        { transform: `rotate(${turn}deg)`, offset: 1 },
    ] : [
        { transform: `rotate(${start}deg)`, offset: 0 },
        { transform: `rotate(${angle}deg)`, offset: between(0.25, 0.35, random) },
        { transform: `rotate(${-angle * 0.65}deg)`, offset: between(0.6, 0.75, random) },
        { transform: `rotate(${angle * 0.15}deg)`, offset: 0.88 },
        { transform: "rotate(0deg)", offset: 1 },
    ];
    return { frames, duration, easing: spin ? 'linear' : 'ease-in-out', spin, turn };
}
// A deterministic varied idle cycle makes the standalone SVG/cacheable asset
// reproducible. Interactive users get a fresh random choice on every motion.
function declarativeIdle() {
    let seed = 0x79503421;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    let time = 0, rotation = 0;
    const keys = [{ time: 0, rotation: 0, easing: 'linear' }];
    for (let i = 0; i < 12; i++) {
        time += between(3200, 7600, random);
        const plan = motion(randomTurn(3, random), 0, random);
        for (const frame of plan.frames) {
            keys.push({
                time: time + frame.offset * plan.duration,
                rotation: rotation + Number(frame.transform.match(/rotate\(([^d]+)deg\)/)[1]),
                easing: frame.easing || plan.easing,
            });
        }
        time += plan.duration;
        rotation += plan.turn;
    }
    time += between(3200, 7600, random);
    keys.push({ time, rotation, easing: 'linear' });
    const frames = keys.map(k => `${(100 * k.time / time).toFixed(6)}%{transform:rotate(${k.rotation}deg);animation-timing-function:${k.easing}}`).join('');
    return `.yolo-mark__motion{transform-origin:48px 48px;animation:yolo-mark-idle ${time.toFixed(3)}ms linear infinite}@keyframes yolo-mark-idle{${frames}}@media(prefers-reduced-motion:reduce){.yolo-mark__motion{animation:none!important}}`;
}
export const idleCss = declarativeIdle();
export const animatedSvg = renderMark().replace('>', `><style>${idleCss}</style>`);
/**
 * @param {SVGSVGElement | HTMLImageElement} mark
 * @param {{trigger?: Element, onActivate?: () => void}} [options]
 */
export function animateYoloMark(mark, { trigger = mark, onActivate } = {}) {
    const doc = mark.ownerDocument;
    const view = doc.defaultView;
    // Keep image/component references intact. Only the inline sibling is animated,
    // so an image's own SVG animation cannot stack with the shared motion.
    const image = mark.localName === 'img' ? mark : undefined;
    const display = image?.style.display;
    if (image) {
        const holder = doc.createElement('template');
        holder.innerHTML = renderMark({ decorative: !image.alt || image.getAttribute('aria-hidden') === 'true' });
        const inline = holder.content.firstElementChild;
        inline.classList.add(...image.classList);
        for (const dimension of ['width', 'height'])
            inline.setAttribute(dimension, image.getAttribute(dimension) || String(image[dimension] || 40));
        if (image.alt && image.getAttribute('aria-hidden') !== 'true')
            inline.setAttribute('aria-label', image.alt);
        image.before(inline);
        image.style.display = 'none';
        if (trigger === image)
            trigger = inline;
        mark = inline;
    }
    const touchAction = trigger.style.touchAction, userSelect = trigger.style.userSelect;
    trigger.style.touchAction = 'none';
    trigger.style.userSelect = 'none';
    let pointer;
    const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
    let timer, running, frame, spinning = false, destroyed = false;
    let phase, angle = 0, speed = 0, direction = 1, last = 0, coast;
    let trail;
    mark.style.transformOrigin = 'center';
    const inner = mark.querySelector?.('.yolo-mark__motion');
    if (inner)
        inner.style.animation = 'none';
    function schedule() {
        clearTimeout(timer);
        if (!destroyed && !reduced.matches && !doc.hidden) {
            timer = setTimeout(() => play(randomTurn(3)), between(3200, 7600));
        }
    }
    function play(turnSize = randomTurn(1), from, settledDirection) {
        if (destroyed || spinning || phase)
            return;
        clearTimeout(timer);
        if (reduced.matches || doc.hidden)
            return;
        if (!mark.getClientRects().length) {
            schedule();
            return;
        }
        const matrix = new view.DOMMatrixReadOnly(view.getComputedStyle(mark).transform);
        const start = from ?? Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
        running?.cancel();
        mark.style.transform = 'rotate(0deg)';
        const plan = motion(turnSize, start, Math.random, settledDirection);
        const animation = mark.animate(plan.frames, { duration: plan.duration, easing: plan.easing });
        running = animation;
        spinning = plan.spin;
        animation.finished.then(() => {
            if (running !== animation)
                return;
            running = undefined;
            spinning = false;
            schedule();
        }, () => { });
    }
    // Holding is local animation only: never polls or invokes an app callback.
    function paint() {
        mark.style.transform = `rotate(${angle}deg)`;
        const blur = Math.max(0, Math.min(1, (speed - 1600) / 2800));
        if (trail)
            trail.style.opacity = String(blur);
        if (inner) {
            inner.style.opacity = String(1 - blur);
            inner.style.filter = `blur(${blur * .8}px)`;
        }
    }
    function settle() {
        phase = undefined;
        speed = 0;
        if (trail)
            trail.style.opacity = '0';
        if (inner) {
            inner.style.opacity = '1';
            inner.style.filter = '';
        }
        // Whole 120° turns are identical; settle from the equivalent nearby pose.
        const from = ((angle + 60) % 120 + 120) % 120 - 60;
        play(0, from, direction);
    }
    function advance(now) {
        frame = undefined;
        if (!phase || destroyed || reduced.matches || doc.hidden)
            return;
        const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
        last = now;
        if (phase === 'holding') {
            const next = Math.min(7200, speed + 2400 * dt);
            angle += direction * (speed + next) * .5 * dt;
            speed = next;
        }
        else {
            const t = Math.min(coast.duration, (now - coast.time) / 1000);
            angle = coast.start + direction * (coast.speed * t - .5 * coast.brake * t * t);
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
        if (destroyed || phase === 'holding' || reduced.matches || doc.hidden)
            return;
        clearTimeout(timer);
        view.cancelAnimationFrame(frame);
        const resume = phase === 'coasting';
        if (!resume) {
            const matrix = new view.DOMMatrixReadOnly(view.getComputedStyle(mark).transform);
            angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
            direction = Math.random() < .5 ? -1 : 1;
            speed = 0;
        }
        running?.cancel();
        running = undefined;
        spinning = false;
        phase = 'holding';
        if (!trail) {
            const svg = (tag, attributes = {}) => {
                const element = doc.createElementNS('http://www.w3.org/2000/svg', tag);
                for (const [key, value] of Object.entries(attributes))
                    element.setAttribute(key, String(value));
                return element;
            };
            const id = 'yolo-mark-density-' + view.crypto.randomUUID();
            const radius = Math.hypot(34, 4); // 30-unit arm + 4-unit square cap/half-width.
            const gradient = svg('radialGradient', { id, gradientUnits: 'userSpaceOnUse', cx: 48, cy: 48, r: radius });
            // Angular coverage of three rotating rectangles, not a luminous rim:
            // full coverage at the hub, then 3*asin(halfWidth/r)/pi until the tip.
            for (const r of [0, 4 / Math.sin(Math.PI / 3), 6, 8, 10, 12, 16, 20, 24, 28, 30, 32, 34, radius]) {
                const coverage = r === 0 ? 1 : Math.min(1, 3 / Math.PI * Math.max(0, Math.asin(Math.min(1, 4 / r)) - (r > 34 ? Math.acos(34 / r) : 0)));
                gradient.append(svg('stop', { offset: r / radius, 'stop-color': 'currentColor', 'stop-opacity': coverage }));
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
        if (phase !== 'holding')
            return;
        if (speed < 300) {
            view.cancelAnimationFrame(frame);
            frame = undefined;
            settle();
            return;
        }
        const distance = speed * speed / (2 * 3200);
        const target = Math.ceil((direction * angle + distance) / 120) * 120;
        const travel = target - direction * angle;
        coast = { start: angle, speed, target: direction * target, brake: speed * speed / (2 * travel), duration: 2 * travel / speed, time: view.performance.now() };
        phase = 'coasting';
    }
    function sync() {
        cancelPress();
        clearTimeout(timer);
        running?.cancel();
        running = undefined;
        spinning = false;
        view.cancelAnimationFrame(frame);
        frame = undefined;
        phase = undefined;
        speed = 0;
        mark.style.transform = '';
        if (trail)
            trail.style.opacity = '0';
        if (inner) {
            inner.style.opacity = '1';
            inner.style.filter = '';
        }
        schedule();
    }
    const hover = event => { if (event.pointerType === 'mouse')
        play(); };
    const disabled = () => trigger.disabled || trigger.getAttribute('aria-disabled') === 'true';
    function cancelPress(event) {
        if (event?.pointerId !== undefined && event.pointerId !== pointer)
            return;
        const id = pointer;
        pointer = undefined;
        if (id === undefined)
            return;
        release();
        if (trigger.hasPointerCapture?.(id))
            trigger.releasePointerCapture(id);
    }
    function pressGesture(event) {
        if (destroyed || disabled() || event.button !== 0 || !event.isPrimary || pointer !== undefined)
            return;
        pointer = event.pointerId;
        try {
            trigger.setPointerCapture(event.pointerId);
        }
        catch { /* document release fallback */ }
        press();
    }
    function releaseGesture(event) {
        if (event.pointerId !== pointer)
            return;
        const bounds = trigger.getBoundingClientRect();
        const inside = Math.abs(event.clientX - bounds.left - bounds.width / 2) <= mark.clientWidth / 2 && Math.abs(event.clientY - bounds.top - bounds.height / 2) <= mark.clientHeight / 2;
        cancelPress();
        if (inside && !doc.hidden && !destroyed && !disabled())
            onActivate?.();
    }
    function activate(event) {
        // Pointer-up owns pointer activation; native keyboard/assistive clicks have
        // no pointer sequence. Neither path can double-fire the location's action.
        if (event.detail === 0 && !event.pointerType && pointer === undefined && !destroyed && !disabled()) {
            play();
            onActivate?.();
        }
    }
    const preventMenu = event => event.preventDefault();
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
        press, release,
        destroy() {
            destroyed = true;
            cancelPress();
            clearTimeout(timer);
            running?.cancel();
            view.cancelAnimationFrame(frame);
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
            if (image) {
                mark.remove();
                image.style.display = display;
            }
            reduced.removeEventListener('change', sync);
            doc.removeEventListener('visibilitychange', sync);
        },
    };
}
