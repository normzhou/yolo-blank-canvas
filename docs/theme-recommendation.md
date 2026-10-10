# Theme recommendation for the blank canvas

Research, recommendation and delivery for [#110](https://github.com/normzhou/yolo-blank-canvas/issues/110):
*"look at established free UI/UX resources, and propose the theme that fits this app"*, then offer theme
choice. Both halves are done.

## The short version

**The app now has three themes behind a switcher — Slate, Sand and Dusk.** The maintainer was asked for
three candidates and picked the set; the recommendation I gave argued *against* a switcher, was
overridden, and is kept below as the record of what was weighed.

The useful discovery was not about colour preference at all. It was that **colour was only about 60%
tokenized**: roughly twenty literals sat in the CSS below `:root`, so *no* theme could have worked —
a switcher would have themed the panels and buttons and left every badge, border, banner, field, error
state and the entire Tetris board stubbornly light. Fixing that first
([#120](https://github.com/normzhou/yolo-blank-canvas/pull/120)) is what made theming possible at all,
and it was verified as zero rendered change by diffing 172 elements' computed styles before and after.

Shipping a dark theme also **changed the method**: contrast is now checked against APCA as well as WCAG
2.1, because a palette can clear 4.5:1 and still be hard to read on a dark surface. That is not a
theoretical concern here — two of Dusk's values failed it and had to be lifted.

## What I found in the app

`src/client/styles.css` defines 12 colour roles in `:root` (`--bg`, `--surface`, `--field`, `--border`,
`--text`, `--muted`, `--accent`, `--accent-weak`, `--accent-weak-text`, `--positive`, `--warning`,
`--warning-weak`, `--error-bg`, `--error-text`, `--problem`, `--problem-weak`, `--closed`). The type
scale is four role-named steps, spacing six, radii four, elevation two. This is genuinely good
foundational work — the #75 review and #103 type-scale consolidation did their job.

But roughly **twenty colour literals sat in the component rules below `:root`**: button hover border,
field border, all four badge fills, the warning and problem borders, the error-code fill, the summary
background, the Tetris board gap and all seven piece colours.

Three of them were not even new colours. They silently restated roles already in `:root`:

| Was written as | Actually | 
| --- | --- |
| `.comment-body pre { background: #f6f8fa }` | `--field`, exactly |
| `.tetris-cell { background: rgba(242,244,247,0.74) }` | the badge fill at 74% |
| panel scroll shadow `rgba(31,35,40,0.14)` | `--text` at 14% |

**This is the whole finding.** A theme overrides `:root`. Everything below it was untouchable. So a
theme switcher built on the old CSS would have themed the panels, text and buttons and left the badges,
borders, banner, fields, error states and the entire game board stubbornly light. It would have looked
broken in exactly the places you would be looking at.

## The research

**Radix Colors** is the most directly useful free reference. Its 12-step scale assigns each step a
documented use — 1–2 backgrounds, 3–5 component states, 6–8 borders, 9–10 solids, 11–12 text — and it
guarantees steps 11 and 12 hit **Lc 60 / Lc 90 APCA** against step 2 of the same scale. Their own theming
guidance maps one semantic alias (`AppBg`) to different values per colour mode. That is exactly this
app's structure: few roles, each with a light and a dark value.

**On contrast, the interesting part.** APCA is the candidate method for WCAG 3, and the guidance that
matters here is blunt: WCAG 2.x ratios *"overstate contrast for dark colors to the point that 4.5:1 can
be functionally unreadable"* and therefore *"cannot be used for guidance designing dark mode"*. WCAG 3
is still a Working Draft — APCA's own documentation says plainly that "WCAG 3 Compliant: does not exist
yet" — so nothing here changes the app's current WCAG AA floor. But it means the **method** must change
before dark mode does. Re-measuring a dark palette with a 4.5:1 formula would ship failures that look
correct on paper.

**shadcn/ui** and **Primer** are worth knowing about but solve problems this app does not have. shadcn is
a component distribution model; Primer is a full product system with brand assets. Neither should be
adopted wholesale here.

## What was recommended, and what was actually built

The recommendation was: finish tokenization, map the roles onto a documented scale, then add dark mode
via `prefers-color-scheme` — and **not** build a theme switcher, on the grounds that it adds persistent
state to a deliberately blank canvas and makes a record viewer dress up the records it exists to show
truthfully.

**The maintainer chose the switcher.** That is the system working: the Charter puts the direction of the
product with the people who use it, and a recommendation that loses is still a recommendation rather than
a veto. The switcher is built, and the arguments above are kept because they are the record of what was
weighed — not because they were accepted.

What the switcher needed that the recommendation had not costed:

- **A third palette, not a dark mode.** Two light themes plus one dark gives three genuinely different
  options rather than a light/dark pair with a novelty third.
- **Every theme validated, not just the dark one.** Three full role sets, every text pair checked on
  both axes. That is 45 checks per theme, and it is what surfaced the `--cell-empty` gap below.
- **A persistence story**, which the recommendation had dismissed as the cost. It is small: one
  `localStorage` key and a pre-paint script.

## The three themes, and why

| Theme | What it is | Why it is in the set |
| --- | --- | --- |
| **Slate** | The palette this project already had, unchanged | It was already measured and liked. Not replacing a working default to prove a point. |
| **Sand** | The same lightness and chroma budget, rotated warm | The classic light-theme pairing. Two lights that differ by *temperature* feel like a choice; two lights that differ by *hue* just look like a mistake. |
| **Dusk** | Dark, aligned with how GitHub renders dark | A record viewer should not make its records look unlike the records. Matching GitHub dark is the only dark palette that is *about* credibility rather than decoration. |

## How the dark theme was validated

This is the part that changed the method rather than the colours. **APCA is now enforced alongside the
existing WCAG floor**, on every text pair, in all three themes: WCAG 2.1 4.5:1 **and** |Lc| ≥ 60.

Two of Dusk's values had to be lifted to reach it. Its muted text measured |Lc| 51 and its badge text 49,
both clearing WCAG comfortably at ~6–7:1 and both *failing* the perceptual floor. That is the exact trap
the recommendation warned about, found by measurement rather than by taste — and it is the reason the
dark theme exists at two axes instead of one.

The APCA implementation is checked against that package's published reference values
(`#888` on white = 63.1 Lc, black on white = 106.0, white on black = −107.9) so the maths cannot silently
rot. Full conformance with APCA's *font-size lookup* is deliberately **not** enforced: this app's
12–14px type sits below what that table supports at any achievable contrast, and closing the gap would be
a type-scale change — #103's settled decision, not this change's to make quietly.

## A gap the validation found

`--cell-empty` — the empty Tetris cell — was a colour role **no theme overrode**. It would have stayed
light on Dusk's dark board and read as a glowing block. Found because the theme test asserts every theme
covers the same set of colour roles, not because anyone looked at a screenshot.

## One thing that did not go as planned

Applying the stored theme before first paint needs one inline script, and this app's CSP is
`script-src 'self'` with no `unsafe-inline` — correctly, because the panel renders untrusted Markdown.
The first attempt hashed the script for the policy and got it wrong in a way that was invisible: the
build's own check agreed with itself, because it made the same mistake. The browser's rejection message
named the hash it wanted, which is what exposed it. Fixed by hashing the element's exact text content,
and `test/csp.test.ts` now re-derives the digest independently and fails if `unsafe-inline` ever appears
in `script-src`.

---
Filed by an AI agent under the L1 grant in `.yolo/governance/AUTHORITY.md`. Outcome: #110.
<!-- yolo:agent outcome=#110 authority=.yolo/governance/AUTHORITY.md -->
