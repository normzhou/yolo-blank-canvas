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

## 3. User Segregation & Access Control on the `yolo:control` Issue

If we use a GitHub Issue (`yolo:control`) as the low-latency (~200ms) backing store for live framework settings (#1), **how do we enforce access control between a regular user and a maintainer** — both inside our UI and if someone calls the GitHub API directly?

### Layer 1: GitHub-Native Write Enforcement on the `yolo:control` Issue
On a public GitHub repository, any logged-in GitHub user can normally file issues and comment on open issues. However, GitHub provides **three hard server-side permission boundaries** on an issue that regular users (`READ` / `NONE` permission) **cannot** cross:

1. **Labeling (`yolo:control`) is Collaborator-Only (`triage`/`write`/`admin`):**
   - A regular user cannot add or remove labels on any issue. Therefore, a regular user can **never** create a fake issue and label it `yolo:control`.
2. **Editing the Issue Body (`PATCH /repos/:o/:r/issues/:n`) is Author/Collaborator-Only:**
   - Only the issue author (`normzhou`) or a repo collaborator with `write`/`maintain`/`admin` permission can edit the `yolo:control` issue body. GitHub returns `403 Forbidden` to everyone else.
3. **Locking the `yolo:control` Issue (`PUT /repos/:o/:r/issues/:n/lock`) Blocks Non-Collaborator Comments:**
   - When a GitHub issue is **locked**, GitHub's API **blocks all non-collaborators (`READ`/`NONE`) from posting comments (`403 Forbidden`)**, while **maintainers/collaborators (`write`/`maintain`/`admin`) can still post comments and edit the body normally!**
   - Locking *only* the single `yolo:control` issue turns it into a **maintainer-write-only, public-read** ledger at the GitHub API level, while leaving all other issues in the repo open for regular users to file and comment on.

### Layer 2: Read-Side Attribution Verification (UI & Runner)
Even on top of GitHub's write lock, both the UI and the Runner verify attribution when reading the `yolo:control` issue:
- **Issue check:** Must carry the `yolo:control` label and `issue.user.login ∈ adoption.authority.maintainers`.
- **Event comment check:** Every setting change comment (`<!-- yolo:control-event ... -->`) is verified against `comment.user.login ∈ adoption.authority.maintainers` (and `comment.author_association ∈ {"OWNER", "MEMBER", "COLLABORATOR"}`). Any comment from any other user is ignored.

### Layer 3: Decided Identity & Access Model (Maintainers on GitHub, Regular Users via Bot + External ID)

**Decided direction (2026-10-22):**
1. **Repo Maintainers require a GitHub account**, and their permissions are managed natively with their GitHub account (`admin` / `maintain` on the repository + listed in `adoption.authority.maintainers`).
2. **Regular Users do NOT need a GitHub account.** They sign in to the web app via Google (`login.yolo-dev.ai`) or another external IdP, which tracks their usage under a stable opaque ID (`user_a`, `user_b`, e.g., `<!-- yolo:requester id="user_8f92a1" -->`). The web app uses a **bot token** to write their requests and comments to GitHub.
3. **Fine-grained GitHub Issue permissions** separate what the Maintainer's GitHub account can touch (`yolo:control` body/comments, `yolo:*` labels/tags, issue state) from what the Regular User bot path can touch (creating untagged request issues and commenting on unlocked request threads).

#### How GitHub's Fine-Grained Issue Permissions Work in Practice

There is an important nuance in how GitHub enforces issue-level permissions depending on which kind of **bot token** the web app uses:

| Issue Operation on GitHub | Maintainer Token (`normzhou`, repo `admin`) | Bot Option A: Dedicated Non-Collaborator GitHub Account *(public repos)* | Bot Option B: GitHub App Installation Token (`issues: write` on public or private repos) |
| --- | --- | --- | --- |
| **Create new issue (`title` + `body`)** | Allowed | **Allowed by GitHub** | **Allowed** (Worker passes `title` + `body` only) |
| **Comment on open, unlocked issue** | Allowed | **Allowed by GitHub** | **Allowed** (Worker blocks commenting on `yolo:control` issue) |
| **Add / remove `labels` (`yolo:*` tags)** | **Allowed by GitHub** | **Blocked by GitHub (`403`)** — non-collaborators cannot set labels | GitHub API allows `issues:write` to label, so **Worker omits `labels`** and **Runner ignores `LabeledEvent` if `actor.type === "Bot"`** |
| **Edit `yolo:control` issue body** | **Allowed by GitHub** | **Blocked by GitHub (`403`)** — non-collaborators can only edit their own issues | **Worker blocks `PATCH`**, and **Runner verifies `yolo:control` edits/comments have `user.login ∈ authority.maintainers` (human, never `[bot]`)** |
| **Comment on locked `yolo:control` issue** | **Allowed by GitHub** (collaborators bypass issue lock) | **Blocked by GitHub (`403`)** — locked issues reject non-collaborator comments | **Worker blocks**, and **Runner rejects any `yolo:control` comment where `user.login` is the `[bot]`** |
| **Edit another user's comment (`user_a` vs `user_b`)** | Allowed (repo admin moderation) | **Blocked** — `user_a` and `user_b` share the bot token, so the **Webapp Worker enforces that `user_a` can only edit/reply to `id="user_a"`** | **Webapp Worker enforces `principal.subject` match** before calling GitHub |

**Key takeaway from the table above:**
- **Between Maintainer and Regular Users (`[bot]`):**
  - If the repo is public and the bot uses a **non-collaborator GitHub account (Bot Option A)**, **GitHub's own servers** enforce regular-user permissions (`403` on labels/tags, `403` on editing `yolo:control` body, `403` on commenting on a locked `yolo:control` issue).
  - If the bot uses a **GitHub App Installation token (Bot Option B)** (which works on both public and private repos), GitHub's API only has a single `issues: write` scope (no native "create/comment without label/edit" sub-scope). However, **GitHub cryptographically stamps every action with `user.login = "<app>[bot]"` (`type: "Bot"`)**, whereas the maintainer's token stamps `user.login = "normzhou"` (`type: "User"`). So combining the **Worker's 2-endpoint requester boundary** (`createIssue(title, body)` and `createComment`) with **GitHub's immutable `user.login` attribution** gives the exact same guarantee!
- **Between `user_a` and `user_b` (both using the same bot token):**
  - Because `user_a` and `user_b` share the web app's single bot token on GitHub, GitHub sees both of them as the bot. Therefore, **the Webapp Worker only exposes append-only operations (`createIssue` and `createComment`) to regular users** (never allowing `user_b` to edit or delete `user_a`'s issue body or comments).

---

## 4. End-to-End Mapping of the Enumerated Surface Area to the Decided Model

Below is the complete mapping of our **7 Framework Surface-Area Domains** (plus **Domain 0: Regular User Requests**) onto:
- **GitHub Primitive & Field** (Issue Lock, Tags/Labels, Issue Body, Issue Comments, PR Review, `.yolo/adoption.json`)
- **Regular User (`user_a`, `user_b` via External ID + Bot Token)**
- **Maintainer (`normzhou` via GitHub Account Token)**
- **Runner / Coding Harness**

---

### Master Mapping Matrix

| Domain & Setting / Feature | GitHub Backing Artifact | GitHub Fine-Grained Permission Gate | Regular User (`user_a` via Google ID + Bot Token) | Maintainer (`normzhou` via GitHub Account) | Runner / Coding Harness |
| --- | --- | --- | --- | --- | --- |
| **0. Regular User Requests & Replies** (`yolo.feedback`, `yolo.feature`, `yolo.bug`) | Ordinary unlocked **GitHub Issue** + **Comments** | **Open & Unlocked Issue:** Bot token can `POST /issues` (no labels) and `POST /issues/:n/comments`. Cannot edit others' bodies/comments. | **UI:** Files request & replies. Stamped with `<!-- yolo:requester id="user_a" -->`. Can filter "My requests".<br>**GitHub:** Posted by Bot token. | **UI:** Sees all requests + requester IDs; can reply or triage.<br>**GitHub:** Posts as `normzhou`. | **Reads** new issues; adds `yolo:request` / `yolo:work` + `yolo:state:*` labels and `## YOLO status` / `## YOLO request` summary comments. |
| **A1. Automatic Upstream Feedback** (`feedback.automatic`: `bool`) | **Locked `yolo:control` Issue** (Comment + Body table) ➔ synced to `.yolo/adoption.json` | **Locked Issue + Tag `yolo:control`:** Bot token gets `403` on comment/edit/label. Maintainer GH token bypasses lock (`200`). | **UI:** Hidden.<br>**GitHub:** Blocked (`403` on locked `yolo:control` issue; Runner also rejects non-maintainer `user.login`). | **UI:** Flips toggle ➔ posts `<!-- yolo:control-event {"feedback.automatic":true} -->` comment + updates `yolo:control` body.<br>**Latency:** ~200ms. | **Reads** `.yolo/adoption.json` + latest `normzhou` comment on `yolo:control`.<br>**Writes:** Syncs value + comment URL into `adoption.json` `feedback.acceptance[]` on next commit. |
| **A2. Activity Observation / Telemetry** (`observation.enabled`: `bool`) | **Locked `yolo:control` Issue** (Comment + Body table) ➔ synced to `.yolo/adoption.json` | **Locked Issue + Tag `yolo:control`:** Bot token blocked (`403`). Maintainer GH token allowed (`200`). | **UI:** Read-only privacy note in footer.<br>**GitHub:** Blocked (`403`). | **UI:** Flips toggle ➔ posts control-event comment on locked `yolo:control` issue.<br>**Latency:** ~200ms. | **Reads** `adoption.json` + `yolo:control` before observer hook transmits.<br>**Writes:** Syncs value + comment URL into `observation.acceptance[]`. |
| **B1. Skill Pin & Channel Upgrade** (`v0.1.0-alpha.33`, `stable` vs `preview`) | **Locked `yolo:control` Issue** (trigger) + **GitHub PR** (`.agents/skills/yolo`, `.yolo/protocol.md`, `adoption.json`) | **PR Review / Merge Gate:** Bot token cannot open branches/PRs or review. Maintainer GH token posts `APPROVED` review. | **UI:** Read-only version in footer.<br>**GitHub:** Blocked. | **UI:** Sees current pin vs. latest upstream release; clicks **"Upgrade to preview"** (posts command on `yolo:control`) and **"Approve Upgrade PR"**. | **Reads** upgrade trigger on `yolo:control`; runs `yolo-check resolve`, opens PR, runs `yolo-check --structure`, and merges after Maintainer approval. |
| **B2. Target Level & Qualification** (`L1` / `L2`, `Q1–Q5`, `yolo-check`) | `.yolo/adoption.json` + `.yolo/reports/*.json` | **Git Branch / Repo Contents:** Read-only in Git; only Runner/Maintainer can commit. | **UI:** Hidden.<br>**GitHub:** Read-only. | **UI:** Inspects `L1 Assisted · Active`, Q1–Q5 status, and `13/13 structure pass`; clicks **"Request `/yolo check`"**. | **Writes** `.yolo/reports/checkpoint-review-*.json` and updates `qualification.evidence[]`. |
| **C. Execution & Credential Profile** (`personal` vs `self-hosted-app`) | `.yolo/adoption.json` (`execution`) + private controller config outside repo | **Locked `yolo:control` + PR:** Requires Maintainer GH token + local controller preflight (`yolo-check app verify`). | **UI:** Hidden.<br>**GitHub:** Blocked. | **UI:** Views active profile (`personal` vs `self-hosted-app` `app_id`/`installation_id`) and preflight receipt. | **Reads** `adoption.json` `execution.profile`; refuses fallback if `self-hosted-app` is configured without preflight. |
| **D. Governance & Protected Docs** (`CHARTER.md`, `AUTHORITY.md`, `authority.pending[]`) | `.yolo/governance/*` + **GitHub PR Review** (`commit_id`) | **Protected Edit Rule + PR Review:** Runner requires `review.user.login ∈ authority.maintainers` bound to exact PR `head.sha`. | **UI:** Can view Charter purpose ("About this app").<br>**GitHub:** Cannot approve or merge. | **UI:** Views Charter/Authority; sees any pending governance PR and clicks **"Approve revision `<sha>`"** (posts GitHub PR Review). | **Verifies** authenticated `normzhou` approval on exact commit SHA before merging any diff touching `CHARTER.md` or `AUTHORITY.md`. |
| **E. Verification, Checkpoints & Releases** (`v0.13.1`, `checkpoint.commit`, `unresolved[]`) | `.yolo/adoption.json` + `.yolo/reports/releases-observed-*.json` + **GitHub Releases** | **Git Tag / Release:** Delegated to Runner under `ARCHITECTURE.md` versioning policy; withdrawing/deleting reserved to Maintainer. | **UI:** Sees `v0.13.1` and "App version changed — reload" banner. | **UI:** Sees release history, `11/11` verify-release status, commits since last checkpoint, and `unresolved[]` list. | **Writes** release tags, `.yolo/reports/releases-observed-*.json`, and updates `verification.release.published`. |
| **F. App Hosting & Shared Identity** (`hosting/cloudflare/`, `demo.yolo-dev.ai`) | `hosting/*` in Git + Upstream Issue (`normzhou/yolo-dev#208`) + Manual Blocker (`#203`) | **Repo + Cross-Repo Issue (`yolo-dev#208`):** Filed under Maintainer/authorized `feedback.automatic` path. | **UI:** Uses `demo.yolo-dev.ai` in `static_demo` mode. | **UI:** Sees pipeline (`Scaffold ✓` ➔ `Upstream #208` ➔ `Blocker #203` ➔ `Live`) and `CLIENT_IDENTITY_ENABLED` status. | **Instantiates** `hosting/`, verifies `wrangler deploy --dry-run`, files/updates `yolo-dev#208`, and deploys Worker once `#203` completes. |
| **G1. Maintainer Manual Tasks** (`yolo:manual`, e.g., `#203` blocking `#199`) | **Locked `yolo:manual` Issue** + GraphQL `blockedBy` edge to `yolo:work` issue | **Tag `yolo:manual` + Locked Issue:** Bot token cannot label (`403`) or comment if locked (`403`). Only Maintainer GH token can confirm/close. | **UI:** Filtered **out** of the regular Requests list so ops tasks don't clutter user requests.<br>**GitHub:** Blocked (`403`). | **UI:** Top **"Action Required (1)"** banner showing `#203` steps + **"I completed this — resume work"** button (posts `normzhou` comment). | **Creates** `yolo:manual` issue + `addBlockedBy` when blocked; **reads** `normzhou` confirmation, verifies completion condition, closes `#203`, and resumes `#199`. |
| **G2. Execution Steering** (`Run / Pause` & `Now / Next` queue) | **Locked `yolo:control` Issue** (Body table + Comments) | **Locked Issue + Tag `yolo:control`:** Bot token blocked (`403`). Maintainer GH token edits body / comments (`200`). | **UI:** Sees read-only `Planned` / `In progress` / `Waiting` badges on requests.<br>**GitHub:** Blocked (`403`). | **UI:** Clicks **Pause / Resume** or reorders `Now / Next` queue ➔ updates locked `yolo:control` issue (~200ms). | **Checks** `yolo:control` before every step/merge/release; halts immediately if `Paused`. Updates `Now / Next` as work advances. |

---

### Concrete Walkthrough of How the Three Core Flows Work

#### Flow 1: Regular User (`user_a`) Files a Request vs. Tries to Touch Settings
1. `user_a` opens the web app and signs in with **Google** (`login.yolo-dev.ai`). They have **no GitHub account**.
2. The web app session has `{ role: "requester", userId: "user_8f92a1" }`. The UI renders **only** the game stage and the `Requests` drawer (filtered to exclude `yolo:manual` and `yolo:control` issues).
3. `user_a` submits a feature request. The web app backend calls GitHub `POST /repos/:o/:r/issues` using the **Bot Token**, passing **only** `title` and `body` (appending `<!-- yolo:requester id="user_8f92a1" -->`).
4. Even if `user_a` tries to craft a malicious HTTP request to change framework settings:
   - The web app backend rejects `/api/control` because `session.role !== "maintainer"`.
   - Even if the Bot Token itself tried to comment on or edit the `yolo:control` issue on GitHub, **`yolo:control` is locked (`locked: true`) and tagged `yolo:control`**, so GitHub returns `403 Forbidden` to a non-collaborator bot token, and the Runner ignores any `yolo:control` event not authored by `normzhou`.

#### Flow 2: Maintainer (`normzhou`) Flips a Live Setting (`feedback.automatic` or `Pause`)
1. `normzhou` signs into the web app using **GitHub** (`gh` locally, or GitHub OAuth on hosted).
2. The web app backend verifies `login === "normzhou"` (`∈ adoption.authority.maintainers`) and repo `admin` permission, setting `{ role: "maintainer", login: "normzhou" }`.
3. `normzhou` opens the **Framework / Control** tab and flips `feedback.automatic` (or clicks **Pause**).
4. The backend uses `normzhou`'s GitHub token to post a structured comment on the locked `yolo:control` issue and update its body table (~200ms):
   ```markdown
   ## YOLO control event
   - Setting: `feedback.automatic` -> `true`
   <!-- yolo:control-event {"setting":"feedback.automatic","value":true} -->
   ```
5. Both the UI and the Runner immediately read this event from `yolo:control` (verifying `comment.user.login === "normzhou"`). On the Runner's next commit, it syncs the setting and the comment's immutable GitHub URL into `.yolo/adoption.json` `feedback.acceptance[]`.

#### Flow 3: Maintainer Completes a `yolo:manual` Blocker (`#203`)
1. During `/yolo work` on `#199` (`demo.yolo-dev.ai`), the Runner hits a human-only step (creating the per-subdomain Cloudflare Worker API token). It creates `#203` with label `yolo:manual`, locks it (so only maintainers can comment), links `#199` `blockedBy` `#203`, and sets `#199` to `yolo:state:waiting`.
2. When `normzhou` opens the web app, the UI sees an open `yolo:manual` issue and displays an **"Action Required: #203"** card at the top of the drawer with the step-by-step instructions.
3. After `normzhou` creates `~/.local/share/yolo-demo-app/env.sh`, they click **"Mark completed & resume #199"** in the UI.
4. The UI posts a comment on `#203` under `normzhou`'s GitHub token. On the next `/yolo work` run, the Runner verifies `normzhou`'s comment + checks `~/.local/share/yolo-demo-app/env.sh`, closes `#203`, and resumes `#199`.

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

- Upstream `yolo-dev` feedback & common-layer proposal: [`normzhou/yolo-dev#285`](https://github.com/normzhou/yolo-dev/issues/285) (`[feedback] Common control-plane & UI layer for framework settings, locked yolo:control state, and external-ID user mapping`)
- Current UI & `RequestStore` boundary: [`.yolo/governance/ARCHITECTURE.md`](../.yolo/governance/ARCHITECTURE.md)
- Adopted protocol sections: [`.yolo/protocol.md`](../.yolo/protocol.md) (`Adoption and evidence records`, `L2 coordination and recovery`, `Maintainer-reserved actions`, `Owner-operated app hosting`)
- Session logs:
  - [`brainstorm/log/2026-10-22-01-framework-settings-ui-surface.md`](log/2026-10-22-01-framework-settings-ui-surface.md)
  - [`brainstorm/log/2026-10-22-02-dual-writer-github-mechanisms-and-roles.md`](log/2026-10-22-02-dual-writer-github-mechanisms-and-roles.md)
