# Optional YOLO mark

Use these assets when the client wants YOLO branding. They are part of this
versioned skill; copying them does not require a hosting account, shared login
or requests to yolo-dev.ai. Keep the client's design and deployment choices.

For the complete in-app feedback button, use the [prewired feedback launcher](client-feedback-library.md#install-and-mount-the-same-implementation).
It bundles this mark with the panel and existing-login handoff; no manual click
wiring or separate brand copy is needed. The assets below remain useful for
decorative marks, sign-in pages and custom controls.

Resolve `assets/brand/` relative to the skill folder you actually loaded. For a
repo-local installation this is `.agents/skills/yolo/assets/brand/`.

| File | Use |
| --- | --- |
| `yolo-mark-static.svg` | Still mark, favicon, or the interactive helper's image. |
| `yolo-mark.svg` | Image-only idle wiggles/spins; a varied repeating sequence, no JavaScript. |
| `yolo-mark.mjs` | Shared idle/hover/hold/release motion, activation callback and inline SVG/CSS exports. |

Copy the selected files into the app's existing public-assets directory or
asset pipeline. Serve the copies with the app; do not point browser URLs into
the installed skill directory. There is no automatic branding insertion or
client-repository modification during skill installation.

For example, after copying to `public/brand/` in an app that serves `public/`:

```html
<img src="/brand/yolo-mark.svg" width="40" height="40" alt="YOLO">
```

For the full shared interaction, use a static fallback image in a native labelled button:

```html
<button id="mark-button" type="button" aria-label="Animate YOLO symbol">
  <img id="mark" src="/brand/yolo-mark-static.svg"
       width="40" height="40" alt="">
</button>
```

Initialize from an existing application JavaScript module:

```js
import {animateYoloMark} from '/brand/yolo-mark.mjs';
const motion = animateYoloMark(document.querySelector('#mark'), {
  trigger: document.querySelector('#mark-button'),
  // Optional: onActivate: () => yourAppAction()
});
// motion.play() triggers a random motion; motion.destroy() removes timers/listeners.
```

One helper owns every gesture. Hover runs the same randomized motion; holding
accelerates into a translucent disk, denser at the center and thinner toward the tips, and release coasts to an aligned stop/wiggle.
Release over the mark invokes `onActivate` once; release away/cancel/blur does
not. Native keyboard/assistive activation also invokes it; touch/pen share the
same pointer path. Give action buttons an accurate label. Decorative marks omit
the callback. Each instance keeps independent randomized timing, with the same
motion rules, and respects reduced motion/document visibility.

Use `destroy()` on unmount. For image callers, the helper keeps the original image
reference and temporarily shows the same inline SVG beside it, restoring the
image on cleanup. This avoids stacked image/helper animation and supports the
shared blur. Prefer the static image fallback with the helper. Do not add separate
click/pointer/hover motion handlers; supply only the location's action.

Keep the app's security policy. If a CSP also applies to SVG asset responses,
the animated SVG needs its exact embedded stylesheet hash in `style-src`.
Compute `sha256-` plus the base64 SHA-256 of the module's exported `idleCss`
using the app's build tooling; avoid a blanket inline-style exception. The static
image plus helper uses the app's approved module policy instead. Serve `.mjs`
with a JavaScript MIME type, or import it through the app's bundler.

For server-rendered inline marks, the module exports `renderMark({decorative:true})`
and `idleCss`. Initialize the inline SVG with the same helper for full gestures;
pass no activation callback on decorative sign-in/consent marks. Place the CSS in the app's existing approved stylesheet or
nonce-scoped style. Decorative marks should remain hidden from assistive
technology when nearby text already names them. Images use the original red;
inline SVG can override `color`. No tracking or external resources are included.

For explicit remote motion/UI updates, the optional [hosted v1 profile](hosted-feedback.md) also exports the same mark helpers. Local images/modules remain supported; installing a skill does not enable remote code.
