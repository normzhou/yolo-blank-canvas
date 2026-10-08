# Variant options (`e2e/review/variants/`)

Stage 3 of the UI review, [#75](https://github.com/normzhou/yolo-blank-canvas/issues/75). Regenerate with:

```sh
npm run e2e:variants
```

## What these are

Each open visual question is rendered as **at least two named variants plus the current
app**, over the real app with the real stubbed data. Variants are applied as CSS over the
running page, so every image is a genuine render of the same DOM under a candidate style —
not a mockup and not a description. If a variant looks wrong here, it looks wrong in the
product.

The variants and their trade-offs are defined in `e2e/variants.spec.ts`, next to the CSS.
This directory is the output; the spec is the argument.

## Why they are renders and not descriptions

The maintainer said they do not have the input required to make design calls. Prose about a
layout is not that input. Screenshots of the actual thing are, and they are what made one
variant's failure visible during this stage: an early "wrap in priority order" variant was
supposed to stop Refresh being stranded on its own row at 390px, and the render showed it
produced exactly the same layout as the current app. It was rewritten. **A variant that has
not been looked at is not an option.**

## What this is not

This is not a second stylesheet. The winning variants get implemented properly afterwards,
and the losing ones get no code at all. Nothing here changes the status-presentation
contract: colour, size and layout are decoration, and the label→text mappings are untouched.
