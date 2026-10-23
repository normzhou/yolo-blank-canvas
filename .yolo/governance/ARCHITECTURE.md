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
server/request-store.js RequestStore port (list/get/create requests, list/create comments, identity/links); GitHubRequestStore adapter selected at launch
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
- **`app.js` exposes a fixed operation set through the `RequestStore` port.** Routes depend on the
  port (`server/request-store.js`), and `cli.js` injects `createGitHubRequestStore` at launch.
  GitHub remains the sole record backend today; the browser cannot choose an endpoint, command,
  repository or storage backend. `--repo` is chosen at launch.
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
component; the first such content is the Tetris view (#4), now reached through the canvas gallery.

The main canvas centers on the **game slide deck** (`src/client/App.tsx`, `src/client/apps/registry.ts`),
while the feedback prompt (**Start a request** / **Open requests**) and navigation controls
(**Feedback**, **Requests**) stay tucked into a compact, unobtrusive top HUD bar (#187, #196)
and the theme switcher lives in the **Requests** panel footer so the overlay stays out of the
way until opened. Each registry entry has an id, a title, a summary and one element, and the
shell owns navigation through the slide deck (`‹` / `›` and slide pills in the header, stacked
next/previous preview cards beneath the hero card, `ArrowLeft` / `ArrowRight` to flip and `Enter` /
`Space` to launch on the home deck, directional slide animations, and subtle ambient background
effects, #198) as well as the Ctrl/⌘K (`~`) palette.
`?app=<id>` is the app's location, and `?app=<id>&panel=<n>` composes the Requests overlay over it.
The registry is a compile-time list, not a plugin surface: there is no manifest, remote loading,
install step, iframe, third-party app, marketplace or per-app persistence. The Tetris entry (#4)
and the 2-player Puzzle Bobble / Bust-A-Move entry (#181) are compiled into the registry.

For optional static hosting at `demo.yolo-dev.ai` (#199), `hosting/cloudflare/` is instantiated
under the adopted `cloudflare` profile (`yolo-demo-app`), serving `../../dist/client` behind the
guarded Worker (`run_worker_first: true`, `APP_VERSION` set to the released semver tag rather than
`development`), and `hosting/yolo-identity/` instantiates the local shared-identity preview package
(`CLIENT_IDENTITY_ENABLED: "false"` by default). When `/api/session` returns the static Worker's `503
Backend configuration unavailable` response, the client enters `static_demo` mode: the home slide
deck, Tetris, and Puzzle Bobble run with no startup error banner (`normzhou/yolo-blank-canvas ·
static preview`), and opening **Requests** or **Feedback** displays a truthful static-preview
notice with a direct link to GitHub Issues and the local `npx` launch command. Contextual feedback capture is deliberately text-only: a request composed over an app
starts with `App: <title> (?app=<id>)` in its body, and new-request drafts are scoped by app. The
composer offers three direct intent lenses at the top of the form (**Share feedback**, **Build or
change**, **Report a problem**) with a shared primary answer, the adopted `v0.1.0-alpha.33` YOLO
Dev starter template markers (`yolo.feedback@1.0.0`, `yolo.feature@1.0.0`, `yolo.bug@1.0.0`, while
retaining backward compatibility with earlier `blankcanvas.*@1` markers and plain-text issues), a
generated-body preview and a freeform escape hatch (`src/client/requestTemplates.ts`,
`src/client/views/NewRequestView.tsx`). Entry points suggest an initial intent (**Feedback** in an
app → Share feedback; **Start a request** / **New request** → Build or change) while keeping all
three intents directly selectable without losing typed input (#172, #173, #174, #175). Native
GitHub Issue Forms (`.github/ISSUE_TEMPLATE/yolo.{feedback,feature,bug,question}@1.0.0.yml`) are
installed from the verified `v0.1.0-alpha.33` starter pack (#174). There is no app label,
attachment, element targeting, per-app content persistence or new API; richer in-app evidence (#170)
is a deferred request.

## Behavior contracts

The durable observable contracts, verified by the test suite:

| Contract | Home | Verified by |
| --- | --- | --- |
| Status, reported-summary and request-triage derivation from labels, state, `## YOLO status` and `## YOLO request` comments | [specs/status-presentation.md](specs/status-presentation.md) | `test/status.test.ts`, `e2e/summary-hierarchy.spec.ts` |
| Issue/comment round-trip, request-store seam, write ambiguity, endpoint scope | `server/request-store.js`, `server/github.js`, `server/app.js` | `test/request-store.test.ts`, `test/github-client.test.ts`, `test/app-api.test.ts` |
| Process boundary and argument isolation | `server/gh.js` | `test/gh-process.test.ts` |
| Launcher prerequisites, auth reuse, port fallback | `server/cli.js`, `server/launch.js` | `test/launcher.test.ts` |
| Untrusted Markdown safety and in-panel same-repo issue links | `src/client/components/Markdown.tsx` | `test/markdown.test.tsx`, `e2e/summary-hierarchy.spec.ts` |
| Draft preservation and v1→v2 migration across panel/refresh/reload | `src/client/drafts.ts` | `test/drafts.test.ts` |
| Guided three-intent request templates, body rendering, app-context feedback line and app-scoped drafts | `src/client/requestTemplates.ts`, `src/client/feedback.ts`, `src/client/drafts.ts`, `src/client/views/NewRequestView.tsx` | `test/request-templates.test.ts`, `test/feedback.test.ts`, `test/drafts.test.ts`, `e2e/app-feedback.spec.ts` |
| Canvas app registry and addressable `?app=` locations | `src/client/apps/registry.ts`, `src/client/route.ts` | `test/apps.test.ts`, `test/route.test.ts`, `e2e/canvas-gallery.spec.ts` |
| Tetris rules and board state (local to the view, not a GitHub record) | `src/shared/tetris.ts` | `test/tetris.test.ts` |
| Puzzle Bobble (Bust-A-Move) hex-grid, 2P versus rules, selectable cute characters and win/lose animations (local to the view, not a GitHub record) | `src/shared/puzzleBobble.ts`, `src/client/views/PuzzleBobbleView.tsx` | `test/puzzle-bobble.test.ts`, `e2e/puzzle-bobble.spec.ts` |
| Tetris track list and shuffled bundled-asset playlist | `src/shared/tetrisMusic.ts` | `test/tetris-music.test.ts` |
| Tetris backdrop scenes (bundled sourced art) and the four-line cycle | `src/shared/tetrisBackgrounds.ts` | `test/tetris-backgrounds.test.ts` |

The app also presents the shared YOLO request-to-result vocabulary, and its behavior is
contractual where it is in scope. Its observed gaps are listed under Decisions and limits.

## Verification and delivery

- **Checks (existing):** `npm test` (vitest — deterministic, network-free tests),
  `npx tsc --noEmit`, `npm run build`. No network, no writes.
- **Browser-driven checks (added for #71):** `npm run e2e` (Playwright against the real app with a
  stubbed GitHub client, deterministic fixtures, no repository writes) and `npm run e2e:live`
  (Playwright, read-only, against the real dev app with real `gh` credentials). Both run headless
  system Google Chrome and capture per-step screenshots for agent review. They are harness-run
  evidence cited in [docs/verification.md](../../docs/verification.md); they are not CI gates.
- **CI:** GitHub Actions runs `npm test` and `npx tsc --noEmit` on pull requests and pushes to
  `main` ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)); harness-run evidence is
  cited from [docs/verification.md](../../docs/verification.md).
- **Delivery route:** one-command `npx` install of a tagged revision
  (`github:normzhou/yolo-blank-canvas#<tag>`).
- **Versioning policy:** semantic versioning on the delivered artifact. **The agent cuts releases at
  any semver level — patch, minor or major — without seeking per-release approval**, on the condition
  that acceptance passes on the version users actually receive. Choosing the version and cutting it is
  ordinary work, not an escalation. This standing delegation was granted by the maintainer on
  2026-10-14 ("work and stop asking me for permission to release versions") and confirmed directly by
  the maintainer in an authenticated session on 2026-10-20 (issue #141); it is the identified
  human approval [CHARTER.md](CHARTER.md) durable constraint 5 requires for publishing. It does not
  extend to **deleting, unpublishing or otherwise withdrawing** a tag or release, or to **changing
  this policy**; those remain reserved to the maintainer. A release that fails acceptance is not cut.
- **Delivered-version observation:** `GET /api/version` reports `serverBuild`/`clientBuild`; the
  client footer shows the revision it was built from and offers a user-initiated reload when the
  server advertises a different client build. A release tag points at an assets-only commit
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
- **A `yolo:request` label does not change the derived status.** Under the adopted
  `request-outcome-v2` issue policy, an open request-only issue reads **Request open**, the same as
  an unlabelled one: intake classification is not evidence of review, admission or scheduling. When
  an issue has a `## YOLO request` triage comment and no `## YOLO status` work summary, the detail
  view surfaces it under **Request triage** (without reading or displaying delivery timing) and opens
  same-repository covering-outcome links inside the panel (#177).
- **First-login, missing-`gh`, browser-open and mid-session auth-loss paths are unit tested, not
  observed live.** Known verification limits, not defects.
- **The app derives status from labels but does not write labels.** It creates ordinary issues and
  comments only; agent-side label management belongs to the workflow, not the UI.
