# yolo-blank-canvas

A minimal local web app: a blank canvas with a **Requests** overlay for creating, discussing, and following GitHub issues in one configured repository. The app is a thin presentation of GitHub records — issues and comments live in GitHub, and nothing else is stored. A small first-party **canvas gallery** gives the canvas substance beyond the prompt; its first app is a **Tetris** game, added in response to [request #4](https://github.com/normzhou/yolo-blank-canvas/issues/4). Canvas apps are compiled into the client and addressed as places (`?app=tetris`); their local state is never written to GitHub. Inside an app, **Feedback** opens the request composer with the app named in the issue body.

Built to the [Blank Canvas UI build spec](https://github.com/normzhou/yolo-dev/blob/main/brainstorm/blank-canvas-ui-build-spec.md).

## Prerequisites

- **Node.js 20.10+** and npm (Node 24 LTS recommended)
- **[GitHub CLI](https://cli.github.com/)** (`gh`), authenticated for `github.com`

No checkout, build step, pasted token, client secret, or GitHub App registration is needed. GitHub CLI owns credentials; the app never reads, copies, or stores a token.

## Launch

```sh
npx --yes github:normzhou/yolo-blank-canvas#v0.17.1
```

Opens `http://localhost:4317` (falls back to the next free loopback port) and prints the URL if the browser does not open. Press Ctrl-C to stop.

Useful options:

```sh
npx --yes github:normzhou/yolo-blank-canvas#v0.17.1 --repo owner/name   # choose the target repository for this run
npx --yes github:normzhou/yolo-blank-canvas#v0.17.1 --port 5000        # choose a preferred port
npx --yes github:normzhou/yolo-blank-canvas#v0.17.1 --no-open          # do not open a browser
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

The main stage centers on the **game slide deck** (`‹` **Tetris** **Puzzle Bobble** `›` in the unified top navigation bar and a two-column hero showcase card with live SVG board previews, specs, and keyboard controls), while the feedback prompt (*"What would you like to build or change?"*, **Start a request**, **Open requests**) stays tucked into the right side of the top bar (#187, #196) so the overlay stays out of the way until opened. Opening **Requests** or **Start a request** displays a centred modal overlay (full width on narrow screens) with three views:

- **List** — repository identity, Open/Closed/All filter, issue title/number/status/updated time, newest-updated first, Refresh and Load more.
- **New request** — three direct intent lenses at the top (**Share feedback**, **Build or change**, **Report a problem**) with a required title and shared primary answer, optional details, a generated-body preview (`yolo.feedback@1.0.0`, `yolo.feature@1.0.0`, `yolo.bug@1.0.0`), and a **Write freely instead** escape hatch; creates one ordinary issue with no labels, priorities, or assignees. Composed over an app, the generated body starts with the visible line `App: <title> (?app=<id>)`; the line is editable plain issue text, not a label.
- **Detail** — the issue, its readable status, the reported summary, the full discussion, and a reply box. Replies are GitHub comments, including on closed issues.

Escape closes the panel and focus returns to the control that opened it (the canvas primary action, the app header's **Feedback** control, or **Requests**). While the panel is open, records refresh about every 30 seconds (paused when the page is hidden); the footer shows the last successful refresh, the **Theme** preference (**Slate**, **Sand**, **Dusk**), and **Disconnect**, and content is marked stale if a refresh fails. Drafts survive opening/closing, refreshing, sign-in failures, and reload.

The centered slide-deck switcher in the top header flips directly between compiled apps (**Tetris**, **Puzzle Bobble**). On the home deck, stacked **Up next** / **Prev** preview cards peek out beneath the active hero card (#198); you can click a stacked preview card, press **←** / **→** to flip slides with a directional slide transition, or press **Enter** / **Space** to launch the selected game. Pressing **Ctrl/⌘K** — or `~` as an alias when you are not typing — opens a keyboard navigation palette listing **Blank canvas** and every app; Escape closes it. Each app is a place: `?app=tetris` is linkable, and Requests composes over it (`?app=tetris&panel=7`). Opening the palette does not disturb the app underneath; leaving an app unmounts it and resets its local state.

When served as a static web app via the optional `cloudflare` hosting profile (`hosting/cloudflare/`, published live at [`https://demo.yolo-dev.ai`](https://demo.yolo-dev.ai) in #199), the home slide deck, **Tetris**, and **Puzzle Bobble** run in **Static Preview** mode (`normzhou/yolo-blank-canvas · static preview`), and opening **Requests** or **Feedback** points to GitHub Issues and the local `npx` launch command.

Inside an app, the header's **Feedback** action opens the composer directly with the app context at the top of the description; **Requests** still opens the list. A request composed over an app carries `App: <title> (?app=<id>)` in its body — visible, editable text, not an `app:<id>` label, screenshot, or attachment. `?app=tetris&panel=new` works as a cold link. New-request drafts are scoped by app and by the home canvas, so switching contexts never overwrites typed text, and a confirmed create starts the next feedback with a fresh context line.

### Tetris

Choose **Tetris** from the canvas row, the **Canvas** palette, or `?app=tetris` to open a classic game (10×20 board, all seven tetrominoes) as canvas content. Controls support both keyboard (**←/→** move, **↑** rotates, **↓** soft-drops, **Space** hard-drops, **Escape** closes) and mobile/tablet touch (**← Left**, **Right →**, **↻ Rotate**, **↓ Soft**, **⤓ Drop** buttons with auto-repeat, plus direct board gestures: drag horizontally to move, tap to rotate, flick down to hard-drop; #212). Score, lines, level and the next piece are shown beside the board; gravity speeds up every ten lines. **Music** toggles a shuffled playlist of five bundled free chiptune tracks — CC0 music by SketchyLogic (*Map*, *Mars*, *Mercury*, *Venus*, *Boss*) — moving to the next without repeating one back to back; audio starts on the click, per browser autoplay policy. A pixel-art backdrop (sourced CC0 art bundled locally — no network fetch) crossfades to the next of six scenes each time four lines are cleared at once; the current scene and tune are named below the board. The board and score live only in the view — they are not GitHub records, are not written back, and are lost when the view closes. The game is generated from a request; the shell's **Feedback** action gives it a direct path back into Requests.

### Puzzle Bobble (Bust-A-Move)

Choose **Puzzle Bobble** from the canvas row, the **Canvas** palette, or `?app=puzzle-bobble` ([request #181](https://github.com/normzhou/yolo-blank-canvas/issues/181), [#183](https://github.com/normzhou/yolo-blank-canvas/issues/183), [#186](https://github.com/normzhou/yolo-blank-canvas/issues/186), [#204](https://github.com/normzhou/yolo-blank-canvas/issues/204), [#210](https://github.com/normzhou/yolo-blank-canvas/issues/210), [#212](https://github.com/normzhou/yolo-blank-canvas/issues/212)) to open a 2-player (or 1-player) arcade bubble-shooter battle modelled on the 1994 Taito / Neo-Geo cabinet:

- **Controls, mobile/tablet touch & cute characters:** **Player 1** uses **ASDF** (**A/D** to aim left/right, **S** or **F** to shoot); **Player 2** uses **Arrow keys** (**←/→** to aim left/right, **↑** or **↓** to shoot). On touchscreens and pointers (#212), drag directly on the board to aim the sight line and tap **FIRE** (or use the **◀ -0.5°** / **+0.5° ▶** buttons for fine-tap and hold-sweep aiming); phone screens (`< 768px`) automatically open in **1 Player** mode, while tablets/iPads and desktops (`≥ 768px`) support **2 Players** side-by-side with independent multi-touch per board. Each player can pick their cute mascot (**Dragon** — Bub/Bob, **Cat** — Mochi/Yuzu, **Dog** — Pochi/Koro, or **Bunny** — Usagi/Momo), which cranks the catapult wheel, cheers on combos, sweats on **`HURRY UP!`**, celebrates with a victory jump and sparkles when winning a round, and cries with falling teardrops when losing.
- **15 classic stages & level stepper:** Step through `Wave: Random` and **15 named classic arcade formations** (`Stage 1: Paired Blocks` through `Stage 15: Emperor's Citadel`) using the `‹` / `›` stage stepper; clearing a board or clicking **Next round** advances to the next stage automatically.
- **Arcade rules & scoring:** Popped groups of 3+ same-colour bubbles score `10 × count`; unanchored bubbles hanging below fall for an exponential avalanche bonus (**`20 × 2^(n - 1)`**: `1 = 20`, `2 = 40`, `3 = 80`, …, up to **`1,310,720`** for 17+ dropped at once), plus a fast-clear stage bonus (`50,000` pts at `≤ 5s`).
- **2-Player Versus stack & HURRY UP! timer:** Popping 4+ bubbles charges your attack stack (`popped - 3`, shown with Neo-Geo **yellow = 1** and **red = 5** warning orbs), and dropping hanging bubbles unleashes all dropped + stacked bubbles onto your opponent's playfield. The compressor ceiling drops faster as fewer colours remain on screen, and waiting more than 5 seconds triggers a **`HURRY UP!`** countdown before auto-firing at 10 seconds. Like Tetris, all game state is local to the view and is lost when the view closes.

### Status display

Status is text first; colour is decoration. The app only renders what GitHub records and never implies that something was scheduled or is available in this browser.

| Open managed-issue label | UI status |
| --- | --- |
| `yolo:state:queued` | Planned |
| `yolo:state:active` | In progress |
| `yolo:state:waiting` | Waiting |
| `yolo:state:deferred` | Postponed |

A managed issue (`yolo:work`) with a missing, duplicated, or orphaned state shows **Status needs reconciliation** with its raw labels. An open issue without managed labels is **Request open**. Closed issues show **Not planned**, **Duplicate**, **Completed (reported)** for completed managed work, **Closed** for a completed untagged conversation, or **Closed — reason unavailable**. Leftover state labels on a closed issue are shown as unreconciled.

A comment whose first heading is `## YOLO status` is shown as the **Reported summary** (most recently updated match; earlier ones stay in the discussion). When an issue has no `## YOLO status` comment, a comment whose first heading is `## YOLO request` is shown as **Request triage** (interpretation, disposition, and covering outcomes, with same-repository issue links opening inside the panel and no delivery-timing claims). Without either comment, the panel says *"No progress summary yet."* Timing is shown only when a `## YOLO status` summary states it; otherwise *"Delivery timing not yet estimated."* Unrelated labels are shown unchanged.

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
npm run e2e            # browser checks (Playwright, system Chrome): stubbed GitHub client, no writes
npm run e2e:live       # browser checks, read-only, against the real dev app (needs authenticated gh)
```

Layout:

| Path | Purpose |
| --- | --- |
| `server/cli.js` | launcher: prerequisites, CLI auth, port, browser |
| `server/launch.js` | `gh` presence/login/access checks, port fallback, browser open |
| `server/gh.js` | the only `gh api` call site; validates arguments, JSON on stdin, no shell |
| `server/github.js` | the four GitHub operations: list/get issues, list/create comments, create issue |
| `server/request-store.js` | the `RequestStore` port and `GitHubRequestStore` adapter |
| `server/app.js` | Express app: session, identity, issue/comment endpoints, static UI |
| `server/security.js` | loopback Host guard, same-origin/cross-site guard, security headers |
| `server/session.js` | in-memory opaque session; browser holds only an HttpOnly cookie |
| `src/shared/status.ts` | status and reported-summary derivation (shared, pure) |
| `src/shared/tetris.ts` | Tetris rules and board state (shared, pure; local to the view) |
| `src/shared/puzzleBobble.ts` | Puzzle Bobble (Bust-A-Move) hex-grid and 2P versus rules (shared, pure; local to the view) |
| `src/shared/tetrisMusic.ts` | Tetris track list and shuffled playlist (shared, pure) |
| `src/shared/tetrisBackgrounds.ts` | Tetris backdrop scenes and the four-line cycle (shared, pure) |
| `src/client/audio/tetrisMusic.ts` | HTMLAudio playback of bundled tracks; reports the tune now playing |
| `e2e/` | Playwright specs: stubbed-GitHub deterministic run, read-only live run, per-step screenshots |
| `src/client/apps/registry.ts` | first-party canvas app registry (`id`, `title`, `element`) |
| `src/client/feedback.ts` | visible app-context line for feedback composed over an app |
| `src/client/requestTemplates.ts` | three-intent request templates, v2 draft shape, and Markdown body rendering |
| `src/client/components/CanvasPalette.tsx` | Ctrl/⌘K navigation palette |
| `src/client/views/TetrisView.tsx` | the Tetris canvas app |
| `src/client/views/PuzzleBobbleView.tsx` | the 2-player Puzzle Bobble (Bust-A-Move) canvas app |
| `src/client/` | React UI (canvas, panel, list/new/detail views, Markdown rendering) |
| `dist/client/` | committed build output, so the one-command launch needs no build |
| `public/tetris/` | bundled CC0 music and backdrop art (copied into the build) |

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
See [docs/theme-recommendation.md](docs/theme-recommendation.md) for the palette and theming recommendation raised in [#110](https://github.com/normzhou/yolo-blank-canvas/issues/110).

## Governance

This repository is adopted under the YOLO Dev protocol at **L1 Assisted** (active; qualification `unverified`). Ordinary agent work starts from [AGENTS.md](AGENTS.md).

- [Charter](.yolo/governance/CHARTER.md) — purpose, audience, durable boundaries
- [Authority](.yolo/governance/AUTHORITY.md) — recognized maintainers, grant, reserved decisions
- [Architecture](.yolo/governance/ARCHITECTURE.md) — intended design and verification/delivery route
- [Status presentation spec](.yolo/governance/specs/status-presentation.md)
- [Adopted protocol](.yolo/protocol.md) and [adoption record](.yolo/adoption.json)

## License

MIT