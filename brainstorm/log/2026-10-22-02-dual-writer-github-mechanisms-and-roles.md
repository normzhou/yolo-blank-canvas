# Dual-writer state (UI vs. Runner), GitHub mechanisms, and Maintainer vs. User segregation

2026-10-22

## Questions Explored

1. **Git-backed config vs. UI-driven writes:** All framework config currently lives in Git (`.yolo/adoption.json`, `.yolo/governance/*`), which is awkward for UI-driven toggles — especially when both **people in the UI** and **a runner/coding harness** read and write these values, and `npx` / static `demo.yolo-dev.ai` have no local `.git` checkout.
2. **User segregation (Maintainer vs. Regular User):** How to separate regular app users (who file requests and use canvas apps) from recognized maintainers (who control framework settings, `yolo:manual` tasks, and approvals).
3. **Other major concerns:** Latency of live controls vs. code-coupled changes, dual-writer concurrency, and anti-spoofing.
4. **Native GitHub mechanisms:** Which GitHub primitives (beyond raw file commits) can serve as the shared read/write layer between UI and Runner.

## Key Findings & Proposed Architecture

1. **Four Additional Concerns Identified:**
   - **Latency split ("Live Control State" vs. "Versioned Repo State"):** Live switches (`Pause`, `feedback.automatic`, `observation.enabled`, `Now / Next` priority) shouldn't require a 3-minute branch/PR/CI/release loop to take effect, whereas pin upgrades (`v0.1.0-alpha.33`) and `CHARTER.md` edits *must* change files in Git.
   - **Dual-writer concurrency:** UI and Runner must not clobber each other's writes.
   - **Provenance & anti-spoofing:** The Runner must verify that a control event was authored by an account in `adoption.authority.maintainers`, not an arbitrary commenter.
   - **Topology independence:** Neither `npx` (installed from tarball without `.git`) nor `demo.yolo-dev.ai` (static Cloudflare Worker) can edit local repo files on disk; both must use the GitHub API.
2. **Comparison of 6 Native GitHub Mechanisms:**
   - Evaluated (1) `yolo:control` issue + structured comments, (2) Git Contents API (`PUT /contents/`), (3) Issues + Labels + GraphQL `blockedBy`, (4) PRs + PR Reviews, (5) Actions Repo Variables, and (6) Org Custom Properties.
   - **Winner for Live Control State:** A single **`yolo:control` issue** (already reserved in `.yolo/protocol.md` for L2) with structured maintainer comments. Posting a comment takes ~200ms, creates an immutable GitHub URL + timestamp + `author.login` that satisfies `.yolo/protocol.md`'s `acceptance: [...]` requirement, is readable by both UI and Runner in one API call, and is synced back into `.yolo/adoption.json` by the Runner on its next normal commit.
   - **Winner for Versioned Governance / Pin State:** Git branches + PRs + GitHub PR Review / Issue Comment approval bound to exact commit SHAs.
   - **Winner for Manual Blocker Tasks:** Dedicated `yolo:manual` issues + GraphQL `blockedBy` edges (filtered out of the regular user list and highlighted in a Maintainer "Action Required" banner).
3. **Maintainer vs. Regular User Segregation & `yolo:control` Access Control (`visitor` | `requester` | `maintainer`):**
   - **Layer 1 (GitHub-native enforcement on `yolo:control`):**
     1. Applying the `yolo:control` label requires repo `triage`/`write`/`admin` permission (regular users cannot forge a control issue).
     2. Editing the `yolo:control` issue body (`PATCH /repos/:o/:r/issues/:n`) requires repo `write`/`maintain`/`admin` permission.
     3. **Locking the `yolo:control` issue (`PUT /repos/:o/:r/issues/:n/lock`)** blocks all non-collaborators (`READ`/`NONE`) from posting comments (`403 Forbidden`), while collaborators/maintainers (`write`/`maintain`/`admin`) can still post control-event comments and edit the issue body normally.
   - **Layer 2 (Read-side attribution check):** Both UI and Runner verify `comment.user.login ∈ adoption.authority.maintainers` on every control event.
   - **Layer 3 (App session role resolution):** Intersects GitHub identity + repo permission (`ADMIN`/`MAINTAIN` via `gh api repos/:o/:r` in local `npx` mode, or GitHub App OAuth / `yolo-client-identity-v1` in hosted mode) with `.yolo/adoption.json` `authority.maintainers`, without ever laundering a maintainer token to regular users.
4. **Walked through all 7 enumerated examples** in [`brainstorm/framework-settings-ui.md`](../framework-settings-ui.md#4-walking-through-the-7-enumerated-surface-area-examples) against this model.
