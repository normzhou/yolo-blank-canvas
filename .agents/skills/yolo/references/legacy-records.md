# Legacy adoption and review records

Compatibility reference for schema 1 and the target's earlier pin. Preserve mapped legacy paths during repair/check; the current instruction asset uses `.yolo/` and must not be copied over a legacy binding without explicit migration. This file does not upgrade the adopted rules.

The target owns these records. They identify adopted context and evidence; neither a marker nor this schema grants authority. Use repo-relative paths that remain inside the target. Avoid machine-specific paths and preserve meaningful local documents.

## Adoption

Store `.yolo-dev/adoption.json`:

```json
{
  "schema_version": 1,
  "protocol": {
    "repository": "https://github.com/normzhou/yolo-dev",
    "revision": "FULL_40_CHARACTER_COMMIT",
    "source": "skills/yolo-dev/references/assisted-protocol.md",
    "path": ".yolo-dev/protocol.md",
    "sha256": "SHA256_OF_THE_COPIED_FILE_BYTES"
  },
  "documents": {
    "charter": "CHARTER.md",
    "architecture": "ARCHITECTURE.md",
    "instructions": "AGENTS.md",
    "authority": ".yolo-dev/authority.md"
  },
  "adopted_at": "TARGET_COMMIT_BEFORE_INITIAL_SETUP",
  "checkpoint": null,
  "unresolved": [],
  "qualification": {
    "level": 1,
    "status": "prepared",
    "evidence": []
  }
}
```

Use full Git commit IDs. `adopted_at` is the initial history baseline, not a successful review. After initial setup it remains unchanged. `checkpoint` is either null or `{ "commit": "REVIEWED_COMMIT", "report": ".yolo-dev/reports/REPORT.json" }`. `unresolved` contains durable references to unresolved findings; preserve them until cited resolution. Protocol changes follow ownership rules and retain historical applicability.

The protocol snapshot is copied from the installed bundle, not fetched during ordinary work. Its source revision comes from installation provenance, and its digest identifies the adopted bytes. The helper checks the local digest; the agent verifies provenance and semantic applicability. A digest is not approval or tamper-proof enforcement. Unknown source provenance blocks qualification.

Link this marker and local snapshot from ordinary agent instructions and explicitly require agents to apply the snapshot and mapped context. Use the bundled [instruction template](../assets/agent-instructions.md), adapting relative links. The authority document cites the owner's existing grant and limits; missing decisions remain explicit. Do not derive permissions from a repository label, installed skill, or agent-authored summary alone.

For an explicit protocol upgrade, record the old/new source revisions and effective target commit in a durable work record. Keep the original baseline, prior snapshots in Git history, successful checkpoint, and unresolved findings. Judge earlier work under its earlier protocol. An older marker without a snapshot needs a diagnosed migration, not an automatic replacement.

## Reports

The helper emits factual observations, changed state, and the history interval requiring review. Save that output in an approved evidence location when useful; semantic review is a separate agent-authored report:

```json
{
  "schema_version": 1,
  "revision": "REVIEWED_COMMIT",
  "from": "PREVIOUS_CHECKPOINT_OR_INITIAL_BASELINE",
  "previous_report": null,
  "reviewed_commits": [],
  "findings": [
    {
      "rule": "ownership",
      "status": "unverified",
      "evidence": ["source path, commit, or GitHub record"],
      "detail": "observation, impact, cause or uncertainty, and remedy"
    }
  ],
  "verification": [
    {
      "revision": "REVIEWED_COMMIT",
      "result": "pass",
      "evidence": "command/result record or GitHub check"
    }
  ],
  "next": "Unresolved work or next action"
}
```

Use the exact commits in `from..revision`, including merges and intermediate repairs, in `reviewed_commits`. Review current uncommitted changes separately; they cannot justify a durable checkpoint. Required semantic rules are **ownership, congruence, verification, continuity**, defined by the target's adopted contract. Each needs cited findings; any missing/conflicting/unverified finding blocks checkpoint advancement. A successful report needs verification against its subject revision, not a stale ancestor. `previous_report` links the previous successful report when there is one.

Preserve reports and unresolved findings after failure. The agent publishes evidence and updates bookkeeping within its grant; the read-only helper never does so. A successful checkpoint points at a committed report. Reports usually land after their subject commit; the next review includes those bookkeeping changes. No report can attest its own future publication or exclude changes merely because they are documentation.

## Qualification evidence

Keep a concise task/handoff record in a GitHub issue, linked from `qualification.evidence`. Use **Q1–Q5 in the adopted contract** as the report template: one verdict, cited evidence, and reason per criterion, plus target/protocol/inspected interval, harness/version, unresolved findings, and next action. Change status to `qualified` only when all five pass. A helper's factual readiness cannot make that decision. On discovering an unsupported qualification, retain its historical reports, mark current status `prepared`, and record the gap and required reassessment without resetting history.
