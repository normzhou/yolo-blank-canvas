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
    "skill": {"path": ".agents/skills/yolo", "revision": "IDENTIFIED_PUBLISHED_BUNDLE_COMMIT"}
  },
  "verification": {
    "checks": ["TARGET_CHECK_REQUIREMENTS_REFERENCE"],
    "delivery": ["TARGET_DELIVERY_AND_VERSION_OBSERVATION_REFERENCE"],
    "recovery": ["ACCEPTED_RECOVERY_SCOPE_REFERENCE"],
    "limits": ["ACCEPTED_BINDING_LIMITS_REFERENCE"]
  },
  "activation": {"state": "active", "evidence": ["ACCEPTED_SETUP_REVISION_AND_PUBLICATION_EVIDENCE"]},
  "adopted_at": "ORIGINAL_PRE_SETUP_TARGET_COMMIT",
  "upgrades": [],
  "checkpoint": null,
  "unresolved": [],
  "qualification": {"level": 1, "status": "prepared", "evidence": []}
}
```

Copy **all** `inputs`, source repository/revision and protocol digest from the installed manifest, not this abbreviated example. Verify the manifest output digest before copying the protocol. Source-input revision identifies committed design inputs; the generated file need not exist there. Installed publication revision identifies the bundle obtained by the target and may be later. Unknown identity blocks qualification.

Paths remain inside the target; document references may include a heading fragment. New governing documents use the canonical layout slots; map existing equivalents outside `.yolo/` before creating replacements. `documents.specs` contains applicable repo-relative spec references when needed. `harness.instructions` records actual loading/import entrypoints; `skill.path` is the selected native installation, with an explicit gap if absent. File presence cannot attest actual harness loading.

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

Include all four obligations, with cited resolutions of earlier findings. Qualification needs **all Q1–Q5**, not this shortened example; omit qualification only for a non-qualification review. Factual helper output is supporting observation, not a semantic report. Missing/unverified/conflicting findings block a successful checkpoint and qualification.

A checkpoint is `{ "commit": "REVIEWED_COMMIT", "report": ".yolo/reports/PUBLISHED_SUCCESSFUL_REPORT.json" }`. Publish the report before recording its checkpoint; retain the chain back to the original baseline. Later bookkeeping belongs to the next review. Schema 1 historical reports remain valid under their original rules; upgrades do not retroactively change acceptance. A supported structure/digest does not prove truth or authorized delivery.
