# Enumerating the YOLO Dev framework & settings UI surface area

2026-10-22

## Context & Trigger

While preparing `demo.yolo-dev.ai` ([#199](https://github.com/normzhou/yolo-blank-canvas/issues/199)) and its maintainer blocker ([#203](https://github.com/normzhou/yolo-blank-canvas/issues/203)), we hit a recurring UX gap: framework-level settings like `feedback.automatic: true` in `.yolo/adoption.json` and maintainer-owned `yolo:manual` tasks currently have no dedicated UI surface. Discovering why an action was blocked or flipping a framework consent switch required inspecting `.yolo/adoption.json` and GitHub labels in chat.

The maintainer asked to start brainstorming and architecting a UI interface for YOLO Dev framework settings (without coding yet), starting by enumerating the full surface area and storing the design in `brainstorm/` so we can iterate on it.

## What Was Discussed

1. **Enumerated the 7 domains of YOLO Dev framework state & controls** in [`brainstorm/framework-settings-ui.md`](../framework-settings-ui.md):
   - **Domain A — Consent & Upstream Switches:** `feedback.automatic` and `observation.enabled` (`adoption_id`, `acceptance[]`).
   - **Domain B — Adoption Identity & Pin Lifecycle:** `target.level` (L1/L2), `activation.state`, `qualification.status` (Q1–Q5), `harness.skill.release` (`v0.1.0-alpha.33`), and `upgrades[]`.
   - **Domain C — Execution & Credential Profile:** `execution.profile` (`personal` vs. `self-hosted-app`).
   - **Domain D — Governance & Authority:** `authority.maintainers`, `authority.pending[]`, and `CHARTER.md` / `AUTHORITY.md` / `ARCHITECTURE.md`.
   - **Domain E — Verification, Releases & Checkpoints:** `verification.release.published`, build-ID alignment, `checkpoint`, and `unresolved[]`.
   - **Domain F — Optional App Hosting & Shared Identity:** `hosting/cloudflare/` (`demo.yolo-dev.ai`), `hosting/HOSTNAME-REQUEST.md`, upstream request `normzhou/yolo-dev#208`, and `hosting/yolo-identity`.
   - **Domain G — Workflow Control Plane:** `yolo:manual` maintainer tasks (e.g., `#203`), `blockedBy` links, `Now / Next` plan (`#192`), and L2 `yolo:control`.
2. **Identified the core architectural constraint for writing settings:**
   - Framework settings live in `.yolo/adoption.json` on `main`, and authority controls (`feedback.automatic`, `observation.enabled`) require an authenticated maintainer acceptance reference (`acceptance: [...]`).
   - Because `npx` runs from a read-only package cache (no local git checkout) and `demo.yolo-dev.ai` runs as a static Worker, a UI toggle cannot just write to disk. Instead, posting a structured GitHub issue/comment under the maintainer's authenticated session both records the human approval (`acceptance` evidence) and queues the `.yolo/adoption.json` change for `/yolo work`.

## Open Questions for Next Iteration

Tracked as `Q1–Q6` in [`brainstorm/framework-settings-ui.md`](../framework-settings-ui.md#3-decisions-and-open-questions):
- `Q1`: Prototype in `yolo-blank-canvas` first vs. specify upstream in `normzhou/yolo-dev` first?
- `Q2`: Navigation placement (tab inside the drawer vs. footer/header settings popover vs. split between Requests and Settings)?
- `Q3`: Which of the 7 domains belong in V1 vs. later?
- `Q4`: Mechanism for applying setting changes (GitHub-backed setting proposal + *"Pending apply"* state vs. alternatives)?
- `Q5`: Should the framework inspector be visible read-only on public static `demo.yolo-dev.ai`?
- `Q6`: How to represent cross-repo links like `normzhou/yolo-dev#208` while keeping `RequestStore` single-repo?
