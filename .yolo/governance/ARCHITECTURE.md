# yolo-blank-canvas: Architecture

> Design record co-owned with the maintainer under the [Charter](CHARTER.md) and
> [Authority](AUTHORITY.md). Describes the **intended** design; where the current implementation
> differs, the difference is named rather than silently ratified. Drafted during onboarding at
> baseline `520a81e`.

## System and boundaries

A single local Node process serves a React client and a small Express API over loopback.

```text
browser (React, dist/client)
  │  opaque HttpOnly session cookie; same-origin only
  ▼
Express app (server/app.js) ── session.js   in-memory opaque session, no persistence
  │                    ── security.js       Host guard, origin/Sec-Fetch-Site guard, headers
  ▼
server/github.js        four operations only: list/get issues, list/create comments, create issue
  ▼
server/gh.js            the single `gh api` call site; validated arguments, JSON on stdin, no shell
  ▼
GitHub CLI (credentials) ──► GitHub issues, comments, labels, PRs
```

Boundary rules that are load-bearing rather than incidental:

- **`gh.js` is the only process-spawning path to GitHub.** User text is never a command, flag or
  shell string. This is what lets the backend accept arbitrary issue text safely.
- **`app.js` exposes a fixed operation set.** The browser cannot choose an endpoint, command or
  repository. `--repo` is chosen at launch.
- **No persistence.** Session state lives in memory; restarting requires reconnecting.
  Disconnecting ends the local session but never logs the maintainer out of `gh`.
- **Committed build output.** `dist/client/` and `server/build-id.generated.js` are committed so
  the `npx` one-command launch serves reviewed assets with no build step and no git metadata at
  runtime.

State ownership: GitHub owns all work records; the server owns only its session; the client
derives presentation from records and never repairs metadata silently.

## Behavior contracts

The durable observable contracts, verified by the test suite:

| Contract | Home | Verified by |
| --- | --- | --- |
| Status and reported-summary derivation from labels, state and `## YOLO status` comments | [specs/status-presentation.md](specs/status-presentation.md) | `test/status.test.ts` |
| Issue/comment round-trip, write ambiguity, endpoint scope | `server/github.js`, `server/app.js` | `test/github-client.test.ts`, `test/app-api.test.ts` |
| Process boundary and argument isolation | `server/gh.js` | `test/gh-process.test.ts` |
| Launcher prerequisites, auth reuse, port fallback | `server/cli.js`, `server/launch.js` | `test/launcher.test.ts` |
| Untrusted Markdown safety | `src/client/components/Markdown.tsx` | `test/markdown.test.tsx` |
| Draft preservation across panel/refresh/reload | `src/client/drafts.ts` | `test/drafts.test.ts` |

The app also presents the shared YOLO request-to-result vocabulary. Where a target provides that
interface, its behavior is contractual too; it is in scope for this repository because the app
*is* the interface. Its observed gaps are listed under Decisions and limits.

## Verification and delivery

- **Checks (proportionate, existing):** `npm test` (vitest — 64 deterministic, network-free
  tests), `npx tsc --noEmit`, and `npm run build`. These are deterministic and reproducible.
- **Evidence trail:** [docs/verification.md](../../docs/verification.md) records the commands,
  results, tested revision and open gaps, including live GitHub round-trips.
- **Delivery route:** one-command `npx` install of a tagged revision
  (`github:normzhou/yolo-blank-canvas#v0.1.0`). The tag currently points at an assets-only
  commit following the tagged source, and both build-ID files record the built source revision —
  a deliberate ordering that must stay legible to users.
- **Delivered-version observation:** `GET /api/version` reports `serverBuild`/`clientBuild`;
  the client footer shows the revision it was built from and offers a user-initiated reload when
  the server advertises a different client build.
- **CI:** there is **no GitHub Actions workflow** in this repository today, so L1 evidence is
  harness-run and cited from the verification record. Adding a real workflow (test + type-check
  on push/PR) is a maintainer decision recorded as pending; a placeholder job must not be added.

## Decisions and limits

- **One process, no build step at launch.** Committed assets trade release friction for a
  one-command install that always runs reviewed code.
- **`gh` is a hard dependency**, including the CLI's own login flow, which is reused rather than
  reimplemented. This keeps tokens inside `gh` at the cost of depending on CLI behaviour.
- **Loopback-only.** Remote or multi-user deployment is out of scope until the maintainer decides
  otherwise; the security boundary was designed for the single-user case.
- **Pagination is implemented but unexercised live** — the repository has too few issues to
  exercise multi-page loads. See the gaps in `docs/verification.md`.
- **First-login, missing-`gh`, browser-open and mid-session auth-loss paths are unit tested, not
  observed live.** They are known verification limits, not defects.
- **The app derives status from labels but does not write labels.** It creates ordinary issues and
  comments only. Agent-side label management belongs to the workflow, not the UI.
