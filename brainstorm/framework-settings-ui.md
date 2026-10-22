# YOLO Dev framework & settings UI

Status: exploring · 2026-10-22

How should a YOLO Dev-enabled web app expose its own **framework state, settings, governance, hosting status, and maintainer manual tasks** in the UI — and how can a human in the UI and an AI runner/harness both read and write these settings when the repository and GitHub are the source of truth?

---

## 1. The Four Core Architectural Questions

1. **Git-backed config vs. UI-driven writes (Dual Read / Dual Write):**
   - Today, framework config lives in `.yolo/adoption.json` and `.yolo/governance/*` in Git.
   - However, **both the UI (human)** and **the Runner / Coding Harness (AI)** need to read and write framework state — and in `npx` mode (no local `.git` checkout) or hosted `demo.yolo-dev.ai` mode (Cloudflare Worker), the UI has no local git working tree to edit.
2. **User segregation (Maintainer vs. Regular User vs. Anonymous Visitor):**
   - A regular user of the app should only see the **Request-to-Result experience** (play apps, file feedback/feature/bug requests, follow status).
   - Only a **Recognized Maintainer** should be able to flip framework switches (`feedback.automatic`, `observation.enabled`), complete `yolo:manual` tasks, pause/resume execution, or approve protected Charter/pin changes.
3. **Immediate effect vs. Versioned code effect (Latency split):**
   - If a maintainer flips **Pause** or **`feedback.automatic`**, they expect it to take effect *immediately* (~200ms), not wait for a branch + PR + CI + release cycle.
   - Conversely, upgrading the **YOLO Dev skill pin (`v0.1.0-alpha.33`)** or editing **`CHARTER.md`** *must* change versioned files in Git via a reviewed PR.
4. **Dual-writer concurrency & provenance (UI vs. Runner race & anti-spoofing):**
   - If the UI and the Runner both mutate state, how do we prevent overwrites, and how does the Runner verify that a setting change was genuinely authorized by a recognized maintainer rather than spoofed by an outsider or hallucinated by an agent?

---

## 2. Evaluating Native GitHub Mechanisms for Shared UI + Runner State

Because every topology (local `npx`, hosted Worker, local CLI harness, L2 runner) speaks to the **GitHub API**, we can compare native GitHub primitives for backing the UI + Runner control plane:

| GitHub Mechanism | Latency | Access Control | Audit / Provenance | Fit for UI ↔ Runner State |
| --- | --- | --- | --- | --- |
| **1. Dedicated `yolo:control` Issue (Body + Structured Comments)** | **Fast (~200ms)**; no git commits or CI noise | Body edit: repo collaborators (`write`+). Comments: anyone, but **Runner filters by `author.login ∈ authority.maintainers`**. | Immutable comment URLs + timestamps + `author.login` (satisfies `.yolo/protocol.md` `acceptance: [...]` rule!) | **Best fit for Live Control Plane** (`feedback.automatic`, `observation.enabled`, `Run / Pause`, `Now / Next` priority overrides). Already reserved in `.yolo/protocol.md` (`yolo:control`)! |
| **2. Git Contents API (`PUT /repos/:o/:r/contents/.yolo/adoption.json`)** | Slow (~1–2s); creates a commit on `main` & triggers CI per click | Requires `contents:write` on default branch; fails if branch protection requires PRs | Full Git commit history (`sha` optimistic lock) | Good optional fast-sync when `main` is unprotected, but **noisy** if used as the primary toggle mechanism for every click. |
| **3. GitHub Issues + Labels (`yolo:manual`, `yolo:work`, `yolo:state:*`) + GraphQL `blockedBy`** | **Fast (~150ms)** | Only `triage`/`write`/`admin` can label or close; regular users can only create untagged issues | Native GitHub timeline (`LabeledEvent`, `ClosedEvent`, `BlockedByAddedEvent`) | **Best fit for Workflow & Manual Blocker Queue** (`#203` blocking `#199`). Already used today. |
| **4. GitHub Pull Requests + PR Reviews (`POST /repos/:o/:r/pulls/:n/reviews`)** | Async (branch + PR) | `CODEOWNERS` + repo `admin` approval bound to exact `commit_id` | Cryptographic review state (`APPROVED` on exact SHA) | **Best fit for Versioned Governance & Pin Upgrades** (`CHARTER.md`, `AUTHORITY.md`, `.agents/skills/yolo` pin migrations). |
| **5. GitHub Actions Repo Variables (`/repos/:o/:r/actions/variables`)** | Fast (~150ms) | Repo `admin` only (`variables:write` scope) | **No audit trail** (overwrites in place, no comment URL for `acceptance: [...]`) | **Poor fit:** lacks the verifiable acceptance URL required by `.yolo/protocol.md` and requires extra token scopes. |
| **6. GitHub Repo Custom Properties (`/repos/:o/:r/properties/values`)** | Fast | Org `admin` only | Key-value | **Not usable on personal repos** (`normzhou/*` is a user account, not an Organization). |

### The Two-Plane Architecture: `yolo:control` Issue + Git Sync

Combining **Mechanism 1 (`yolo:control` issue)** with **`.yolo/adoption.json` in Git** solves the dual-writer problem cleanly:

1. **Fast Write (UI → GitHub `yolo:control` Issue):**
   - When the maintainer toggles a live setting in the UI (e.g., `feedback.automatic: true` or `observation.enabled: false` or `Pause`), the UI posts an authenticated comment on the repository's single `yolo:control` issue (and updates the control issue's summary table).
   - That comment URL (e.g., `https://github.com/normzhou/yolo-blank-canvas/issues/205#issuecomment-...`) is authored by `normzhou` and timestamped by GitHub — **it immediately satisfies the protocol's requirement for authenticated maintainer acceptance evidence**.
2. **Dual Read (UI & Runner both read `adoption.json` + `yolo:control`):**
   - Both the UI and the Runner read `.yolo/adoption.json` as the baseline, overlaid with any newer maintainer-authored control events on the `yolo:control` issue.
   - Thus the toggle takes effect **instantly (<200ms)** in both the UI and the next Runner turn!
3. **Eventual Git Sync (Runner → `.yolo/adoption.json`):**
   - On the Runner's next commit/PR (or a dedicated sync step), the Runner writes the new setting and its `yolo:control` comment URL into `.yolo/adoption.json` (`acceptance: [...]`), keeping the Git repo self-contained for offline/cold clones.

---

## 3. User Segregation: Maintainer vs. Regular User

How does the app know whether the person looking at the UI is a **Maintainer** or a **Regular User**?

### Two-Layer Identity & Permission Check
Per [`.yolo/governance/AUTHORITY.md`](../.yolo/governance/AUTHORITY.md), GitHub permissions support authority but do not widen the recognized maintainer list. So the backend (`GET /api/session`) resolves:
1. **GitHub Identity:** `login` (e.g., `normzhou`) via `gh api user` (in local `npx` mode) or GitHub OAuth / `yolo-client-identity-v1` (in hosted mode).
2. **GitHub Repo Permission:** `viewerPermission` (`ADMIN`, `MAINTAIN`, `WRITE`, `TRIAGE`, `READ`, `NONE`) via `gh api repos/:owner/:repo`.
3. **YOLO Authority Match:** Checks `login ∈ adoption.authority.maintainers` (`["normzhou"]`) **AND** `permission ∈ {ADMIN, MAINTAIN}`.

```text
Role =
  if (!authenticated)                                     -> "visitor"    (static preview / read-only)
  else if (login in authority.maintainers && isRepoAdmin) -> "maintainer" (full Request + Framework Control Plane)
  else                                                    -> "requester"  (Request-to-Result UI only)
```

- **Why this is secure even if someone bypasses the UI:**
  - Regular users (`requester`) only have `READ`/`NONE` repo permission on GitHub: GitHub itself refuses any attempt by them to edit issue bodies, change labels (`yolo:manual`, `yolo:state:*`), merge PRs, or edit files.
  - Even if a regular user posts a comment on the `yolo:control` issue, the Runner and UI both ignore control comments whose `author.login` is not in `adoption.authority.maintainers`.

---

## 4. Walking Through the 7 Enumerated Surface-Area Examples

Here is how each of the 7 items from our enumeration works end-to-end across **Storage Mechanism**, **Role Segregation**, **UI Read/Write**, and **Runner Read/Write**:

### Example 1: Consent Switches (`feedback.automatic`, `observation.enabled`)
- **What it is:** Boolean authority controls in `.yolo/adoption.json` requiring maintainer `acceptance` evidence.
- **Role visibility:**
  - *Regular user:* Hidden (or read-only privacy/telemetry disclosure in footer).
  - *Maintainer:* Interactive toggle switches in the **Framework / Settings** tab.
- **How UI writes & reads:**
  - *Write:* Maintainer flips `feedback.automatic` → UI posts a structured comment on `yolo:control` (or updates `yolo:control` body) under maintainer's `gh` identity.
  - *Read:* UI reads baseline `.yolo/adoption.json` + latest maintainer event on `yolo:control`. Shows `On (synced)` or `On (pending Git sync · #205)`.
- **How Runner writes & reads:**
  - *Read:* Before `/yolo feedback` or observer transmission, Runner checks `.yolo/adoption.json` + `yolo:control` events authored by `authority.maintainers`.
  - *Write:* On next `/yolo work` run, Runner commits the updated boolean + comment URL into `.yolo/adoption.json` `feedback.acceptance[]`.

### Example 2: Maintainer Manual Tasks (`yolo:manual`, e.g., `#203` for `demo.yolo-dev.ai`)
- **What it is:** Tasks reserved to the human maintainer (creating a per-subdomain Cloudflare API token, setting a secret, making an authority decision) that block an admitted `yolo:work` outcome (`#199`) via native GitHub `blockedBy`.
- **Role visibility:**
  - *Regular user:* Filtered **out** of the default Requests list (or shown muted under the blocked outcome's detail view) so regular users aren't confused by internal ops tasks.
  - *Maintainer:* Highlighted in an **"Action Required (1)"** banner at the top of the drawer.
- **How UI writes & reads:**
  - *Read:* Queries open issues with label `yolo:manual` and their GraphQL `blocking` edges. Renders the step-by-step instructions (`#203`).
  - *Write:* Maintainer clicks **"I completed this — resume work"** (optionally with a note) → UI posts a maintainer confirmation comment on `#203`.
- **How Runner writes & reads:**
  - *Write:* When Runner hits a human-only boundary during `/yolo work`, it creates a `yolo:manual` issue, links `addBlockedBy`, and sets the work issue to `yolo:state:waiting`.
  - *Read:* On next `/yolo work`, Runner sees the maintainer's confirmation comment on `#203`, verifies the completion condition (e.g., checks `~/.local/share/yolo-demo-app/env.sh`), closes `#203`, and transitions `#199` from `waiting` to `active`.

### Example 3: Execution Steering (`Run / Pause` & `Now / Next` Priority Ordering)
- **What it is:** Global execution clutch (`Run` vs. `Pause` binding limit in `AUTHORITY.md`) and priority ordering of queued outcomes (`Now / Next`).
- **Role visibility:**
  - *Regular user:* Sees read-only status badges (`Planned`, `In progress`, `Waiting`) on their requests.
  - *Maintainer:* Sees **Run / Pause** toggle and can reorder or pin `Now / Next` outcomes.
- **How UI writes & reads:**
  - *Write:* Maintainer clicks **Pause** or promotes an issue to **Now** → UI updates the `yolo:control` issue (or active plan issue).
  - *Read:* Reads `yolo:control` issue state.
- **How Runner writes & reads:**
  - *Read:* Runner checks `yolo:control` at startup and before every merge/release; if `Paused` by maintainer, Runner stops immediately (`AUTHORITY.md`: *"A stated human pause holds until explicit human resume"*).
  - *Write:* Runner updates the `Now / Next` table as outcomes complete or new requests are triaged.

### Example 4: Skill Pin & Upgrade Lifecycle (`v0.1.0-alpha.33`, `/yolo upgrade [preview]`)
- **What it is:** The pinned YOLO Dev bundle in `.agents/skills/yolo/**`, `.yolo/protocol.md`, and `.yolo/adoption.json`.
- **Role visibility:**
  - *Regular user:* Footer shows `YOLO Dev v0.1.0-alpha.33` (read-only).
  - *Maintainer:* Sees current pin (`v0.1.0-alpha.33`), whether a newer `stable` or `preview` release exists upstream (`normzhou/yolo-dev` releases API), and an **"Upgrade Pin"** / **"Approve Upgrade PR"** button.
- **How UI writes & reads:**
  - *Read:* Reads `.yolo/adoption.json` (`harness.skill.release`) and compares with `GET /repos/normzhou/yolo-dev/releases`.
  - *Write:* Clicking **"Request upgrade to v0.1.0-alpha.34"** posts a control request; once the Runner opens the upgrade PR, if protected edits are involved, the UI shows **"Approve Upgrade PR"** which posts the maintainer's approval on the PR/issue.
- **How Runner writes & reads:**
  - *Write:* Runner runs `yolo-check resolve`, stages the 92-file bundle in a PR, runs `yolo-check --structure`, and merges once approved.

### Example 5: Protected Governance (`CHARTER.md`, `AUTHORITY.md`, `authority.pending[]`)
- **What it is:** Human-owned purpose, durable constraints, recognized maintainers, and standing grant.
- **Role visibility:**
  - *Regular user:* Can read the project's Charter purpose ("What this app is for").
  - *Maintainer:* Sees active Charter/Authority summary + any pending protected proposal in `authority.pending[]` or open PRs touching `.yolo/governance/*`.
- **How UI writes & reads:**
  - *Write:* Maintainer can propose a Charter edit or click **"Approve revision `<sha>`"** on a pending governance PR (posting an authenticated PR review/comment bound to that exact SHA).
- **How Runner writes & reads:**
  - *Read:* Runner checks that the approval comment/review by `authority.maintainers` names the exact commit SHA before merging any PR that touches `CHARTER.md` or `AUTHORITY.md`.

### Example 6: Verification, Checkpoints & Releases (`v0.13.1`, `yolo-check`, `checkpoint`)
- **What it is:** Read-only health dashboard of the repository's conformity (`13/13 structure pass`, `checkpoint` commit `c62fbd3`, `unresolved[]`, and latest release `v0.13.1` `11/11` verification).
- **Role visibility:**
  - *Regular user:* Sees current build/release version (`v0.13.1`) and reload prompt when a new version ships.
  - *Maintainer:* Sees full conformity breakdown (`structure`, `checkpoint` lag, `unresolved[]`) and can request a checkpoint review.
- **How UI & Runner interact:**
  - *Runner writes* `.yolo/reports/*.json` and updates `.yolo/adoption.json` on each release/checkpoint; *UI reads* and renders them.

### Example 7: App Hosting & Shared Identity (`hosting/cloudflare/`, `demo.yolo-dev.ai`)
- **What it is:** Static/Worker deployment config (`wrangler.json`), upstream hostname request (`normzhou/yolo-dev#208`), and manual setup blocker (`#203`).
- **Role visibility:**
  - *Regular user:* Uses the hosted app at `demo.yolo-dev.ai`; sees truthful `static preview` indicator.
  - *Maintainer:* Sees hosting pipeline status (`Scaffold ready` → `Upstream request #208 open` → `Waiting on Worker API token #203` → `Live`), with direct links to `#203` and `normzhou/yolo-dev#208`.

---

## 5. Summary of Key Takeaways & Open Questions

### Key Architectural Takeaways
1. **Split state by mutation speed:**
   - **Fast / Live Control State** (`feedback.automatic`, `observation.enabled`, `Run / Pause`, `Now / Next` overrides) should write to a **single `yolo:control` GitHub issue** via authenticated maintainer comments/body updates, and be synced into `.yolo/adoption.json` by the Runner on its next commit.
   - **Versioned Repo State** (`CHARTER.md`, `AUTHORITY.md`, skill pin upgrades, `hosting/` files) must go through **Git branches/PRs**, with the UI providing visibility and one-click PR/issue approval.
2. **Role segregation (`visitor` vs. `requester` vs. `maintainer`):**
   - Determined by checking `session.identity ∈ adoption.authority.maintainers` + GitHub repo permission (`ADMIN`/`MAINTAIN`).
   - Keeps the default app experience clean for regular users while giving the maintainer a real control plane.

### Open Questions to Settle Next
- **Q1 (`yolo:control` issue in L1):** Today `.yolo/protocol.md` introduces `yolo:control` at L2. Should we introduce the single `yolo:control` issue in L1 as well whenever a target app wants UI-driven framework settings, or keep L1 setting changes as ordinary `yolo:work` issues until L2?
- **Q2 (Where Maintainer Controls Live in UI):** When signed in as a `maintainer`, should the UI show:
  - **(a)** A **"Maintainer / YOLO"** tab inside the existing drawer (next to `Requests`), plus an **"Action required (`#203`)"** pill in the top bar whenever a `yolo:manual` issue is open?
  - **(b)** A separate slide-over panel / modal triggered from a header badge (`L1 · v0.1.0-alpha.33`)?
- **Q3 (First Slice to Prototype):** Would you like our first prototype slice (when we're ready to code) to be:
  1. **Role detection (`maintainer` vs `requester`) + `yolo:manual` Action Required banner** (so `#203` is front-and-center for you and hidden from regular users), plus
  2. **The `Framework` tab** showing `.yolo/adoption.json` switches (`feedback.automatic`, `observation.enabled`), pin version, and `demo.yolo-dev.ai` hosting status?

## Governing record

- Current UI & `RequestStore` boundary: [`.yolo/governance/ARCHITECTURE.md`](../.yolo/governance/ARCHITECTURE.md)
- Adopted protocol sections: [`.yolo/protocol.md`](../.yolo/protocol.md) (`Adoption and evidence records`, `L2 coordination and recovery`, `Maintainer-reserved actions`, `Owner-operated app hosting`)
- Session logs:
  - [`brainstorm/log/2026-10-22-01-framework-settings-ui-surface.md`](log/2026-10-22-01-framework-settings-ui-surface.md)
  - [`brainstorm/log/2026-10-22-02-dual-writer-github-mechanisms-and-roles.md`](log/2026-10-22-02-dual-writer-github-mechanisms-and-roles.md)
