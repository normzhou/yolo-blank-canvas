# Current record encoding

Encoding v2 for protocol `github-v1`. [Protocol → Adoption and evidence records](protocol.md#adoption-records-adoption-and-evidence-records) defines meaning; this file implements its fields. Legacy schema 1 is read-only compatible through [legacy-records.md](legacy-records.md). Unsupported versions remain gaps. Never rewrite a pin merely to satisfy this encoding.

## Adoption

Use `.yolo/adoption.json`. This is an example shape, not accepted target facts:

```json
{
  "schema_version": 2,
  "protocol": {
    "format": "github-v1",
    "repository": "https://github.com/normzhou/yolo-dev",
    "revision": "COMMITTED_SOURCE_INPUT_REVISION",
    "source": "skills/yolo/references/protocol.md",
    "inputs": [{"path": "SOURCE_PATH", "sha256": "SOURCE_DIGEST", "selection": "MANIFEST_SELECTION"}],
    "path": ".yolo/protocol.md",
    "sha256": "COPIED_PROTOCOL_DIGEST"
  },
  "target": {"repository": "OWNER/REPO", "default_branch": "OBSERVED_BRANCH", "level": 1, "scope": "QUALIFICATION_SCOPE"},
  "documents": {
    "charter": ".yolo/governance/CHARTER.md",
    "architecture": ".yolo/governance/ARCHITECTURE.md",
    "instructions": "AGENTS.md",
    "authority": ".yolo/governance/AUTHORITY.md",
    "specs": []
  },
  "authority": {
    "maintainers": ["RECOGNIZED_LOGIN"],
    "source": ["EXISTING_OWNER_POLICY_REFERENCE"],
    "acceptance": ["AUTHENTICATED_ACCEPTANCE_OF_IDENTIFIED_GRANT_REVISION"],
    "pending": []
  },
  "harness": {
    "name": "SELECTED_HARNESS", "version": "OBSERVED_VERSION",
    "instructions": ["AGENTS.md"],
    "skill": {"path": ".agents/skills/yolo", "revision": "IDENTIFIED_PUBLISHED_BUNDLE_COMMIT", "release": "SELECTED_YOLO_RELEASE_TAG"}
  },
  "verification": {
    "checks": ["TARGET_CHECK_REQUIREMENTS_REFERENCE"],
    "delivery": ["TARGET_DELIVERY_AND_VERSION_OBSERVATION_REFERENCE"],
    "recovery": ["ACCEPTED_RECOVERY_SCOPE_REFERENCE"],
    "limits": ["ACCEPTED_BINDING_LIMITS_REFERENCE"]
  },
  "feedback": {"automatic": false, "acceptance": []},
  "observation": {"enabled": false, "adoption_id": null, "acceptance": []},
  "activation": {"state": "active", "evidence": ["ACCEPTED_SETUP_REVISION_AND_PUBLICATION_EVIDENCE"]},
  "adopted_at": "ORIGINAL_PRE_SETUP_TARGET_COMMIT",
  "upgrades": [],
  "checkpoint": null,
  "unresolved": [],
  "qualification": {"level": 1, "status": "prepared", "evidence": []}
}
```

Bundles with a full file inventory require `harness.skill.manifest_sha256`: SHA-256 of the exact obtained `references/provenance.json` bytes. Retain it independently in adoption; the inventory covers all shipped files except that manifest itself. Bindings/imports are verified separately.

Copy **all** `inputs`, source repository/revision and protocol digest from the installed manifest, not this abbreviated example. Verify the manifest output digest before copying the protocol. Source-input revision identifies committed design inputs; the generated file need not exist there. Installed publication revision identifies the bundle obtained by the target and may be later. Unknown identity blocks qualification.

### Feedback setting

Optional `feedback` contains only `automatic` (a JSON boolean) and `acceptance` (a list of nonempty evidence references, default `[]`). Missing `feedback` means automatic reporting is off. `true` requires explicit recognized-maintainer acceptance of sanitized upstream submission to the identified publisher; cite the consent/revision, not generic install or merge authority. The field records a decision, never authenticates or expands it.

A proposed record may stage `true` with consent still in `authority.pending`; this requests the setting and permits no submission. Enabling it needs authenticated approval of the identified proposed revision. Treat setting changes as authority controls. Preserve the choice/evidence across upgrade and check compatibility with old/new rules and target restrictions; older pins do not acquire this capability from a new helper. Dry runs never submit. See **Agent activities → Feedback** in the protocol for scope and submission procedure.

### Observation setting

Optional `observation` is distinct from `feedback` and enables [activity observation](protocol.md#observation-activity-observation). It contains only `enabled` (a JSON boolean), `adoption_id` (a stable opaque identifier, null only for an explicitly requested local pre-adoption trial) and `acceptance` (nonempty evidence references when enabled, default `[]`). Missing `observation` means capture and transmission are off. `enabled: true` requires explicit recognized-maintainer acceptance of the identified destination and permitted fields; the field records a decision and cannot authenticate or expand it. A proposed record may stage it under `authority.pending` while permitting no transmission. Preserve `adoption_id` and the choice across repeat init, upgrade and worktrees; revocation stops queued and new transmission, and dry runs never transmit. Remote observations are not authority; analysis credentials are separately read-only. See **Activity observation** in the protocol for scope and transmission-consent procedure.

### Release bindings

Bundles declaring `release_convention: "semver-v1"` require `verification.release`:

```json
{
  "policy": ".yolo/governance/ARCHITECTURE.md#releases",
  "version_source": "package.json#version",
  "effective_commit": null,
  "legacy_tags": {},
  "observations": []
}
```

Map the target's real policy/native source; do not add a second version file or copy its changing version into this record. AI verifies the source's SemVer value at the inspected default-branch revision and its match at released revisions/artifacts. For a newly introduced convention, `effective_commit` stays null until the applicable setup is observed landed; then record that commit. Preserve an established boundary on upgrade; identify newly applicable requirements in upgrade evidence. `legacy_tags` maps earlier product tag names to full commits, retaining their earlier rules, not exempting violations of existing target policy. Capture it during migration and preserve it thereafter. Tooling tags need semantic classification, not blanket exemption for later product releases.

`observations` references unchanged committed JSON evidence with `schema_version: 2` and `releases: [{"tag": "v0.1.0", "commit": "FULL_COMMIT"}]`. Persist observed mappings when releases exist and retain prior observations. These are supporting evidence, not checkpoint/qualification reports unless they also meet the full report contract. The helper detects changed/deleted recorded mappings; artifact bytes and unobserved historical changes require agent evidence.

`harness.skill.release` records the selected YOLO tag separately from the target app version. An unreleased publisher candidate uses null and proposed/unverified status, not a guessed tag. Earlier bundles without this convention retain their encoding; a new helper cannot impose these fields on an old pin.

Paths remain inside the target; document references may include a heading fragment. For `canonical-v1` layout, all governing roles and specs use the reserved canonical homes; existing content is migrated rather than exempted. Older pins retain earlier mappings. `documents.specs` contains applicable repo-relative spec references when needed. `harness.instructions` records actual loading/import entrypoints; `skill.path` is the selected native installation, with an explicit gap if absent. File presence cannot attest actual harness loading.

References identify accepted source/revision and observations, not duplicated grants or workflow state. Maintainers come from accepted owner policy. Human acceptance/authenticity is reviewed from the source; strings in this marker cannot authenticate it. Targets describe no recovery authority or no additional binding limits explicitly when that is the accepted policy.

For a pending proposal use `activation.state: "proposed"`, `qualification.status: "unverified"`, retain pending decisions/access and unresolved findings, and record missing values as null or explicit gaps. Do not fill placeholders with guesses. Qualification statuses are `unverified`, `prepared` and `qualified`; active prepared setup must be observed on the default branch, and qualification requires actual level evidence. A helper reports readiness gaps for pending acceptance, not approval or malformedness of an otherwise valid proposal.

`adopted_at` remains the original baseline. A pending upgrade uses proposed/unverified candidate status; retain old status/evidence in Git and its report, with decisions in `authority.pending` and findings in `unresolved`. After observing the effective target commit, append `{ "from": "OLD_SOURCE_REVISION", "to": "NEW_SOURCE_REVISION", "effective_commit": "TARGET_COMMIT", "evidence": ["IDENTIFIED_ACCEPTANCE"] }` to `upgrades`; do not insert a pending/null effective commit. Keep old rules/history/reports and applicable authority. Relocation removes the superseded active marker only through authorized migration; Git preserves it. Never clear a checkpoint or unresolved finding to make init succeed.

## Review reports

File reports may use `.yolo/reports/`; issue/PR records remain the primary interface. A schema 2 report retains the legacy checkpoint-chain fields below and adds target/protocol/default-branch/harness/GitHub context:

```json
{
  "schema_version": 2,
  "target": "OWNER/REPO",
  "protocol": {"revision": "ADOPTED_SOURCE_REVISION", "sha256": "ADOPTED_DIGEST"},
  "revision": "INSPECTED_SUBJECT_COMMIT",
  "default_revision": "OBSERVED_DEFAULT_BRANCH_COMMIT",
  "from": "BASELINE_OR_SUCCESSFUL_CHECKPOINT",
  "previous_report": null,
  "reviewed_commits": ["EVERY_COMMIT_IN_FROM_TO_REVISION"],
  "working_changes": [],
  "harness": {"name": "HARNESS", "version": "VERSION", "loading_evidence": ["OBSERVED_ENTRY_AND_CONTRACT_LOADING"]},
  "github": ["DATED_ISSUE_PR_SETTINGS_CHECK_AND_DELIVERY_OBSERVATIONS"],
  "findings": [{"rule": "ownership", "status": "unverified", "evidence": ["CITED_SOURCE"], "detail": "REASON_CAUSE_IMPACT_REMEDY"}],
  "verification": [{"revision": "INSPECTED_SUBJECT_COMMIT", "result": "pass", "evidence": "OBSERVED_RESULT_AND_LIMITS"}],
  "qualification": {"level": 1, "criteria": [{"id": "Q1", "verdict": "unverified", "reason": "OBSERVATION", "evidence": ["SOURCE"]}]},
  "next": "RECONCILED_NEXT_ACTION"
}
```

Every successful report, including each `previous_report`, includes the exact rule IDs `ownership`, `congruence`, `verification` and `continuity`. Each finding needs nonempty `evidence` references and `detail`. Use `compliant` for supported conformity or `resolved` for an earlier failure with a cited repair and explanation; both are accepted. `missing`, `conflicting`, `unverified`, `pending`, `recorded` and unknown statuses block a successful checkpoint. A citation alone does not resolve a finding. Keep failed reports unchanged outside the successful chain and cite them from the resolving report; do not relabel history to pass the checker.

Qualification needs **all Q1–Q5**, not this shortened example; omit qualification only for a non-qualification review. Factual helper output is supporting observation, not a semantic report. For Q5, `harness.loading_evidence` identifies the observing fresh session separately from setup/upgrade, the actual instructions/pin loaded and the reconciled next action. A read-only `check` presents those observations; separately authorized `work` publishes them, in the same observing session or later. Neither session can attest a future restart or unobserved continuation.

A checkpoint is `{ "commit": "REVIEWED_COMMIT", "report": ".yolo/reports/PUBLISHED_SUCCESSFUL_REPORT.json" }`. Publish the report before recording its checkpoint; retain the chain back to the original baseline. Later bookkeeping belongs to the next review. Schema 1 historical reports remain valid under their original rules; upgrades do not retroactively change acceptance. A supported structure/digest does not prove truth or authorized delivery.
