---
name: yolo
description: Onboard, upgrade or check YOLO Dev adoption, handle target-app requests and issue-backed development, or send feedback about YOLO Dev. Use for adopted repo work and YOLO onboarding, conformity or upstream questions.
---

# YOLO Dev

One skill exposes **init, upgrade, check, request, work, feedback and help**. These are agent procedures, not shell commands. Explicit invocation routes the first word as an activity and preserves the remaining request. Otherwise choose from intent; clarify only ambiguous destination or execution scope. Status queries remain read-only. Installation supplies no purpose, authority, credentials or qualification.

For help, use **Help** below; unrelated protocol/history checks are unnecessary.

## Load the applicable rules

For Codex's artifact handoff, if `YOLO_ACTIVITY_ID`/`YOLO_ACTIVITY_REPORT` are absent, obtain the current native-session descriptor through the read-only [observer context launcher](references/checker.md#codex-observation). Use its matching activity ID/report path for the same ordinary result below. An unavailable descriptor stays a report gap; never select another session from its working directory.

When the harness supplies `YOLO_ACTIVITY_ID` and `YOLO_ACTIVITY_REPORT`, make the ordinary structured result available at that path with the matching `activity_id`. Keep durable evidence in its normal Git/GitHub location. Use `kind: "review"` for init/upgrade/check and `kind: "outcome"` for request/work/feedback; keep factual observations and agent assessment separate ([records](references/records.md#activity-result)). If waiting for the next user reply, include `awaiting_input: true`. This is normal result recording; native hooks collect measurements and handle transmission automatically.

- Existing target: read its `.yolo/adoption.json` (or legacy `.yolo-dev/adoption.json`), pinned snapshot, mapped governing/instruction context and durable work. Two markers are a conflict; never select one implicitly. A newer skill cannot upgrade a pin.
- New init: read the bundled [protocol](references/protocol.md), particularly **Operating protocol**, the layout/issue/repository/verification contracts, **Qualification**, and **Onboarding**. Read [record encoding](references/records.md), [template guidance](references/templates.md) and `references/provenance.json` when drafting. Required rules are local; source-input revision and installed publication revision are distinct identities.
- Legacy check/repair: use [legacy encoding](references/legacy-records.md) and the target's earlier rules. The [earlier protocol](references/assisted-protocol.md) is compatibility material, not an upgrade.

Preserve accepted intent, baseline, checkpoints, failed findings and historical applicability. Migration needs explicit direction and identified old/new rules. Unknown provenance or missing context stays a gap.

For an explicitly configured App profile on a compatible pin, use the [operator guide](references/operator-app.md) only within accepted setup authority. Private verification runs on the controller side; never copy keys or tokens into candidate context. This publication supplies access preflight, not App-backed work/publication or hosted execution: report that gap and preserve the profile instead of falling back to personal credentials.

## Init

Default to **L1 Assisted**; no L2 runner is supplied. For new adoption, use **Assisted distribution → Release selection**; retain any explicit selection already resolved during installation. Follow **Onboarding → Init / Discover governing intent / Proposal review** in the applicable protocol:

Repeat init retains an existing adoption’s pin; use **Upgrade** for migration.

Start with deep target inspection and the protocol's **Charter interview**. End the first discussion turn with a few sentences of interpretation and the smallest batch about product purpose, aspirations and boundaries. Keep inspection inventory in a report; grant questions come later and routine engineering choices stay with AI. Wait for the maintainer's reply before drafting Charter/dependent documents or assessing setup. Dry run/noninteractive sessions also return questions and stop. Existing drafts inform the interview; only explicit maintainer deferral permits a provisional draft without answers.

Shape the concrete purpose/grant/design proposal from that direction. Offer automatic sanitized upstream feedback with the grant/settings proposal, default off; encode explicit consent using [records](references/records.md#feedback-setting). Review actual files, not intentions. Missing human decisions remain pending; AI supplies recommendations and routine technical choices. Publish a pending issue/draft PR only when authorized. Activation requires recognized acceptance of the identified Charter/grant revision.

Apply authorized setup using the local protocol and canonical governing context (migrating existing content, not exempting its locations) and ordinary harness binding. Copy `references/protocol.md` byte-for-byte to `.yolo/protocol.md`; record manifest provenance/digest. Run **Structural validation** before claiming prepared setup, then assess factual and semantic conformity under the protocol's result states and Q1–Q5. No placeholder CI, L2 runner or new bypass privilege.

Establish **Product releases → Establish and check** and its release bindings during init/upgrade: native version source, policy/effective history and retained tag mappings. Record the selected YOLO release separately from app versions. Unreleased setup and dry-run planned tags do not establish publication.

Record the obtained manifest SHA-256 with its publication identity. Install the complete skill and repo-local command bindings together using the verified executable's `install --bundle <skill-folder> <target>` operation ([distribution](references/checker.md)), following **Assisted distribution → Harness bindings**. Preserve conflicts rather than overwriting.

Requirements: Git, the verified platform executable and existing authorized `gh` access. No Python or Go runtime is needed. Missing tools/access stay gaps. **Assisted distribution → Harness bindings** gives discovery routes; demonstrate ordinary instruction loading separately.

### Init --dry-run

Follow **Onboarding → Dry run**: prepare/commit the complete proposal in a separate retained checkout, preserving the source, GitHub and earlier drafts. Return an external report and tested, shell-quoted full/focused diff commands using actual revisions. End **proposal pending — dry run**; later activation needs separate direction/acceptance. Read-only observation is allowed; publication or other remote effects are not.

## Upgrade

`upgrade [preview|<publisher-ref>] [--dry-run]` selects latest stable by default; `preview` allows prereleases. Use the verified executable's read-only resolver ([distribution](references/checker.md)) to select once and return tag/full publication commit:

```sh
/path/to/yolo-check resolve          # stable
/path/to/yolo-check resolve preview  # newest published, including prereleases
```

Follow **Assisted distribution → Release selection**; no release means stop, not silent fallback. Fetch the selected commit's complete bundle and versioned guide, verify manifest identity, and keep that selection through the proposal. For an already-adopted publication, check and repair drift before reporting unchanged. These channels select YOLO, not the target app's version. Explicit tags/commits remain supported.

Read the active old rules/grant and reconcile work/writers first; then read **Onboarding → Repeat init and upgrade** in the requested staged bundle. Resolve publication once and verify provenance. Compare rules/tooling and preserve accepted target purpose, instructions, original baseline, checkpoints, findings and history. Propose one issue/PR or an isolated dry-run diff; replace bundle/bindings, snapshot and mapping as one reviewed change, preserving local customizations. Include minimal implementation/tooling repairs required for conformity within the current grant; unrelated improvements or publisher-source changes are separate work. Installer conflicts require explicit reconciliation, never a blind overwrite.

When the app uses shipped brand/feedback/identity components, include its actual
consumers in the [integration upgrade review](references/hosted-feedback.md#upgrade-existing-integrations).
Distinguish bundle, app mount, served UI and server versions; record/apply the
appropriate migration within target authority instead of treating installation
as app delivery.

Preserve feedback choice/consent; a new bundle cannot enable reporting. Compare permissions and restrictions per affected action, including contrary evidence. Follow the protocol's finding classification: AI chooses authorized routine repairs, humans decide protected changes, evidence gaps require investigation. Keep only owner decisions in `authority.pending`. Prepare complete relevant protected corrections before asking for final-revision approval; continue independent authorized work while affected actions wait. Apply only within old authority. A pending candidate record is proposed/unverified; preserve old status as history. Notify significant changes and record actual effective revision. Recheck affected qualification; old loading evidence cannot attest a new pin. Reload the harness for fresh continuation. New skill files alone do not change an active pin. Older installations bootstrap selection from the current agent guide, then use the selected version and read the staged skill directly.

## Structural validation

Init, upgrade and check run the same read-only validator on actual files, including dry-run proposals. Obtain the selected publication’s executable using [checker distribution](references/checker.md); verify its checksum and version/publication before execution. Existing pins retain their tools; never use a newer executable to silently upgrade a pin.

```sh
/path/to/yolo-check /path/to/target --structure
```

Use **Conformance checks** in the applicable protocol for deterministic coverage, advisory warnings and required judgment. Read `structure.status` and its findings; pass requires canonical governing homes, matching snapshot/manifest/full bundle, resolved active context references and intact native bindings. Move accepted governing content to one authoritative home per role; update instruction links/mappings and affected native tooling, removing competing active copies. Inspect the final diff for these properties and scope, then rerun. Read `replica_candidates` and apply **Repository layout → Governing-file review**: classify every candidate from content/references/history and record evidence in the normal report. Preserve intentional artifacts; propose owned migration for active copies. No deletion or publisher-source exemption from filename alone. Apply **Onboarding → Proposal review** line by line; a script pass cannot waive semantic failures. Old pins retain old policy: use a staged candidate only for an explicitly requested upgrade. No prepared/completed setup while applicable strict requirements fail or are unverified; structural pass is separate from pending approval, activation and qualification.

## Check

Read the active contract/context, then run:

```sh
/path/to/yolo-check /path/to/target
```

Read-only exit **0** means factual readiness for agent review, **1** gaps, **2** invocation/Git failure. `--offline` leaves GitHub unverified. None means qualification.

Follow **Onboarding → Check and repair** and **Qualification**. Inspect every intervening commit, local/default-branch state, issues/replies, related PRs/reviews/checks, effective configuration and delivery. Reconcile evidence beyond the helper's declared coverage. Review ownership, congruence, verification and continuity; use Q1–Q5 for L1 claims. Keep assessment read-only; propose repairs and apply them only when separately requested and authorized. Retain failures and publish successful evidence before advancing a checkpoint. `check --dry-run` prepares an isolated repair under the same pin using **Onboarding → Dry run**; it never silently upgrades. If stricter rules are needed, report the explicit upgrade required.

Use the observing report's actual harness/version/loading for Q5; an installation-time harness selection is not exclusive. For immutable checkpoint reports missing obligation fields, consult [historical supplementation](references/records.md#historical-supplementation) only when the active pin supports it. Re-review and cite the earlier evidence; never rewrite history, waive an existing failure or infer qualification from a repaired encoding.

If this fresh session observes loading/continuation, present the evidence and name `work` as the recording step. Separately authorized work may publish that observation in this same fresh session; another restart is unnecessary. Follow **Qualification → L1 acceptance** and [report encoding](references/records.md#review-reports); never attest an unobserved future session or write during read-only check.

Briefly assess YOLO guidance/tooling effectiveness after check and final init/upgrade assessment; use **Feedback** for useful findings. Assessment remains read-only; report any separate authorized feedback submission and its link.

## Request and work

For a client with the optional work bridge configured, follow the shipped
[shared feedback / L1 bridge guide](references/client-feedback-library.md) for
mapped feedback reads and intentional responses through that client's bridge.
Load its actual active pin/grant and private connection; bridge access supplies
no new authority. Preserve ordinary Git/PR/CI tools and the guide's secondary
direct-gh recovery route. No automatic runner is required.

For a maintainer-requested app-hosting route, read [optional hosting](references/app-hosting.md), its single onboarding/setup-grant flow and client webapp integration guide before instantiating files. Discover complete known/pending inputs and prepare one selected-lifecycle owner grant; keep operator-only work and already supplied acceptance off the client handoff path. The client can build/test the guarded frontend and same-origin API through a loopback preview before cloud/DNS setup. Before actionable provider instructions, follow its live official references even from an older bundle; cached limits are not current eligibility. Hosting remains opt-in under the target's existing authority, with client-owned app accounts and separate Yolo Dev domain management. No new activity, account grant or automatic target upgrade is supplied.

For requested shared-login/app-permission integration, read [the client identity preview](references/client-identity.md). It ships a complete local adapter/example/test package; production issuer activation and migration remain unavailable. Preserve existing Access/gateway/origin protection and client-owned private policy. Use this route before changing a deployed authentication flow; local synthetic success is not live login or a namespace grant.

For webapps wanting compatible automatic logo/feedback updates, use the
[hosted v1 profile](references/hosted-feedback.md) with its versioned local adapter
and fallback under the app's accepted delivery choice. Standalone mark motion
and the complete feedback launcher are separate mounts. Use the
[local brand assets](references/brand-assets.md) for bundled/pinned or custom controls.

Use **Agent activities** in the active snapshot (the [bundle](references/protocol.md#activities-agent-activities) for new init). Report missing activity support rather than silently upgrading.

For versioned form intake or an app request composer, read [request forms](references/request-forms.md). The optional starter pack and matching executable compile native forms and validate typed JSON/native Markdown locally. Skill upgrade alone does not activate intake. Plain text remains valid; uncertain input needs confirmation only for the affected structured action. Use the bound resolution protocol under existing authority. For configured authenticated responses or outbound continuation under a supporting pin, read [request responses](references/request-responses.md). Ordinary work/check reconcile the index named by accepted target configuration; check stays read-only and authorized work persists progress in normal records. Installation alone selects no receiver or index.

For requested feedback inside a client app, use [client-owned feedback](references/client-feedback.md): a complete optional requester UI/API, existing starter forms, verified-principal/app-permission boundary and client-owned GitHub writer. Preserve private-thread ownership and uncertain write intents; this supplies no maintainer control plane, automatic client deployment or unattended runner.

`request` discusses/files/follows **target-app** needs. It shares **Issue management → Intake and admission** with upstream feedback. Search existing issues, preserve consequential direction and apply an existing `yolo:request` label when filing is authorized and permissions allow; otherwise leave classification to the receiving AI. Return a real link or unsent draft. Intake is not admission or execution permission; follow the active pin, never silently upgrade it.

`work` requires active adoption: **reconcile → select a useful chunk → interpret/admit when needed → advance → publish and continue or hand off**. Under **Issue management → Planning across outcomes**, review incoming issues/replies alongside existing work; consolidate or split into useful outcomes instead of one ticket per input. Reuse covering work, or promote a suitable source in place before creating another ticket. Preserve source coverage/dispositions and use a linked Now/Next plan when coordinating outcomes. AI manages priority, acceptance, state, PRs and authorized delivery; distinguish verified fulfillment from decline/duplicate disposition. Significant design changes notify; protected changes need identified approval. Reconcile interrupted effects and other writers before acting, and inspect an external action's actual result before repeating it. Preserve result/version, failures and next action.

Ordinary development requests follow this procedure without manual skill invocation. Direct conversation is steering; a bypass needs a scoped owner override. L1's maintainer starts sessions; AI may admit/plan within them. L2 automatic initiation remains unbuilt.

Reconcile applicable current intent, including later reversals; superseded decisions remain history. Interpret input from dissatisfaction to a precise proposal before executing it: record the admission handoff — outcome/sources, scope/decisions, acceptance/delivery, Charter fit/authority, readiness — or publish another disposition, and admit a bounded investigation when the solution is materially unknown. Before executing a replan, record revised acceptance and the original scope's disposition in the outcome and affected sources. A substitute result cannot fulfill abandoned scope or waive its prerequisites; unresolved consequential contradictions block affected work.

Before handing a blocker to the maintainer, apply [Maintainer-reserved actions](references/protocol.md#issue-management-maintainer-reserved-actions): finish authorized preparation, leave only the reserved/unavailable action and keep its why, blocked work and current steps in one existing issue. Consent-only work uses a concrete in-session proposal and authorized execution after approval. Preserve completed setup and the target's actual grant.

Maintain the existing status-summary comment as work changes, and record the iteration identity once per iteration in that outcome's or the plan's summary, with the result, evidence, remaining scope, next action and any operation still running. Mark new YOLO-written objects with `Created by YOLO Dev · mode: <profile> · harness: <name/version> · run: <iteration id> · <record link>`. Follow the target's declared delivery route through usable publication; a development checkout does not establish a package/release's availability. If publication fails, retain the local result and report exactly what remains unsynchronized. Reconcile governing conflicts and primary evidence before claiming conformity or completion.

## Feedback

`feedback` concerns **YOLO Dev upstream**, not the target app; no target adoption is required. Follow **Agent activities → Feedback** in the applicable protocol: sanitize useful findings, resolve publisher provenance and deduplicate. Default to a draft, show exact destination/content and ask before sending. Only active, explicitly accepted `feedback.automatic` permits automatic sanitized submission within the pin/grant; verify consent, not just the flag. Dry runs always retain drafts. Read [feedback encoding](references/records.md#feedback-setting) when evaluating settings.

Confirm actual submission and return its link/status. Upstream fixes do not upgrade the target pin; missing upstream access does not block unrelated work.

Feedback is intake in the publisher's repo: apply its existing `yolo:request` label when permitted, otherwise file normally. Never change upstream settings or mark submitted feedback as admitted work. The receiving AI owns triage and planning.

## Help

For bare invocation, `help` without a question or an unknown activity, return only this text verbatim, without the code fence. Do not inspect the repo or infer its adoption status.

```text
YOLO Dev
Usage: /yolo <activity> [details]
Codex CLI/IDE: $yolo <activity> [details]

init      Propose onboarding; preview allows prereleases; --dry-run previews.
upgrade   Propose latest stable; preview allows prereleases; --dry-run previews.
check     Review conformity; --dry-run proposes isolated repair.
request   Discuss, file or follow a target-app request.
work      Advance issue-backed work under active adoption and authority.
feedback  Discuss, file or follow feedback about YOLO Dev upstream.
help      Show this usage; help <activity> explains an activity.

Installation alone establishes neither adoption nor qualification.
```

For `help <activity>`, give a short paragraph and relevant local reference; expand only to answer a specific question. Read only what the question needs; do not perform the activity or upgrade the target pin. Any requested repo status needs evidence, not inference from installed files.
