# Review evidence (`e2e/review/`)

Evidence for the UI review, [#75](https://github.com/normzhou/yolo-blank-canvas/issues/75). Regenerate with:

```sh
npm run e2e:visual   # visual/** — surfaces at desktop 1280x900 and narrow 390x844
npm run e2e:measure  # measurements/** — contrast, type scale and spacing read from the app
```

`motion/**` comes from `npm run e2e` and is **regenerated evidence, not reference**: the
backdrop crossfade is sampled mid-animation, so those frames are expected to differ run to
run. The determinism guard deliberately does not cover them.

## What is guaranteed

`e2e/determinism.spec.ts` requires two captures of the same surface, in the same run, to
agree on **rendered text, computed styles and element geometry**. That is deterministic by
construction, and it catches every cause of churn found so far: the wall clock in the panel
footer, `Math.random` in the Tetris 7-bag and music shuffle, captures taken before loading
finished, captures taken mid-fade, and a blinking text caret.

## What is not guaranteed

**PNG byte-equality is not achievable here.** After those causes were fixed, roughly 3–4 of
40 captures still differed between consecutive runs by a few hundred pixels, and *which*
ones varied from run to run. Text, computed styles and geometry were identical throughout, so
the residue is rasterization/compositor variance, not content.

Practical consequence: when you regenerate, a handful of images may show up in `git status`.
Open them before treating a diff as a real change — `git diff` on a PNG will not tell you
which it is. A structural or textual change moves a large region; noise moves a few dozen
pixels.
