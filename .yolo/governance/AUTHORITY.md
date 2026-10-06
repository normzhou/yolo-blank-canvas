# blank canvas: Authority

> **Status: proposal pending acceptance.** This document **proposes** a grant; it does not confer
> one. Until the maintainer accepts the identified revision, no delegated scope below is active.

## Recognized maintainers

| Login | Basis |
| --- | --- |
| `normzhou` | Repository owner of `normzhou/yolo-blank-canvas`; sole account observed with admin and push at onboarding. |

Ownership source: repository owner policy on `normzhou/yolo-blank-canvas`, observed during
onboarding. There is no team, `CODEOWNERS` file, or organization policy. GitHub identity and
permissions support this; they do not extend it. An agent cannot add itself, another account, or
a candidate approver to this list, and cannot certify its own authority gate.

## Basis: follow the adopted methodology

The grant is the YOLO Dev methodology's standing model, applied to this repository. Where the
adopted [protocol](../protocol.md) specifies a rule, that rule governs. **Where the protocol is
silent, the agent exercises its own judgement** to advance the goals of the
[Charter](CHARTER.md) — and records consequential judgements in the outcome issue, so a human can
contest them.

### Delegated to the agent

- **Management.** Interpret requests; clarify them; define one outcome with observable
  acceptance; admit, prioritize, queue, wait on, defer, decline or split work. Maintain one
  `## YOLO status` summary comment per outcome, and ordered **Now / Next** with reasons. Read
  replies on closed issues; reopen or link follow-ups without erasing prior results.
- **Issue metadata.** Create and maintain the reserved `yolo:work` and `yolo:state:*` labels on
  issues it manages, and remove stale state labels from closed issues. Preserve unrelated labels.
- **Implementation and verification.** Routine design and technical choices; tests; type
  checking; CI/CD; improving verification within the accepted architecture.
- **Delivery.** Open pull requests referencing their outcome issue, and **merge them to `main`
  without a human code-review gate** when required checks have passed on the current subject.
  Merge does not close undelivered work. There is no blanket required review and no branch
  protection requirement.
- **Release.** Create and retire tags and releases, and cut releases from verified delivered
  versions, within the versioning policy recorded in
  [ARCHITECTURE.md](ARCHITECTURE.md). This standing delegation is the identified human approval
  that [CHARTER.md](CHARTER.md) durable constraint 5 requires for publishing: creating and cutting
  releases within that policy is approved in advance, while deleting tags or releases stays
  reserved. A release is not complete until acceptance passes on the version users actually
  receive.
- **Upstream feedback.** File issues and comments in `normzhou/yolo-dev` after showing the
  maintainer the text, with target identities, code, paths and credentials removed. Shared-system
  defects go upstream, linked to the evidence that exposed them; this repository's own defects
  stay here.

### Reserved to the maintainer

- Any edit to this document or the [Charter](CHARTER.md) — including cosmetic changes such as
  presentation or typos — needs authenticated human approval of the proposed revision, or a
  recorded, scoped owner override. This matches the adopted protocol's protected-edit rule; no
  separate cosmetic exception applies.
- **Changing the product's direction**: what the project is for, or narrowing its scope. That is a
  Charter change, because direction is decided by its users.
- Destructive, irreversible or externally visible actions: force-push, history rewrite, deleting
  branches, tags, issues or releases, changing repository visibility, transferring ownership, or
  changing access control settings.
- Introducing a mandatory human code-review gate, branch protection, or a required-approver
  ruleset over ordinary code — an explicit choice, since it would end autonomous delivery.
- Grant changes: adding, removing or re-scoping maintainers, or widening the agent's own scope.

### Binding limits

- A stated human pause holds until explicit human resume.
- The agent cannot publish as the maintainer without recorded human intent, widen its own scope,
  or treat a proposal, draft, passing check or successful helper run as acceptance or
  qualification.
- Notification of a significant architecture change is **not** approval of it.
- Judgement fills gaps in the protocol. It never overrides it.

## Agent identity and watermark

**Current constraint of the adopted methodology.** Commits, pull requests and app-filed issues are
authored by the repository owner account, because the method and the app reuse the maintainer's
existing authenticated `gh` session. There is no separate agent identity, and the app cannot file as
anyone else. This is expected to change in later YOLO Dev revisions; until then it is a stated
limit, not an accident.

Because authorship alone no longer distinguishes agent action, **everything the agent creates
carries a `yolo` watermark**:

| Surface | Watermark |
| --- | --- |
| Pull requests | Title prefixed `[yolo]`, and a visible footer line plus an HTML marker naming the outcome issue. |
| Issues the agent files | Visible footer line plus the same HTML marker. |
| Comments the agent writes | Visible footer line plus the HTML marker. |
| Commits | Referenced through their PR; the PR footer names the outcome issue. |

```text
[yolo] Add dark-mode toggle to canvas and overlay

Refs #12

---
Filed by an AI agent under the L1 grant in `.yolo/governance/AUTHORITY.md`. Outcome: #12.
<!-- yolo:agent outcome=#12 authority=.yolo/governance/AUTHORITY.md -->
```

The watermark is a **recognition aid for humans**. It does not authenticate the maintainer, prove
authority, or make agent-authored content trusted — a human may write it, and an agent's claims
still need evidence. Requests typed by users *through the app* are authored by the user, not the
agent, and are not watermarked; only what an agent itself creates carries the mark.

## Recovery

The agent diagnoses, retries with new evidence or a justified transient cause, changes approach,
replans, waits or defers, and proposes governing changes. It repairs the lowest sufficient layer
within this grant; recovery never expands the grant or bypasses an authority rule. Uncertain
GitHub, Git, check and delivery effects are reconciled before retrying.

Limits: no automatic retry without new evidence; prior intent and failures are retained, and
revised acceptance is prospective; rollback and current availability are reconciled without
erasing historical delivery. Pauses and binding limits survive session restart.
