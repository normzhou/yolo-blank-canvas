# yolo-blank-canvas

A minimal local web app: a blank canvas with a **Requests** overlay for creating, discussing, and following GitHub issues in one configured repository. The app is a thin presentation of GitHub records — issues and comments live in GitHub, and nothing else is stored. A **Tetris** game, added in response to [request #4](https://github.com/normzhou/yolo-blank-canvas/issues/4), is the first canvas content beyond the prompt; its board and score are local to the view and are never written to GitHub.

Built to the [Blank Canvas UI build spec](https://github.com/normzhou/yolo-dev/blob/main/brainstorm/blank-canvas-ui-build-spec.md).

## Prerequisites

- **Node.js 20.10+** and npm (Node 24 LTS recommended)
- **[GitHub CLI](https://cli.github.com/)** (`gh`), authenticated for `github.com`

No checkout, build step, pasted token, client secret, or GitHub App registration is needed. GitHub CLI owns credentials; the app never reads, copies, or stores a token.

## Launch

```sh
npx --yes github:normzhou/yolo-blank-canvas#v0.1.0
```

Opens `http://localhost:4317` (falls back to the next free loopback port) and prints the URL if the browser does not open. Press Ctrl-C to stop.

Useful options:

```sh
npx --yes github:normzhou/yolo-blank-canvas#v0.1.0 --repo owner/name   # choose the target repository for this run
npx --yes github:normzhou/yolo-blank-canvas#v0.1.0 --port 5000        # choose a preferred port
npx --yes github:normzhou/yolo-blank-canvas#v0.1.0 --no-open          # do not open a browser
```

Default repository: this app's own repository (`normzhou/yolo-blank-canvas`).

### Launch situations

| Situation | What happens |
| --- | --- |
| `gh` installed and authenticated | The effective account is reused automatically; the app opens ready to use, showing account and repository. No extra Connect step. |
| `gh` installed, not authenticated | The launcher runs `gh auth login --hostname github.com --web --skip-ssh-key` with your terminal attached, then continues. Cancelling prints the command to retry. |
| `gh` missing | Explains the missing prerequisite with install commands; rerun the same launch command afterwards. |
| Noninteractive launch without authentication | Prints the exact login command and exits instead of hanging. |
| Auth lost while the app is running | Requests report an explicit state with the login command and a **Retry connection** action; typed drafts are preserved. |

## Using it

The canvas asks *"What would you like to build or change?"*. **Requests** opens a right-side overlay (full width on narrow screens) with three views:

- **List** — repository identity, Open/Closed/All filter, issue title/number/status/updated time, newest-updated first, Refresh and Load more.
- **New request** — required title and description; creates one ordinary issue with no labels, priorities, or assignees.
- **Detail** — the issue, its readable status, the reported summary, the full discussion, and a reply box. Replies are GitHub comments, including on closed issues.

Escape closes the panel and focus returns to the Requests button. While the panel is open, records refresh about every 30 seconds (paused when the page is hidden); the footer shows the last successful refresh, and content is marked stale if a refresh fails. Drafts survive opening/closing, refreshing, sign-in failures, and reload.

### Tetris

**Play Tetris** in the header opens a classic game (10×20 board, all seven tetrominoes) as canvas content. Controls are keyboard-only: **←/→** move, **↑** rotates, **↓** soft-drops, **Space** hard-drops, **Escape** closes. Score, lines, level and the next piece are shown beside the board; gravity speeds up every ten lines. **Music** toggles an old-school square-wave synth that plays a shuffled playlist of public-domain tunes — the full traditional *Korobeiniki* (both strains of the folk song, not the original game's copyrighted arrangement), *Greensleeves*, Beethoven's *Ode to Joy* and Grieg's *In the Hall of the Mountain King* — moving to the next tune without repeating one back to back; audio starts on the click, per browser autoplay policy. A pixel-art backdrop (generated locally from in-repo pixel data — no network fetch) cycles to the next scene each time four lines are cleared at once; the current scene is named below the board. The board and score live only in the view — they are not GitHub records, are not written back, and are lost when the view closes. The game is generated from a request and does not change the Requests workflow.

### Status display

Status is text first; colour is decoration. The app only renders what GitHub records and never implies that something was scheduled or is available in this browser.

| Open managed-issue label | UI status |
| --- | --- |
| `yolo:state:queued` | Planned |
| `yolo:state:active` | In progress |
| `yolo:state:waiting` | Waiting |
| `yolo:state:deferred` | Postponed |

A managed issue (`yolo:work`) with a missing, duplicated, or orphaned state shows **Status needs reconciliation** with its raw labels. An open issue without managed labels is **Request open**. Closed issues show **Not planned**, **Duplicate**, **Completed (reported)** for completed managed work, **Closed** for a completed untagged conversation, or **Closed — reason unavailable**. Leftover state labels on a closed issue are shown as unreconciled.

A comment whose first heading is `## YOLO status` is shown as the **Reported summary** (most recently updated match; earlier ones stay in the discussion). Without one, the panel says *"No progress summary yet."* Timing is shown only when the summary states it; otherwise *"Delivery timing not yet estimated."* Unrelated labels are shown unchanged.

### Build identity

`/api/version` reports the non-secret `serverBuild` and `clientBuild`; the panel footer shows the revision the client UI was built from, and the canvas offers **App version changed — reload** if the server advertises a different client build. Reload is user-initiated and preserves drafts. The build ID is written at build time (see below), so an `npx` install needs no git metadata.

## Development

```sh
git clone https://github.com/normzhou/yolo-blank-canvas.git
cd yolo-blank-canvas
npm install
npm run build          # build the client into dist/client and record the build ID
npm start              # launch (add -- --repo owner/name to target another repository)
npm test               # deterministic tests (vitest), no network, no writes
npx tsc --noEmit       # type check
```

Layout:

| Path | Purpose |
| --- | --- |
| `server/cli.js` | launcher: prerequisites, CLI auth, port, browser |
| `server/launch.js` | `gh` presence/login/access checks, port fallback, browser open |
| `server/gh.js` | the only `gh api` call site; validates arguments, JSON on stdin, no shell |
| `server/github.js` | the four operations: list/get issues, list/create comments, create issue |
| `server/app.js` | Express app: session, identity, issue/comment endpoints, static UI |
| `server/security.js` | loopback Host guard, same-origin/cross-site guard, security headers |
| `server/session.js` | in-memory opaque session; browser holds only an HttpOnly cookie |
| `src/shared/status.ts` | status and reported-summary derivation (shared, pure) |
| `src/shared/tetris.ts` | Tetris rules and board state (shared, pure; local to the view) |
| `src/shared/tetrisMusic.ts` | Tetris melodies, playlist shuffle and pitch mapping (shared, pure) |
| `src/shared/tetrisBackgrounds.ts` | Pixel-art backdrop scenes and the four-line cycle (shared, pure) |
| `src/client/audio/tetrisMusic.ts` | Web Audio square-wave playback for the playlist |
| `src/client/views/TetrisView.tsx` | the Tetris canvas view |
| `src/client/` | React UI (canvas, panel, list/new/detail views, Markdown rendering) |
| `dist/client/` | committed build output, so the one-command launch needs no build |

### Build identity

`npm run build` writes the current commit SHA (or `YOLO_BUILD_ID` when set) to `dist/client/.build-id` and `server/build-id.generated.js`. Both are committed so an installed release can report a real revision. Unknown is displayed as `Unknown`.

```sh
YOLO_BUILD_ID=$(git rev-parse HEAD) npm run build
```

## Configuration

There is no app configuration file, client ID, or secret. Options are launch flags only (`--repo`, `--port`, `--no-open`). The only environment variable read is `YOLO_GH_BIN`, an override for the `gh` executable path (useful for tests). The server binds loopback only.

## Security notes

- GitHub credentials stay inside `gh`. The backend shells out with fixed-host, repository-scoped argument arrays; user text is passed as JSON on stdin, never as a command or flag.
- The API exposes only the operations this app needs — there is no arbitrary authenticated GitHub proxy, and the browser cannot choose an endpoint, command, or repository.
- The browser holds only an opaque HttpOnly, SameSite=Strict cookie. Sessions live in memory: restarting the app requires reconnecting, and Disconnect ends the local session without logging you out of `gh`.
- Requests must be addressed to loopback, mutations must be same-origin, and issue/comment Markdown is rendered without executing untrusted HTML.

## Verification record

See [docs/verification.md](docs/verification.md) for the commands run, results, tested revision, and open gaps.

## Governance

This repository is adopted under the YOLO Dev protocol at **L1 Assisted** (active; qualification `prepared`). Ordinary agent work starts from [AGENTS.md](AGENTS.md).

- [Charter](.yolo/governance/CHARTER.md) — purpose, audience, durable boundaries
- [Authority](.yolo/governance/AUTHORITY.md) — recognized maintainers, grant, reserved decisions
- [Architecture](.yolo/governance/ARCHITECTURE.md) — intended design and verification/delivery route
- [Status presentation spec](.yolo/governance/specs/status-presentation.md)
- [Adopted protocol](.yolo/protocol.md) and [adoption record](.yolo/adoption.json)

## License

MIT