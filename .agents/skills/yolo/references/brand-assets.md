# Optional YOLO mark

Use these assets when the client wants YOLO branding. They are part of this
versioned skill; copying them does not require a hosting account, shared login
or requests to yolo-dev.ai. Keep the client's design and deployment choices.

Resolve `assets/brand/` relative to the skill folder you actually loaded. For a
repo-local installation this is `.agents/skills/yolo/assets/brand/`.

| File | Use |
| --- | --- |
| `yolo-mark-static.svg` | Still mark, favicon, or the interactive helper's image. |
| `yolo-mark.svg` | Image-only idle wiggles/spins; a varied repeating sequence, no JavaScript. |
| `yolo-mark.mjs` | The primary site's fresh randomized idle/click motion and shared inline SVG/CSS exports. |

Copy the selected files into the app's existing public-assets directory or
asset pipeline. Serve the copies with the app; do not point browser URLs into
the installed skill directory. There is no automatic branding insertion or
client-repository modification during skill installation.

For example, after copying to `public/brand/` in an app that serves `public/`:

```html
<img src="/brand/yolo-mark.svg" width="40" height="40" alt="YOLO">
```

For clickable motion, use the static image in a native labelled button:

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
  trigger: document.querySelector('#mark-button')
});
// motion.play() triggers a random motion; motion.destroy() removes timers/listeners.
```

Use `destroy()` when removing the component. Native button activation supports
keyboard use. Each instance is independent. Both animated forms respect
`prefers-reduced-motion`; the helper also pauses while the document is hidden.
Use the static image with the helper, rather than stacking it on the animated SVG.

Keep the app's security policy. If a CSP also applies to SVG asset responses,
the animated SVG needs its exact embedded stylesheet hash in `style-src`.
Compute `sha256-` plus the base64 SHA-256 of the module's exported `idleCss`
using the app's build tooling; avoid a blanket inline-style exception. The static
image plus helper uses the app's approved module policy instead. Serve `.mjs`
with a JavaScript MIME type, or import it through the app's bundler.

For server-rendered inline marks, the module exports `renderMark({decorative:true})`
and `idleCss`. Place the CSS in the app's existing approved stylesheet or
nonce-scoped style. Decorative marks should remain hidden from assistive
technology when nearby text already names them. Images use the original red;
inline SVG can override `color`. No tracking or external resources are included.
