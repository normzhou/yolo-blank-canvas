# Verification record — yolo-blank-canvas

Tested revision: see "Tested revision" below.
Environment: macOS (darwin), Node v24.20.0, npm 11.19.0, GitHub CLI installed and authenticated as `normzhou`.
Target repository for live checks: `normzhou/yolo-blank-canvas` (the app's own repository).

## Deterministic tests (`npm test`)

```
 ✓ test/status.test.ts (17 tests)          status/summary derivation from fixtures
 ✓ test/github-client.test.ts (8 tests)    target validation, argument isolation, PR exclusion, pagination
 ✓ test/gh-process.test.ts (4 tests)       real process boundary against a stand-in `gh` executable
 ✓ test/app-api.test.ts (14 tests)         session, cross-site, host, identity, write-ambiguity, endpoint scope, CSP media-src
 ✓ test/launcher.test.ts (12 tests)        gh missing, first login, cancellation, noninteractive, port fallback
 ✓ test/markdown.test.tsx (5 tests)        untrusted Markdown cannot execute; links stay safe
 ✓ test/drafts.test.ts (5 tests)           draft preservation and clearing only after confirmation
 ✓ test/list-refresh.test.ts (5 tests)     background refresh keeps rows; filter changes clear
 ✓ test/list-reconciliation.test.ts (8 tests)  created-issue reconciliation against the list
 ✓ test/tetris.test.ts (19 tests)          Tetris pieces, collision, line clear, scoring, game over, tetris count
 ✓ test/tetris-music.test.ts (4 tests)     bundled track list, shuffle permutation/determinism, bundled files exist
 ✓ test/tetris-backgrounds.test.ts (3 tests)  bundled scenes, four-line cycle helper, bundled files exist

 Test Files  12 passed (12)
      Tests  104 passed (104)
```

Also run: `npx tsc --noEmit` (clean), `npm run build` (clean). Last full pass at the v0.3.1
release (`80bf5f8`, on top of the #67 CSP fix `7ffb324`); see the per-issue sections below for
earlier results. Earlier counts are preserved in their sections; the playlist/backdrop tests
were rewritten for the sourced-assets change.

Fixture coverage required by the spec, all in `test/status.test.ts`: untagged open issue → **Request open**; all four managed states; missing state, duplicate states, and state without `yolo:work` → **Status needs reconciliation** with raw labels; closure reasons `not_planned` / `duplicate` / `completed`; **Completed (reported)** vs **Closed**; unknown reason → **Closed — reason unavailable**; leftover state labels on a closed issue; reported-summary detection rules, most-recent-match selection, and `No progress summary yet.` / `Delivery timing not yet estimated.` fallbacks. No fixture asserts scheduling or availability.

Tetris coverage (`test/tetris.test.ts`): 7-bag fairness, piece geometry across rotations, spawn centering, wall/floor/settled-cell collision, line clearing and the classic score table, level/speed scaling, wall stops, soft/hard drop, lock-and-spawn on gravity, game over when the next piece cannot spawn, and the `tetrisCount` that a four-line clear advances but a smaller clear does not. The game state is local to the view; no test writes to GitHub.

Music coverage (`test/tetris-music.test.ts`): equal-tempered pitch mapping, the melody's note shapes and lengths, and sequential timeline planning. The Web Audio playback wrapper is not covered by tests.

## Live integration (real GitHub records)

Run through the local backend at `http://localhost:4317` (`node server/cli.js --no-open`), which reused the existing `gh` login with no extra step.

| Step | Result |
| --- | --- |
| Launcher with existing login | Printed repository `normzhou/yolo-blank-canvas`, `signed in as: normzhou (via GitHub CLI)`, `http://localhost:4317` |
| `GET /api/version` | `{"serverBuild":"<sha>","clientBuild":"<sha>"}` — matches the build identity |
| Session bootstrap (no Connect step) | `{"authenticated":true,"identity":"normzhou","repo":"normzhou/yolo-blank-canvas"}` |
| Issue creation through the app | [#1](https://github.com/normzhou/yolo-blank-canvas/issues/1) created with only the entered title/body |
| Managed-state issue created | [#2](https://github.com/normzhou/yolo-blank-canvas/issues/2) + labels `yolo:work`, `yolo:state:active` |
| Conflicting-label issue created | [#3](https://github.com/normzhou/yolo-blank-canvas/issues/3) + `yolo:work`, `yolo:state:queued`, `yolo:state:waiting` |
| Reply through the app | [comment 5973676276](https://github.com/normzhou/yolo-blank-canvas/issues/1#issuecomment-5973676276) |
| Reply added outside the app | [comment 5973676365](https://github.com/normzhou/yolo-blank-canvas/issues/1#issuecomment-5973676365) appeared in the app's comment list on refresh |
| `## YOLO status` summary comment | [comment 5974369089](https://github.com/normzhou/yolo-blank-canvas/issues/2#issuecomment-5974369089) rendered as the Reported summary with its source link and PR link clickable |
| Reply on a closed issue | [#1 closed as completed](https://github.com/normzhou/yolo-blank-canvas/issues/1), then reply accepted: [comment 5973677292](https://github.com/normzhou/yolo-blank-canvas/issues/1#issuecomment-5973677292) |
| Cross-site mutation (`Origin: https://evil.example`, `Sec-Fetch-Site: cross-site`) | `403`, no issue created |
| Unauthenticated mutation without a session cookie | `401` |
| Request addressed to a non-loopback `Host` | `400` |
| UI served | `GET /` returned the built canvas; assets served from `dist/client` |

### Tetris live check (maintainer)

| Step | Result |
| --- | --- |
| Maintainer ran the merged `main` (`3896a2a`) from a checkout and played the game | Confirmed on 2026-10-06 that it plays correctly in a live browser: the board, keyboard controls and game flow all work. Acceptance for [#4](https://github.com/normzhou/yolo-blank-canvas/issues/4) is therefore verified on the delivered revision. |

## One-command install outside the checkout

Run from an empty directory (`/tmp/npx-check`, no source checkout present):

```
$ npx --yes github:normzhou/yolo-blank-canvas#v0.1.0 --no-open --port 4399
yolo-blank-canvas (3b507ee3d8560f3473add648f559dca9e73da408)
  repository: normzhou/yolo-blank-canvas
  signed in as: normzhou (via GitHub CLI)
  http://localhost:4399
  Open http://localhost:4399
  Press Ctrl-C to stop.
```

From that installed copy: `POST /api/session` returned the authenticated identity, `GET /api/issues?state=all` listed the real issues with their labels, and `GET /api/version` reported the release build identity. The command runs in the foreground until stopped; `--no-open` was used here only to keep the check headless, and the browser-open path was not observed (see gaps).

A later release, `v0.1.2`, was verified the same way from an empty directory (`/tmp/npx-check-v012`, no checkout):

```
$ npx --yes github:normzhou/yolo-blank-canvas#v0.1.2 --no-open --port 4401
yolo-blank-canvas (26feaa62ef978a4193fee87343f7a030c2e9fa63)
  repository: normzhou/yolo-blank-canvas
  signed in as: normzhou (via GitHub CLI)
  http://localhost:4401
  Open http://localhost:4401
  Press Ctrl-C to stop.
```

`GET /api/version` reported `26feaa6` for both `serverBuild` and `clientBuild`, and the served bundle contained the Tetris view and the music synth (`AudioContext`, `square`). Audible playback was not verified here (see gaps).

Browser-driven checks (headless Chrome against the running app):

- Canvas renders the prompt and Requests button; the session is established automatically.
- List shows `#3 … Status needs reconciliation` and `#2 … In progress` (live label mapping).
- Detail shows the reported summary, the full discussion, and the reply box; footer shows last refresh and `UI build: <sha>`.
- Escape closes the panel and focus returns to the Requests button.
- A draft typed into **New request** survived closing the panel and reopening it.
- Changing the served client build ID produced the banner **“App version changed — reload to use the version this server is running.”** with user-initiated Reload / Not now.
- No console errors during these runs.

## Just-created request and list reconciliation (issue #5)

Browser-driven against the real app (headless Chrome over CDP from a scratch profile; no new dependencies), with the list endpoint stubbed to drop the new issue for the first two reads to reproduce GitHub's lagging list replica deterministically.

| Step | Result |
| --- | --- |
| Create a request through **New request** | Issue confirmed by the API; detail view opens on it |
| Back to the list, list lagging | New request at the top, marked **Not listed yet**, with the note that the create succeeded and the list is catching up |
| Duplicate rows | None |
| After a later re-read | Row stops being marked and stays present exactly once |
| Bounded retries | List re-read on 5s/10s/… backoff; stops once confirmed or bounded out |
| Console errors | None |

Root cause measured directly: `POST /api/issues` created #12 and the immediate `GET /api/issues?state=open` returned `[5, 4]`, while `GET /api/issues/12` returned the issue at once; the list still lacked it after 20s. A second probe (#13) appeared in 2s, so the lag is intermittent rather than a wrong query. GitHub's list endpoint is served from a lagging replica.

Deterministic coverage of the same contract: `test/list-reconciliation.test.ts` (8 cases). Delivered revision `1f22d77`, assets built from `123c4c5`.

Also observed in the browser during this work, filed as [#22](https://github.com/normzhou/yolo-blank-canvas/issues/22): the list blanks briefly on each background refresh because the list effect clears items before every load.

## List refresh keeps the visible rows (issue #22)

Browser-driven against the real app (headless Chrome over CDP from a scratch profile; `puppeteer-core`
installed outside the checkout, so the project itself adds no dependency). The list endpoint was
intercepted and delayed by 3s so the response was observably in flight while the refresh happened.
The panel was opened, the list was scrolled to a known offset, and the visible rows, empty state and
scroll offset were sampled every 250ms for 5s.

| Step | Candidate `e39b750` (fix) | Baseline `d8875e0` (pre-fix) |
| --- | --- | --- |
| Rows before refresh | 2 | 2 |
| Minimum rows during a manual Refresh | 2 | 2 |
| Minimum rows during a background refresh | 2 | 0 — list blanked |
| Empty state rendered during refresh | no | no |
| Scroll offset before → after background refresh | 40 → 40 | 40 → 0 |
| Console errors | none | none |

The control run against the pre-fix revision fails the same checks, so the browser observation
distinguishes the bug from the fix rather than merely passing.

Delivered and re-verified after merge:

| Step | Result |
| --- | --- |
| Delivered revision | `0c8038f` (squash merge of PR #26); `GET /api/version` on it reports build `e39b750` |
| Acceptance re-run on the delivered revision | Same PASS table above (2 rows kept, scroll 40 → 40, no console errors) |
| Released artifact `npx --yes github:normzhou/yolo-blank-canvas#v0.1.1` | Serves build `e39b750`; the browser check passes against the installed copy |

Deterministic coverage of the same contract: `test/list-refresh.test.ts` (5 cases).

## Cleanup

Integration issues [#1](https://github.com/normzhou/yolo-blank-canvas/issues/1), [#2](https://github.com/normzhou/yolo-blank-canvas/issues/2), and [#3](https://github.com/normzhou/yolo-blank-canvas/issues/3) were closed after the checks; their comments remain as the evidence trail. The deliberate leftover `yolo:state:*` labels on [#2](https://github.com/normzhou/yolo-blank-canvas/issues/2)/[#3](https://github.com/normzhou/yolo-blank-canvas/issues/3) were later removed so the repository itself conforms to the managed-state contract (a closed issue carries no state label), and a status summary was recorded on #3. GitHub CLI credentials were untouched by the app throughout (verified by `gh api user` after the session ended).

## E2E visual checks (issue #71)

Two Playwright runs complement the deterministic vitest layer; both use system Google
Chrome (`channel: 'chrome'`), headless, and capture a full-page screenshot per step into
`e2e/artifacts/` (git-ignored). Representative images are committed under
`e2e/screenshots/`.

- `npm run e2e` — deterministic: `e2e/stub-server.ts` launches the real `createApp` with a
  stubbed GitHub client on a random port (same seam as `test/app-api.test.ts`). Covers the
  canvas empty state, the Requests panel (issue-state variants), refresh, the detail view's
  rendered `## YOLO status` summary, the new-request flow incl. draft persistence, the
  version-changed banner, session/auth-retry surfaces, and Tetris (board render, Music
  toggle, stable track label, scene cycle via a four-line clear). 6 specs passing.
- `npm run e2e:live` — read-only against the real dev app (`server/cli.js --no-open`, random
  port, real `gh` credentials, no GitHub writes): canvas with real identity, real issue list
  and detail, forced mid-session auth loss, and a second run targeting `--repo
  normzhou/yolo-dev`. 4 specs passing, no console errors, no CSP media violations.

The four-line-clear scene cycle is exercised through the `yolo:tetris:four-line-clear`
window event handled by `TetrisView` (a real clear advances `tetrisCount` the same way);
pixel-perfect gameplay scripting is not attempted. Live gaps closed by these runs:
**multi-repository `--repo` access** and **mid-session auth-loss surfaces** (now observed
read-only); **Tetris music/backdrop in a live browser** is additionally covered by the
deterministic browser run (track label stays stable across 3s, scene label advances).

## Unverified / gaps

- **First-login path was not exercised end-to-end**: this machine already had an authenticated `gh`, so the interactive `gh auth login --web` branch is covered by unit tests (spawn arguments, single invocation, cancellation, and the noninteractive print-the-command path) but was not run against a real browser authorization.
- **`gh` missing path** is unit tested with a failing runner; it was not observed on a machine without the CLI.
- **Pagination beyond one page** was verified only with fixtures (`hasMore`, page parameters); the live repository has too few issues to exercise multi-page loads.
- **Browser-open behaviour** (`open`, `xdg-open`, `start`) was not observed live; the one-command check used `--no-open`. The launcher prints the URL regardless, so opening is a best-effort convenience.
- **Lost authentication during a running session** is unit tested through the API surface (`auth_required` state with the login command and Retry connection) and was forced read-only in the live E2E (`e2e/live.spec.ts`), but was not observed by revoking real credentials mid-session.
- **The Tetris view was not exercised in a live browser.** Its rules and state transitions are covered by `test/tetris.test.ts`, but keyboard handling (arrow/space/Escape), gravity timing and rendering were not observed in a browser session against a running build.
  **Resolved 2026-10-06:** the maintainer played the merged `main` in a live browser and confirmed it works; see the Tetris live check above. Keyboard hard-drop (space), Pause, New game, Close and Escape are additionally driven in the deterministic E2E (`e2e/deterministic.spec.ts`).
- **Tetris music was not observed in a live browser.** As of #63 the audio is bundled CC0 tracks played through a single `HTMLAudioElement`; the playlist shuffle and track list are covered by `test/tetris-music.test.ts`, and the Music toggle + stable track label are exercised in the deterministic E2E. Audible playback was verified on the delivered `v0.3.1` artifact (see issue #67 below).
- **The pixel-art backdrop was not observed in a live browser.** As of #63 the scenes are bundled sourced images; ids/files and the four-line cycle are covered by `test/tetris-backgrounds.test.ts` and the `tetrisCount` cases in `test/tetris.test.ts`, and the scene label + crossfade layers are exercised in the deterministic E2E. Readability over every scene in a live browser remains a human check.

## Fuller tunes and a backdrop crossfade (issue #58)

Source revision committed with the #58 improvements; deterministic tests only. Each tune is now a sectioned arrangement: *Korobeiniki* is A–B–A, *Greensleeves* verse–second–verse, *Ode to Joy* and *Mountain King* add a second phrase, and two more public-domain melodies (*Kalinka*, *Scarborough Fair*) join the playlist. At the player's 2.2 beats/second each tune runs ~20–43s (playlist total ~173s, up from ~94s). The background set grew to six scenes, and the view now crossfades between them (new scene fades in, old fades out) and names the tune now playing. `test/tetris-music.test.ts` (11 cases) checks the second strain, the per-tune minimum length, playlist well-formedness and the shuffle; `test/tetris-backgrounds.test.ts` continues to validate every scene. The copyrighted original-game music and artwork were **declined** — see #58 for the recorded reasoning — so no third-party asset was added. Live browser playback/render of the crossfade remains unverified.

## Pixel-art backdrops (issue #55)

Source revision committed with the backdrop work (see the branch for #55); deterministic tests only. `BACKGROUNDS` ships four scenes (night sky, city, mountain, blocks) generated from in-repo pixel data, and the Tetris view cycles to the next scene when `tetrisCount` rises — i.e. on a four-line clear. `test/tetris-backgrounds.test.ts` (4 cases) checks distinct scene ids, rectangular grids with a complete palette, one resolvable colour per cell, and the wrap-around index; `test/tetris.test.ts` adds the four-line counter cases. Live browser rendering of the backdrops remains unverified — see the gap above.

## Music playlist (issue #54)

Source revision `819724d`, deterministic tests only. `KOROBEINIKI` is now the familiar strain followed by a second strain; `PLAYLIST` adds *Greensleeves*, *Ode to Joy* and *In the Hall of the Mountain King*, and `shuffledMelodies` orders them so the audio wrapper plays one after another without a back-to-back repeat. `test/tetris-music.test.ts` (10 cases) checks pitch mapping, positive note lengths, resolvable pitches, the second strain, playlist well-formedness and the shuffle permutation/determinism. Live browser playback of the playlist remains unverified — see the gap above. The changed assets were built from the same source (`dist/client/.build-id` and `server/build-id.generated.js` report `819724d…`).

## Sourced assets for the Tetris music and backdrops (issue #63)

Dedicated branch `yolo/asset-replacement`; deterministic checks only. The in-repo synth melodies and generated pixel grids were replaced with bundled sourced assets: five CC0 chiptune tracks (SketchyLogic, "NES Shooter Music" pack, converted WAV→AAC `.m4a`) and six CC0 backdrops (LuminousDragonGames night sky, FisherG city, Emcee Flesher desert, Quantiset Mars, Scribe space, biodegradableguy castle GIF). Provenance and licenses: `docs/assets.md`. `src/shared/tetrisMusic.ts` now lists tracks and `shuffledTracks`; `src/client/audio/tetrisMusic.ts` plays them with a single `HTMLAudioElement` (no Web Audio synth). `src/shared/tetrisBackgrounds.ts` lists backdrops; the view `<img>` crossfade replaces the SVG grid. `test/tetris-music.test.ts` (4 cases) and `test/tetris-backgrounds.test.ts` (3 cases) now validate playlist/backdrop well-formedness, shuffle determinism and that the bundled files exist under `public/`. `npm test` (103 passed), `npx tsc --noEmit` and `npm run build` all pass; the build copies `public/tetris/` into `dist/client/tetris/`. Live browser playback of these assets was verified on the delivered `v0.3.1` artifact (see issue #67 below); before that the gap was real — the CSP blocked every audio load (#67).

## Tetris music playback blocked by CSP (issue #67)

Root cause: `server/security.js` set `Content-Security-Policy` to `default-src 'none'` with no
`media-src` directive, so every `tetris/*.m4a` load was blocked. The Tetris player's
`error -> next track` path then spun through the queue — the on-screen "Music: …" label
scrolled many times per second with no audio. Fix (PR #68, released in `v0.3.1`): add
`media-src 'self'` and a regression test asserting the CSP contains it. Verified on the
delivered artifact: `npx --yes github:normzhou/yolo-blank-canvas#v0.3.1 --no-open` served
`GET /api/version` with `serverBuild`/`clientBuild` `7ffb324`; headless Chrome (Play Tetris →
Music on) showed no CSP media violations, the track loaded over HTTP 206, and the one-playing-
track label stayed stable across 6s. This closes the earlier "live browser playback of the new
assets remains unverified" gap from issue #63.

## Tested revision

Release tag `v0.3.1` points at the squash merge `80bf5f8` (release bump) on top of
`7ffb324` (the #68 CSP fix). Assets were built from source `7ffb324` (the fix commit;
`dist/client/.build-id` and `server/build-id.generated.js` report `7ffb324…`). The native
version at the tagged revision (`package.json`) is `0.3.1`. The published artifact was verified
outside the checkout as described in the issue #67 section and
[`.yolo/reports/releases-observed-2026-10-07.json`](../.yolo/reports/releases-observed-2026-10-07.json).

History: `v0.3.0` (`dbfdacf`, assets from `350852b`) shipped the sourced CC0 music/backdrops;
`v0.2.0` (`eaf7cc2`, assets from `828b21d`) added the longer tunes, more backdrops and the
crossfade; `v0.1.2` (source `26feaa6`, squash merge `878854e`) added Tetris and the first
chiptune melody; `v0.1.1` (source `e39b750`, squash merge `0c8038f`) kept list rows visible
across a background refresh; `v0.1.0` followed the separate source/assets ordering described
above.