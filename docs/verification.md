# Verification record — yolo-blank-canvas

Tested revision: see "Tested revision" below.
Environment: macOS (darwin), Node v24.20.0, npm 11.19.0, GitHub CLI installed and authenticated as `normzhou`.
Target repository for live checks: `normzhou/yolo-blank-canvas` (the app's own repository).

## Deterministic tests (`npm test`)

```
 ✓ test/status.test.ts (17 tests)          status/summary derivation from fixtures
 ✓ test/github-client.test.ts (8 tests)    target validation, argument isolation, PR exclusion, pagination
 ✓ test/gh-process.test.ts (4 tests)       real process boundary against a stand-in `gh` executable
 ✓ test/app-api.test.ts (13 tests)         session, cross-site, host, identity, write-ambiguity, endpoint scope
 ✓ test/launcher.test.ts (12 tests)        gh missing, first login, cancellation, noninteractive, port fallback
 ✓ test/markdown.test.tsx (5 tests)        untrusted Markdown cannot execute; links stay safe
 ✓ test/drafts.test.ts (5 tests)           draft preservation and clearing only after confirmation
 ✓ test/list-refresh.test.ts (5 tests)     background refresh keeps rows; filter changes clear
 ✓ test/list-reconciliation.test.ts (8 tests)  created-issue reconciliation against the list
 ✓ test/tetris.test.ts (19 tests)          Tetris pieces, collision, line clear, scoring, game over, tetris count
 ✓ test/tetris-music.test.ts (11 tests)    playlist length, second strain, shuffle, pitch mapping, timeline planning
 ✓ test/tetris-backgrounds.test.ts (4 tests)  scene grids, palettes, four-line cycle helper

 Test Files  12 passed (12)
      Tests  111 passed (111)
```

Also run: `npx tsc --noEmit` (clean), `npm run build` (clean). Run at the #58 improvements source revision; not yet a released version, so the release-level sections below still describe `v0.1.1`/`v0.1.2`.

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

## Unverified / gaps

- **First-login path was not exercised end-to-end**: this machine already had an authenticated `gh`, so the interactive `gh auth login --web` branch is covered by unit tests (spawn arguments, single invocation, cancellation, and the noninteractive print-the-command path) but was not run against a real browser authorization.
- **`gh` missing path** is unit tested with a failing runner; it was not observed on a machine without the CLI.
- **The `--repo` flag targeting a second repository** was not exercised live; repository access checking was verified only for `normzhou/yolo-blank-canvas`.
- **Pagination beyond one page** was verified only with fixtures (`hasMore`, page parameters); the live repository has too few issues to exercise multi-page loads.
- **Browser-open behaviour** (`open`, `xdg-open`, `start`) was not observed live; the one-command check used `--no-open`. The launcher prints the URL regardless, so opening is a best-effort convenience.
- **Lost authentication during a running session** was verified through the API surface and unit tests (explicit `auth_required` state with the login command and Retry connection), not by revoking real credentials mid-session.
- **The Tetris view was not exercised in a live browser.** Its rules and state transitions are covered by `test/tetris.test.ts`, but keyboard handling (arrow/space/Escape), gravity timing and rendering were not observed in a browser session against a running build.
  **Resolved 2026-10-06:** the maintainer played the merged `main` in a live browser and confirmed it works; see the Tetris live check above. The deterministic tests remain the regression guard.
- **Tetris music was not observed in a live browser.** The pitch mapping, the full *Korobeiniki* (both strains), the playlist and its shuffle are covered by `test/tetris-music.test.ts`, but the Web Audio playback wrapper (context creation on the user gesture, per-tune scheduling across tune boundaries and the toggle) is untested and was not exercised live. The maintainer's listen check on `v0.1.2` confirmed the original single melody was audible (see #50), and the four-tune playlist was received (#58); the longer six-tune playlist and the "now playing" display await the same check.
- **The pixel-art backdrop was not observed in a live browser.** The scene data and the four-line cycle are covered by `test/tetris-backgrounds.test.ts` and the `tetrisCount` cases in `test/tetris.test.ts`, but the SVG rendering, the crossfade transition and the readability of the board over each scene were not observed in a browser session against a running build. The four-scene set was received (#58); the two new scenes and the crossfade await the same check.

## Fuller tunes and a backdrop crossfade (issue #58)

Source revision committed with the #58 improvements; deterministic tests only. Each tune is now a sectioned arrangement: *Korobeiniki* is A–B–A, *Greensleeves* verse–second–verse, *Ode to Joy* and *Mountain King* add a second phrase, and two more public-domain melodies (*Kalinka*, *Scarborough Fair*) join the playlist. At the player's 2.2 beats/second each tune runs ~20–43s (playlist total ~173s, up from ~94s). The background set grew to six scenes, and the view now crossfades between them (new scene fades in, old fades out) and names the tune now playing. `test/tetris-music.test.ts` (11 cases) checks the second strain, the per-tune minimum length, playlist well-formedness and the shuffle; `test/tetris-backgrounds.test.ts` continues to validate every scene. The copyrighted original-game music and artwork were **declined** — see #58 for the recorded reasoning — so no third-party asset was added. Live browser playback/render of the crossfade remains unverified.

## Pixel-art backdrops (issue #55)

Source revision committed with the backdrop work (see the branch for #55); deterministic tests only. `BACKGROUNDS` ships four scenes (night sky, city, mountain, blocks) generated from in-repo pixel data, and the Tetris view cycles to the next scene when `tetrisCount` rises — i.e. on a four-line clear. `test/tetris-backgrounds.test.ts` (4 cases) checks distinct scene ids, rectangular grids with a complete palette, one resolvable colour per cell, and the wrap-around index; `test/tetris.test.ts` adds the four-line counter cases. Live browser rendering of the backdrops remains unverified — see the gap above.

## Music playlist (issue #54)

Source revision `819724d`, deterministic tests only. `KOROBEINIKI` is now the familiar strain followed by a second strain; `PLAYLIST` adds *Greensleeves*, *Ode to Joy* and *In the Hall of the Mountain King*, and `shuffledMelodies` orders them so the audio wrapper plays one after another without a back-to-back repeat. `test/tetris-music.test.ts` (10 cases) checks pitch mapping, positive note lengths, resolvable pitches, the second strain, playlist well-formedness and the shuffle permutation/determinism. Live browser playback of the playlist remains unverified — see the gap above. The changed assets were built from the same source (`dist/client/.build-id` and `server/build-id.generated.js` report `819724d…`).

## Tested revision

Source revision `26feaa6` ("Add chiptune music to the Tetris view"); release tag `v0.1.2` points at
the squash merge `878854e` (PR #51) that carries that source together with the assets built from it
(`dist/client/.build-id` and `server/build-id.generated.js` both report `26feaa6…`, and
`GET /api/version` on the installed release reports the same). The build ID identifies the source
revision the running assets were produced from.

History: `v0.1.1` (source `e39b750`, squash merge `0c8038f`) kept list rows visible across a
background refresh; `v0.1.0` followed the separate source/assets ordering described above.