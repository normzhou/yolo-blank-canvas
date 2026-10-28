// Shared, dependency-free brand geometry and motion. No browser globals at import.
export function renderMark({decorative=false}={}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" color="#d84b27" class="yolo-mark" ${decorative?'aria-hidden="true"':'role="img" aria-label="Threefold symbol"'}><g class="yolo-mark__motion" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square"><path d="M48 48v30"/><path d="M48 48v30" transform="rotate(120 48 48)"/><path d="M48 48v30" transform="rotate(240 48 48)"/></g></svg>`;
}
const between = (min, max, random = Math.random) => min + random() * (max - min);
function randomTurn(wiggleSteps, random = Math.random) {
  // Each successive step receives a third of the remaining probability.
  const step = Math.floor(Math.log1p(-random()) / Math.log(2 / 3));
  return Math.max(0, step - wiggleSteps + 1) * 120;
}
function motion(turnSize, start = 0, random = Math.random) {
  const spin = turnSize !== 0;
  const direction = random() < 0.5 ? -1 : 1;
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
  return {frames,duration,easing:spin?'linear':'ease-in-out',spin,turn};
}

// A deterministic varied idle cycle makes the standalone SVG/cacheable asset
// reproducible. Interactive users get a fresh random choice on every motion.
function declarativeIdle() {
  let seed = 0x79503421;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let time = 0, rotation = 0;
  const keys = [{time: 0, rotation: 0, easing: 'linear'}];
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
  keys.push({time, rotation, easing: 'linear'});
  const frames = keys.map(k => `${(100 * k.time / time).toFixed(6)}%{transform:rotate(${k.rotation}deg);animation-timing-function:${k.easing}}`).join('');
  return `.yolo-mark__motion{transform-origin:48px 48px;animation:yolo-mark-idle ${time.toFixed(3)}ms linear infinite}@keyframes yolo-mark-idle{${frames}}@media(prefers-reduced-motion:reduce){.yolo-mark__motion{animation:none!important}}`;
}
export const idleCss=declarativeIdle();
export const animatedSvg=renderMark().replace('>',`><style>${idleCss}</style>`);

export function animateYoloMark(mark, {trigger = mark} = {}) {
  const doc = mark.ownerDocument;
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  let timer, running, spinning = false, destroyed = false;
  mark.style.transformOrigin = 'center';
  const inner = mark.querySelector?.('.yolo-mark__motion');
  if (inner) inner.style.animation = 'none';

  function schedule() {
    clearTimeout(timer);
    if (!destroyed && !reduced.matches && !doc.hidden) {
      timer = setTimeout(() => play(randomTurn(3)), between(3200, 7600));
    }
  }

  function play(turnSize = randomTurn(1)) {
    if (destroyed || spinning) return;
    clearTimeout(timer);
    if (reduced.matches || doc.hidden) return;
    const matrix = new view.DOMMatrixReadOnly(view.getComputedStyle(mark).transform);
    const start = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    running?.cancel();
    const plan = motion(turnSize, start);
    const animation = mark.animate(plan.frames, {duration: plan.duration, easing: plan.easing});
    running = animation;
    spinning = plan.spin;
    animation.finished.then(() => {
      if (running !== animation) return;
      running = undefined;
      spinning = false;
      schedule();
    }, () => {});
  }

  function sync() {
    clearTimeout(timer);
    running?.cancel();
    running = undefined;
    spinning = false;
    schedule();
  }

  const click = () => play();
  trigger.addEventListener('click', click);
  reduced.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', sync);
  sync();
  return {
    play: () => play(),
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      running?.cancel();
      trigger.removeEventListener('click', click);
      reduced.removeEventListener('change', sync);
      doc.removeEventListener('visibilitychange', sync);
    },
  };
}
