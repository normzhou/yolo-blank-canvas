# YOLO Dev framework & settings UI

Status: exploring · 2026-10-22

How should a YOLO Dev-enabled web app expose its own **framework state, settings, governance, hosting status, and maintainer manual tasks** in the UI — and how can a maintainer change settings like `feedback.automatic` or `observation.enabled` without violating the protocol's single-source-of-truth and authority-evidence rules?

---

## 1. Complete Surface Area Enumeration (7 Domains)

Everything that governs or configures the YOLO Dev framework in an adopted repository lives across `.yolo/adoption.json`, `.yolo/governance/*`, `.yolo/reports/*`, `hosting/*`, and GitHub Issues/PRs:

### Domain A — Consent & Upstream Switches (Authority Controls in `.yolo/adoption.json`)

| Setting / Field | Current Shape | Protocol Meaning & Authority Constraint |
| --- | --- | --- |
| **Automatic Upstream Feedback** (`feedback.automatic`) | `{ automatic: boolean, acceptance: string[] }` | When `true`, the agent may submit sanitized upstream feedback and hostname requests to `normzhou/yolo-dev` without pausing for a manual draft gate. **Authority control:** enabling requires a verifiable maintainer acceptance reference in `feedback.acceptance`. |
| **Activity Observation / Telemetry** (`observation.enabled`) | `{ enabled: boolean, adoption_id: string \| null, acceptance: string[] }` | When `true`, native harness hooks capture and transmit bounded session/tool/token metrics correlated by `adoption_id`. **Authority control:** enabling requires maintainer acceptance in `observation.acceptance`; disabling stops queued and new transmissions immediately. |

### Domain B — Adoption Identity & Pin Lifecycle (`.yolo/adoption.json` + `.agents/skills/yolo`)

| Surface | Fields / Artifacts | Potential UI Role (Read vs. Action) |
| --- | --- | --- |
| **Target & Level** | `target.repository`, `target.default_branch`, `target.level` (`1` Assisted, `2` Autonomous), `activation.state` (`proposed` \| `active`), `qualification.status` (`unverified` \| `prepared` \| `qualified`) | **Read:** Badge showing `L1 Assisted · Active` and Q1–Q5 qualification readiness.<br>**Action:** Request `/yolo check` or level progression review. |
| **Protocol & Skill Pin** | `protocol.revision`, `protocol.sha256`, `harness.skill.release` (`v0.1.0-alpha.33`), `harness.skill.revision`, `harness.skill.manifest_sha256`, `upgrades[]` | **Read:** Current pinned release (`v0.1.0-alpha.33`), manifest integrity (`92/92`), and upgrade history.<br>**Action:** Check for newer `stable` / `preview` releases (`yolo-check resolve [preview]`) and request `/yolo upgrade [preview]`. |
| **Harness & Observed Sessions** | `harness.name`, `harness.version`, `harness.instructions`, `harness.observed_sessions[]` | **Read:** Which coding harnesses (`opencode`, `Cursor`, `Claude`, `Codex`, `Gemini`) have intact bindings and recorded Q5 continuation evidence. |

### Domain C — Execution & Credential Profile (`execution` in `.yolo/adoption.json`)

| Surface | Fields / Artifacts | Potential UI Role (Read vs. Action) |
| --- | --- | --- |
| **Execution Profile** | `execution.profile`: `"personal"` (default `gh` session) vs. `"self-hosted-app"` (`app_id`, `installation_id`, `acceptance[]`) | **Read:** Whether work runs under personal `gh` credentials or an operator-owned GitHub App, plus preflight status (`yolo-check app verify`).<br>**Action:** Guide setup or switch profile (keeping PEM/private config outside the repo). |

### Domain D — Governance & Authority (`.yolo/governance/*`)

| Surface | Files / Fields | Potential UI Role (Read vs. Action) |
| --- | --- | --- |
| **Maintainers & Pending Approvals** | `authority.maintainers` (`["normzhou"]`), `authority.source`, `authority.acceptance`, `authority.pending[]` | **Read:** Recognized maintainers and any decision blocked in `authority.pending`.<br>**Action:** Approve or decline a pending protected proposal. |
| **Governing Documents** | `CHARTER.md` (purpose & 6 durable constraints), `AUTHORITY.md` (delegated vs. reserved), `ARCHITECTURE.md` (contracts & versioning policy), `specs/*` | **Read:** Structured summary or rendered view of Charter purpose, delegated powers (autonomous merge, semver release), and reserved gates.<br>**Action:** Draft a Charter or Authority amendment request. |

### Domain E — Verification, Releases & Checkpoints (`verification` & `checkpoint` in `.yolo/adoption.json`)

| Surface | Fields / Artifacts | Potential UI Role (Read vs. Action) |
| --- | --- | --- |
| **Published Release & Build ID** | `verification.release.published` (`tag`, `commit`, `source_commit`, `acceptance`), `legacy_tags`, `observations[]`, `/api/version` | **Read:** Current release (`v0.13.1`), `serverBuild` / `clientBuild` match, and 11/11 artifact acceptance receipt. |
| **Checkpoint & Conformity Findings** | `checkpoint.commit`, `checkpoint.report`, `prior_interval_reviews[]`, `unresolved[]`, live `yolo-check --structure` | **Read:** Last reviewed checkpoint commit (`c62fbd3`), commits since checkpoint, `13/13` structural rules, and open `unresolved[]` notes. |

### Domain F — Optional App Hosting & Shared Identity (`hosting/*`)

| Surface | Files / Artifacts | Potential UI Role (Read vs. Action) |
| --- | --- | --- |
| **Hosting Profile (`demo.yolo-dev.ai`)** | `hosting/cloudflare/wrangler.json` (`PUBLIC_ORIGIN`, `BACKEND_ORIGIN`, `yolo-demo-app`), `hosting/HOSTNAME-REQUEST.md`, upstream request (`normzhou/yolo-dev#208`) | **Read:** Profile (`cloudflare` static vs. `cloudflare-oracle`), Worker name, static asset count/size, upstream request link (`normzhou/yolo-dev#208`), and current blocker (`#203`). |
| **Shared Identity Preview** | `hosting/yolo-identity` (`CLIENT_IDENTITY_ENABLED`, `PUBLIC_ORIGIN`, `APP_DB`) | **Read / Action:** Status of `yolo-client-identity-v1` (`login.yolo-dev.ai` Google OIDC preview). |

### Domain G — Workflow Control Plane (GitHub Issues & Labels)

| Surface | Labels / Objects | Potential UI Role (Read vs. Action) |
| --- | --- | --- |
| **Maintainer Manual Tasks** | `yolo:manual` issues (e.g., `#203`) + native `blockedBy` links to `yolo:state:waiting` work (e.g., `#199`) | **Read & Action:** Dedicated **"Action required by maintainer"** callout so human-only tasks (creating API tokens, approving protected edits) stand out from ordinary user requests, with a one-click **"Mark completed & notify agent"** action. |
| **Cross-Outcome Plan & L2 Control** | Plan issue (`#192`: `Now / Next / Deferred`) and future L2 `yolo:control` issue (`Run / Pause`) | **Read & Action:** View ordered `Now / Next` queue and (in L2) toggle `Run / Pause`. |

---

## 2. Architectural Options for Reading & Writing Framework Settings

### Constraint Checklist
1. **GitHub + `.yolo/adoption.json` on `main` is the only source of truth** (`CHARTER.md` constraint 1) — settings cannot live in `localStorage` or an uncommitted local database.
2. **Authority controls need authenticated human acceptance** (`records.md`) — flipping `feedback.automatic` or `observation.enabled` to `true` requires a durable record authored by the recognized maintainer (`normzhou`) that can be cited in `acceptance: [...]`.
3. **Must work in both local `npx` mode and static `demo.yolo-dev.ai` mode** — in static mode there is no Node backend, so read state needs a build-time snapshot (or public GitHub read) and write actions need to route through GitHub.

### Option 1: GitHub-Backed Setting Proposals (Pure Protocol Flow)
- **How Read works:**
  - At build time (`vite.config.ts`) and via `GET /api/framework` in local server mode, expose a sanitized read-only summary of `.yolo/adoption.json` + `hosting/cloudflare/wrangler.json` (no secrets).
- **How Write works:**
  - When the maintainer toggles a setting in the UI (e.g., `feedback.automatic` or `observation.enabled`) or clicks **"Confirm manual task #203 complete"**, the UI posts an authenticated GitHub issue or comment via the existing `RequestStore` (`POST /api/issues` or `POST /api/issues/:n/comments`) using a structured marker (e.g., `Template: yolo.setting@1.0.0`).
  - Because `gh` posts under the maintainer's authenticated GitHub account, **that issue/comment URL is immediate, cryptographically attributable maintainer acceptance evidence**!
  - In the next `/yolo work` turn (or automatically under an L2 runner), the agent reads the setting issue, updates `.yolo/adoption.json` citing that issue URL in `acceptance: [...]`, and closes the issue.
  - Meanwhile, the UI can show **"Pending apply (#204)"** next to the toggle using the same reconciliation pattern we already use for `createdIssues`.

### Option 2: Direct Local Commit in Loopback Mode + Issue Fallback
- When running locally on a writable git checkout (`npm run dev`), a local endpoint could directly edit `.yolo/adoption.json` and commit/push on behalf of the local user.
- **Downside:** Does not work in `npx` installed mode (which runs in a read-only npm cache directory with no git checkout!) or in static `demo.yolo-dev.ai` mode, and widens `server/app.js` beyond the 4-operation `RequestStore` boundary.

---

## 3. Decisions and Open Questions

- **Q1 (Scope Boundary — App Repo vs. Reusable YOLO Dev Spec):** Should this "Framework / Settings UI" be designed first as a concrete feature inside `yolo-blank-canvas` (to prove the UX), and then graduated upstream into `normzhou/yolo-dev` (`specs/request-interface.md`), or specified upstream first?
- **Q2 (Where It Lives in the UI):** Should framework settings and status live:
  - **(a)** As a second tab/view inside the existing drawer (**Requests** | **Framework & Settings**),
  - **(b)** As a dedicated **Settings / YOLO** gear popover in the panel footer / header, or
  - **(c)** Split between **Requests** (surfacing `yolo:manual` tasks + `Now / Next` plan) and a **Settings** view (`.yolo/adoption.json` switches, pin, hosting)?
- **Q3 (Which Surface Area Enters V1):** Which of the 7 domains above belong in the first iteration, and which are noise for day-to-day use?
  - Candidate V1 core: **Domain A** (`feedback.automatic`, `observation.enabled`), **Domain B** (Pin version & L1/L2 status), **Domain F** (Hosting status `demo.yolo-dev.ai`), and **Domain G** (`yolo:manual` blocker tasks like `#203`).
- **Q4 (How Toggles Apply):** Does Option 1 (toggling a setting files/updates a structured GitHub issue/comment that serves as the maintainer's authenticated `acceptance` record and shows *"Pending apply"* until `/yolo work` lands it) feel right, or do we want a different mechanism?
- **Q5 (Static Preview Visibility):** On the public static deployment (`demo.yolo-dev.ai`), should the Framework/Settings panel be visible read-only to visitors (as a live showcase of how a YOLO Dev app is governed), or hidden/maintainer-only?
- **Q6 (Multi-Repo / Upstream Status):** For cross-repo items like `normzhou/yolo-dev#208` (`demo.yolo-dev.ai` hostname request), should the UI link out to the upstream issue, or should `RequestStore` stay strictly single-repo?

## Governing record

- Current UI & `RequestStore` boundary: [`.yolo/governance/ARCHITECTURE.md`](../.yolo/governance/ARCHITECTURE.md)
- Adopted protocol sections: [`.yolo/protocol.md`](../.yolo/protocol.md) (`Adoption and evidence records`, `Request-to-result interface`, `Maintainer-reserved actions`, `Owner-operated app hosting`)
- Related session log: [`brainstorm/log/2026-10-22-01-framework-settings-ui-surface.md`](log/2026-10-22-01-framework-settings-ui-surface.md)
