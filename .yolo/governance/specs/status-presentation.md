# Status and reported-summary presentation

> Co-owned durable behavior contract, co-owned with the [Charter](../CHARTER.md). Derived from
> the implemented `src/shared/status.ts` and the app README, and verified by
> `test/status.test.ts`. Purpose, delegation and evidence live elsewhere; this document records
> only observable behavior.

## Why this contract is durable

The status column is where a request-to-result interface either stays honest or starts lying. It
is derived entirely from GitHub records — labels, closure reason and comments — because the app
holds no workflow state of its own. The contract therefore fixes two things: the mapping from
records to words, and the refusal to imply progress no record supports.

## Managed states

| Labels on an **open** issue | Displayed status |
| --- | --- |
| `yolo:work` + `yolo:state:queued` | Planned |
| `yolo:work` + `yolo:state:active` | In progress |
| `yolo:work` + `yolo:state:waiting` | Waiting |
| `yolo:work` + `yolo:state:deferred` | Postponed |
| no `yolo:work` label | Request open |

`yolo:work` with a missing state, two or more state labels, or a state label without `yolo:work`
is **Status needs reconciliation**, shown together with the raw labels. The app shows the
conflicting record; it never repairs it.

## Closure

| Closed issue | Displayed status |
| --- | --- |
| Managed work closed as completed | Completed (reported) |
| Closed without completion reporting | Closed |
| Closed as `not_planned` / `duplicate` | Not planned / Duplicate |
| Closed with an unrecognized reason | Closed — reason unavailable |

Leftover state labels on a closed issue are shown as unreconciled. "Completed (reported)" is a
statement that the record says so, not an independent verification of delivery.

## Reported summary

A comment whose **first heading** is `## YOLO status` is the *Reported summary*. The most
recently updated matching comment wins; earlier ones remain visible in the discussion. With no
matching comment the panel says **No progress summary yet.**

A comment whose **first heading** is `## YOLO request` is the *Request triage summary*. It records
interpretation, disposition and covering outcomes for intake that has not been admitted. It is not a
*Reported summary*: the panel does not read timing, state or delivery from it, and its presence does
not change an issue's derived status. Where a request has been promoted, the work issue's
*Reported summary* carries current status and the triage comment stays as history.

## One summary per outcome

The workflow writes **one** `## YOLO status` summary per admitted outcome and edits it as work
progresses; earlier dated comments record decisions and results rather than restating the summary.
Several matching comments on one outcome, or none on a completed one, mean the record needs
reconciliation. The panel still shows the most recently updated matching comment — it never guesses
which of several was meant to be current.

Timing is shown only when the summary states it; otherwise **Delivery timing not yet
estimated.** Two consequences are part of the contract:

- **The summary's own words are the display for timing.** A summary that states a timing
  shows it in its own body, and the panel adds no derived timing line. Duplicating it would
  repeat the same words twice and assert nothing extra. The panel's only timing text is the
  **not estimated** fallback, which exists to say honestly that no timing was reported.
- **A timing is only read from prose.** Content inside fenced or indented code is an example,
  not a statement, so neither a `Timing:` line nor a `Timing` heading inside a code block
  counts as the summary stating a timing. Reading one would have the panel assert a delivery
  date the author never claimed. The same rule governs summary detection: a `## YOLO status`
  heading quoted inside a code block is not the comment's first heading.

## Themes

The app offers three themes — **Slate** (default light), **Sand** (warm light) and **Dusk** (dark) —
selected by a control in the canvas header. The choice persists in `localStorage`; with nothing stored
the app follows `prefers-color-scheme`, so a user who has already told their OS they want dark gets dark
without touching the control.

**A theme changes presentation and nothing else.** It must not change:

- which status word an issue displays — that is derived from records, and the derivation in
  [Managed states](#managed-states) is theme-independent;
- whether a record is present, missing, or in conflict — [Status needs
  reconciliation](#managed-states) is shown with the same raw labels in every theme;
- what the timing fallback says, or whether a timing is read from prose.

**Colour is decoration; the derivation is not.** Every theme must therefore satisfy the same legibility
floor, and the floor is two axes:

| Axis | Threshold | Why |
| --- | --- | --- |
| WCAG 2.1 ratio | ≥ 4.5:1 for text | The floor this project always enforced. Unchanged. |
| APCA \|Lc\| | ≥ 60 for text, ≥ 8 for separations | WCAG 2.x overstates contrast for dark colours badly enough that a pair can clear 4.5:1 and still be hard to read. A dark theme validated by ratio alone is not validated. |

`Lc 60` is APCA's own level for "about as strong as WCAG 2's 4.5:1". Full conformance with APCA's
font-size lookup table is deliberately **not** enforced: the app's 12–14px type sits below what that
table supports at any achievable contrast, and closing that gap would change the type scale settled in
#103. That is a deliberate, recorded limit rather than an oversight.

Enforced by `test/theme-contrast.test.ts`, which checks every text and separation pair in all three
themes and verifies the APCA implementation against published reference values; and by
`test/theme-tokens.test.ts`, which fails if a theme fails to cover a colour role the others cover — the
gap that would otherwise have left the empty Tetris cell light on a dark board.

Home: `src/client/theme.ts`, `src/client/components/ThemeSwitcher.tsx`, and the `[data-theme]`
blocks in `src/client/styles.css`. Verified by `e2e/theme.spec.ts`.

## Truthfulness rules

These are acceptance criteria, not styling preferences:

1. No fixture, view or copy asserts that work is scheduled, queued for execution, or available.
   A delivery timing is read only from the summary's prose, never from a quoted example.
2. Untagged open issues read as **Request open** — never as work that an agent has read,
   accepted or scheduled. Under the adopted `request-outcome-v1` issue policy, an issue labelled
   `yolo:request` and not yet promoted to `yolo:work` reads the same way: intake classification is
   not evidence of review, admission or scheduling.
3. Closing an unmanaged conversation does not display as delivery.
4. Merge, a passing check, or a stage name never displays as delivered acceptance.
5. Conflicting or missing record data shows **Status needs reconciliation** with raw records
   available; the UI must not silently repair metadata.
6. Unrelated labels are displayed unchanged.

## Just-created requests and list reconciliation

GitHub's issue **list** endpoint is eventually consistent. A freshly created issue can be absent
from list queries for seconds, or — as observed in this repository — for well over twenty
seconds, while a direct read of the same issue returns it at once. The app must therefore never
conclude "not created" from "not listed".

| Situation | Required behavior |
| --- | --- |
| Request created and the list confirms it | Shown as an ordinary listed request, once, with no duplicate row. |
| Request created and the list does not yet include it | Shown as an explicitly **unconfirmed** row, marked *Not listed yet*, with a note saying the create succeeded and the list is catching up. Never omitted, never shown as if the list contained it. |
| Created request still unconfirmed after the bounded retries | The unconfirmed row stays, and the footer tells the user the list re-reads itself and that Refresh is available. |
| List read fails | Existing content is preserved and marked stale; the unconfirmed row is not treated as confirmation. |

The app never fabricates list membership: an unconfirmed row is derived from the confirmed create
result, and it is marked as unconfirmed until the server's list actually contains that number.
Retries are bounded and backed off, so a slow list cannot spin the server.

Home: `src/shared/listReconciliation.ts`. Verified by `test/list-reconciliation.test.ts`.

## Observable acceptance

`test/status.test.ts` is the executable form of the status contract and must cover every row above.
Acceptance of the presentation contract is: the suite passes, and the live round-trip recorded
in `docs/verification.md` shows the same derivation against real issue records.

List reconciliation adds `test/list-reconciliation.test.ts`, covering unconfirmed, confirmed,
deduplicated, ordering and retry-bound cases. Its live evidence is recorded in the issue it
fixed; the GitHub-side lag it absorbs is intermittent, so it cannot be forced on demand.
