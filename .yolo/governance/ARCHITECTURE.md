# blank canvas: Architecture

> Design record, co-owned with the maintainer under the [Charter](CHARTER.md) and
> [Authority](AUTHORITY.md). Describes the **current intended** design at baseline `520a81e`. The
> Charter deliberately does not fix product scope, so this document is expected to change as
> requests arrive; significant changes notify the maintainer.

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
- **Committed build output.** `dist/client/` and `server/build-id.generated.js` are committed so
  the `npx` one-command launch serves reviewed assets with no build step and no git metadata at
  runtime.

State ownership: GitHub owns all work records; the server owns only its session; the client
derives presentation from records and never repairs metadata silently.

## The canvas and requested content

The canvas starts empty: a prompt and one action — a request — and nothing else. Emptiness is the
starting condition, not a prohibition, and substance comes from Requests:

- The canvas carries no hidden project, board, document or view model; content originates as
  Requests and is added deliberately.
- Agent and user both get their content from the same GitHub records, so nothing on screen has a
  second source of truth.
- A request typed here and one typed directly into GitHub are indistinguishable to the workflow,
  because they are literally the same record.

Content a request calls for (for example a game) is presented as a view with a stated source of
truth. GitHub remains the source of truth for the request and its work. Any in-app state that is
not a GitHub record — such as a game's score — is explicitly local to the view, is never written
back or presented as a repository record, and is lost when the view closes. Adding persistent
content is an architecture and data-model change recorded here, not a quiet addition to a
component; the first such content is the Tetris view (#4).

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
| Tetris rules and board state (local to the view, not a GitHub record) | `src/shared/tetris.ts` | `test/tetris.test.ts` |
| Tetris melodies, playlist shuffle and pitch mapping | `src/shared/tetrisMusic.ts` | `test/tetris-music.test.ts` |

The app also presents the shared YOLO request-to-result vocabulary, and its behavior is
contractual where it is in scope. Its observed gaps are listed under Decisions and limits.

## Verification and delivery

- **Checks (existing):** `npm test` (vitest — deterministic, network-free tests),
  `npx tsc --noEmit`, `npm run build`. No network, no writes.
- **CI:** GitHub Actions runs `npm test` and `npx tsc --noEmit` on pull requests and pushes to
  `main` ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)); harness-run evidence is
  cited from [docs/verification.md](../../docs/verification.md).
- **Delivery route:** one-command `npx` install of a tagged revision
  (`github:normzhou/yolo-blank-canvas#v0.1.0`).
- **Versioning policy:** semantic versioning on the delivered artifact. A patch release may be cut
  by the agent after acceptance passes on the version users receive; a minor or major release, and
  any change to this policy, is a maintainer decision.
- **Delivered-version observation:** `GET /api/version` reports `serverBuild`/`clientBuild`; the
  client footer shows the revision it was built from and offers a user-initiated reload when the
  server advertises a different client build. Current tag `v0.1.0` points at an assets-only commit
  following the tagged source, and both build-ID files record the built source revision — a
  deliberate ordering that must stay legible to users.

## Decisions and limits

Present-day choices, revisitable by request rather than protected:

- **Local, loopback-only, single user.** Chosen because the credentials and session model are
  built for it. Remote or multi-user use is an access-model change that must preserve the
  credential and authority boundaries in the Charter; it is not currently supported.
- **Four GitHub operations, no arbitrary proxy.** A capability the journey does not need is not
  exposed. Widen only for an observed request.
- **`gh` is a hard dependency**, including the CLI's own login flow, which is reused rather than
  reimplemented.
- **GitHub only.** Deliberate for now; another forge would be a new integration, not a
  configuration option.
- **Agent-authored content is watermarked** `[yolo]` because commits and issues post as the
  maintainer's account; see [Authority](AUTHORITY.md#agent-identity-and-watermark).
- **Pagination is implemented but unexercised live** — too few issues to exercise multi-page
  loads.
- **First-login, missing-`gh`, browser-open and mid-session auth-loss paths are unit tested, not
  observed live.** Known verification limits, not defects.
- **The app derives status from labels but does not write labels.** It creates ordinary issues and
  comments only; agent-side label management belongs to the workflow, not the UI.
