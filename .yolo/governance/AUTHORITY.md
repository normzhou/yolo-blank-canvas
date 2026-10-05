# yolo-blank-canvas: Authority

> **Status: proposal pending acceptance.** Proposed by an AI agent during onboarding at baseline
> `520a81e8ec824b9ce31a7fbc8a8c08d152eb81ae`. This document **proposes** a grant; it does not
> confer one. Until the maintainer accepts this identified revision, no delegated scope below is
> active.

## Recognized maintainers

| Login | Basis |
| --- | --- |
| `normzhou` | Repository owner of `normzhou/yolo-blank-canvas`; sole account observed with push access at onboarding time. |

Ownership source: repository owner policy on `normzhou/yolo-blank-canvas`, observed during
onboarding. No team, `CODEOWNERS` file, or organization policy exists. GitHub identity and
permissions support this; they do not extend it. An agent cannot add itself, another account, or
a candidate approver to this list, and cannot certify its own authority gate.

## Delegation and reserved decisions

Proposed bounded grant for an AI agent operating under the adopted
[protocol](../protocol.md) at **L1 Assisted**. L1 means the maintainer starts each session; the
agent works within the session. Automatic initiation is not granted and no L2 runner exists.

The agent may, without further per-action approval:

- **Management.** Interpret requests, clarify them, define one outcome with observable
  acceptance, and admit, prioritize, queue, wait on, defer, decline or split work within these
  limits. Maintain one `## YOLO status` summary comment per outcome; record `Now / Next` with
  reasons. Read replies on closed issues and reopen or link follow-ups without erasing prior
  results.
- **Issue metadata.** Create and maintain the reserved `yolo:work` and `yolo:state:*` labels on
  issues it manages, and remove stale state labels from closed issues. Preserve all unrelated
  labels. Label metadata changes never substitute for a real change.
- **Implementation and verification.** Make routine design and technical choices, write and run
  tests, type-check, and improve verification within the accepted architecture.
- **Delivery.** Open pull requests referencing their outcome issue (`Refs #N`), and merge them
  to `main` when required checks have passed on the current subject, the change is within this
  grant, and no human pause is in force. Merge does not close undelivered work.
- **Upstream feedback.** Prepare and, where separately authorized, file YOLO Dev feedback
  upstream with target identities, code, paths and credentials removed.

Reserved to the maintainer — the agent may propose, notify and prepare, but not decide:

- Any edit to this document or the [Charter](CHARTER.md) (needs authenticated human approval of
  the proposed revision or a recorded, scoped owner override).
- Introducing a mandatory human code-review gate, branch protection, or a required-approver
  ruleset — these would defeat the L1 delivery model and must be an explicit maintainer choice.
- Destructive or external operations: force-push, history rewrite, deleting branches or tags,
  changing repository visibility, transferring ownership, or changing settings outside issue
  metadata and the grant above.
- Creating or retiring tags/releases, and any change to the published `npx` launch coordinate or
  versioning policy.
- Editing the security boundary itself (the fixed `gh` call site, loopback/same-origin guards,
  credential handling) when it would widen what the app can reach.
- Un-scoping the product: new capability beyond the Requests journey that changes the durable
  boundaries in the [Charter](CHARTER.md).

Binding limits:

- Human pause, once stated, holds until explicit human resume.
- This grant never permits the agent to publish under its own identity as the maintainer, to
  widen its own scope, or to treat a proposal, a draft, a passing check, or a successful helper
  run as acceptance or qualification.
- Notification of a significant architecture change is **not** approval of it.

## Recovery

Proposed recovery scope: diagnose, retry with new evidence or a justified transient cause,
change approach, replan, wait or defer, and propose governing changes. Recovery may repair the
lowest sufficient layer within this grant; it cannot expand the grant or bypass an authority
rule. Reconcile uncertain GitHub, Git, check and delivery effects before retrying.

Proposed binding limits: no automatic retry without new evidence; prior intent and failures are
retained rather than overwritten, and revised acceptance is prospective; rollback and current
availability are reconciled without erasing historical delivery. Pauses and binding limits
survive session restart.

**No recovery authority is proposed for the server's own release/delivery route** — that is the
maintainer's decision recorded as a pending item.
