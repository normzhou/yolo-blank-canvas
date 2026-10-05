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
matching comment the panel says **No progress summary yet.** Timing is shown only when the
summary states it; otherwise **Delivery timing not yet estimated.**

## Truthfulness rules

These are acceptance criteria, not styling preferences:

1. No fixture, view or copy asserts that work is scheduled, queued for execution, or available.
2. Untagged open issues read as **Request open** — never as work that an agent has read,
   accepted or scheduled.
3. Closing an unmanaged conversation does not display as delivery.
4. Merge, a passing check, or a stage name never displays as delivered acceptance.
5. Conflicting or missing record data shows **Status needs reconciliation** with raw records
   available; the UI must not silently repair metadata.
6. Unrelated labels are displayed unchanged.

## Observable acceptance

`test/status.test.ts` is the executable form of this contract and must cover every row above.
Acceptance of the presentation contract is: the suite passes, and the live round-trip recorded
in `docs/verification.md` shows the same derivation against real issue records.
