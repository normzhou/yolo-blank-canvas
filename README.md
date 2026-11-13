# yolo-blank-canvas

A minimal local web app: a blank canvas with a **Requests** overlay for creating, discussing, and following GitHub issues in one configured repository. The app is a thin presentation of GitHub records — issues and comments live in GitHub, and nothing else is stored. A small first-party **canvas gallery** gives the canvas substance beyond the prompt; its first app is a **Tetris** game, added in response to [request #4](https://github.com/normzhou/yolo-blank-canvas/issues/4). Canvas apps are compiled into the client and addressed as places (`?app=tetris`); their local state is never written to GitHub. Inside an app, **Feedback** opens the request composer with the app named in the issue body.

Built to the [Blank Canvas UI build spec](https://github.com/normzhou/yolo-dev/blob/main/brainstorm/blank-canvas-ui-build-spec.md).

## Prerequisites

- **Node.js 20.10+** and npm (Node 24 LTS recommended)
- **[GitHub CLI](https://cli.github.com/)** (`gh`), authenticated for `github.com`

No checkout, build step, pasted token, client secret, or GitHub App registration is needed. GitHub CLI owns credentials; the app never reads, copies, or stores a token.

## Launch

```sh
npx --yes github:normzhou/yolo-blank-canvas#v0.22.0
```

Opens `http://localhost:4317` (falls back to the next free loopback port) and prints the URL if the browser does not open. Press Ctrl-C to stop.

Useful options:

```sh
npx --yes github:normzhou/yolo-blank-canvas#v0.22.0 --repo owner/name   # choose the target repository for this run
npx --yes github:normzhou/yolo-blank-canvas#v0.22.0 --port 5000        # choose a preferred port
npx --yes github:normzhou/yolo-blank-canvas#v0.22.0 --no-open          # do not open a browser
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

The centered slide-deck switcher flips between modular games (**Starlight Burst**, **Prism Stack**). On the home deck, you can press **←** / **→** or click the carousel indicator dots to flip slides with a directional slide transition, or click the card / press **Enter** / **Space** to launch the selected game. Pressing **Ctrl/⌘K** — or `~` as an alias when you are not typing — opens a keyboard navigation palette listing **Blank canvas** and every app; Escape closes it. Each app is a place: `?app=prism-stack` and `?app=starlight-burst` are linkable, and Requests composes over them (`?app=prism-stack&panel=7`). Opening the palette does not disturb the app underneath; leaving an app unmounts it and resets its local state.

When served as a static web app via the optional `cloudflare` hosting profile (`hosting/cloudflare/`, published live at [`https://demo.yolo-dev.ai`](https://demo.yolo-dev.ai) in #199), the home slide deck, **Starlight Burst**, and **Prism Stack** run in **Static Preview** mode (`normzhou/yolo-blank-canvas · static preview`), and opening **Requests** or **Feedback** opens the hosted YOLO feedback modal or points to GitHub Issues and the local `npx` launch command.

Inside an app, the **Feedback** action opens the composer directly with the app context at the top of the description; **Requests** still opens the list. A request composed over an app carries `App: <title> (?app=<id>)` in its body — visible, editable text, not an `app:<id>` label, screenshot, or attachment. `?app=prism-stack&panel=new` works as a cold link. New-request drafts are scoped by app and by the home canvas, so switching contexts never overwrites typed text, and a confirmed create starts the next feedback with a fresh context line.

### Prism Stack

Choose **Prism Stack** from the home deck, the **Canvas** palette, or `?app=prism-stack` to open a **9×18 crystal polyomino puzzle** (`@yolo-arcade/game-prism-stack`) as canvas content. Controls support keyboard (**←/→** or **A/D** move, **↑/W** rotates, **↓/S** soft-drops, **Space/F** hard-drops, **Escape** pauses), symmetric Local & Online 2-Player split-screen, and mobile/tablet touch (**◀**, **▼**, **▶**, **↻**, **⤓** buttons with auto-repeat, plus direct board gestures: drag horizontally to move, tap to rotate, flick down to hard-drop; #212). Seven chamfered jewel polyominoes (`bar`, `hookL`, `hookR`, `quad`, `stepR`, `crest`, `stepL`) use a custom `--prism-1..7` palette, vertical column guide rails + floor landing ticks indicate where the active prism will touch down, an inline **Upcoming** pill previews the next prism in the lane header, and 2-player matches send solid full-width **Hazard Lock Bars** shattered by any adjacent horizontal line clear (#352). A pixel-art backdrop crossfades to the next of six scenes each time four lines are cleared at once.

### Starlight Burst

Choose **Starlight Burst** from the home deck, the **Canvas** palette, or `?app=starlight-burst` (`@yolo-arcade/game-starlight-burst`, #181, #204, #212, #347, #349, #352) to open a 2-player (Local, Online symmetric split-screen, or Solo) celestial star-core matching battle:

- **Controls, mobile/tablet touch & cute companions:** **Player 1** uses **ASDF** (**A/D** to tilt left/right, **S** or **F** to launch); **Player 2** uses **Arrow keys** (**←/→** to tilt left/right, **↑** or **↓** to launch). On touchscreens and pointers (#212, #258), drag directly on the board to aim the starlight beam and release to launch; phone screens (`< 560px`) open in **1 Player** mode, while tablets/iPads and desktops support symmetric **2 Players** side-by-side. Each player is accompanied by a distinct Boy or Girl plush companion (**Fox** — Ren/Kiko, **Cat** — Yuzu/Mochi, **Dog** — Koro/Hana, or **Bunny** — Poko/Momo) channeling the **Celestial Starlight Sling** and **Orbital Focus Ring** with a glowing Star-Wand, cheering on bursts, sweating on **`HURRY UP!`**, celebrating with sparkles when winning, and crying teardrops when losing.
- **15 constellations & stepper:** Step through `Wave: Random` and **15 named constellation formations** (`Stage 1: Paired Blocks` through `Stage 15: Emperor's Citadel`) in the Pause Menu.
- **Star-core rules & scoring:** Matching 3+ same-color **Astral Star-Cores** (each carrying a distinct orbital ring and geometric sigil) bursts them for `10 × count`; unanchored star-cores cascade for an exponential bonus (**`20 × 2^(n - 1)`**, capped at **`1,310,720`** for 17+ dropped at once), plus a fast-clear sky bonus (`50,000` pts at `≤ 5s`).
- **2-Player Versus & HURRY UP! timer:** Bursting 4+ star-cores or dropping unanchored clusters sends rising attack star-cores into your opponent's bottom tray. Waiting more than 5 seconds triggers a **`HURRY UP!`** countdown before auto-launching at 10 seconds. All game state is local to the view and is lost when the view closes.

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
| `server/app.js` | Express app: session, identity, issue/comment endpoints, 2P netplay relay, static UI |
| `server/netplay.js` | ephemeral 2P online presence, open game invites, and real-time room event relay |
| `server/security.js` | loopback Host guard, same-origin/cross-site guard, security headers |
| `server/session.js` | in-memory opaque session; browser holds only an HttpOnly cookie |
| `src/shared/status.ts` | status and reported-summary derivation (shared, pure) |
| `src/shared/prismStack.ts` | Prism Stack 9×18 crystal polyomino rules, landing guide, and solid Hazard Lock Bars (shared, pure) |
| `src/shared/starlightBurst.ts` | Starlight Burst hex-grid, Fox/Cat/Dog/Bunny companions, and 2P versus rules (shared, pure) |
| `src/client/netplay.ts` | client 2P online coordinator (`/api/netplay` + `BroadcastChannel` zero-latency local bridge) |
| `src/shared/arcadeMusic.ts` | Selector, Prism Stack, and Starlight Burst track lists and shuffled playlists (shared, pure) |
| `src/shared/stageBackdrops.ts` | Stage backdrop scenes and the four-line cycle (shared, pure) |
| `src/client/audio/arcadeAudio.ts` | Web Audio playback of bundled tracks & synth SFX; reports the tune now playing |
| `e2e/` | Playwright specs: stubbed-GitHub deterministic run, read-only live run, per-step screenshots |
| `src/client/apps/registry.ts` | first-party canvas app registry (`id`, `title`, `element`) |
| `src/client/feedback.ts` | visible app-context line for feedback composed over an app |
| `src/client/requestTemplates.ts` | three-intent request templates, v2 draft shape, and Markdown body rendering |
| `src/client/components/CanvasPalette.tsx` | Ctrl/⌘K navigation palette |
| `src/client/views/PrismStackView.tsx` | the Prism Stack 9×18 canvas app |
| `src/client/views/StarlightBurstView.tsx` | the 2-player Starlight Burst canvas app |
| `src/client/` | React UI (canvas, panel, list/new/detail views, Markdown rendering) |
| `dist/client/` | committed build output, so the one-command launch needs no build |
| `public/audio/`, `public/backdrops/` | bundled CC0 music, countdown sprite, and stage backdrop art |

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