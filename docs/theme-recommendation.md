# Theme recommendation for the blank canvas

Research and recommendation requested in [#110](https://github.com/normzhou/yolo-blank-canvas/issues/110).
This answers the first of the two scopes there — *"look at established free UI/UX resources, and propose
the theme that fits this app"*. It deliberately does **not** restyle anything: the restyle is the second
scope, and the recommendation here says what it should follow from.

## The short version

**The theme is not the problem, and a three-theme switcher is the wrong feature.** What the app has is a
neutral, low-chroma, content-first palette built on 12 role tokens — which is already the right shape for
this product. The concrete defect I found is that **colour was only about 60% tokenized**, so no theme
would have worked properly even if you had picked one.

That defect is now fixed, invisibly, in
[#120](https://github.com/normzhou/yolo-blank-canvas/pull/120) — verified as zero rendered change by
diffing 172 elements' computed styles before and after.

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

## What I'd recommend, in order

1. **Finish the tokenization.** Done, invisibly — verified as zero rendered change.
2. **Map the 12 existing roles onto Radix's scale semantics**, keeping the app's own names. It is already
   90% of the work, and it makes the palette defensible rather than taste-driven.
3. **Then dark mode**, driven by `prefers-color-scheme`, with no persisted preference and no switcher.
   Validate with APCA, not WCAG ratios.
4. **Then, only if you still want it,** a theme switcher.

## Why I would not build the switcher

You floated "possibly three candidate themes behind a switcher". Three reasons not to:

- **It adds persistent state to a product whose whole premise is a blank canvas.** The Charter says
  surface is added for an *observed* request, not for symmetry. A switcher is a control for choosing
  between things that do not exist yet.
- **The canvas is deliberately empty and one local user.** Dark mode is an accessibility need — it serves
  someone who needs it. A theme picker serves nobody yet.
- **A theme switcher would make the record view less credible.** This app's job is showing GitHub
  records truthfully. GitHub has a light and a dark mode; matching it keeps the app from looking like it
  is dressing the records up.

If you want personality, the honest place for it is the artwork already in the canvas — which is what
Tetris and the backdrops are doing — not in the chrome around it.

## One thing that would change my mind

If the goal is to *showcase* themes rather than to serve a user, say so and I'll build it. That is a
legitimate goal and it would need a different token strategy — three full role sets, validated, with the
Tetris pieces checked against each. I would just rather not assume it, because it is the one version of
this that contradicts what the project says it is for.

---
Filed by an AI agent under the L1 grant in `.yolo/governance/AUTHORITY.md`. Outcome: #110.
<!-- yolo:agent outcome=#110 authority=.yolo/governance/AUTHORITY.md -->