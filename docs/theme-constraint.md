# The theme constraint for the finish pass

Requirements for [#134](https://github.com/normzhou/yolo-blank-canvas/issues/134), and the proposal
that [needs a maintainer decision](https://github.com/normzhou/yolo-blank-canvas/issues/145).

> **Status: proposed, not applied.** No palette has been changed. The enforceable half of the rule set
> is already in the suite; the direction is not chosen.

## Why this document exists

The last time this app was given themes, it was given three palettes and they came out of the same
distribution. That is not a colour-selection failure. It is what happens when structure is undecided
and colour is the only free variable — and at the time, structure *was* undecided. The structure work
is now done and on the default branch (#130–#133), so the finish pass has something to finish.

The research behind this constraint was consistent about one thing: **adjectives do not change the
output, constraints do.** "Make it feel less generic" produces the same thing. A system with real
friction in it — where a choice can be *checked* — produces something else.

## Part 1 — the rules that bind every candidate

These are theme-independent, so they are enforced now, before any direction is chosen. Each bans a
specific documented tell rather than expressing taste. They live in
[`test/theme-discipline.test.ts`](../blob/main/test/theme-discipline.test.ts) and pass today.

| # | Rule | Banned tell |
| --- | --- | --- |
| 1 | Every `border-radius` names all four corners or one value for all four. | The single-rounded-side treatment, described in review as *"all but an exact fingerprint of Anthropic models"*. |
| 2 | No `border-left`/`border-right` wider than the 1px hairline. | The thick coloured accent bar — the most recognisable generated-UI tell. |
| 3 | No `font-size` below **12px**; body copy no lower than **14px**. | *"The default for some reason is to use nigh-illegibly small text."* |
| 4 | `--accent` is a real token in every theme, and used for **state** — active, selected, focus — never for surface tint. | Accent spreading into every card, border and background until nothing is emphasised. |
| 5 | No gradients anywhere in the theme surface. | The most-cited piece of the generated look. |
| 6 | Every text-bearing pair clears **WCAG ≥ 4.5:1 and APCA \|Lc\| ≥ 60**; every separation clears **\|Lc\| ≥ 8**. | Already fixed by `status-presentation.md` § Themes. Not reopened here. |
| 7 | Status is never carried by colour alone. | Already contract. Not reopened here. |

Rules 6 and 7 are unchanged and are cited rather than restated, because they are durable contract.

## Part 2 — three candidate constraints

The previous failure was three palettes from one distribution. The correction is **three constraints
from three different traditions**. Each is a system with a rule that can fail, not a mood.

### A — Ruled ledger

*Account books and manuscript ruled paper: ink on a ground, hairline rules, one accent for the column
being worked.*

- **Ground rule.** At most **one** tinted surface per theme. Every other surface is the paper or the
  ink. If a second surface tint is introduced, the rule has been broken.
- **Rule rule.** Separations are hairlines only. A surface may never be separated by more than one
  pixel of border or by elevation alone.
- **Accent rule.** The accent marks the thing currently being worked on, and nothing else.

*Why it has friction:* it forbids the most common move in generated UI — adding a card here, a tinted
panel there — by making the count itself the constraint.

### B — Terminal phosphor

*Monochrome CRT: a long neutral ramp, one accent, no colour in the surface at all.*

- **Ramp rule.** The neutral ramp between text and ground must span **at least nine distinguishable
  steps**. A palette that jumps text straight to background is not a ramp; it is two colours.
- **Colour rule.** The only chromatic value in the surface is the accent. Status uses the accent and
  the ramp — never a second hue.
- **Glow rule.** No text-shadow, no bloom, no scanline.

*Why it has friction:* it forbids using hue to carry meaning, which is the thing every generated
palette does first.

### C — Mineral pigment

*Ground mineral pigment on vellum. Five pigments, each with one fixed duty, mixed by rule.*

- **Pair rule.** **Every pair of the five must clear the contrast floor against each other** — ten
  pairs, all tested, not just text-on-ground. This is the rule borrowed from the research: *"five base
  colours, and every pair has to earn its contrast."*
- **Duty rule.** Each pigment has exactly one job and is never reused. There is no "also a subtle
  hover".
- **Mixing rule.** No value is hand-picked; every value is a stated ratio of two pigments or one
  pigment and its ground.

*Why it has friction:* the ten-pair requirement is a test that will fail, repeatedly, until the
palette is actually designed rather than chosen.

## Part 3 — what choosing one commits to

Choosing a candidate means:

1. It becomes the **rule set**, written into `status-presentation.md` § Themes as checkable
   properties, and enforced in the suite. It is not a description.
2. It is applied across the existing three modes. The modes are not the axis of variation — **the
   constraint is.** Slate, Sand and Dusk stop being three palettes and become light, warm and dark
   instances of one system.
3. Any existing theme that cannot satisfy the chosen rule set is replaced, not adjusted.

## What is deliberately not claimed

- **No candidate is recommended here.** Each is defensible; the choice is a taste decision and
  belongs to the maintainer. A recommendation would be one more opinion from the same distribution
  that produced three identical palettes.
- **Captures are not byte-reproducible.** Two back-to-back runs differ in 15 of 75 images, all 12 of
  them motion frames sampled from an unfrozen CSS animation at wall-clock offsets — non-reproducible
  by design, as `e2e/motion.spec.ts` documents. Visual acceptance therefore rests on the content guard
  (`e2e/determinism.spec.ts`, which compares text, computed styles and geometry) plus human inspection
  of the images — **not** on pixel diffs. See the linked issue.