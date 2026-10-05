---
name: yolo
description: Onboard or check YOLO Dev adoption, handle target-app requests and issue-backed development, or send feedback about YOLO Dev. Use for adopted repo work and YOLO onboarding, conformity or upstream questions.
---

# YOLO Dev

One skill exposes **init, check, request, work, feedback and help**. These are agent procedures, not shell commands. Explicit invocation routes the first word as an activity and preserves the remaining request. Otherwise choose from intent; clarify only ambiguous destination or execution scope. Status queries remain read-only. Installation supplies no purpose, authority, credentials or qualification.

For help, use **Help** below; unrelated protocol/history checks are unnecessary.

## Load the applicable rules

- Existing target: read its `.yolo/adoption.json` (or legacy `.yolo-dev/adoption.json`), pinned snapshot, mapped governing/instruction context and durable work. Two markers are a conflict; never select one implicitly. A newer skill cannot upgrade a pin.
- New init: read the bundled [protocol](references/protocol.md), particularly **Operating protocol**, the layout/issue/repository/verification contracts, **Qualification**, and **Onboarding**. Read [record encoding](references/records.md), [template guidance](references/templates.md) and `references/provenance.json` when drafting. Required rules are local; source-input revision and installed publication revision are distinct identities.
- Legacy check/repair: use [legacy encoding](references/legacy-records.md) and the target's earlier rules. The [earlier protocol](references/assisted-protocol.md) is compatibility material, not an upgrade.

Preserve accepted intent, baseline, checkpoints, failed findings and historical applicability. Migration needs explicit direction and identified old/new rules. Unknown provenance or missing context stays a gap.

## Init

Default to **L1 Assisted**; no L2 runner is supplied. Follow **Onboarding → Init / Discover governing intent / Proposal review** in the applicable protocol:

Prepare a concrete purpose/grant/design proposal from deep target inspection and the protocol's informed intent interview. Review actual files, not intentions. Missing human decisions remain pending; AI supplies recommendations and routine technical choices. Publish a pending issue/draft PR only when authorized. Activation requires recognized acceptance of the identified Charter/grant revision.

Apply authorized setup using the local protocol, canonical/mapped context and ordinary harness binding. Copy `references/protocol.md` byte-for-byte to `.yolo/protocol.md`; record manifest provenance/digest. Assess factual and semantic conformity under the protocol's result states and Q1–Q5. No placeholder CI, L2 runner or new bypass privilege.

Install the complete skill and repo-local command bindings together using [the installer](scripts/install.py), following **Assisted distribution → Harness bindings**. Preserve conflicts rather than overwriting.

Requirements: Git/Python 3.9+ and existing authorized `gh` access for GitHub observations. Missing tools/access stay gaps. **Assisted distribution → Harness bindings** gives discovery routes; demonstrate ordinary instruction loading separately.

### Init --dry-run

Follow **Onboarding → Dry run**: prepare/commit the complete proposal in a separate retained checkout, preserving the source, GitHub and earlier drafts. Return an external report and tested, shell-quoted full/focused diff commands using actual revisions. End **proposal pending — dry run**; later activation needs separate direction/acceptance. Read-only observation is allowed; publication or other remote effects are not.

## Check

Read the active contract/context, then run:

```sh
python3 /path/to/yolo/scripts/check.py /path/to/target
```

Read-only exit **0** means factual readiness for agent review, **1** gaps, **2** invocation/Git failure. `--offline` leaves GitHub unverified. None means qualification.

Follow **Onboarding → Check and repair** and **Qualification**. Inspect every intervening commit, local/default-branch state, issues/replies, related PRs/reviews/checks, effective configuration and delivery. Reconcile evidence beyond the helper's declared coverage. Review ownership, congruence, verification and continuity; use Q1–Q5 for L1 claims. Repair within authority, retain failures and publish successful evidence before advancing a checkpoint.

## Request and work

Use **Agent activities** in the active snapshot (the [bundle](references/protocol.md#activities-agent-activities) for new init). Report missing activity support rather than silently upgrading.

`request` discusses/files/follows **target-app** needs. Search existing issues, preserve consequential direction when filing is authorized, and return a real link or unsent draft. Intake is not admission or execution permission.

`work` requires active adoption: **reconcile → plan/admit → execute → record/continue or hand off**. Capture outcomes in issues before implementation. AI manages priority, acceptance, state, PRs and authorized delivery; distinguish verified fulfillment from decline/duplicate disposition. Significant design changes notify; protected changes need identified approval. Reconcile interrupted effects and other writers before acting. Preserve result/version, failures and next action.

Ordinary development requests follow this procedure without manual skill invocation. Direct conversation is steering; a bypass needs a scoped owner override. L1's maintainer starts sessions; AI may admit/plan within them. L2 automatic initiation remains unbuilt.

## Feedback

`feedback` concerns **YOLO Dev upstream**, not the target app; no target adoption is required. Resolve the publisher from provenance, search related issues/plan and prefer existing threads. Review exact destination/content and use explicit reporting authority; otherwise retain a draft. Sanitize diagnostics, excluding target identities, code, URLs, paths, logs and credentials. Never forward automatically.

Confirm actual submission and return its link/status. Upstream fixes do not upgrade the target pin; missing upstream access does not block unrelated work.

## Help

For bare invocation, `help` without a question or an unknown activity, return only this text verbatim, without the code fence. Do not inspect the repo or infer its adoption status.

```text
YOLO Dev
Usage: /yolo <activity> [details]
Codex CLI/IDE: $yolo <activity> [details]

init      Propose onboarding; --dry-run prepares an isolated preview.
check     Review conformity and report gaps.
request   Discuss, file or follow a target-app request.
work      Advance issue-backed work under active adoption and authority.
feedback  Discuss, file or follow feedback about YOLO Dev upstream.
help      Show this usage; help <activity> explains an activity.

Installation alone establishes neither adoption nor qualification.
```

For `help <activity>`, give a short paragraph and relevant local reference; expand only to answer a specific question. Read only what the question needs; do not perform the activity or upgrade the target pin. Any requested repo status needs evidence, not inference from installed files.
