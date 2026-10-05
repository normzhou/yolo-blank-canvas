# AGENTS.md

Ordinary instructions for coding agents working in this repository.

## YOLO Dev Assisted

Before planning or changing this repo, read and apply the local
[operating contract and L1 criteria](.yolo/protocol.md), then read the
[adoption record](.yolo/adoption.json) and its mapped governing documents and authority.
Follow this protocol during ordinary work, even when the YOLO Dev skill is not invoked.
Reconcile the current request and durable GitHub/Git progress before acting; keep unresolved
conflicts visible.

The adoption record identifies the protocol revision and local context. Installation is not a
permission grant. Preserve the repo's other active instructions; investigate conflicts rather
than silently overriding them.

Follow the adopted **Agent activities** contract: `request` discusses/files/follows target-app
needs; `work` advances issue-backed outcomes; `feedback` concerns YOLO Dev upstream. Ordinary
development requests enter the work procedure even without naming it; record consequential
harness direction in issues before implementation. A direct conversation is not an override.
Upstream submission requires explicit reporting authority and reviewed destination/content. A
newer installed skill cannot impose activities absent from the active protocol; resolve that gap
through explicit upgrade.

## This project

`yolo-blank-canvas` is a local web app: a blank canvas with a **Requests** overlay over one
GitHub repository. [README.md](README.md) documents its prerequisites, launch, behavior,
security boundaries and verification record.

| Home | Contents |
| --- | --- |
| [`.yolo/governance/CHARTER.md`](.yolo/governance/CHARTER.md) | Purpose, audience, durable boundaries |
| [`.yolo/governance/AUTHORITY.md`](.yolo/governance/AUTHORITY.md) | Recognized maintainers, grant, reserved decisions, recovery |
| [`.yolo/governance/ARCHITECTURE.md`](.yolo/governance/ARCHITECTURE.md) | Intended design, contracts, verification/delivery route |
| [`.yolo/governance/specs/status-presentation.md`](.yolo/governance/specs/status-presentation.md) | Durable status/summary presentation contract |
| [`docs/verification.md`](docs/verification.md) | Commands run, results, tested revision, open gaps |

## Working in this repository

- Keep source, tests and build output in their existing locations; `dist/client/` and
  `server/build-id.generated.js` are committed on purpose.
- Never commit credentials. `gh` owns authentication; the backend must keep using the single
  fixed call site in `server/gh.js` for all GitHub access.
- Run `npm test` and `npx tsc --noEmit` before proposing a merge; record real results.
- If you change the status presentation contract, update the spec and its fixtures together.
- Significant architecture changes notify the maintainer; Charter and authority edits require
  their approval.
